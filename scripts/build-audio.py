#!/usr/bin/env python3
"""
Procedural audio builder for Underworld, Scenes 01 to 03.

Synthesises every ambience, music loop and SFX from scratch with numpy only,
writes temporary 16-bit WAVs, then encodes each one to
public/assets/audio/<name>.webm (Opus) and public/assets/audio/<name>.mp3 (LAME VBR).

Run:  python3 -I scripts/build-audio.py [name ...]

Techniques used:
  * RBJ biquads / one-poles, applied in the frequency domain as their exact
    complex response (a scipy-free lfilter equivalent).  For loops the response
    is applied circularly, which yields the periodic steady state, so filtered
    loops wrap seamlessly.
  * Swept filters via an interpolated bank of fixed biquads.
  * Synthetic multi-band exponentially-decaying noise impulse responses for
    reverb (decorrelated L/R), convolved via FFT (circular for loops).
  * Loops are built periodically: sustained oscillators are quantised to
    integer cycles per loop, LFOs have integer cycles, events wrap around the
    loop boundary, so head and tail join sample-accurately.
Deterministic: fixed seed per sound.
"""
import math
import os
import shutil
import subprocess
import sys
import tempfile
import time
import wave
import zlib

try:
    import numpy as np
except ImportError:  # `python3 -I` disables the user site; numpy may live there
    import site
    _p = site.getusersitepackages()
    if _p not in sys.path:
        sys.path.append(_p)
    import numpy as np

SR = 48000
SEED = 1931
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "assets", "audio")
FFMPEG = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
TAU = 2.0 * math.pi


# --------------------------------------------------------------------------
# basic helpers
# --------------------------------------------------------------------------
def secs(s):
    return int(round(s * SR))


def tt(n):
    return np.arange(n) / SR


def db(x):
    return 10.0 ** (x / 20.0)


def qf(f, T):
    """Quantise a frequency to an integer number of cycles over T seconds."""
    return max(1.0, round(f * T)) / T


def midi(m):
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
        "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def nf(name):
    """'D3' -> Hz"""
    pitch, octave = name[:-1], int(name[-1])
    return midi(12 * (octave + 1) + NOTE[pitch])


def next_fast(n):
    best = 1 << max(0, (n - 1).bit_length())
    f5 = 1
    while f5 < best:
        f35 = f5
        while f35 < best:
            f = f35
            while f < n:
                f *= 2
            best = min(best, f)
            f35 *= 3
        f5 *= 5
    return best


def rms(x):
    return float(np.sqrt(np.mean(np.square(x)) + 1e-30))


def unit(x):
    return x / (rms(x) + 1e-30)


# --------------------------------------------------------------------------
# filters (RBJ cookbook biquads, applied via exact frequency response)
# --------------------------------------------------------------------------
def _coeffs(spec):
    kind, f0 = spec[0], float(spec[1])
    Q = spec[2] if len(spec) > 2 else 0.7071
    g = spec[3] if len(spec) > 3 else 0.0
    f0 = min(max(f0, 1.0), 0.47 * SR)
    w0 = TAU * f0 / SR
    cw, sw = math.cos(w0), math.sin(w0)
    alpha = sw / (2.0 * Q)
    A = 10.0 ** (g / 40.0)
    if kind == "lp":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "hp":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "bp":
        b = [alpha, 0.0, -alpha]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "peak":
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]
        a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    elif kind in ("ls", "hs"):
        sa = math.sqrt(A)
        al = sw / 2 * math.sqrt(2.0)
        if kind == "ls":
            b = [A * ((A + 1) - (A - 1) * cw + 2 * sa * al), 2 * A * ((A - 1) - (A + 1) * cw),
                 A * ((A + 1) - (A - 1) * cw - 2 * sa * al)]
            a = [(A + 1) + (A - 1) * cw + 2 * sa * al, -2 * ((A - 1) + (A + 1) * cw),
                 (A + 1) + (A - 1) * cw - 2 * sa * al]
        else:
            b = [A * ((A + 1) + (A - 1) * cw + 2 * sa * al), -2 * A * ((A - 1) + (A + 1) * cw),
                 A * ((A + 1) + (A - 1) * cw - 2 * sa * al)]
            a = [(A + 1) - (A - 1) * cw + 2 * sa * al, 2 * ((A - 1) - (A + 1) * cw),
                 (A + 1) - (A - 1) * cw - 2 * sa * al]
    elif kind == "lp1":
        p = math.exp(-TAU * f0 / SR)
        b, a = [1 - p, 0.0, 0.0], [1.0, -p, 0.0]
    elif kind == "hp1":
        p = math.exp(-TAU * f0 / SR)
        b, a = [(1 + p) / 2, -(1 + p) / 2, 0.0], [1.0, -p, 0.0]
    else:
        raise ValueError(kind)
    a0 = a[0]
    return np.array(b) / a0, np.array(a) / a0


def response(specs, nfft):
    w = TAU * np.arange(nfft // 2 + 1) / nfft
    z1 = np.exp(-1j * w)
    z2 = z1 * z1
    H = np.ones_like(z1)
    for s in specs:
        b, a = _coeffs(s)
        H *= (b[0] + b[1] * z1 + b[2] * z2) / (a[0] + a[1] * z1 + a[2] * z2)
    return H


def filt(x, specs, circular=False, tail=1.0):
    """Apply a cascade of biquads. circular=True -> periodic steady state (loops)."""
    x = np.asarray(x, dtype=float)
    n = x.shape[-1]
    nfft = n if circular else next_fast(n + secs(tail))
    X = np.fft.rfft(x, nfft, axis=-1)
    return np.fft.irfft(X * response(specs, nfft), nfft, axis=-1)[..., :n]


def sweep(x, kind, fcurve, Q=0.7071, fmin=None, fmax=None, nb=28):
    """Time-varying filter: interpolate between a bank of fixed filters (mono)."""
    fmin = fmin or float(np.min(fcurve)) * 0.98
    fmax = fmax or float(np.max(fcurve)) * 1.02
    fs = np.geomspace(fmin, fmax, nb)
    bank = np.stack([filt(x, [(kind, f, Q)]) for f in fs])
    pos = np.interp(np.log(np.clip(fcurve, fmin, fmax)), np.log(fs), np.arange(nb))
    i0 = np.clip(np.floor(pos).astype(int), 0, nb - 2)
    fr = pos - i0
    idx = np.arange(x.shape[-1])
    return bank[i0, idx] * (1 - fr) + bank[i0 + 1, idx] * fr


def fconv(x, k, circular=False):
    """FFT convolution; output length == len(x)."""
    n = x.shape[-1]
    if circular:
        kk = np.zeros(k.shape[:-1] + (n,))
        m = min(n, k.shape[-1])
        kk[..., :m] = k[..., :m]
        return np.fft.irfft(np.fft.rfft(x, n, axis=-1) * np.fft.rfft(kk, n, axis=-1), n, axis=-1)
    nfft = next_fast(n + k.shape[-1])
    return np.fft.irfft(np.fft.rfft(x, nfft, axis=-1) * np.fft.rfft(k, nfft, axis=-1), nfft,
                        axis=-1)[..., :n]


# --------------------------------------------------------------------------
# sources
# --------------------------------------------------------------------------
def colored(rng, n, slope=-3.0, fmin=12.0):
    """Noise with a spectral slope in dB/octave (pink=-3, brown=-6). Periodic in n."""
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1.0 / SR)
    g = (np.maximum(f, fmin) / 1000.0) ** (slope / 6.0206)
    g[0] = 0.0
    return unit(np.fft.irfft(X * g, n))


def smooth_noise(rng, n, fc, circular=True):
    return unit(filt(rng.standard_normal(n), [("lp", fc, 0.6), ("lp", fc, 0.6)], circular=circular))


def saw(f, n, phase0=0.0):
    """PolyBLEP sawtooth with constant frequency."""
    dt = f / SR
    ph = np.mod(phase0 + f * np.arange(n) / SR, 1.0)
    y = 2.0 * ph - 1.0
    m1 = ph < dt
    x = ph[m1] / dt
    y[m1] -= x + x - x * x - 1.0
    m2 = ph > 1.0 - dt
    x = (ph[m2] - 1.0) / dt
    y[m2] -= x * x + x + x + 1.0
    return y


def chirp_sine(n, f_start, f_end, tau, phase=0.0):
    t = tt(n)
    f = f_end + (f_start - f_end) * np.exp(-t / tau)
    return np.sin(TAU * np.cumsum(f) / SR + phase)


def modal(n, freqs, taus, amps, rng=None, attack=0.0003):
    t = tt(n)
    y = np.zeros(n)
    for i, (f, d, a) in enumerate(zip(freqs, taus, amps)):
        if f >= 0.45 * SR:
            continue
        ph = rng.uniform(0, TAU) if rng is not None else 0.0
        y += a * np.exp(-t / d) * np.sin(TAU * f * t + ph)
    if attack > 0:
        y *= 1.0 - np.exp(-t / attack)
    return y


def decay(n, tau, attack=0.0005):
    t = tt(n)
    e = np.exp(-t / tau)
    if attack > 0:
        e *= 1.0 - np.exp(-t / attack)
    return e


def burst(rng, n, tau, specs, attack=0.0003):
    return filt(rng.standard_normal(n) * decay(n, tau, attack), specs)


def env_pts(n, pts):
    """Piecewise-linear envelope from [(time_s, value), ...]."""
    ts = [p[0] for p in pts]
    vs = [p[1] for p in pts]
    return np.interp(tt(n), ts, vs)


def pan(x, p):
    """Equal-power pan, p in [-1, 1]. Returns (2, n)."""
    a = (p + 1.0) * math.pi / 4.0
    return np.stack([x * math.cos(a), x * math.sin(a)]) * math.sqrt(2.0)


def add_at(buf, sig, start, circular=False, gain=1.0):
    n = buf.shape[-1]
    m = sig.shape[-1]
    if circular:
        s = start % n
        pos = 0
        while pos < m:
            k = min(m - pos, n - s)
            buf[..., s:s + k] += gain * sig[..., pos:pos + k]
            pos += k
            s = 0
    else:
        a, b = max(start, 0), min(start + m, n)
        if b > a:
            buf[..., a:b] += gain * sig[..., a - start:b - start]
    return buf


def stick_slip(rng, n, rate, amp_env, kernel, jitter=0.15):
    """Creak: an irregular pulse train (stick-slip) exciting a resonant body."""
    r = rate * (1.0 + jitter * smooth_noise(rng, n, 40.0, circular=False))
    phase = np.cumsum(np.maximum(r, 1.0)) / SR
    idx = np.nonzero(np.diff(np.floor(phase)))[0] + 1
    imp = np.zeros(n)
    imp[idx] = amp_env[idx] * rng.uniform(0.35, 1.0, len(idx))
    return fconv(imp, kernel)


# --------------------------------------------------------------------------
# reverb
# --------------------------------------------------------------------------
def make_ir(rng, rt, hf=0.5, lf=1.15, predelay=0.012, er_spread=0.05, n_er=10,
            stereo=True, length=None, er_gain=0.6, lowpass=9000.0):
    n = secs(length if length else rt * 1.15 + predelay)
    t = tt(n)
    chans = []
    for _ in range(2 if stereo else 1):
        w = rng.standard_normal(n)
        lo = filt(w, [("lp", 450, 0.7071)], circular=True)
        hi = filt(w, [("hp", 3200, 0.7071)], circular=True)
        mid = w - lo - hi
        ir = (lo * np.exp(-6.91 * t / (rt * lf)) + mid * np.exp(-6.91 * t / rt)
              + hi * np.exp(-6.91 * t / (rt * hf)))
        ir *= 1.0 - np.exp(-t / 0.012)
        er = np.zeros(n)
        for _k in range(n_er):
            ti = rng.uniform(0.003, er_spread)
            er[secs(ti)] += rng.choice([-1, 1]) * rng.uniform(0.4, 1.0) * math.exp(-ti / er_spread)
        ir = ir / (rms(ir) * math.sqrt(n)) + er_gain * er / (np.sqrt(np.sum(er ** 2)) + 1e-9) * 0.5
        pd = secs(predelay)
        ir = np.concatenate([np.zeros(pd), ir])[:n]
        ir = filt(ir, [("lp", lowpass, 0.7071)], circular=True)
        chans.append(ir / np.sqrt(np.sum(ir ** 2)))
    return np.stack(chans) if stereo else chans[0]


