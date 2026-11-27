/**
 * The title: UNDERWORLD in heavy italic caps, white and red, over a ragged
 * charcoal brush stroke with a red streak under it, tilted up to the right.
 * Drawn inline so it uses the page's display font and stays sharp at any size.
 */
export function MenuLogo() {
  return (
    <svg className="menu-logo" viewBox="0 0 360 150" role="img" aria-label="Underworld">
      <g transform="rotate(-6 180 75)">
        {/* the brush stroke: a body and frayed bristle ends */}
        <path d="M18 66 L46 40 L318 30 L346 38 L352 52 L340 92 L306 106 L40 114 L20 104 L10 86 Z" fill="#0d0d11" />
        <path d="M6 70 L30 62 L26 74 Z M4 94 L28 92 L20 102 Z M340 30 L360 26 L350 40 Z M344 98 L362 96 L346 108 Z" fill="#0d0d11" />
        <path d="M30 48 L120 44 L118 47 L32 52 Z M240 34 L330 32 L326 36 L244 38 Z M60 108 L200 104 L196 108 L64 112 Z" fill="#26262c" />
        {/* the red streak under the name */}
        <path d="M44 112 L336 98 L330 106 L40 118 Z" fill="#e1263a" />
        <path d="M70 118 L250 110 L246 113 L72 121 Z" fill="#ff6a76" opacity="0.6" />
        <text
          x="180"
          y="94"
          textAnchor="middle"
          textLength="304"
          lengthAdjust="spacingAndGlyphs"
          className="menu-logo__text"
        >
          <tspan className="menu-logo__under">UNDER</tspan>
          <tspan className="menu-logo__world">WORLD</tspan>
        </text>
      </g>
    </svg>
  )
}
