/**
 * LaTiendita — Tailwind theme bridge (v3-compatible, shadcn/ui naming).
 *
 * tokens.css is the single source of truth: every value here is a
 * CSS custom property, so light/dark switching, the data-theme override and
 * the prefers-color-scheme fallback are handled before Tailwind ever runs.
 *
 * Usage (config file):
 *   module.exports = { theme: { extend: require('./design/tokens/tailwind.theme') } }
 *
 * Usage (Play CDN in preview.html):
 *   tailwind.config = { theme: { extend: { ...THEME } } }
 *
 * Never hardcode a hex in a component: pick a role from this map.
 * Roles are defined and contrast-verified in tokens.css / verify_contrast.py.
 */
const THEME = {
  colors: {
    // shadcn/ui-compatible surface roles
    background: 'var(--color-surface-page)',
    foreground: 'var(--color-text)',
    card: { DEFAULT: 'var(--color-surface-card)', foreground: 'var(--color-text)' },
    popover: { DEFAULT: 'var(--color-surface-card)', foreground: 'var(--color-text)' },
    input: { DEFAULT: 'var(--color-surface-sunken)', foreground: 'var(--color-text)' },
    muted: { DEFAULT: 'var(--color-surface-sunken)', foreground: 'var(--color-text-muted)' },
    border: { DEFAULT: 'var(--color-border-card)', strong: 'var(--color-border-strong)' },
    ring: 'var(--color-focus)',
    // actions (teal — never used for status meaning)
    primary: {
      DEFAULT: 'var(--color-action)',
      hover: 'var(--color-action-hover)',
      foreground: 'var(--color-text-on-action)',
    },
    secondary: {
      DEFAULT: 'var(--color-surface-sunken)',
      foreground: 'var(--color-text)',
      border: 'var(--color-border-strong)',
    },
    destructive: {
      DEFAULT: 'var(--color-destructive)',
      hover: 'var(--color-destructive-hover)',
      foreground: 'var(--color-text-on-destructive)',
    },
    link: 'var(--color-text-link)',
    // credit (fiados) — amber is reserved for money owed, nothing else
    credit: {
      DEFAULT: 'var(--color-credit)',
      foreground: 'var(--color-text-on-credit)',
      text: 'var(--color-credit-text)',
      accent: 'var(--color-credit-accent)',
      surface: 'var(--color-warning-bg)',
    },
    // stock status (semantic red / green / amber) — always icon + text, never color alone
    danger: {
      text: 'var(--color-danger-text)',
      surface: 'var(--color-danger-bg)',
      accent: 'var(--color-danger-accent)',
    },
    success: {
      text: 'var(--color-success-text)',
      surface: 'var(--color-success-bg)',
      accent: 'var(--color-success-accent)',
    },
    warning: {
      text: 'var(--color-warning-text)',
      surface: 'var(--color-warning-bg)',
      accent: 'var(--color-warning-accent)',
    },
    // navigation & overlays
    nav: {
      active: { DEFAULT: 'var(--color-nav-active-bg)', foreground: 'var(--color-nav-active-text)' },
      idle: 'var(--color-text-muted)',
    },
    scrim: 'var(--color-scrim)',
    hover: 'var(--color-surface-hover)',
  },
  fontFamily: { sans: ['var(--font-sans)'] },
  fontSize: {
    xs: ['var(--font-size-xs)', { lineHeight: 'var(--line-height-xs)' }],
    sm: ['var(--font-size-sm)', { lineHeight: 'var(--line-height-sm)' }],
    base: ['var(--font-size-base)', { lineHeight: 'var(--line-height-base)' }],
    lg: ['var(--font-size-lg)', { lineHeight: 'var(--line-height-lg)' }],
    xl: ['var(--font-size-xl)', { lineHeight: 'var(--line-height-xl)' }],
    '2xl': ['var(--font-size-2xl)', { lineHeight: 'var(--line-height-2xl)' }],
    '3xl': ['var(--font-size-3xl)', { lineHeight: 'var(--line-height-3xl)' }],
  },
  fontWeight: { regular: 'var(--font-weight-regular)', bold: 'var(--font-weight-bold)' },
  borderRadius: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)',
    full: 'var(--radius-full)',
  },
  spacing: {
    1: 'var(--space-1)', 2: 'var(--space-2)', 3: 'var(--space-3)', 4: 'var(--space-4)',
    5: 'var(--space-5)', 6: 'var(--space-6)', 8: 'var(--space-8)', 10: 'var(--space-10)',
    12: 'var(--space-12)', 16: 'var(--space-16)',
    // component sizes (usable as h-nav, w-fab, min-h-touch, ...)
    touch: 'var(--size-touch-min)',
    control: 'var(--size-control-h)',
    row: 'var(--size-row-min)',
    nav: 'var(--size-nav-h)',
    header: 'var(--size-header-h)',
    fab: 'var(--size-fab)',
    key: 'var(--size-key)',
    icon: 'var(--size-icon)',
    'icon-sm': 'var(--size-icon-sm)',
    'icon-lg': 'var(--size-icon-lg)',
  },
  borderWidth: { hairline: 'var(--border-hairline)', focus: 'var(--border-focus)' },
  transitionDuration: {
    fast: 'var(--duration-fast)',
    base: 'var(--duration-base)',
    slow: 'var(--duration-slow)',
  },
  transitionTimingFunction: { standard: 'var(--ease-standard)' },
  boxShadow: { xs: 'var(--shadow-xs)' },
};

module.exports = THEME;