def reverb(x, ir, wet, dry=1.0, circular=False):
    if ir.ndim == 2 and x.ndim == 1:
        x = np.stack([x, x])
    return dry * x + wet * fconv(x, ir, circular=circular)


# --------------------------------------------------------------------------
# finishing
# --------------------------------------------------------------------------
def normalise(x, peak_db, max_rms_db=None):
    x = x / (np.max(np.abs(x)) + 1e-12) * db(peak_db)
    if max_rms_db is not None:
        r = 20 * math.log10(rms(x))
        if r > max_rms_db:
            x *= db(max_rms_db - r)
    return x


def trim_lead(x, thresh_db=-50.0, preroll=0.002):
    mono = np.max(np.abs(x), axis=0) if x.ndim == 2 else np.abs(x)
    thr = np.max(mono) * db(thresh_db)
    i = int(np.argmax(mono > thr))
    i = max(0, i - secs(preroll))
    return x[..., i:]


def fade_out(x, dur):
    m = secs(dur)
    m = min(m, x.shape[-1])
    x = x.copy()
    x[..., -m:] *= np.cos(np.linspace(0, math.pi / 2, m)) ** 2
    return x


def fade_in(x, dur):
    m = min(secs(dur), x.shape[-1])
    x = x.copy()
    x[..., :m] *= np.sin(np.linspace(0, math.pi / 2, m)) ** 2
    return x


def finish_sfx(x, length=None, fade=0.04):
    x = trim_lead(x)
    if length:
        x = x[..., :secs(length)]
    x = fade_out(x, fade)
    x = fade_in(x, 0.0005)
    return normalise(x, -1.0)


# ==========================================================================
# AMBIENCE
# ==========================================================================
def amb_rain(rng):
    T = 20.0
    n = secs(T)
    t = tt(n)
    C = True

    # --- broadband bed: partially correlated pink noise, tamed highs
    common = colored(rng, n, -3.0)
    bed = np.stack([0.55 * common + 0.83 * colored(rng, n, -3.0),
                    0.55 * common + 0.83 * colored(rng, n, -3.0)])
    bed = filt(bed, [("hp", 140, 0.6), ("ls", 350, 0.7, -5), ("peak", 2800, 0.9, -2.5),
                     ("lp", 5200, 0.6), ("lp", 9000, 0.7)], circular=C)
    lfo = 1.0 + 0.07 * np.sin(TAU * 3 / T * t) + 0.04 * np.sin(TAU * 7 / T * t + 1.3)
    bed *= lfo
    # second, airier layer: rain hiss on metal/car roofs (higher, quieter)
    hiss = np.stack([colored(rng, n, -2.0), colored(rng, n, -2.0)])
    hiss = filt(hiss, [("hp", 1800, 0.6), ("lp", 6500, 0.6), ("lp", 8000, 0.7)], circular=C)
    hiss *= 1.0 + 0.12 * np.sin(TAU * 5 / T * t + np.array([[0.0], [2.0]]))

    # --- droplets: impulse trains convolved with droplet kernels
    kn = secs(0.08)
    kt = tt(kn)

    def k_tick():
        return filt(rng.standard_normal(kn) * decay(kn, 0.0012, 0.0002),
                    [("bp", rng.uniform(2200, 3800), 0.9), ("lp", 6500, 0.7)])

    def k_plip():
        f0 = rng.uniform(1300, 2500)
        f = f0 * (1.0 + 1.8 * kt)
        return np.sin(TAU * np.cumsum(f) / SR) * decay(kn, rng.uniform(0.006, 0.014), 0.0003)

    def k_metal():
        b = rng.uniform(0.85, 1.15)
        return modal(kn, [1050 * b, 2480 * b, 3950 * b, 5300 * b], [0.03, 0.022, 0.012, 0.008],
                     [1.0, 0.6, 0.35, 0.15], rng)

    def k_soft():
        return filt(rng.standard_normal(kn) * decay(kn, 0.004, 0.0004),
                    [("lp", rng.uniform(900, 1800), 0.7), ("hp", 200, 0.7)])

    kinds = [(k_tick, 260, 0.35), (k_soft, 140, 0.6), (k_plip, 9, 0.25), (k_metal, 6, 0.18)]
    drops = np.zeros((2, n))
    for ch in range(2):
        for maker, rate, lvl in kinds:
            for var in range(3):
                kern = unit(maker())
                cnt = int(rate * T / 3)
                imp = np.zeros(n)
                pos = rng.integers(0, n, cnt)
                amps = np.minimum(rng.lognormal(0.0, 0.7, cnt), 4.0) * rng.choice([-1, 1], cnt)
                np.add.at(imp, pos, amps)
                drops[ch] += lvl * fconv(imp, kern, circular=C)
    drops = np.stack([drops[0] + 0.35 * drops[1], drops[1] + 0.35 * drops[0]])
    drops = filt(drops, [("lp", 7000, 0.7), ("hp", 250, 0.7)], circular=C)

    # --- gutter trickle: bubbles + modulated water noise, off to the right
    trick = np.zeros(n)
    rate_env = 0.5 + 0.5 * np.clip(smooth_noise(rng, n, 1.5), -1, 1)
    bn = secs(0.06)
    bt = tt(bn)
    nb = int(16 * T)
    for _ in range(nb):
        st = int(rng.integers(0, n))
        if rng.random() > rate_env[st]:
            continue
        f0 = rng.uniform(380, 1150)
        tau = rng.uniform(0.005, 0.016)
        f = f0 * (1.0 + 0.9 * bt / tau * 0.25)
        b = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-bt / tau) * (1 - np.exp(-bt / 0.0008))
        add_at(trick, b * rng.uniform(0.3, 1.0), st, circular=C)
    stream = filt(colored(rng, n, -3.0), [("bp", 900, 1.1), ("bp", 1400, 0.8)], circular=C)
    stream *= 0.6 + 0.4 * np.clip(smooth_noise(rng, n, 6.0), -1.5, 1.5)
    trick = 0.6 * unit(trick) + 0.5 * stream
    trick = pan(filt(trick, [("lp", 3500, 0.7)], circular=C), 0.55)

    # --- very distant low rumble: one slow swell per loop
    rum = filt(colored(rng, n, -6.0), [("lp", 110, 0.7), ("lp", 140, 0.7), ("hp", 25, 0.7)],
               circular=C)
    d = (t - 12.5 + T / 2) % T - T / 2  # circular distance to 12.5 s
    renv = np.where(d < 0, np.exp(-(d / 1.6) ** 2), np.exp(-(d / 3.8) ** 2))
    renv *= 0.75 + 0.25 * np.clip(smooth_noise(rng, n, 2.0), -2, 2)
    rum = np.stack([rum, np.roll(rum, secs(0.013))]) * renv

    ir = make_ir(rng, 1.4, hf=0.45, predelay=0.02, er_spread=0.04)
    mix = (0.55 * unit(bed) + 0.12 * unit(hiss)
           + reverb(0.36 * unit(drops), ir, 0.35, circular=C)
           + reverb(0.10 * trick, ir, 0.3, circular=C)
           + 0.28 * unit(rum))
    mix = filt(mix, [("hs", 6000, 0.7, -3)], circular=C)
    return normalise(mix, -6.0, -21.0)


def amb_gym(rng):
    T = 16.0
    n = secs(T)
    t = tt(n)
    C = True
    # low room tone
    room = np.stack([colored(rng, n, -4.5), colored(rng, n, -4.5)])
    room = filt(room, [("lp", 260, 0.6), ("hp", 22, 0.7)], circular=C)
    air = np.stack([colored(rng, n, -3.0), colored(rng, n, -3.0)])
    air = filt(air, [("hp", 1200, 0.6), ("lp", 6000, 0.6)], circular=C)
    # HVAC hum: 60 Hz family, slow AM; plus fan noise band
    hum = np.zeros((2, n))
    for k, a in zip([1, 2, 3, 4, 5, 6], [1.0, 0.55, 0.3, 0.16, 0.08, 0.05]):
        f = qf(60.0 * k, T)
        for ch in range(2):
            hum[ch] += a * np.sin(TAU * f * t + rng.uniform(0, TAU))
    hum *= 1.0 + 0.15 * np.sin(TAU * (2 / T) * t) + 0.05 * np.sin(TAU * (9 / T) * t)
    fan = filt(np.stack([colored(rng, n, -3.0), colored(rng, n, -3.0)]),
               [("bp", 240, 0.9), ("lp", 700, 0.7)], circular=C)
    fan *= 1.0 + 0.2 * np.sin(TAU * qf(1.9, T) * t)  # slow blade-ish wobble
    # fluorescent buzz (120 Hz rich) faint, high-passed, left of centre
    buzz = np.zeros(n)
    for k in range(1, 60):
        f = 120.0 * k
        if f > 9000:
            break
        buzz += (1.0 / k ** 0.7) * np.sin(TAU * f * t + rng.uniform(0, TAU))
    buzz = filt(buzz, [("hp", 1400, 0.7), ("lp", 5500, 0.7)], circular=C)
    flick = 1.0 + 0.25 * np.clip(smooth_noise(rng, n, 3.0), -2, 2)
    buzz = pan(unit(buzz) * flick, -0.45)
    # distant creaks (metal roof beams), heavily reverberant
    creaks = np.zeros(n)
    for start, dur, r0, r1, base in [(4.6, 0.9, 16, 30, 1.0), (11.3, 0.6, 24, 14, 0.82)]:
        m = secs(dur)
        rate = np.linspace(r0, r1, m)
        ae = np.sin(np.linspace(0, math.pi, m)) ** 1.5
        kern = modal(secs(0.25), [170 * base, 395 * base, 690 * base, 1130 * base, 1720 * base],
                     [0.05, 0.035, 0.022, 0.014, 0.009], [1.0, 0.8, 0.55, 0.3, 0.15], rng)
        c = stick_slip(rng, m, rate, ae, kern, jitter=0.25)
        add_at(creaks, unit(c) * (1.0 if base == 1.0 else 0.7), secs(start), circular=C)
    creaks = filt(creaks, [("lp", 1800, 0.7), ("hp", 90, 0.7)], circular=C)
    # a very faint distant metallic tick (thermal contraction)
    tick = modal(secs(0.5), [1830, 2950, 4210], [0.12, 0.08, 0.05], [1, 0.5, 0.25], rng)
    ticks = np.zeros(n)
    add_at(ticks, tick, secs(8.2), circular=C)

    ir = make_ir(rng, 3.0, hf=0.4, lf=1.2, predelay=0.03, er_spread=0.09)
    dry = (0.55 * unit(room) + 0.035 * unit(air) + 0.11 * unit(hum) + 0.10 * unit(fan)
           + 0.022 * buzz)
    mix = reverb(dry, ir, 0.25, circular=C)
    mix += reverb(0.14 * unit(creaks), ir, 1.0, dry=0.12, circular=C)
    mix += reverb(0.05 * unit(ticks), ir, 1.0, dry=0.05, circular=C)
    return normalise(mix, -6.0, -31.0)


