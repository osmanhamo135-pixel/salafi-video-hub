/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // The Basmala and نور marks are inlined SVGs whose group class names
    // (.basmala-stroke, .basmala-harakat, .mark-stroke, .mark-ijam) appear
    // nowhere else. Without this the component-layer fill rules are purged and
    // both marks render in the SVG default black.
    "./src/assets/marks/*.svg",
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--bg-main-rgb) / <alpha-value>)',
        sidebar: 'rgb(var(--bg-sidebar-rgb) / <alpha-value>)',
        panel: 'rgb(var(--bg-panel-rgb) / <alpha-value>)',
        'panel-hover': 'rgb(var(--bg-card-hover-rgb) / <alpha-value>)',
        'elevated-panel': 'rgb(var(--bg-card-rgb) / <alpha-value>)',
        // One hairline hue for the whole app, taken from the active accent and
        // matching --hair / --hair-strong in index.css. These used to come off
        // --border-subtle-rgb, a different per-theme hue: in Emerald a card
        // drew a gold hairline and the input inside it drew a green one.
        border: 'rgb(var(--hair-rgb) / 0.13)',
        'border-strong': 'rgb(var(--hair-rgb) / 0.26)',
        'border-faint': 'rgb(var(--hair-rgb) / 0.07)',
        'muted-text': 'rgb(var(--text-muted-rgb) / <alpha-value>)',
        'text-primary': 'rgb(var(--text-main-rgb) / <alpha-value>)',
        'text-soft': 'rgb(var(--text-soft-rgb) / <alpha-value>)',
        'text-faint': 'rgb(var(--text-faint-rgb) / <alpha-value>)',
        'primary-blue': 'rgb(var(--accent-teal-rgb) / <alpha-value>)',
        'primary-blue-hover': 'rgb(var(--accent-turquoise-rgb) / <alpha-value>)',
        'accent-turquoise': 'rgb(var(--accent-turquoise-rgb) / <alpha-value>)',
        'accent-emerald': 'rgb(var(--accent-emerald-rgb) / <alpha-value>)',
        'accent-blue': 'rgb(var(--accent-blue-rgb) / <alpha-value>)',
        'accent-gold': 'rgb(var(--accent-gold-rgb) / <alpha-value>)',
        'danger-red': 'rgb(var(--danger-rgb) / <alpha-value>)',
        'success-green': 'rgb(var(--success-rgb) / <alpha-value>)',
        'warning-orange': 'rgb(var(--warning-rgb) / <alpha-value>)',
      },
      screens: {
        '3xl': '1800px',
      },
      fontFamily: {
        // 'Inter' sat here and in index.css for the app's whole life without an
        // @font-face behind it, so every Latin glyph fell through to system-ui.
        sans: ['Plex Sans', 'system-ui', '-apple-system', 'sans-serif'],
        // Latin display only — route titles and the featured headline. Arabic
        // display is Aref Ruqaa and is not reachable through this token.
        display: ['Plex Serif', 'Georgia', 'serif'],
      },
      maxWidth: {
        'content': '1600px',
      },
      // The type scale, pointed at the tokens in index.css so there is one
      // source. Every step carries its own leading and its own tracking:
      // tracking tightens as size rises, which is the static-font substitute
      // for the `opsz` optical-size axis. A face cut for text and set at 37px
      // with default spacing looks slack; at 11.5px with default spacing it
      // looks jammed.
      //
      // Arabic never receives any of it — a blanket rule in index.css zeroes
      // letter-spacing under html[data-language='ar'], because tracking breaks
      // the joins inside a word in a connected script.
      fontSize: {
        'xs':   ['var(--fs-cap)',  { lineHeight: '1.45', letterSpacing: 'var(--tr-cap)' }],
        'sm':   ['var(--fs-sm)',   { lineHeight: '1.5',  letterSpacing: 'var(--tr-sm)' }],
        'base': ['var(--fs-base)', { lineHeight: '1.55', letterSpacing: 'var(--tr-base)' }],
        'lg':   ['var(--fs-md)',   { lineHeight: '1.45', letterSpacing: 'var(--tr-md)' }],
        'xl':   ['var(--fs-lg)',   { lineHeight: '1.35', letterSpacing: 'var(--tr-lg)' }],
        '2xl':  ['var(--fs-xl)',   { lineHeight: '1.28', letterSpacing: 'var(--tr-xl)' }],
        '3xl':  ['var(--fs-2xl)',  { lineHeight: '1.14', letterSpacing: 'var(--tr-2xl)' }],
        '4xl':  ['var(--fs-3xl)',  { lineHeight: '1.06', letterSpacing: 'var(--tr-3xl)' }],
        '5xl':  ['var(--fs-3xl)',  { lineHeight: '1.04', letterSpacing: 'var(--tr-3xl)' }],
      },
      // Two radii, per the Windows 11 system: 4px for in-page elements and
      // 8-10px for containers that read as panels. A 16px radius on a card
      // inside a window with an 8px radius is the giveaway that a desktop UI
      // was designed in a browser. Pointed at the CSS tokens so the two
      // ladders that used to disagree (rounded-sm = 6px, var(--r-sm) = 4px)
      // are now one.
      borderRadius: {
        'sm': 'var(--r-sm)',
        'md': 'var(--r-md)',
        'lg': 'var(--r-lg)',
        'xl': 'var(--r-xl)',
      },
      // The elevation ladder, available as utilities so a component can opt
      // into the same material the shared primitives use. `subtle`/`panel`/
      // `teal` were never shadows at all — they were 0 0 0 1px rings named
      // misleadingly — and are kept only as aliases onto the real ladder.
      boxShadow: {
        'elev-1': 'var(--elev-1)',
        'elev-2': 'var(--elev-2)',
        'elev-3': 'var(--elev-3)',
        'press': 'var(--elev-press)',
        'ring-focus': 'var(--ring-focus)',
        subtle: 'var(--elev-1)',
        panel: 'var(--elev-2)',
        teal: 'var(--elev-2)',
      }
    },
  },
  plugins: [],
}
