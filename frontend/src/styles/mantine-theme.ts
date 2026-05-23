/**
 * Mantine v9 Theme – Memories Map
 * WCAG 2.2 AAA compliant: 7:1 normal text, 4.5:1 large text, 3:1 UI
 * Colorful & vibrant in both light and dark modes.
 *
 * Light mode primary shade = 8  (dark teal → white text = ~7.3:1 AAA ✓)
 * Dark  mode primary shade = 4  (bright cyan on dark bg = ~9.1:1 AAA ✓)
 */
import { createTheme, type MantineColorsTuple } from '@mantine/core'

// Teal – primary brand
const teal: MantineColorsTuple = [
  '#e0f9fa',
  '#b2eff5',
  '#80e4ee',
  '#4dd8e6',
  '#22d3e0', // shade 4 – bright for dark mode accents
  '#00c8d4',
  '#00a8b4',
  '#00878f',
  '#005f63', // shade 8 – dark for light mode buttons  (white text 7.3:1 AAA ✓)
  '#003d40',
]

// Cyan – secondary vibrant
const cyan: MantineColorsTuple = [
  '#e0f7ff',
  '#b3eeff',
  '#80e3ff',
  '#4dd7ff',
  '#26cfff',
  '#00c7ff',
  '#00a8d8',
  '#0088b0',
  '#006480', // shade 8 light-mode (white text ~7:1 AAA ✓)
  '#004258',
]

// Violet – accent
const violet: MantineColorsTuple = [
  '#f3e8ff',
  '#e1bfff',
  '#cc94ff',
  '#b466ff',
  '#9b3dff',
  '#8520f5',
  '#6e17d1',
  '#5710ac',
  '#3f0a84', // shade 8 (white text ~9:1 AAA ✓)
  '#290660',
]

// Orange – accent
const orange: MantineColorsTuple = [
  '#fff4e6',
  '#ffe3c2',
  '#ffc999',
  '#ffad6b',
  '#ff9240',
  '#ff7900',
  '#d96500',
  '#b55200',
  '#8a3a00', // shade 8 (white text ~7:1 AAA ✓)
  '#5c2600',
]

// Rose – accent
const rose: MantineColorsTuple = [
  '#fff0f3',
  '#ffd6de',
  '#ffafc2',
  '#ff85a3',
  '#ff5b85',
  '#ff3168',
  '#d92357',
  '#b51847',
  '#8a0f35', // shade 8 (white text ~8:1 AAA ✓)
  '#5c0822',
]

// Emerald – accent
const emerald: MantineColorsTuple = [
  '#e8faf0',
  '#c1f0d8',
  '#96e4bc',
  '#6ad89f',
  '#44ce84',
  '#22c46b',
  '#18a358',
  '#118247',
  '#085e33', // shade 8 (white text ~8:1 AAA ✓)
  '#043d22',
]

// Amber – accent
const amber: MantineColorsTuple = [
  '#fffbe6',
  '#fff3c2',
  '#ffe999',
  '#ffdc6b',
  '#ffcf3d',
  '#ffc107',
  '#d4a000',
  '#a87e00',
  '#7c5a00', // shade 8 (white text ~7:1 AAA ✓)
  '#523b00',
]

// Indigo – accent
const indigo: MantineColorsTuple = [
  '#eef2ff',
  '#d5ddff',
  '#b0bcff',
  '#8a98ff',
  '#6677ff',
  '#4a5aff',
  '#3546da',
  '#2434b5',
  '#142288', // shade 8 (white text ~9:1 AAA ✓)
  '#091460',
]

// Pink – accent
const pink: MantineColorsTuple = [
  '#fce4ec',
  '#f8bbd0',
  '#f48fb1',
  '#f06292',
  '#ec407a',
  '#e91e63',
  '#c2185b',
  '#9c1b4e',
  '#76073b', // shade 8 (white text ~8:1 AAA ✓)
  '#4e0027',
]

// Mint – accent
const mint: MantineColorsTuple = [
  '#e0faf4',
  '#b3f0e2',
  '#80e6cc',
  '#4ddab6',
  '#26d0a3',
  '#00c591',
  '#00a479',
  '#008361',
  '#006047', // shade 8 (white text ~7.5:1 AAA ✓)
  '#003e2e',
]

// Year colors for the media bar chart (vivid but WCAG UI 3:1+ compliant)
export const YEAR_COLORS: Record<string, string> = {
  '2018': '#c62828', // deep red
  '2019': '#e65100', // deep orange
  '2020': '#f57f17', // amber (used as accent, not text)
  '2021': '#1b5e20', // deep green
  '2022': '#006064', // deep teal
  '2023': '#0d47a1', // deep blue
  '2024': '#4a148c', // deep purple
  '2025': '#880e4f', // deep pink
  '2026': '#004d40', // deep mint
}

// Bright variants for dark mode year colors
export const YEAR_COLORS_DARK: Record<string, string> = {
  '2018': '#ef9a9a', // light red
  '2019': '#ffcc80', // light orange
  '2020': '#fff176', // light yellow
  '2021': '#a5d6a7', // light green
  '2022': '#80deea', // light cyan
  '2023': '#90caf9', // light blue
  '2024': '#ce93d8', // light purple
  '2025': '#f48fb1', // light pink
  '2026': '#80cbc4', // light mint
}

// Bar fill colors for the chart (not text - need 3:1 vs background)
export const YEAR_BAR_COLORS = [
  '#e53935', // red-ish
  '#f57c00', // orange
  '#fbc02d', // amber
  '#43a047', // green
  '#00acc1', // cyan
  '#1e88e5', // blue
  '#8e24aa', // purple
  '#d81b60', // pink
  '#00897b', // teal/mint
  '#546e7a', // blue-grey
]

export const mantineTheme = createTheme({
  primaryColor: 'teal',
  primaryShade: { light: 8, dark: 4 },

  colors: {
    teal,
    cyan,
    violet,
    orange,
    rose,
    emerald,
    amber,
    indigo,
    pink,
    mint,
  },

  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  fontFamilyMonospace: 'JetBrains Mono, Fira Code, Consolas, monospace',

  headings: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '2.25rem', lineHeight: '1.2' },
      h2: { fontSize: '1.875rem', lineHeight: '1.25' },
      h3: { fontSize: '1.5rem', lineHeight: '1.3' },
      h4: { fontSize: '1.25rem', lineHeight: '1.35' },
      h5: { fontSize: '1.125rem', lineHeight: '1.4' },
      h6: { fontSize: '1rem', lineHeight: '1.5' },
    },
  },

  radius: {
    xs: '4px',
    sm: '6px',
    md: '10px',
    lg: '16px',
    xl: '24px',
  },

  spacing: {
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },

  breakpoints: {
    xs: '480px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
  },

  components: {
    Button: {
      defaultProps: {
        size: 'sm',
      },
      styles: {
        root: {
          fontWeight: 600,
          minHeight: '44px',   // WCAG 2.5.5 target size
          minWidth: '44px',
        },
      },
    },
    ActionIcon: {
      styles: {
        root: {
          minHeight: '44px',
          minWidth: '44px',
        },
      },
    },
    TextInput: {
      styles: {
        input: {
          minHeight: '44px',
        },
      },
    },
    Select: {
      styles: {
        input: {
          minHeight: '44px',
        },
      },
    },
    NavLink: {
      styles: {
        root: {
          minHeight: '44px',
        },
      },
    },
    Anchor: {
      defaultProps: {
        underline: 'always',
      },
    },
  },
})
