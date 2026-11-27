import type { IconName } from '../../game/narrative/types'

type Name = IconName | 'don_loyalty' | 'independence' | 'ravi_trust' | 'discipline' | 'timeline_knowledge' | 'don_ambition_knowledge' | 'scientist_trust' | 'experiment_commitment' | 'sound' | 'mute' | 'replay' | 'home' | 'settings' | 'log' | 'heart'

const PATHS: Record<Name, string> = {
  crown: 'M3 8l4.5 3.5L12 5l4.5 6.5L21 8l-2 11H5L3 8zm2.6 9.2h12.8',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  fist: 'M7 11V7.5a1.5 1.5 0 013 0V10m0-3.5a1.5 1.5 0 013 0V10m0-2.5a1.5 1.5 0 013 0V11m0-1a1.5 1.5 0 013 0v3.5c0 3.6-2.9 6.5-6.5 6.5H12a5 5 0 01-5-5v-2.5a1.5 1.5 0 013 0',
  scales: 'M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 006 0L5 7zm14 0l-3 6a3 3 0 006 0l-3-6z',
  brain: 'M9.5 4A2.5 2.5 0 007 6.5 2.5 2.5 0 004.5 9 2.5 2.5 0 005 13.5a2.5 2.5 0 002.5 4A2.5 2.5 0 0012 20V5.5A2.5 2.5 0 009.5 4zm5 0A2.5 2.5 0 0117 6.5 2.5 2.5 0 0119.5 9a2.5 2.5 0 01-.5 4.5 2.5 2.5 0 01-2.5 4A2.5 2.5 0 0112 20',
  chevron: 'M6 9l6 6 6-6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  log: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.2a4.3 4.3 0 017.5 2.6C19.5 15.4 12 20 12 20z',
  cash: 'M3 7h18v10H3V7zm9 2.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM6 10v.01M18 14v.01',
  gem: 'M6 3h12l4 6-10 12L2 9l4-6zm-4 6h20M9 3l-2 6 5 12 5-12-2-6',
  plus: 'M12 5v14M5 12h14',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zm0-4.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm0-3.5a1 1 0 100-2 1 1 0 000 2z',
  skip: 'M5 5l7 7-7 7M12 5l7 7-7 7',
  close: 'M6 6l12 12M18 6L6 18',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zm10 3a3 3 0 100-6 3 3 0 000 6z',
  hand: 'M8 13V5.5a1.5 1.5 0 013 0V11m0-6.5a1.5 1.5 0 013 0V11m0-4.5a1.5 1.5 0 013 0V13c0 4.4-3 8-7.5 8S5 18 5 14.5V12a1.5 1.5 0 013 0',
  door: 'M5 21V4a1 1 0 011-1h9l4 2v16M3 21h18M12 12h.01M15 5v16',
  chat: 'M4 5h16v11H9l-5 4V5z',
  lock: 'M6 11h12v10H6V11zm2 0V7a4 4 0 118 0v4',
  warning: 'M12 3.5L2.5 20h19L12 3.5zM12 10v4.5M12 17.2v.01',
  atom: 'M12 13.2a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4zM12 21c2 0 3.6-4 3.6-9S14 3 12 3s-3.6 4-3.6 9 1.6 9 3.6 9zM4.2 7.5c-1 1.7 1.7 5.1 6 7.6s8.6 3 9.6 1.4-1.7-5.1-6-7.6-8.6-3-9.6-1.4zM4.2 16.5c1 1.7 5.3 1.1 9.6-1.4s7-5.9 6-7.6-5.3-1.1-9.6 1.4-7 5.9-6 7.6z',
  hourglass: 'M6 3h12M6 21h12M7 3c0 4.5 5 6 5 9s-5 4.5-5 9M17 3c0 4.5-5 6-5 9s5 4.5 5 9M9.5 18.5h5',
  don_loyalty: 'M3 8l4.5 3.5L12 5l4.5 6.5L21 8l-2 11H5L3 8z',
  independence: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  discipline: 'M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 006 0L5 7zm14 0l-3 6a3 3 0 006 0l-3-6z',
  ravi_trust: 'M8 13V5.5a1.5 1.5 0 013 0V11m0-6.5a1.5 1.5 0 013 0V11m0-4.5a1.5 1.5 0 013 0V13c0 4.4-3 8-7.5 8S5 18 5 14.5V12a1.5 1.5 0 013 0',
  timeline_knowledge: 'M6 3h12M6 21h12M7 3c0 4.5 5 6 5 9s-5 4.5-5 9M17 3c0 4.5-5 6-5 9s5 4.5 5 9M9.5 18.5h5',
  don_ambition_knowledge: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zm10 3a3 3 0 100-6 3 3 0 000 6z',
  scientist_trust: 'M12 13.2a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4zM12 21c2 0 3.6-4 3.6-9S14 3 12 3s-3.6 4-3.6 9 1.6 9 3.6 9zM4.2 7.5c-1 1.7 1.7 5.1 6 7.6s8.6 3 9.6 1.4-1.7-5.1-6-7.6-8.6-3-9.6-1.4zM4.2 16.5c1 1.7 5.3 1.1 9.6-1.4s7-5.9 6-7.6-5.3-1.1-9.6 1.4-7 5.9-6 7.6z',
  experiment_commitment: 'M12 21a9 9 0 100-18 9 9 0 000 18zm0-4.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm0-3.5a1 1 0 100-2 1 1 0 000 2z',
  sound: 'M4 9h4l5-4v14l-5-4H4V9zm12.5-.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12',
  mute: 'M4 9h4l5-4v14l-5-4H4V9zm12 0l5 6m0-6l-5 6',
  replay: 'M4 4v6h6M4.6 15A8 8 0 104 10',
  home: 'M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 00-2-1.2L14.5 3h-5l-.4 2.6a7.4 7.4 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.4l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 002 1.2l.4 2.6h5l.4-2.6a7.4 7.4 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
}

const FILLED = new Set<Name>(['crown', 'bolt', 'gem', 'heart', 'don_loyalty', 'independence'])

export function Icon({ name, size = 20, className }: { name: Name | string; size?: number; className?: string }) {
  const d = PATHS[name as Name]
  if (!d) return null
  const filled = FILLED.has(name as Name)
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
      {name === 'dots' && <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={3.2} />}
      {name === 'crown' && <path d="M5 19h14" stroke="currentColor" strokeWidth={1.6} fill="none" />}
    </svg>
  )
}
