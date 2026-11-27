// Inline SVG icon set (no icon font / external requests). Coloured icons
// carry their own gradients; line icons use currentColor.

export type IconName =
  | 'cash' | 'gem' | 'gear' | 'close' | 'replay' | 'plus' | 'heart' | 'star' | 'power'
  | 'chest' | 'ads' | 'crew' | 'question' | 'talk' | 'fist' | 'crown' | 'walk' | 'eye' | 'play' | 'skull' | 'bolt'
  | 'menu' | 'target' | 'skip'

export function Icon({ name }: { name: IconName }) {
  switch (name) {
    case 'cash':
      return (
        <svg className="icon" viewBox="0 0 32 32" aria-hidden>
          <rect x="3" y="11" width="22" height="13" rx="2" fill="#2d6b3c" stroke="#a5e3a8" strokeWidth="1" transform="rotate(-12 14 17)" />
          <rect x="6" y="12" width="22" height="13" rx="2" fill="#3c8a4c" stroke="#c4f0c4" strokeWidth="1" />
          <circle cx="17" cy="18.5" r="3.6" fill="none" stroke="#e1ffe1" strokeWidth="1.4" />
          <circle cx="25" cy="25" r="5" fill="#e8b84a" stroke="#7a5512" strokeWidth="1" />
          <text x="25" y="28" fontSize="7" textAnchor="middle" fill="#5a3c08" fontWeight="900">$</text>
        </svg>
      )
    case 'gem':
      return (
        <svg className="icon" viewBox="0 0 32 32" aria-hidden>
          <defs>
            <linearGradient id="i-gem" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f0b6ff" />
              <stop offset="0.5" stopColor="#a63ee8" />
              <stop offset="1" stopColor="#5a128c" />
            </linearGradient>
          </defs>
          <path d="M9 6h14l6 8-13 14L3 14z" fill="url(#i-gem)" stroke="#3a0a5c" strokeWidth="1" />
          <path d="M3 14h26M9 6l4 8 3 14 3-14 4-8M13 14l3-8 3 8" fill="none" stroke="#f6dcff" strokeWidth="0.8" opacity=".7" />
        </svg>
      )
    case 'heart':
      return (
        <svg className="icon" viewBox="0 0 32 32" aria-hidden>
          <defs>
            <radialGradient id="i-heart" cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#ff8a8a" />
              <stop offset="0.45" stopColor="#e41d2a" />
              <stop offset="1" stopColor="#7a0710" />
            </radialGradient>
          </defs>
          <path d="M16 28S3 20 3 11.5A6.5 6.5 0 0 1 16 8a6.5 6.5 0 0 1 13 3.5C29 20 16 28 16 28z" fill="url(#i-heart)" stroke="#4a0308" strokeWidth="0.8" />
          <ellipse cx="10" cy="11" rx="3" ry="2" fill="#fff" opacity=".45" transform="rotate(-30 10 11)" />
        </svg>
      )
    case 'star':
      return (
        <svg className="icon" viewBox="0 0 32 32" aria-hidden>
          <defs>
            <linearGradient id="i-star" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#9fd8ff" />
              <stop offset="0.5" stopColor="#2f7fe0" />
              <stop offset="1" stopColor="#123a8a" />
            </linearGradient>
          </defs>
          <path d="M16 2l3.2 3.6 4.8-.6.9 4.7 4.3 2.3-2 4.4 2 4.4-4.3 2.3-.9 4.7-4.8-.6L16 30l-3.2-3.6-4.8.6-.9-4.7-4.3-2.3 2-4.4-2-4.4 4.3-2.3.9-4.7 4.8.6z" fill="url(#i-star)" stroke="#0b2660" strokeWidth="0.8" />
          <path d="M16 9.5l2 4.1 4.5.6-3.3 3.1.8 4.5-4-2.2-4 2.2.8-4.5-3.3-3.1 4.5-.6z" fill="#fff" />
        </svg>
      )
    case 'power':
      return (
        <svg className="icon" viewBox="0 0 32 32" aria-hidden>
          <defs>
            <linearGradient id="i-pow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffe48a" />
              <stop offset="0.55" stopColor="#f0a81c" />
              <stop offset="1" stopColor="#9a5a06" />
            </linearGradient>
          </defs>
          {/* flexed arm */}
          <path
            d="M6 26c-1.5-4 .5-9 3-12l2-6c.5-1.6 2.4-2.4 4-1.6l2.5 1.3c1.3.7 1.3 2.6 0 3.3L15 12.5l1 2.5c2.2-2.6 6.4-3.4 9.5-1.3 3.2 2.2 3.6 6.8.9 9.6C23 27 14 29 6 26z"
            fill="url(#i-pow)"
            stroke="#6a3a02"
            strokeWidth="0.9"
          />
          <path d="M18 18.5c2-1.5 4.5-1.5 6.2 0" fill="none" stroke="#7a4404" strokeWidth="1" opacity=".6" />
        </svg>
      )
    case 'chest':
      return (
        <svg className="icon" viewBox="0 0 32 32" aria-hidden>
          <defs>
            <linearGradient id="i-chest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e05a8a" />
              <stop offset="1" stopColor="#7a1a4a" />
            </linearGradient>
          </defs>
          <path d="M4 14c0-5 5-8 12-8s12 3 12 8z" fill="url(#i-chest)" stroke="#f0c24a" strokeWidth="1.6" />
          <rect x="4" y="14" width="24" height="13" rx="2" fill="#a82a5c" stroke="#f0c24a" strokeWidth="1.6" />
          <rect x="13.5" y="12" width="5" height="7" rx="1" fill="#ffd45a" stroke="#7a5512" strokeWidth="0.8" />
          <circle cx="9" cy="20" r="2" fill="#4ad0ff" />
          <circle cx="23" cy="21" r="2" fill="#7aff8a" />
        </svg>
      )
    case 'ads':
      return (
        <svg className="icon" viewBox="0 0 32 32" aria-hidden>
          <path d="M5 11l22-5 1 4-22 5z" fill="#fff" stroke="#111" strokeWidth="1" />
          <path d="M8 10.3l3 3.5M13 9.2l3 3.5M18 8l3 3.5M23 6.9l3 3.5" stroke="#111" strokeWidth="1.6" />
          <rect x="5" y="15" width="22" height="12" rx="1.5" fill="#d81c26" stroke="#111" strokeWidth="1" />
        </svg>
      )
    case 'crew':
      return (
        <svg className="icon" viewBox="0 0 32 32" aria-hidden>
          <circle cx="12" cy="11" r="5" fill="#f0c24a" />
          <path d="M3 26c0-5 4-8.5 9-8.5s9 3.5 9 8.5z" fill="#f0c24a" />
          <circle cx="22" cy="10" r="4" fill="#c9962a" />
          <path d="M19 17.5c1-.4 2-.5 3-.5 4.5 0 8 3 8 7.5h-7c0-2.8-1.4-5.3-4-7z" fill="#c9962a" />
        </svg>
      )
    case 'plus':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )
    case 'gear':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1l-.4-2.6h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L4.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
          />
        </svg>
      )
    case 'close':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case 'replay':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case 'question':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M9.2 9a3 3 0 1 1 4.3 2.7c-.9.5-1.5 1.2-1.5 2.3v.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="12" cy="18" r="1.3" fill="currentColor" />
        </svg>
      )
    case 'talk':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M4 5h16v10H10l-4 4v-4H4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M8 9.5h8M8 12h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'fist':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M6 10V7.5a1.5 1.5 0 0 1 3 0V10m0-3V6a1.5 1.5 0 0 1 3 0v4m0-3.5a1.5 1.5 0 0 1 3 0V10m0-2a1.5 1.5 0 0 1 3 0v5.5c0 3.6-2.6 6.5-6.2 6.5H11c-2.8 0-5-2.2-5-5V12c0-1.1.9-2 2-2h2.5a1.5 1.5 0 0 1 0 3H8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'crown':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M3.5 8l4.2 3.6L12 5l4.3 6.6L20.5 8 19 18H5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M5.5 20.5h13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      )
    case 'walk':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <circle cx="13.5" cy="4" r="2" fill="currentColor" />
          <path d="M9 21l2.5-6 2.5 2v4.5M7 12l2-4.5 4-.5 2.5 4 3 1.5M11.5 15l1-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'eye':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      )
    case 'play':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M8 5.5v13l10-6.5z" fill="currentColor" />
        </svg>
      )
    case 'skull':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 3c-4.7 0-8 3.2-8 7.4 0 2.5 1.2 4.3 3 5.4V19h10v-3.2c1.8-1.1 3-2.9 3-5.4C20 6.2 16.7 3 12 3z" fill="#e8e2d4" stroke="#5a1a14" strokeWidth="1" />
          <circle cx="9" cy="11" r="2" fill="#7a1a14" />
          <circle cx="15" cy="11" r="2" fill="#7a1a14" />
          <path d="M10 19v2M12 19v2M14 19v2" stroke="#5a1a14" strokeWidth="1" />
        </svg>
      )
    case 'bolt':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M13.5 2L5 13.5h6L9.5 22 19 9.5h-6.2z" fill="currentColor" />
        </svg>
      )
    case 'menu':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M4 6.5h16M4 12h16M4 17.5h16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      )
    case 'target':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="1.8" fill="currentColor" />
        </svg>
      )
    case 'skip':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M3.5 6l8 6-8 6zM12.5 6l8 6-8 6z" fill="currentColor" />
        </svg>
      )
  }
}
