// Design tokens for Battle Masters 3 — medieval fantasy theme

export const theme = {
  colors: {
    // Primary accent
    gold: '#c4a35a',
    goldDark: '#8a7030',
    goldLight: '#d4b96a',
    goldFaint: 'rgba(196,163,90,0.15)',

    // Factions
    imperial: '#4488cc',
    imperialDark: '#2a5a8a',
    imperialGlow: 'rgba(68,136,204,0.3)',
    chaos: '#cc4444',
    chaosDark: '#8a2a2a',
    chaosGlow: 'rgba(204,68,68,0.3)',

    // Backgrounds
    bg: '#0a0a0f',
    bgLight: '#1a1a2e',
    bgPanel: 'rgba(20,18,14,0.95)',
    bgOverlay: 'rgba(0,0,0,0.85)',
    bgDark: 'rgba(0,0,0,0.7)',
    bgGlass: 'rgba(10,10,15,0.8)',

    // Parchment tones
    parchment: '#d4c4a0',
    parchmentDark: '#b8a47c',
    parchmentBg: 'rgba(40,35,25,0.95)',

    // Text
    text: '#e0e0e0',
    textMuted: '#aaa',
    textDim: '#666',
    textFaint: '#444',

    // Borders
    border: '#333',
    borderLight: '#555',

    // Status
    success: '#44cc88',
    danger: '#ff4444',
    warning: '#ff8844',
    info: '#4488ff',
  },

  fonts: {
    display: "'MedievalSharp', Georgia, serif",
    body: "'Crimson Text', Georgia, serif",
  },

  fontSizes: {
    xs: '0.7rem',
    sm: '0.85rem',
    md: '1rem',
    lg: '1.2rem',
    xl: '1.5rem',
    '2xl': '2rem',
    '3xl': '2.5rem',
    '4xl': '3rem',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
  },

  radii: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
  },

  shadows: {
    panel: '0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
    panelLg: '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
    glow: (color: string) => `0 0 20px ${color}, 0 0 40px ${color}`,
    button: '0 2px 8px rgba(0,0,0,0.4)',
    buttonHover: '0 4px 16px rgba(0,0,0,0.5)',
    text: '0 2px 10px rgba(196,163,90,0.3)',
    textGlow: (color: string) => `0 0 10px ${color}, 0 0 20px ${color}`,
  },

  factions: {
    imperial: {
      primary: '#4488cc',
      dark: '#2a5a8a',
      glow: 'rgba(68,136,204,0.3)',
      bg: 'rgba(68,136,204,0.08)',
      border: 'rgba(68,136,204,0.4)',
      label: 'Imperial Army',
    },
    chaos: {
      primary: '#cc4444',
      dark: '#8a2a2a',
      glow: 'rgba(204,68,68,0.3)',
      bg: 'rgba(204,68,68,0.08)',
      border: 'rgba(204,68,68,0.4)',
      label: 'Dark Legion',
    },
  },
} as const;

export type Faction = keyof typeof theme.factions;

export function getFactionTheme(faction: Faction) {
  return theme.factions[faction];
}

export function getFactionLabel(faction: Faction) {
  return theme.factions[faction].label;
}
