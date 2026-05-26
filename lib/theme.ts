// Carbon Design System v11 – Gray 100 (g100) theme

export const C = {
  // Background
  background: '#161616',
  // Layers
  layer01: '#262626',
  layer02: '#393939',
  // Text
  textPrimary: '#F4F4F4',
  textSecondary: '#8D8D8D',
  textHelper: '#6F6F6F',
  textDisabled: '#525252',
  textOnColor: '#FFFFFF',
  textPlaceholder: '#6F6F6F',
  // Icon
  iconPrimary: '#F4F4F4',
  iconSecondary: '#8D8D8D',
  iconDisabled: '#525252',
  // Border
  borderSubtle01: '#525252',
  borderStrong01: '#6F6F6F',
  // Interactive
  interactive: '#0F62FE',
  focus: '#FFFFFF',
  // Button
  buttonPrimary: '#0F62FE',
  buttonPrimaryActive: '#0353E9',
  buttonSecondary: '#393939',
  buttonDisabled: '#262626',
  // Support
  supportError: '#DA1E28',
  supportErrorBg: 'rgba(218,30,40,0.18)',
  supportErrorBorder: 'rgba(218,30,40,0.3)',
  supportWarning: '#F1C21B',
  supportSuccess: '#24A148',
  supportSuccessBg: 'rgba(36,161,72,0.1)',
  supportSuccessBorder: '#24A148',
  supportInfo: '#0043CE',
  // Interactive overlays (for cards/highlights)
  interactiveBg: 'rgba(15,98,254,0.18)',
  interactiveBorder: 'rgba(15,98,254,0.22)',
  interactiveHighlight: 'rgba(15,98,254,0.12)',
} as const;

// Carbon spacing scale (4px base)
export const S = {
  s01: 2,
  s02: 4,
  s03: 8,
  s04: 12,
  s05: 16,
  s06: 24,
  s07: 32,
  s08: 40,
  s09: 48,
  s10: 64,
} as const;

// IBM Plex Sans font families
export const F = {
  regular: 'IBMPlexSans_400Regular',
  semiBold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
} as const;

// Carbon productive type scale (px)
export const TS = {
  label01: 12,
  body01: 14,
  body02: 16,
  heading01: 14,
  heading02: 16,
  heading03: 20,
  heading04: 28,
  heading05: 32,
} as const;
