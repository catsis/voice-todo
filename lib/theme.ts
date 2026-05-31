// Design tokens – aligned with HTML prototype color system

export const C = {
  // Background
  background: '#0b0b0d',
  // Layers
  layer01: '#161619',
  layer02: '#1f1f24',
  layerHi: '#26262c',
  // Text
  textPrimary: '#f6f6f8',
  textSecondary: '#a0a0aa',
  textHelper: '#6b6b75',
  textDisabled: '#525252',
  textOnColor: '#FFFFFF',
  textPlaceholder: '#6b6b75',
  // Icon
  iconPrimary: '#f6f6f8',
  iconSecondary: '#a0a0aa',
  iconDisabled: '#525252',
  // Border
  borderSubtle01: 'rgba(255,255,255,0.07)',
  borderSubtle02: 'rgba(255,255,255,0.13)',
  borderStrong01: 'rgba(255,255,255,0.20)',
  // Interactive (Blue)
  interactive: '#2f6bff',
  focus: '#FFFFFF',
  // Button
  buttonPrimary: '#2f6bff',
  buttonPrimaryActive: '#1f53e0',
  buttonSecondary: '#1f1f24',
  buttonDisabled: '#1f1f24',
  // Support
  supportError: '#ff5a6a',
  supportErrorBg: 'rgba(255,90,106,0.13)',
  supportErrorBorder: 'rgba(255,90,106,0.3)',
  supportWarning: '#f0a93b',
  supportSuccess: '#34d27b',
  supportSuccessBg: 'rgba(52,210,123,0.14)',
  supportSuccessBorder: 'rgba(52,210,123,0.22)',
  supportInfo: '#2f6bff',
  // Interactive overlays
  interactiveBg: 'rgba(47,107,255,0.16)',
  interactiveBorder: 'rgba(47,107,255,0.22)',
  interactiveHighlight: 'rgba(47,107,255,0.12)',
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

// Type scale (px)
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
