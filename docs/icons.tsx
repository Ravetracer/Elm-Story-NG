import React from 'react'

/**
 * Inline SVG icons — a small hand-picked set so the site needs no icon font and
 * no CDN. All 24×24, stroke `currentColor`, so they take the colour of their box.
 */
type IconProps = { className?: string }

const svg = (children: React.ReactNode) => ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
)

// Scene map / graph
export const MapIcon = svg(
  <>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="7" r="2.5" />
    <circle cx="12" cy="18" r="2.5" />
    <path d="M8 7.5 15.5 8M7 8 11 16m6-6.5L13 16" />
  </>
)

// Template expressions { }
export const BracesIcon = svg(
  <>
    <path d="M8 4c-2 0-2 2-2 4s0 3-2 4c2 1 2 2 2 4s0 4 2 4" />
    <path d="M16 4c2 0 2 2 2 4s0 3 2 4c-2 1-2 2-2 4s0 4-2 4" />
  </>
)

// Objects & recipes
export const CubeIcon = svg(
  <>
    <path d="M12 2.5 21 7v10l-9 4.5L3 17V7z" />
    <path d="M3 7l9 4.5L21 7M12 11.5V21.5" />
  </>
)

// Characters
export const UsersIcon = svg(
  <>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    <path d="M16 5.5a3 3 0 0 1 0 5.8M17 15c2.4.4 4 2.3 4 5" />
  </>
)

// Presentation / theme
export const PaletteIcon = svg(
  <>
    <path d="M12 3a9 9 0 1 0 0 18c1.3 0 2-1 2-2 0-1.4-1-1.6-1-2.6 0-.8.7-1.4 1.6-1.4H17a4 4 0 0 0 4-4c0-3.9-4-8-9-8z" />
    <circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="16.5" cy="11" r="1" fill="currentColor" stroke="none" />
  </>
)

// Export / download
export const ExportIcon = svg(
  <>
    <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </>
)

// Runs in the browser
export const GlobeIcon = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9z" />
  </>
)

// Free & open source
export const HeartIcon = svg(
  <path d="M12 20s-7-4.4-9.2-8.6C1.3 8.5 2.6 5 6 5c2 0 3.2 1.2 4 2.3C10.8 6.2 12 5 14 5c3.4 0 4.7 3.5 3.2 6.4C19 15.6 12 20 12 20z" />
)

export const GithubIcon = svg(
  <path
    d="M12 2.2a9.8 9.8 0 0 0-3.1 19.1c.5.1.7-.2.7-.5v-1.7c-2.7.6-3.3-1.3-3.3-1.3-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.2-4.5-1.1-4.5-4.9 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.6.6.7 1 1.6 1 2.7 0 3.8-2.3 4.7-4.5 4.9.3.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A9.8 9.8 0 0 0 12 2.2z"
    fill="currentColor"
    stroke="none"
  />
)

export const ArrowRightIcon = svg(<path d="M5 12h14m0 0-6-6m6 6-6 6" />)

export const BookIcon = svg(
  <>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" />
  </>
)

export const MenuIcon = svg(<path d="M4 6h16M4 12h16M4 18h16" />)

export const CloseIcon = svg(<path d="M6 6l12 12M18 6 6 18" />)