# ==========================================================================
# MUSIC
# ==========================================================================
def chord_envs(n, segments, xfade, circular=True):
    """segments: list of (start_s, end_s, set_of_note_names). Returns {note: env} with
    smooth crossfades (partition of unity, periodic if circular)."""
    notes = sorted({x for s in segments for x in s[2]})
    ind = np.zeros((len(segments), n))
    for i, (a, b, _) in enumerate(segments):
        ind[i, secs(a):secs(b)] = 1.0
    k = np.hanning(max(3, secs(xfade)))
    k /= k.sum()
    if circular:
        sm = fconv(ind, k[None, :], circular=True)
        sm = np.roll(sm, -len(k) // 2, axis=-1)
    else:
        sm = fconv(np.pad(ind, ((0, 0), (len(k) // 2, 0))), k[None, :])[:, len(k) // 2:]
        sm = sm[:, :n] if sm.shape[-1] >= n else np.pad(sm, ((0, 0), (0, n - sm.shape[-1])))
    out = {}
    for nt in notes:
        out[nt] = sum(sm[i] for i, s in enumerate(segments) if nt in s[2])
    return out


def pad_voice(rng, f, n, T=None, detunes=(-11, -4, 3, 9)):
    out = np.zeros((2, n))
    for ch in range(2):
        for d in detunes:
            ff = f * 2 ** ((d + rng.uniform(-2.5, 2.5)) / 1200.0)
            if T:
                ff = qf(ff, T)
            out[ch] += saw(ff, n, rng.random())
    return out / len(detunes)


def piano_note(rng, f, vel, dur=4.5, hold=None, bright=1.0):
    n = secs(dur)
    t = tt(n)
    B = 0.00022
    y = np.zeros(n)
    tau1 = 2.6 * (110.0 / f) ** 0.4
    for k in range(1, 20):
        fk = k * f * math.sqrt(1 + B * k * k)
        if fk > 5000:
            break
        a = (1.0 / k ** 1.15) * math.exp(-(k - 1) * (0.55 - 0.3 * vel * bright))
        a *= 0.45 + 0.55 * abs(math.sin(math.pi * k * 0.137))  # hammer-position comb
        tau = tau1 / (1.0 + 0.5 * (k - 1))
        env = 0.55 * np.exp(-t / (tau * 0.22)) + 0.45 * np.exp(-t / tau)
        det = 1.0 + rng.uniform(0.0002, 0.0007)
        y += a * env * (np.sin(TAU * fk * t + rng.uniform(0, TAU))
                        + 0.8 * np.sin(TAU * fk * det * t + rng.uniform(0, TAU)))
    y *= 1.0 - np.exp(-t / 0.0022)
    hammer = filt(rng.standard_normal(n) * decay(n, 0.005, 0.0005), [("lp", 1600, 0.7)])
    y += 0.06 * vel * hammer
    if hold is not None and hold < dur:
        y *= np.where(t < hold, 1.0, np.exp(-(t - hold) / 0.25))
    return fade_out(y * vel, 0.05)


def sub_hit(n, f, tau=0.6, attack=0.035, phase=0.0):
    t = tt(n)
    env = (1 - np.exp(-t / attack)) * np.exp(-t / tau)
    return env * (np.sin(TAU * f * t + phase) + 0.22 * np.sin(2 * TAU * f * t + phase))


def music_theme(rng):
    bpm = 64.0
    beat = 60.0 / bpm
    T = 32 * beat  # 8 bars of 4/4 = 30.0 s
    n = secs(T)
    t = tt(n)
    C = True
    bar = 4 * beat
    segs = [(0, 2 * bar, {"D2", "D3", "F3", "A3"}),
            (2 * bar, 4 * bar, {"Bb1", "D3", "F3", "Bb3"}),
            (4 * bar, 6 * bar, {"G1", "D3", "G3", "Bb3"}),
            (6 * bar, 7 * bar, {"A1", "D3", "E3", "A3"}),
            (7 * bar, 8 * bar, {"A1", "C#3", "E3", "A3"})]
    envs = chord_envs(n, segs, 1.6)
    bus = np.zeros((2, n))
    for nt, e in envs.items():
        f = nf(nt)
        g = 0.55 if f < 70 else 1.0
        v = pad_voice(rng, f, n, T)
        if f < 70:  # bass voice: add octave for presence
            v = 0.6 * v + 0.5 * pad_voice(rng, 2 * f, n, T, detunes=(-6, 5))
        bus += g * v * e
    dark = filt(bus, [("lp", 650, 0.6), ("lp", 900, 0.7), ("hp", 45, 0.7)], circular=C)
    bright = filt(bus, [("lp", 1500, 0.6), ("lp", 2200, 0.7), ("hp", 45, 0.7)], circular=C)
    period = 2 * bar
    sw = np.sin(math.pi * (t % period) / period) ** 2  # swell peaks mid-chord, 4 per loop
    pad = (dark * (1 - 0.6 * sw) + bright * 0.6 * sw) * (0.62 + 0.38 * sw)
    pad *= 1.0 + 0.04 * np.sin(TAU * (5 / T) * t + np.array([[0.0], [1.7]]))

    # felt-piano motif (sparse, low register)
    motif = [(0.0, "A3", .78), (1.0, "F3", .55), (2.0, "D3", .62),
             (4.0, "F3", .66), (5.5, "E3", .45), (6.0, "A3", .5),
             (8.0, "Bb3", .76), (9.0, "F3", .52), (10.0, "D3", .58),
             (12.0, "D4", .66), (14.5, "A3", .42),
             (16.0, "G3", .72), (17.0, "Bb3", .52), (18.0, "D4", .58),
             (20.0, "C4", .5), (21.0, "Bb3", .55), (22.0, "G3", .46),
             (24.0, "A3", .72), (25.0, "D4", .5), (26.0, "E4", .52),
             (28.0, "C#4", .66), (29.5, "E3", .4), (30.0, "A3", .48)]
    bass_notes = [(0.0, "D2", .5), (8.0, "Bb1", .5), (16.0, "G1", .5), (24.0, "A1", .5)]
    piano = np.zeros((2, n))
    for b, nt, v in motif + bass_notes:
        st = secs(b * beat + rng.normal(0, 0.012))
        note = piano_note(rng, nf(nt), v, dur=5.0, hold=3.6 * beat)
        p = -0.15 + 0.3 * (nf(nt) - 150) / 200.0
        add_at(piano, pan(note, float(np.clip(p, -0.4, 0.4))), st, circular=C)
    piano = filt(piano, [("lp", 3200, 0.6), ("ls", 180, 0.7, -3)], circular=C)

    # soft sub pulse on half notes
    sub = np.zeros(n)
    roots = {0: "D2", 1: "Bb1", 2: "G1", 3: "A1"}
    for h in range(16):
        root = nf(roots[h // 4])
        if root > 70:
            root /= 2  # D1-ish octave for consistency
        root = root * 2
        hit = sub_hit(secs(2.0), root, tau=0.55, attack=0.05)
        add_at(sub, hit * (1.0 if h % 2 == 0 else 0.6), secs(h * 2 * beat), circular=C)
    sub = filt(sub, [("lp", 160, 0.7)], circular=C)

    ir = make_ir(rng, 3.4, hf=0.45, lf=1.1, predelay=0.025, er_spread=0.07)
    mix = (reverb(0.50 * unit(pad), ir, 0.45, circular=C)
           + reverb(0.40 * unit(piano), ir, 0.55, circular=C)
           + 0.20 * np.stack([unit(sub), unit(sub)]))
    mix = filt(mix, [("lp", 9000, 0.7), ("hp", 28, 0.7)], circular=C)
    return normalise(mix, -6.0, -20.0)


def music_tension(rng):
    T = 24.0
    n = secs(T)
    t = tt(n)
    C = True
    # heartbeat: lub-dub every second
    hb = np.zeros(n)
    for b in range(24):
        acc = 1.0 + 0.08 * math.sin(b * 1.7)
        for off, amp, f0, f1 in [(0.0, 1.0, 72, 44), (0.27, 0.62, 80, 50)]:
            m = secs(0.6)
            s = chirp_sine(m, f0, f1, 0.03) * decay(m, 0.11, 0.004)
            s += 0.4 * burst(rng, m, 0.025, [("lp", 140, 0.7), ("lp", 160, 0.7)], 0.002)
            add_at(hb, s * amp * acc, secs(b + off), circular=C)
    hb = filt(hb, [("lp", 180, 0.7), ("hp", 30, 0.7)], circular=C)

    # cluster drone: D2/Eb2 rub, A2/Bb2 above
    drone = np.zeros((2, n))
    for nt, g in [("D2", 1.0), ("Eb2", 0.85), ("A2", 0.5), ("Bb2", 0.42), ("D3", 0.25)]:
        drone += g * pad_voice(rng, nf(nt), n, T, detunes=(-7, 0, 6))
    breath = 0.5 + 0.5 * np.sin(TAU * (3 / T) * t - math.pi / 2)
    dk = filt(drone, [("lp", 380, 0.6), ("lp", 520, 0.7), ("hp", 40, 0.7)], circular=C)
    br = filt(drone, [("lp", 900, 0.6), ("lp", 1200, 0.7), ("hp", 40, 0.7)], circular=C)
    drone = dk * (1 - 0.5 * breath) + br * 0.5 * breath
    drone *= 0.8 + 0.2 * breath
    # glassy high cluster, very faint (sine pairs D5/Eb5 beating)
    glass = np.zeros((2, n))
    for nt, g in [("D5", 1.0), ("Eb5", 0.8)]:
        for ch in range(2):
            glass[ch] += g * np.sin(TAU * qf(nf(nt) * (1 + 0.0007 * ch), T) * t + rng.uniform(0, TAU))
    glass *= 0.5 + 0.5 * np.sin(TAU * (2 / T) * t)[None, :] ** 2

    # reversed swells landing on 12 s and 24 s (=0)
    swells = np.zeros((2, n))
    ir_long = make_ir(rng, 4.5, hf=0.5, predelay=0.0, er_spread=0.05)
    for land, notes, g in [(12.0, ["D3", "Eb3", "A3"], 1.0), (24.0, ["D2", "Eb3", "Bb3"], 0.75)]:
        m = secs(4.0)
        src = np.zeros(m)
        for nt in notes:
            src += piano_note(rng, nf(nt), 0.8, dur=4.0, bright=1.3)
        src += 0.3 * modal(m, [nf(notes[0]) * r for r in (1, 2.76, 5.4, 8.93)],
                           [1.5, 0.8, 0.4, 0.2], [1, .5, .3, .15], rng)
        wet = fconv(np.stack([src, src]), ir_long)
        rev = wet[:, ::-1] * np.linspace(0, 1, m) ** 1.5
        rev = fade_out(rev, 0.03)
        rev = filt(rev, [("lp", 2500, 0.7)])
        add_at(swells, unit(rev) * g, secs(land) - m, circular=C)

    ir = make_ir(rng, 3.0, hf=0.4, predelay=0.02, er_spread=0.06)
    mix = (reverb(0.40 * unit(drone), ir, 0.4, circular=C)
           + reverb(np.stack([0.55 * unit(hb)] * 2), ir, 0.18, circular=C)
           + reverb(0.012 * unit(glass), ir, 0.8, circular=C)
           + 0.20 * swells)
    mix = filt(mix, [("lp", 8000, 0.7), ("hp", 26, 0.7)], circular=C)
    return normalise(mix, -6.0, -22.0)


def music_resolve(rng):
    T = 8.0
    n = secs(T)
    t = tt(n)
    segs = [(0.0, 3.1, {"D2", "A2", "F3", "A3", "E4"}),
            (3.1, 8.0, {"Bb1", "F2", "D3", "F3", "Bb3", "D4"})]
    envs = chord_envs(n, segs, 0.9, circular=False)
    bus = np.zeros((2, n))
    for nt, e in envs.items():
        f = nf(nt)
        g = 0.6 if f < 70 else 1.0
        bus += g * pad_voice(rng, f, n) * e
    shape = env_pts(n, [(0, 0), (1.4, 0.85), (2.8, 0.7), (3.6, 1.0), (4.6, 0.85), (7.2, 0.0),
                        (8, 0)]) ** 1.3
    cut = env_pts(n, [(0, 500), (1.4, 1300), (2.9, 900), (3.7, 1900), (7.5, 500), (8, 500)])
    padm = np.stack([sweep(bus[0], "lp", cut, 0.8, 300, 2400, 20),
                     sweep(bus[1], "lp", cut, 0.8, 300, 2400, 20)])
    padm = filt(padm, [("lp", 2600, 0.7), ("hp", 40, 0.7)]) * shape
    sub = np.zeros(n)
    sub += sub_hit(n, nf("D2"), tau=1.6, attack=0.5) * (t < 3.6) * env_pts(n, [(0, 1), (3.1, 1), (3.6, 0), (8, 0)])
    sb = sub_hit(n - secs(3.1), nf("Bb1"), tau=1.8, attack=0.25)
    sub[secs(3.1):] += sb
    sub = filt(sub, [("lp", 150, 0.7)])
    piano = np.zeros(n)
    add_at(piano, piano_note(rng, nf("D5"), 0.6, dur=4.8, bright=0.8), secs(3.25))
    add_at(piano, 0.35 * piano_note(rng, nf("D4"), 0.45, dur=4.6, bright=0.7), secs(3.26))
    piano = filt(piano, [("lp", 3800, 0.7)])
    ir = make_ir(rng, 4.2, hf=0.45, predelay=0.03, er_spread=0.07)
    mix = (reverb(0.5 * unit(padm), ir, 0.55)
           + reverb(0.30 * unit(piano), ir, 0.7)
           + 0.2 * np.stack([unit(sub), unit(sub)]))
    mix = filt(mix, [("lp", 9000, 0.7), ("hp", 28, 0.7)])
    mix = fade_out(mix, 1.6)
    mix = fade_in(mix, 0.02)
    return normalise(mix, -6.0, -20.0)


# ==========================================================================
# SFX
# ==========================================================================
_GYM_IR = {}


def gym_ir(rng, rt=1.6):
    key = rt
    if key not in _GYM_IR:
        _GYM_IR[key] = make_ir(np.random.default_rng([SEED, 777, int(rt * 100)]), rt, hf=0.4,
                               lf=1.15, predelay=0.018, er_spread=0.08, stereo=False)
    return _GYM_IR[key]


def chain_rattle(rng, dur=1.0, bursts=((0.0, 0.28, 16, 1.0), (0.42, 0.7, 9, 0.55),
                                       (0.78, 0.95, 3, 0.25))):
    n = secs(dur)
    y = np.zeros(n)
    base = [1350, 2380, 3650, 5150, 7000, 8900]
    for a, b, cnt, lvl in bursts:
        times = np.sort(rng.uniform(a, b, cnt))
        for i, ti in enumerate(times):
            m = secs(0.25)
            s = rng.uniform(0.88, 1.12)
            fr = [f * s * rng.uniform(0.97, 1.03) for f in base]
            taus = [0.09, 0.07, 0.05, 0.035, 0.025, 0.018]
            amps = [rng.uniform(0.3, 1.0) * (0.85 ** j) for j in range(len(base))]
            ev = modal(m, fr, taus, amps, rng)
            ev += 0.6 * burst(rng, m, 0.0008, [("hp", 2500, 0.7)])
            ev += 0.3 * modal(m, [rng.uniform(380, 650)], [0.02], [1.0], rng)
            amp = lvl * rng.uniform(0.35, 1.0) * (1 - 0.4 * (i / max(1, cnt - 1)))
            add_at(y, ev * amp, secs(ti))
    return filt(y, [("lp", 9500, 0.7), ("hp", 300, 0.7), ("peak", 6000, 1.0, -3)])


def punch(rng, f0, f1, tau, slap_f, slap_amt, size=1.0, dur=0.45):
    n = secs(dur)
    thump = chirp_sine(n, f0, f1, 0.02 * size) * decay(n, tau, 0.0012)
    body = burst(rng, n, 0.03 * size, [("lp", 380, 0.7), ("lp", 500, 0.7)], 0.001)
    glove = burst(rng, n, 0.012, [("bp", 650, 1.1), ("lp", 2500, 0.7)], 0.0005)
    slap = burst(rng, n, 0.0045, [("bp", slap_f, 0.8), ("hp", 600, 0.7)], 0.0002)
    bag = modal(n, [86 * size ** -0.3, 143, 231], [0.09, 0.05, 0.03], [0.5, 0.3, 0.15], rng, 0.004)
    y = (1.0 * unit(thump) * 0.9 + 0.7 * unit(body) + 0.45 * unit(glove)
         + slap_amt * unit(slap) + 0.25 * unit(bag))
    y = np.tanh(0.5 * y / np.max(np.abs(y)) * 2.2)
    y = filt(y, [("lp", 7000, 0.7), ("hp", 35, 0.7), ("peak", 320, 1.0, -2)])
    return reverb(y, gym_ir(rng), 0.13)


def sfx_punch_1(rng):
    return finish_sfx(punch(rng, 125, 54, 0.085, 1900, 0.5), 0.42)


def sfx_punch_2(rng):
    return finish_sfx(punch(rng, 140, 60, 0.075, 2300, 0.6), 0.42)


def sfx_punch_3(rng):
    return finish_sfx(punch(rng, 112, 49, 0.095, 1650, 0.42), 0.42)


def sfx_punch_big(rng):
    n = secs(0.9)
    y = punch(rng, 160, 42, 0.16, 1500, 0.55, size=1.5, dur=0.9)
    sub = chirp_sine(n, 95, 36, 0.05) * decay(n, 0.22, 0.003)
    y = y + 0.35 * unit(sub) * np.max(np.abs(y)) / 2.5
    ch = chain_rattle(rng, 0.9, bursts=((0.05, 0.3, 11, 1.0), (0.45, 0.7, 5, 0.45)))
    y = y / np.max(np.abs(y)) + 0.16 * ch / np.max(np.abs(ch))
    y = reverb(y, gym_ir(rng, 1.9), 0.12)
    return finish_sfx(y, 0.8, fade=0.08)


def sfx_chain(rng):
    y = chain_rattle(rng, 1.1)
    y = reverb(y, gym_ir(rng), 0.18)
    return finish_sfx(y, 1.0, fade=0.1)


def sfx_tape(rng):
    n = secs(0.75)
    t = tt(n)
    # micro-pops of the adhesive letting go: rate rises through the pull
    rate = env_pts(n, [(0, 250), (0.08, 350), (0.5, 900), (0.6, 1400), (0.63, 400), (0.75, 50)])
    amp = env_pts(n, [(0, 0), (0.01, 0.35), (0.08, 0.3), (0.45, 0.75), (0.56, 1.0), (0.62, 0.9),
                      (0.64, 0.05), (0.75, 0)])
    k = burst(rng, secs(0.004), 0.0004, [("hp", 1200, 0.7)], 0.00005)
    pops = stick_slip(rng, n, rate, amp, k, jitter=0.6)
    hiss = rng.standard_normal(n) * amp
    centre = env_pts(n, [(0, 1600), (0.5, 2600), (0.6, 3600), (0.75, 3000)])
    hiss = sweep(hiss, "bp", centre, 1.2, 1400, 4000, 16)
    peel = filt(rng.standard_normal(n), [("bp", 550, 0.9)]) * amp * 0.4
    flap = burst(rng, n, 0.015, [("lp", 900, 0.7)], 0.001)
    flapd = np.zeros(n)
    add_at(flapd, flap, secs(0.645))
    y = 1.0 * unit(pops) + 0.55 * unit(hiss) * amp + 0.25 * unit(peel) + 0.35 * unit(flapd)
    y = filt(y, [("lp", 7500, 0.7), ("hp", 180, 0.7)])
    y = reverb(y, gym_ir(rng), 0.08)
    return finish_sfx(y, 0.72, fade=0.05)


def sfx_body_fall(rng):
    n = secs(1.0)
    y = np.zeros(n)
    for off, a, f0, f1, tau in [(0.0, 1.0, 82, 40, 0.14), (0.105, 0.42, 95, 52, 0.07),
                                (0.19, 0.18, 110, 60, 0.05)]:
        m = n - secs(off)
        thud = chirp_sine(m, f0, f1, 0.025) * decay(m, tau, 0.002)
        mass = burst(rng, m, 0.05, [("lp", 260, 0.7), ("lp", 320, 0.7)], 0.001)
        canvas = burst(rng, m, 0.018, [("bp", 900, 0.8)], 0.0005)
        snap = burst(rng, m, 0.004, [("bp", 2600, 0.9)], 0.0002)
        s = unit(thud) + 0.9 * unit(mass) + 0.45 * unit(canvas) + 0.18 * unit(snap)
        add_at(y, a * s, secs(off))
    floor = modal(n, [108, 171, 262], [0.12, 0.08, 0.05], [1, .6, .3], rng, 0.003)
    y += 0.3 * unit(floor) * decay(n, 0.3)
    y = np.tanh(y / np.max(np.abs(y)) * 1.6)
    # rope creak as the ropes take some weight
    m = secs(0.5)
    kern = modal(secs(0.12), [540, 870, 1350, 2050], [0.016, 0.012, 0.008, 0.006],
                 [1, .7, .4, .2], rng)
    cr = stick_slip(rng, m, np.linspace(38, 22, m), np.sin(np.linspace(0, math.pi, m)) ** 2,
                    kern, jitter=0.3)
    add_at(y, 0.09 * cr / np.max(np.abs(cr)), secs(0.24))
    y = filt(y, [("lp", 6000, 0.7), ("hp", 30, 0.7)])
    y = reverb(y, gym_ir(rng), 0.15)
    return finish_sfx(y, 0.9, fade=0.12)


def big_hall_ir():
    if "hall" not in _GYM_IR:
        _GYM_IR["hall"] = make_ir(np.random.default_rng([SEED, 999]), 2.4, hf=0.38, lf=1.2,
                                  predelay=0.03, er_spread=0.1, stereo=False)
    return _GYM_IR["hall"]


def sfx_door_open(rng):
    n = secs(2.4)
    y = np.zeros(n)
    # latch: handle click, bolt release, low clunk
    for off, a in [(0.0, 1.0), (0.085, 0.65)]:
        m = secs(0.3)
        click = modal(m, [1750, 2870, 4420, 6100], [0.018, 0.012, 0.008, 0.005], [1, .7, .4, .2], rng)
        clunk = chirp_sine(m, 160, 95, 0.02) * decay(m, 0.05, 0.001)
        body = burst(rng, m, 0.02, [("lp", 700, 0.7)], 0.0005)
        add_at(y, a * (0.5 * unit(click) + unit(clunk) + 0.7 * unit(body)), secs(off))
    # hinge groan: slow stick-slip through heavy-door modes
    st, dur = 0.28, 1.45
    m = secs(dur)
    rate = env_pts(m, [(0, 11), (0.3, 24), (0.7, 31), (1.1, 19), (1.45, 12)])
    ae = env_pts(m, [(0, 0), (0.15, 0.6), (0.5, 1.0), (1.0, 0.7), (1.45, 0)])
    kern = modal(secs(0.3), [138, 286, 468, 702, 990, 1310], [0.07, 0.05, 0.035, 0.025, 0.018, 0.012],
                 [1, .85, .6, .4, .25, .12], rng)
    groan = stick_slip(rng, m, rate, ae, kern, jitter=0.18)
    squeal_k = modal(secs(0.1), [1240, 1890], [0.02, 0.015], [1, .5], rng)
    squeal = stick_slip(rng, m, rate * 4.1, ae ** 2, squeal_k, jitter=0.06)
    add_at(y, 0.55 * groan / np.max(np.abs(groan)) + 0.07 * squeal / np.max(np.abs(squeal)), secs(st))
    # air push and rolling rumble as the door swings
    m = secs(1.9)
    wn = rng.standard_normal(m)
    wenv = env_pts(m, [(0, 0), (0.6, 0.6), (1.1, 1.0), (1.6, 0.5), (1.9, 0)])
    air = sweep(wn, "bp", env_pts(m, [(0, 250), (1.0, 850), (1.9, 380)]), 0.8, 220, 950, 16) * wenv
    rumble = filt(wn, [("lp", 110, 0.7), ("lp", 130, 0.7)]) * wenv
    add_at(y, 0.12 * unit(air) + 0.12 * unit(rumble), secs(0.35))
    y = filt(y, [("lp", 7000, 0.7), ("hp", 35, 0.7)])
    y = reverb(y, big_hall_ir(), 0.28)
    return finish_sfx(y, 2.1, fade=0.25)


def sfx_door_close(rng):
    n = secs(2.3)
    y = np.zeros(n)
    # brief air push before contact
    m = secs(0.16)
    push = filt(rng.standard_normal(m), [("bp", 420, 0.8)]) * np.linspace(0, 1, m) ** 2
    add_at(y, 0.12 * unit(push), 0)
    hit = secs(0.15)
    m = n - hit
    boom = chirp_sine(m, 95, 38, 0.03) * decay(m, 0.25, 0.0015)
    thud = burst(rng, m, 0.07, [("lp", 280, 0.7), ("lp", 350, 0.7)], 0.0005)
    crack = burst(rng, m, 0.004, [("bp", 2100, 0.8)], 0.0001)
    freqs = [96, 158, 231, 347, 509, 687, 934, 1287, 1712, 2377]
    taus = [1.1, 0.95, 0.8, 0.65, 0.5, 0.4, 0.3, 0.22, 0.16, 0.11]
    amps = [0.8, 1.0, 0.85, 0.7, 0.55, 0.45, 0.35, 0.25, 0.16, 0.1]
    ring = modal(m, freqs, taus, amps, rng) + 0.7 * modal(m, [f * 1.004 for f in freqs], taus,
                                                          amps, rng)
    latch = modal(m, [2650, 4100, 5600], [0.015, 0.01, 0.006], [1, .6, .3], rng)
    latchd = np.zeros(m)
    add_at(latchd, latch, secs(0.035))
    s = (1.0 * unit(boom) + 0.9 * unit(thud) + 0.35 * unit(crack) + 0.42 * unit(ring)
         + 0.2 * unit(latchd))
    add_at(y, s, hit)
    y = np.tanh(y / np.max(np.abs(y)) * 1.4)
    y = filt(y, [("lp", 6500, 0.7), ("hp", 30, 0.7)])
    y = reverb(y, big_hall_ir(), 0.35)
    return finish_sfx(y, 2.0, fade=0.3)


def sfx_footsteps(rng):
    n = secs(3.0)
    y = np.zeros(n)
    spacing = 0.76
    for i in range(4):
        st = 0.02 + i * spacing + rng.normal(0, 0.008)
        v = 0.88 + 0.12 * rng.random() - 0.05 * (i % 2)
        p = 1.0 + 0.06 * (i % 2) + rng.uniform(-0.03, 0.03)
        m = secs(0.4)
        heel_click = burst(rng, m, 0.0035, [("bp", 3300 * p, 0.9), ("hp", 1500, 0.7)], 0.0001)
        heel_knock = chirp_sine(m, 210 * p, 130 * p, 0.008) * decay(m, 0.022, 0.0004)
        heel_body = burst(rng, m, 0.012, [("lp", 900, 0.7), ("hp", 120, 0.7)], 0.0003)
        heel = 0.8 * unit(heel_click) + 0.6 * unit(heel_knock) + 0.6 * unit(heel_body)
        sole = burst(rng, m, 0.011, [("bp", 1250 * p, 0.8)], 0.0008)
        scuff = filt(rng.standard_normal(m) * env_pts(m, [(0, 0), (0.01, 1), (0.05, 0)]),
                     [("bp", 3000, 0.8)])
        add_at(y, v * heel, secs(st))
        add_at(y, v * (0.42 * unit(sole) + 0.06 * unit(scuff)), secs(st + 0.075 + rng.uniform(0, 0.015)))
    y = filt(y, [("lp", 8000, 0.7), ("hp", 60, 0.7)])
    # concrete hall: discrete slapback + diffuse tail
    slap = np.zeros(n)
    add_at(slap, y, secs(0.085))
    y = y + 0.12 * filt(slap, [("lp", 3000, 0.7)])
    y = reverb(y, big_hall_ir(), 0.32)
    return finish_sfx(y, 2.85, fade=0.35)


def sfx_light_clack(rng):
    n = secs(0.9)
    y = np.zeros(n)
    for off, a, s in [(0.0, 1.0, 1.0), (0.019, 0.6, 1.25)]:
        m = secs(0.3)
        mech = modal(m, [940 * s, 2310 * s, 3680 * s, 5520 * s], [0.012, 0.009, 0.006, 0.004],
                     [1, .8, .5, .3], rng)
        thunk = chirp_sine(m, 170, 105, 0.01) * decay(m, 0.03, 0.0005)
        snap = burst(rng, m, 0.003, [("bp", 2200 * s, 0.8)], 0.0001)
        add_at(y, a * (0.7 * unit(mech) + 0.9 * unit(thunk) + 0.5 * unit(snap)), secs(off))
    m = secs(0.85)
    t = tt(m)
    hum = sum((1.0 / k) * np.sin(TAU * 60 * k * t + rng.uniform(0, TAU)) for k in range(1, 22))
    hum = filt(hum, [("lp", 1400, 0.7), ("hp", 90, 0.7)])
    he = (1 - np.exp(-t / 0.02)) * np.exp(-t / 0.22)
    arc = np.zeros(m)
    idx = rng.integers(0, secs(0.07), 22)
    arc[idx] = rng.uniform(-1, 1, 22)
    arc = filt(arc, [("hp", 3000, 0.7), ("lp", 8000, 0.7)])
    add_at(y, 0.12 * unit(hum) * he + 0.05 * unit(arc), secs(0.022))
    y = filt(y, [("lp", 9000, 0.7), ("hp", 50, 0.7)])
    y = reverb(y, big_hall_ir(), 0.18)
    return finish_sfx(y, 0.8, fade=0.15)


def sfx_whoosh(rng):
    n = secs(1.1)
    w = colored(rng, n, -2.0)
    centre = env_pts(n, [(0, 220), (0.35, 600), (0.58, 1700), (0.8, 900), (1.1, 420)])
    a = sweep(w, "bp", centre, 0.9, 200, 1900, 24)
    b = sweep(w, "lp", centre * 0.6, 0.7, 120, 1200, 16)
    t = tt(n)
    env = np.where(t < 0.58, (t / 0.58) ** 2.2, np.exp(-(t - 0.58) / 0.16))
    env *= 1 - np.exp(-t / 0.05)
    y = (0.8 * unit(a) + 0.5 * unit(b)) * env
    y = filt(y, [("lp", 5000, 0.7), ("hp", 80, 0.7)])
    y = reverb(y, big_hall_ir(), 0.15)
    return finish_sfx(y, 1.0, fade=0.12)


def sfx_ui_tap(rng):
    n = secs(0.14)
    y = (modal(n, [2350, 3870, 5900], [0.016, 0.009, 0.005], [1.0, 0.42, 0.18], rng, 0.0004)
         + 0.55 * modal(n, [820], [0.011], [1.0], rng, 0.0004)
         + 0.25 * burst(rng, n, 0.0007, [("lp", 6000, 0.7)], 0.0001))
    y = filt(y, [("lp", 8000, 0.7), ("hp", 300, 0.7)])
    small = make_ir(np.random.default_rng([SEED, 5]), 0.35, hf=0.4, predelay=0.004, er_spread=0.02,
                    stereo=False)
    y = reverb(y, small, 0.12)
    return finish_sfx(y, 0.12, fade=0.03)


def sfx_ui_choice(rng):
    n = secs(0.55)
    thock = chirp_sine(n, 230, 160, 0.012) * decay(n, 0.05, 0.0008)
    wood = modal(n, [480, 1150, 1830], [0.045, 0.016, 0.008], [1.0, 0.45, 0.2], rng, 0.0006)
    tick = burst(rng, n, 0.006, [("lp", 1600, 0.7)], 0.0002)
    f0 = 1760.0
    shim = modal(n, [f0, f0 * 2.32, f0 * 4.25, f0 * 6.63], [0.28, 0.16, 0.09, 0.05],
                 [1, .45, .2, .08], rng, 0.003)
    shim_d = np.zeros(n)
    add_at(shim_d, shim, secs(0.012))
    y = unit(thock) + 0.7 * unit(wood) + 0.3 * unit(tick) + 0.16 * unit(shim_d)
    y = filt(y, [("lp", 9000, 0.7), ("hp", 70, 0.7)])
    small = make_ir(np.random.default_rng([SEED, 6]), 0.8, hf=0.5, predelay=0.008, er_spread=0.03,
                    stereo=False)
    y = reverb(y, small, 0.18)
    return finish_sfx(y, 0.5, fade=0.12)


def bell_note(rng, f, n, vel=1.0):
    ratios = [1.0, 2.0, 3.01, 4.17, 5.43]
    amps = [1.0, 0.32, 0.16, 0.07, 0.035]
    taus = [0.55, 0.32, 0.18, 0.11, 0.07]
    y = modal(n, [f * r for r in ratios], taus, amps, rng, 0.0025)
    y += 0.25 * modal(n, [f * 1.0015], [0.5], [1.0], rng, 0.0025)  # gentle beating
    y += 0.3 * modal(n, [f / 2], [0.35], [1.0], rng, 0.004)       # warmth below
    return y * vel


def sfx_stat_up(rng):
    n = secs(1.0)
    y = np.zeros(n)
    add_at(y, bell_note(rng, nf("A5"), n, 0.8), 0)
    add_at(y, bell_note(rng, nf("E6"), n, 1.0), secs(0.14))
    y = filt(y, [("lp", 7500, 0.7), ("hp", 200, 0.7), ("peak", 3000, 1.0, -2)])
    room = make_ir(np.random.default_rng([SEED, 7]), 1.3, hf=0.5, predelay=0.01, er_spread=0.03,
                   stereo=False)
    y = reverb(y, room, 0.3)
    return finish_sfx(y, 0.9, fade=0.2)


def sfx_impact_hit(rng):
    n = secs(1.7)
    boom = chirp_sine(n, 78, 31, 0.09) * decay(n, 0.5, 0.002)
    whomp = chirp_sine(n, 130, 55, 0.04) * decay(n, 0.18, 0.001)
    crack = burst(rng, n, 0.025, [("lp", 2600, 0.7), ("hp", 200, 0.7)], 0.0002)
    lowtex = burst(rng, n, 0.2, [("lp", 160, 0.7), ("lp", 200, 0.7)], 0.002)
    y = unit(boom) + 0.6 * unit(whomp) + 0.35 * unit(crack) + 0.5 * unit(lowtex)
    y = np.tanh(y / np.max(np.abs(y)) * 1.8)
    y = filt(y, [("lp", 7000, 0.7), ("hp", 24, 0.7)])
    y = reverb(y, big_hall_ir(), 0.25)
    return finish_sfx(y, 1.5, fade=0.4)


def sfx_thunder(rng):
    n = secs(6.5)
    t = tt(n)
    # crackle: irregular burst cluster, muffled by distance
    crk = np.zeros(n)
    times = np.cumsum(rng.exponential(0.025, 40)) + 0.02
    for i, ti in enumerate(times[times < 0.9]):
        m = secs(rng.uniform(0.004, 0.03))
        b = rng.standard_normal(m) * decay(m, m / SR / 3, 0.0003)
        add_at(crk, b * rng.uniform(0.3, 1.0) * math.exp(-ti / 0.45), secs(ti))
    crk = filt(crk, [("bp", 900, 0.6), ("lp", 1800, 0.7)])
    # rumble: brown noise with rolling envelope and a descending lowpass
    br = colored(rng, n, -6.0)
    rolls = np.zeros(n)
    for c, w, a in [(0.5, 0.35, 1.0), (1.2, 0.5, 0.85), (2.1, 0.7, 0.7), (3.2, 0.9, 0.45),
                    (4.4, 1.0, 0.25)]:
        rolls += a * np.exp(-((t - c - rng.uniform(-0.1, 0.1)) / w) ** 2)
    rolls *= 0.75 + 0.25 * np.clip(smooth_noise(rng, n, 4.0, circular=False), -2, 2)
    rolls *= 1 - np.exp(-t / 0.15)
    cut = env_pts(n, [(0, 900), (0.6, 600), (2.0, 300), (4.0, 170), (6.5, 120)])
    rum = sweep(br, "lp", cut, 0.7, 110, 950, 20)
    rum = filt(rum, [("lp", 1200, 0.7), ("hp", 22, 0.7)]) * rolls
    sub = filt(colored(rng, n, -6.0), [("lp", 60, 0.7), ("hp", 20, 0.7)]) * rolls
    y = 0.35 * unit(crk) * np.max(rolls) + unit(rum) + 0.6 * unit(sub)
    ir = make_ir(np.random.default_rng([SEED, 11]), 3.5, hf=0.3, predelay=0.05, er_spread=0.2,
                 stereo=False)
    y = reverb(y, ir, 0.45)
    y = fade_out(y, 1.6)
    return finish_sfx(y, 6.0, fade=0.8)


# ==========================================================================
# SCENE 02: the drive, the bunker, the laboratory
# ==========================================================================
def amb_car(rng):
    """Riding through the city in the rain: tyre hiss on wet tarmac, a smooth
    V8 well under it, and the odd wash of passing traffic."""
    T = 16.0
    n = secs(T)
    t = tt(n)
    C = True
    hiss = np.stack([colored(rng, n, -1.5), colored(rng, n, -1.5)])
    hiss = filt(hiss, [("hp", 700, 0.6), ("peak", 2600, 0.8, 4), ("lp", 6500, 0.6)], circular=C)
    hiss *= 1.0 + 0.08 * np.sin(TAU * (3 / T) * t)
    road = filt(np.stack([colored(rng, n, -6.0), colored(rng, n, -6.0)]), [("lp", 220, 0.7), ("hp", 28, 0.7)], circular=C)
    f0 = qf(41.0, T)
    engine = sum((0.9 / k) * np.sin(TAU * qf(f0 * k, T) * t + rng.uniform(0, TAU)) for k in (1, 2, 3, 4, 6))
    engine = filt(engine, [("lp", 260, 0.7)], circular=C) * (1.0 + 0.05 * np.sin(TAU * (2 / T) * t))
    passes = np.zeros((2, n))
    for at, p in [(2.5, -0.6), (9.0, 0.5), (13.2, -0.3)]:
        m = secs(2.4)
        w = colored(rng, m, -2.0)
        centre = env_pts(m, [(0, 300), (1.0, 1400), (1.3, 1700), (2.4, 350)])
        whoosh = sweep(w, "bp", centre, 0.8, 250, 1900, 18) * np.sin(math.pi * np.linspace(0, 1, m)) ** 2
        add_at(passes, pan(unit(whoosh), p), secs(at), circular=C)
    mix = 0.55 * unit(hiss) + 0.5 * unit(road) + 0.25 * np.stack([unit(engine)] * 2) + 0.35 * passes
    return normalise(mix, -6.0, -24.0)


def amb_bunker(rng):
    """Four storeys down: ventilation, mains hum, far-off metal settling."""
    T = 20.0
    n = secs(T)
    t = tt(n)
    C = True
    air = np.stack([colored(rng, n, -4.5), colored(rng, n, -4.5)])
    air = filt(air, [("hp", 40, 0.7), ("lp", 700, 0.6), ("peak", 120, 1.2, 5)], circular=C)
    air *= 1.0 + 0.06 * np.sin(TAU * (2 / T) * t)
    hum = sum((1.0 / k ** 1.3) * np.sin(TAU * qf(50.0 * k, T) * t + rng.uniform(0, TAU)) for k in range(1, 9))
    hum = filt(hum, [("lp", 600, 0.7)], circular=C)
    ir = make_ir(rng, 3.2, hf=0.35, predelay=0.04, er_spread=0.12)
    clanks = np.zeros(n)
    for at in (3.1, 8.4, 14.7, 17.9):
        m = secs(0.6)
        b = rng.uniform(0.8, 1.25)
        hit = modal(m, [310 * b, 790 * b, 1460 * b, 2210 * b], [0.18, 0.1, 0.06, 0.04], [1, .6, .35, .2], rng)
        add_at(clanks, hit * rng.uniform(0.3, 1.0), secs(at), circular=C)
    clanks = filt(clanks, [("lp", 2500, 0.7)], circular=C)
    mix = (unit(air) + 0.12 * np.stack([unit(hum)] * 2)
           + reverb(0.18 * unit(clanks), ir, 1.0, dry=0.1, circular=C))
    return normalise(mix, -6.0, -30.0)


def amb_lab(rng):
    """Clean-room air, electrical hum, a far-off cooling throb and the polite
    two-note beeps of instruments doing their work."""
    T = 20.0
    n = secs(T)
    t = tt(n)
    C = True
    air = np.stack([colored(rng, n, -3.5), colored(rng, n, -3.5)])
    air = filt(air, [("hp", 80, 0.7), ("lp", 1600, 0.6), ("ls", 300, 0.7, 3)], circular=C)
    hum = sum((1.0 / k ** 1.5) * np.sin(TAU * qf(60.0 * k, T) * t + rng.uniform(0, TAU)) for k in range(1, 7))
    whine = np.sin(TAU * qf(7350.0, T) * t) * (0.5 + 0.5 * np.sin(TAU * (1 / T) * t))
    throb = np.sin(TAU * qf(33.0, T) * t) * (0.6 + 0.4 * np.sin(TAU * (5 / T) * t)) ** 2
    beeps = np.zeros((2, n))
    for at, f, p in [(1.4, 1568, -0.5), (6.1, 1318, 0.4), (10.8, 1568, -0.2), (15.3, 1760, 0.6)]:
        for k, ff in enumerate((f, f * 1.25)):
            m = secs(0.16)
            b = np.sin(TAU * ff * tt(m)) * decay(m, 0.05, 0.002)
            add_at(beeps, pan(b, p), secs(at + k * 0.13), circular=C)
    room = make_ir(rng, 1.4, hf=0.5, predelay=0.015, er_spread=0.05)
    mix = (unit(air) + 0.07 * np.stack([unit(hum)] * 2) + 0.004 * np.stack([unit(whine)] * 2)
           + 0.2 * np.stack([unit(throb)] * 2) + reverb(0.05 * unit(beeps), room, 0.6, circular=C))
    return normalise(mix, -6.0, -29.0)


def music_drive(rng):
    """Night drive: a patient filtered-bass pulse under cold minor chords."""
    bpm = 84.0
    beat = 60.0 / bpm
    T = 32 * beat
    n = secs(T)
    t = tt(n)
    C = True
    bar = 4 * beat
    segs = [(0, 2 * bar, {"A2", "C3", "E3", "A3"}), (2 * bar, 4 * bar, {"F2", "A2", "C3", "E3"}),
            (4 * bar, 6 * bar, {"C3", "E3", "G3", "B3"}), (6 * bar, 8 * bar, {"G2", "B2", "D3", "E3"})]
    envs = chord_envs(n, segs, 1.2)
    pad = np.zeros((2, n))
    for nt, e in envs.items():
        pad += pad_voice(rng, nf(nt), n, T) * e
    pad = filt(pad, [("lp", 900, 0.6), ("lp", 1300, 0.7), ("hp", 60, 0.7)], circular=C)
    pad *= 0.8 + 0.2 * np.sin(TAU * (4 / T) * t)
    roots = ["A1", "F1", "C2", "G1"]
    bass = np.zeros(n)
    for i in range(64):
        f = qf(nf(roots[i // 16]), T)
        m = secs(beat / 2)
        note = saw(f, m, rng.random()) * decay(m, 0.16, 0.004) * (1.0 if i % 2 == 0 else 0.6)
        add_at(bass, note, secs(i * beat / 2), circular=C)
    cut = 260 + 220 * (0.5 + 0.5 * np.sin(TAU * (2 / T) * t))
    bass = sweep(bass, "lp", cut, 1.4, 200, 520, 14)
    bells = np.zeros((2, n))
    for b, nt in [(2.0, "E5"), (9.5, "C5"), (18.0, "G5"), (25.5, "D5"), (29.0, "B4")]:
        add_at(bells, pan(bell_note(rng, nf(nt), secs(3.0), 0.5), rng.uniform(-0.5, 0.5)), secs(b * beat), circular=C)
    ir = make_ir(rng, 3.0, hf=0.4, predelay=0.03, er_spread=0.07)
    mix = (reverb(0.5 * unit(pad), ir, 0.4, circular=C) + 0.4 * np.stack([unit(bass)] * 2)
           + reverb(0.12 * unit(bells), ir, 0.8, circular=C))
    mix = filt(mix, [("lp", 8000, 0.7), ("hp", 28, 0.7)], circular=C)
    return normalise(mix, -6.0, -21.0)


def music_chronos(rng):
    """The laboratory: a glassy, clock-like arpeggio over a cold suspended pad
    and a slow sub pulse. Curious more than ominous."""
    bpm = 72.0
    beat = 60.0 / bpm
    T = 32 * beat
    n = secs(T)
    t = tt(n)
    C = True
    bar = 4 * beat
    segs = [(0, 2 * bar, {"E2", "B2", "F#3", "G#3"}), (2 * bar, 4 * bar, {"C2", "G2", "D3", "E3"}),
            (4 * bar, 6 * bar, {"A1", "E2", "B2", "C#3"}), (6 * bar, 8 * bar, {"B1", "F#2", "A2", "D#3"})]
    envs = chord_envs(n, segs, 1.6)
    pad = np.zeros((2, n))
    for nt, e in envs.items():
        pad += pad_voice(rng, nf(nt), n, T, detunes=(-6, 0, 7)) * e
    pad = filt(pad, [("lp", 700, 0.6), ("lp", 1000, 0.7), ("hp", 45, 0.7)], circular=C)
    arps = [["E4", "B4", "F#5", "G#5"], ["E4", "G4", "D5", "E5"], ["C#4", "E4", "B4", "C#5"], ["D#4", "F#4", "A4", "D#5"]]
    arp = np.zeros((2, n))
    for i in range(128):
        chord = arps[i // 32]
        nt = chord[[0, 1, 2, 3, 2, 1, 3, 1][i % 8]]
        v = 0.28 + 0.12 * (i % 4 == 0)
        add_at(arp, pan(bell_note(rng, nf(nt), secs(1.4), v), 0.35 * math.sin(i * 0.4)), secs(i * beat / 4), circular=C)
    arp = filt(arp, [("lp", 5200, 0.7), ("hp", 300, 0.7)], circular=C)
    arp *= (0.55 + 0.45 * np.sin(TAU * (2 / T) * t - math.pi / 2) ** 2)[None, :]
    sub = np.zeros(n)
    for i in range(16):
        add_at(sub, sub_hit(secs(2.0), qf(nf(["E2", "C2", "A1", "B1"][i // 4]), T), tau=0.7, attack=0.06), secs(i * 2 * beat), circular=C)
    sub = filt(sub, [("lp", 140, 0.7)], circular=C)
    ir = make_ir(rng, 3.6, hf=0.45, predelay=0.03, er_spread=0.08)
    mix = (reverb(0.5 * unit(pad), ir, 0.45, circular=C) + reverb(0.16 * unit(arp), ir, 0.7, circular=C)
           + 0.2 * np.stack([unit(sub)] * 2))
    mix = filt(mix, [("lp", 9000, 0.7), ("hp", 28, 0.7)], circular=C)
    return normalise(mix, -6.0, -21.0)


def sfx_engine(rng):
    """A big saloon pulling up (or away): engine note rising, tyres on wet stone."""
    n = secs(4.5)
    t = tt(n)
    f = env_pts(n, [(0, 34), (1.2, 46), (2.6, 58), (4.5, 40)])
    ph = TAU * np.cumsum(f) / SR
    eng = sum((1.0 / k) * np.sin(k * ph + rng.uniform(0, TAU)) for k in (1, 2, 3, 4, 5, 6, 8))
    eng = filt(eng, [("lp", 520, 0.7), ("hp", 25, 0.7)])
    tyre = filt(colored(rng, n, -1.5), [("hp", 900, 0.6), ("lp", 5000, 0.6)])
    amp = env_pts(n, [(0, 0), (0.6, 0.8), (2.6, 1.0), (4.5, 0.0)])
    y = (unit(eng) + 0.35 * unit(tyre)) * amp
    y = reverb(y, big_hall_ir(), 0.12)
    return finish_sfx(y, 4.4, fade=0.6)


def sfx_car_pass(rng):
    n = secs(2.4)
    w = colored(rng, n, -2.0)
    centre = env_pts(n, [(0, 300), (0.9, 1300), (1.15, 1800), (2.4, 300)])
    hiss = sweep(w, "bp", centre, 0.8, 250, 2000, 20)
    f = env_pts(n, [(0, 62), (1.05, 58), (1.2, 46), (2.4, 42)])
    eng = sum((1.0 / k) * np.sin(k * TAU * np.cumsum(f) / SR) for k in (1, 2, 3, 4))
    eng = filt(eng, [("lp", 400, 0.7)])
    env = np.sin(math.pi * np.linspace(0, 1, n)) ** 3
    y = (unit(hiss) + 0.5 * unit(eng)) * env
    p = np.linspace(-0.8, 0.8, n)
    y = np.stack([y * np.cos((p + 1) * math.pi / 4), y * np.sin((p + 1) * math.pi / 4)]) * math.sqrt(2)
    return finish_sfx(y, 2.3, fade=0.3)


def sfx_scan(rng):
    """Scanner sweep: a soft rising tone with a shimmering tremolo, then a confirm blip."""
    n = secs(2.8)
    t = tt(n)
    tone = chirp_sine(n, 520, 1900, 1.2) * (0.6 + 0.4 * np.sin(TAU * 22 * t))
    tone *= env_pts(n, [(0, 0), (0.2, 0.8), (2.1, 0.8), (2.4, 0), (2.8, 0)])
    buzz = filt(rng.standard_normal(n), [("bp", 3000, 2.0)]) * env_pts(n, [(0, 0), (0.3, 0.3), (2.1, 0.3), (2.3, 0), (2.8, 0)])
    blip = np.zeros(n)
    add_at(blip, np.sin(TAU * 1760 * tt(secs(0.12))) * decay(secs(0.12), 0.04, 0.002), secs(2.42))
    y = filt(unit(tone) + 0.2 * unit(buzz) + 0.8 * unit(blip), [("lp", 7000, 0.7), ("hp", 200, 0.7)])
    y = reverb(y, big_hall_ir(), 0.2)
    return finish_sfx(y, 2.8, fade=0.2)


def sfx_access(rng):
    n = secs(1.2)
    y = np.zeros(n)
    for k, nt in enumerate(("E6", "B6")):
        m = secs(0.5)
        add_at(y, np.sin(TAU * nf(nt) * tt(m)) * decay(m, 0.12, 0.003), secs(k * 0.11))
    clunk = chirp_sine(secs(0.3), 140, 80, 0.02) * decay(secs(0.3), 0.05, 0.001)
    add_at(y, 1.4 * clunk + 0.4 * burst(rng, secs(0.3), 0.01, [("lp", 2000, 0.7)]), secs(0.32))
    y = filt(y, [("lp", 9000, 0.7), ("hp", 60, 0.7)])
    y = reverb(y, big_hall_ir(), 0.15)
    return finish_sfx(y, 1.1, fade=0.25)


def sfx_denied(rng):
    n = secs(0.6)
    t = tt(n)
    y = np.sign(np.sin(TAU * 220 * t)) * env_pts(n, [(0, 0), (0.01, 1), (0.22, 1), (0.25, 0), (0.3, 0), (0.31, 1), (0.52, 1), (0.55, 0), (0.6, 0)])
    y = filt(y, [("lp", 2400, 0.7)])
    return finish_sfx(y, 0.6, fade=0.04)


def sfx_airlock(rng):
    """Heavy door: seal release hiss, a long motorised slide, a solid stop."""
    n = secs(3.0)
    hiss = filt(colored(rng, n, -1.0), [("hp", 1800, 0.6), ("lp", 9000, 0.6)]) * env_pts(n, [(0, 0), (0.03, 1), (0.6, 0.25), (1.2, 0), (3, 0)])
    rumble = filt(colored(rng, n, -5.0), [("lp", 180, 0.7), ("hp", 30, 0.7)]) * env_pts(n, [(0, 0), (0.4, 0), (0.8, 1), (2.2, 1), (2.45, 0), (3, 0)])
    f = env_pts(n, [(0, 90), (0.6, 90), (1.0, 140), (2.2, 150), (2.45, 90), (3, 90)])
    motor = filt(np.sin(TAU * np.cumsum(f) / SR) + 0.3 * np.sin(2 * TAU * np.cumsum(f) / SR), [("lp", 500, 0.7)])
    motor *= env_pts(n, [(0, 0), (0.5, 0), (0.8, 0.6), (2.2, 0.6), (2.45, 0), (3, 0)])
    stop = np.zeros(n)
    add_at(stop, chirp_sine(secs(0.4), 110, 55, 0.04) * decay(secs(0.4), 0.09, 0.001), secs(2.42))
    y = 0.5 * unit(hiss) + unit(rumble) + 0.35 * unit(motor) + 1.2 * unit(stop)
    y = reverb(y, big_hall_ir(), 0.3)
    return finish_sfx(y, 3.0, fade=0.3)


def sfx_barrier(rng):
    n = secs(2.0)
    f = env_pts(n, [(0, 160), (0.3, 240), (1.5, 260), (1.7, 150), (2, 150)])
    motor = np.sin(TAU * np.cumsum(f) / SR) + 0.4 * np.sin(3 * TAU * np.cumsum(f) / SR)
    motor = filt(motor, [("lp", 1500, 0.7)]) * env_pts(n, [(0, 0), (0.1, 1), (1.55, 1), (1.7, 0), (2, 0)])
    clack = np.zeros(n)
    add_at(clack, modal(secs(0.3), [620, 1500, 2700], [0.05, 0.03, 0.015], [1, .5, .3], rng), secs(1.62))
    y = 0.5 * unit(motor) + unit(clack)
    y = reverb(y, big_hall_ir(), 0.2)
    return finish_sfx(y, 2.0, fade=0.2)


def _machine(rng, rising, dur):
    n = secs(dur)
    t = tt(n)
    k = np.clip(t / (dur * 0.85), 0, 1)
    k = k if rising else 1 - k
    f = 26 + 84 * k ** 1.4
    ph = TAU * np.cumsum(f) / SR
    hum = sum((1.0 / h) * np.sin(h * ph + rng.uniform(0, TAU)) for h in (1, 2, 3, 4, 5))
    whine = np.sin(TAU * np.cumsum(300 + 1400 * k ** 1.6) / SR) * k ** 2
    air = filt(colored(rng, n, -2.0), [("bp", 900, 0.6)]) * k
    amp = (0.25 + 0.75 * k) * env_pts(n, [(0, 0), (0.15, 1), (dur - 0.6, 1), (dur, 0)])
    y = (unit(filt(hum, [("lp", 700, 0.7)])) + 0.12 * unit(whine) + 0.15 * unit(air)) * amp
    ir = make_ir(np.random.default_rng([SEED, 4242]), 3.0, hf=0.4, predelay=0.03, er_spread=0.1, stereo=True)
    return reverb(y, ir, 0.35)


def sfx_spinup(rng):
    return finish_sfx(_machine(rng, True, 5.0), 5.4, fade=0.6)


def sfx_spindown(rng):
    return finish_sfx(_machine(rng, False, 4.5), 4.8, fade=0.8)


def sfx_pulse(rng):
    """The discharge: a reversed shimmer drawing in, then a deep soft concussion."""
    n = secs(3.4)
    pre = secs(0.7)
    shimmer = modal(pre, [1320, 1980, 2970, 4450], [0.5, 0.35, 0.25, 0.15], [1, .7, .5, .3], rng, 0.003)
    shimmer = (shimmer + 0.3 * filt(rng.standard_normal(pre), [("hp", 4000, 0.7)]) * decay(pre, 0.3))[::-1]
    boom = chirp_sine(n, 95, 28, 0.25) * decay(n, 0.7, 0.002)
    crack = burst(rng, n, 0.012, [("bp", 2400, 0.6)], 0.0002)
    tail = filt(colored(rng, n, -3.0), [("lp", 1200, 0.7)]) * decay(n, 0.5, 0.01)
    y = np.zeros(n + pre)
    add_at(y, 0.4 * unit(shimmer), 0)
    add_at(y, unit(boom) + 0.3 * unit(crack) + 0.3 * unit(tail), pre)
    y = np.tanh(y / np.max(np.abs(y)) * 1.5)
    ir = make_ir(np.random.default_rng([SEED, 4243]), 3.6, hf=0.4, predelay=0.03, er_spread=0.1)
    y = reverb(filt(y, [("lp", 9000, 0.7), ("hp", 22, 0.7)]), ir, 0.4)
    return finish_sfx(y, 3.6, fade=0.8)


def amb_room(rng):
    """Rookie's room at night: rain on the window, muffled, and a quiet room tone."""
    T = 20.0
    n = secs(T)
    t = tt(n)
    C = True
    rain = np.stack([colored(rng, n, -3.0), colored(rng, n, -3.0)])
    rain = filt(rain, [("hp", 200, 0.6), ("lp", 1800, 0.6), ("lp", 2600, 0.7)], circular=C)
    rain *= 1.0 + 0.1 * np.sin(TAU * (3 / T) * t)
    drops = np.zeros(n)
    times = rng.uniform(0, T, 260)
    for at in times:
        m = secs(0.03)
        d = filt(rng.standard_normal(m) * decay(m, 0.004, 0.0003), [("bp", rng.uniform(1800, 3200), 1.2)])
        add_at(drops, d * rng.uniform(0.2, 1.0), secs(at), circular=C)
    tone = filt(colored(rng, n, -5.0), [("lp", 300, 0.7), ("hp", 30, 0.7)], circular=C)
    mix = unit(rain) + 0.25 * np.stack([unit(drops)] * 2) + 0.35 * np.stack([unit(tone)] * 2)
    return normalise(mix, -6.0, -28.0)


def sfx_phone_buzz(rng):
    """A phone vibrating on a wooden nightstand: two long buzzes."""
    n = secs(2.4)
    t = tt(n)
    motor = np.sign(np.sin(TAU * 172 * t)) * 0.6 + np.sin(TAU * 344 * t) * 0.4
    rattle = filt(rng.standard_normal(n), [("bp", 900, 2.0)]) * (0.5 + 0.5 * np.sign(np.sin(TAU * 29 * t)))
    gate = env_pts(n, [(0, 0), (0.02, 1), (0.75, 1), (0.8, 0), (1.1, 0), (1.12, 1), (1.85, 1), (1.9, 0), (2.4, 0)])
    y = (unit(filt(motor, [("lp", 1600, 0.7)])) + 0.5 * unit(rattle)) * gate
    small = make_ir(np.random.default_rng([SEED, 31]), 0.5, hf=0.5, predelay=0.004, er_spread=0.02, stereo=False)
    return finish_sfx(reverb(y, small, 0.15), 2.4, fade=0.05)


def sfx_phone_hangup(rng):
    n = secs(0.9)
    y = np.zeros(n)
    for k in range(3):
        m = secs(0.16)
        add_at(y, np.sin(TAU * 480 * tt(m)) * env_pts(m, [(0, 0), (0.01, 1), (0.14, 1), (0.16, 0)]), secs(k * 0.28))
    y = filt(y, [("bp", 900, 0.5)])
    return finish_sfx(y, 0.9, fade=0.05)


def sfx_knock(rng):
    """Three knuckle knocks on a wooden door."""
    n = secs(1.2)
    y = np.zeros(n)
    for at, a in [(0.0, 1.0), (0.24, 0.85), (0.46, 1.0)]:
        m = secs(0.25)
        b = rng.uniform(0.95, 1.05)
        hit = modal(m, [190 * b, 430 * b, 820 * b, 1400 * b], [0.05, 0.03, 0.018, 0.01], [1, .6, .35, .2], rng, 0.0005)
        hit += 0.4 * burst(rng, m, 0.004, [("lp", 2500, 0.7)], 0.0002)
        add_at(y, a * hit, secs(at))
    room = make_ir(np.random.default_rng([SEED, 32]), 0.7, hf=0.5, predelay=0.006, er_spread=0.03, stereo=False)
    return finish_sfx(reverb(filt(y, [("hp", 70, 0.7)]), room, 0.25), 1.1, fade=0.2)


def sfx_lamp_click(rng):
    n = secs(0.25)
    y = modal(n, [2100, 3900, 6100], [0.01, 0.007, 0.004], [1, .5, .25], rng, 0.0002)
    y += 0.5 * burst(rng, n, 0.002, [("hp", 1500, 0.7)], 0.0001)
    return finish_sfx(y, 0.2, fade=0.03)


# ==========================================================================
# SCENE 03: the first human transfer, and the city one year earlier
# ==========================================================================
def amb_street(rng):
    """Dawn on the avenue a year ago: far-off traffic, a few birds, the city waking."""
    T = 20.0
    n = secs(T)
    t = tt(n)
    C = True
    hum = filt(np.stack([colored(rng, n, -4.0), colored(rng, n, -4.0)]), [("hp", 50, 0.7), ("lp", 500, 0.6)], circular=C)
    hum *= 1.0 + 0.1 * np.sin(TAU * (2 / T) * t)
    birds = np.zeros((2, n))
    for _ in range(26):
        at = rng.uniform(0, T)
        f0 = rng.uniform(2600, 4200)
        for k in range(int(rng.integers(2, 5))):
            m = secs(0.09)
            tt_ = tt(m)
            chirp = np.sin(TAU * np.cumsum(f0 * (1 + 0.35 * np.sin(TAU * 18 * tt_))) / SR) * decay(m, 0.03, 0.004)
            add_at(birds, pan(chirp, rng.uniform(-0.8, 0.8)), secs(at + k * 0.12), circular=C)
    passes = np.zeros((2, n))
    for at, pn in [(4.0, -0.6), (13.0, 0.5)]:
        m = secs(3.0)
        w = colored(rng, m, -2.5)
        centre = env_pts(m, [(0, 250), (1.4, 900), (3.0, 250)])
        whoosh = sweep(w, "bp", centre, 0.7, 200, 1200, 16) * np.sin(math.pi * np.linspace(0, 1, m)) ** 2
        add_at(passes, pan(unit(whoosh), pn), secs(at), circular=C)
    room = make_ir(rng, 1.8, hf=0.5, predelay=0.02, er_spread=0.08)
    mix = unit(hum) + reverb(0.05 * unit(birds), room, 0.5, circular=C) + 0.3 * passes
    return normalise(mix, -6.0, -27.0)


def music_past(rng):
    """The past: a slow, slightly detuned music-box figure over a warm pad. Not quite real."""
    bpm = 66.0
    beat = 60.0 / bpm
    T = 32 * beat
    n = secs(T)
    t = tt(n)
    C = True
    bar = 4 * beat
    segs = [(0, 2 * bar, {"D3", "F#3", "A3", "E4"}), (2 * bar, 4 * bar, {"B2", "D3", "F#3", "A3"}),
            (4 * bar, 6 * bar, {"G2", "B2", "D3", "F#3"}), (6 * bar, 8 * bar, {"A2", "C#3", "E3", "B3"})]
    envs = chord_envs(n, segs, 1.8)
    pad = np.zeros((2, n))
    for nt, e in envs.items():
        pad += pad_voice(rng, nf(nt), n, T, detunes=(-9, 0, 8)) * e
    pad = filt(pad, [("lp", 1100, 0.6), ("lp", 1600, 0.7), ("hp", 70, 0.7)], circular=C)
    box = np.zeros((2, n))
    tune = ["A5", "F#5", "D5", "E5", "F#5", "A5", "B5", "A5", "F#5", "D5", "B4", "D5", "E5", "C#5", "A4", "E5"]
    for i, nt in enumerate(tune):
        f = nf(nt) * (1 + 0.004 * math.sin(i * 1.3))
        add_at(box, pan(bell_note(rng, f, secs(2.0), 0.35), 0.3 * math.sin(i)), secs(i * 2 * beat), circular=C)
    box = filt(box, [("lp", 6000, 0.7), ("hp", 400, 0.7)], circular=C)
    wobble = 1.0 + 0.06 * np.sin(TAU * (3 / T) * t)
    ir = make_ir(rng, 4.2, hf=0.5, predelay=0.04, er_spread=0.1)
    mix = (reverb(0.5 * unit(pad), ir, 0.5, circular=C) * wobble + reverb(0.18 * unit(box), ir, 0.75, circular=C))
    mix = filt(mix, [("lp", 9000, 0.7), ("hp", 30, 0.7)], circular=C)
    return normalise(mix, -6.0, -21.0)


def sfx_beep(rng):
    n = secs(0.5)
    y = np.sin(TAU * 1320 * tt(n)) * env_pts(n, [(0, 0), (0.005, 1), (0.16, 1), (0.2, 0), (0.5, 0)])
    y = filt(y, [("bp", 1500, 0.6)])
    room = make_ir(np.random.default_rng([SEED, 41]), 1.2, hf=0.5, predelay=0.01, er_spread=0.04, stereo=False)
    return finish_sfx(reverb(y, room, 0.25), 0.5, fade=0.1)


def sfx_warp(rng):
    """Time giving way: a pitch that slides down and away, smeared, with the world's noise sucked out."""
    n = secs(4.0)
    t = tt(n)
    f = env_pts(n, [(0, 900), (1.5, 420), (3.0, 90), (4.0, 40)])
    tone = np.sin(TAU * np.cumsum(f) / SR) + 0.5 * np.sin(TAU * np.cumsum(f * 1.503) / SR)
    noise = colored(rng, n, -1.5)
    centre = env_pts(n, [(0, 6000), (2.0, 1500), (4.0, 200)])
    air = sweep(noise, "bp", centre, 0.8, 150, 7000, 24)
    amp = env_pts(n, [(0, 0), (0.6, 1), (3.0, 0.8), (4.0, 0)])
    y = (0.6 * unit(tone) + unit(air)) * amp
    y = np.stack([y * (1 + 0.3 * np.sin(TAU * 0.7 * t)), y * (1 - 0.3 * np.sin(TAU * 0.7 * t))])
    ir = make_ir(np.random.default_rng([SEED, 42]), 4.5, hf=0.4, predelay=0.03, er_spread=0.1)
    return finish_sfx(reverb(y, ir, 0.5), 4.4, fade=0.8)


def sfx_beacon(rng):
    """The return signal finding him: three rising chirps."""
    n = secs(1.2)
    y = np.zeros(n)
    for k, f in enumerate((1200, 1600, 2100)):
        m = secs(0.18)
        add_at(y, chirp_sine(m, f, f * 1.2, 0.08) * decay(m, 0.07, 0.003), secs(k * 0.2))
    return finish_sfx(filt(y, [("hp", 600, 0.7)]), 1.1, fade=0.15)


def sfx_reappear(rng):
    """Arriving back: a reversed rush that lands in a soft low thump."""
    n = secs(2.4)
    pre = secs(1.0)
    rush = filt(colored(rng, pre, -1.5), [("hp", 800, 0.6)]) * np.linspace(0, 1, pre) ** 2
    thump = chirp_sine(secs(1.2), 80, 40, 0.15) * decay(secs(1.2), 0.35, 0.002)
    y = np.zeros(n)
    add_at(y, 0.5 * unit(rush), 0)
    add_at(y, unit(thump), pre)
    ir = make_ir(np.random.default_rng([SEED, 43]), 3.0, hf=0.4, predelay=0.02, er_spread=0.1, stereo=False)
    return finish_sfx(reverb(y, ir, 0.35), 2.4, fade=0.5)


# ==========================================================================
# registry / output
# ==========================================================================
SOUNDS = [
    ("amb_rain", amb_rain, "amb"),
    ("amb_gym", amb_gym, "amb"),
    ("music_theme", music_theme, "amb"),
    ("music_tension", music_tension, "amb"),
    ("music_resolve", music_resolve, "amb"),
    ("amb_car", amb_car, "amb"),
    ("amb_bunker", amb_bunker, "amb"),
    ("amb_lab", amb_lab, "amb"),
    ("amb_room", amb_room, "amb"),
    ("amb_street", amb_street, "amb"),
    ("music_past", music_past, "amb"),
    ("music_drive", music_drive, "amb"),
    ("music_chronos", music_chronos, "amb"),
    ("sfx_thunder", sfx_thunder, "sfx"),
    ("sfx_punch_1", sfx_punch_1, "sfx"),
    ("sfx_punch_2", sfx_punch_2, "sfx"),
    ("sfx_punch_3", sfx_punch_3, "sfx"),
    ("sfx_punch_big", sfx_punch_big, "sfx"),
    ("sfx_chain", sfx_chain, "sfx"),
    ("sfx_tape", sfx_tape, "sfx"),
    ("sfx_body_fall", sfx_body_fall, "sfx"),
    ("sfx_door_open", sfx_door_open, "sfx"),
    ("sfx_door_close", sfx_door_close, "sfx"),
    ("sfx_footsteps", sfx_footsteps, "sfx"),
    ("sfx_light_clack", sfx_light_clack, "sfx"),
    ("sfx_whoosh", sfx_whoosh, "sfx"),
    ("sfx_ui_tap", sfx_ui_tap, "sfx"),
    ("sfx_ui_choice", sfx_ui_choice, "sfx"),
    ("sfx_stat_up", sfx_stat_up, "sfx"),
    ("sfx_impact_hit", sfx_impact_hit, "sfx"),
    ("sfx_engine", sfx_engine, "sfx"),
    ("sfx_car_pass", sfx_car_pass, "sfx"),
    ("sfx_scan", sfx_scan, "sfx"),
    ("sfx_access", sfx_access, "sfx"),
    ("sfx_denied", sfx_denied, "sfx"),
    ("sfx_airlock", sfx_airlock, "sfx"),
    ("sfx_barrier", sfx_barrier, "sfx"),
    ("sfx_spinup", sfx_spinup, "sfx"),
    ("sfx_spindown", sfx_spindown, "sfx"),
    ("sfx_pulse", sfx_pulse, "sfx"),
    ("sfx_phone_buzz", sfx_phone_buzz, "sfx"),
    ("sfx_phone_hangup", sfx_phone_hangup, "sfx"),
    ("sfx_knock", sfx_knock, "sfx"),
    ("sfx_lamp_click", sfx_lamp_click, "sfx"),
    ("sfx_beep", sfx_beep, "sfx"),
    ("sfx_warp", sfx_warp, "sfx"),
    ("sfx_beacon", sfx_beacon, "sfx"),
    ("sfx_reappear", sfx_reappear, "sfx"),
]


def write_wav(path, x, rng):
    data = x.T if x.ndim == 2 else x[:, None]
    dither = (rng.random(data.shape) - rng.random(data.shape))
    pcm = np.clip(np.round(data * 32767.0 + dither), -32768, 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(data.shape[1])
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def encode(wav, name, kind):
    br = "96k" if kind == "amb" else "64k"
    base = os.path.join(OUT_DIR, name)
    common = [FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", wav, "-map_metadata", "-1"]
    subprocess.run(common + ["-c:a", "libopus", "-b:a", br, "-vbr", "on",
                             "-application", "audio", base + ".webm"], check=True)
    subprocess.run(common + ["-c:a", "libmp3lame", "-q:a", "4", base + ".mp3"], check=True)


def main():
    only = set(sys.argv[1:])
    os.makedirs(OUT_DIR, exist_ok=True)
    t_all = time.time()
    with tempfile.TemporaryDirectory(prefix="underworld-audio-") as tmp:
        for name, fn, kind in SOUNDS:
            if only and name not in only:
                continue
            t0 = time.time()
            rng = np.random.default_rng([SEED, zlib.crc32(name.encode())])
            x = np.asarray(fn(rng), dtype=float)
            if not np.all(np.isfinite(x)):
                raise RuntimeError(f"{name}: non-finite samples")
            wav = os.path.join(tmp, name + ".wav")
            write_wav(wav, x, np.random.default_rng([SEED, 1, zlib.crc32(name.encode())]))
            encode(wav, name, kind)
            pk = 20 * math.log10(np.max(np.abs(x)) + 1e-12)
            ch = x.shape[0] if x.ndim == 2 else 1
            print(f"{name:18s} {x.shape[-1] / SR:6.2f}s  ch={ch}  peak={pk:6.1f} dBFS  "
                  f"rms={20 * math.log10(rms(x)):6.1f} dBFS  ({time.time() - t0:4.1f}s)")
    print(f"done in {time.time() - t_all:.1f}s -> {OUT_DIR}")


if __name__ == "__main__":
    main()
