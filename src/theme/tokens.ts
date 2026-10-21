// Design tokens. Values come from the REA resource evidence (docs/NETFLIX_A_TO_Z.md, M01).
import { Easing } from 'react-native';

export const colors = {
  red: '#E50914',
  redPressed: '#C11119',
  redLight: '#EB3942',
  blue: '#0071EB',

  bg: '#000000',
  surface0: '#0F0F0F',
  surface1: '#121212',
  surface2: '#1F1F1F',
  surface3: '#232323',
  surface4: '#262626',
  surface5: '#333333',
  surface6: '#414141',
  border: '#4D4D4D',

  text: '#FFFFFF',
  text90: 'rgba(255,255,255,0.9)',
  text80: 'rgba(255,255,255,0.8)',
  text70: 'rgba(255,255,255,0.7)',
  textMuted: '#BDBDBD',
  textSoft: '#C3C3C3',
  textDim: '#808080',
  textFaint: '#737373',
  link: '#E6E6E6',

  success: '#5FA53F',
  love: '#3F54FF',
  scrim: 'rgba(0,0,0,0.5)',
  overlay: 'rgba(0,0,0,0.88)',
  glassButton: 'rgba(109,109,110,0.55)',
} as const;

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  pill: 999,
} as const;

export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_700Bold',
  bold: 'Inter_700Bold',
  // Only Regular, Medium and Bold ship in the APK; heavier and lighter-bold weights map to Bold.
  extrabold: 'Inter_700Bold',
  black: 'Inter_700Bold',
  display: 'BebasNeue_400Regular',
} as const;

export type FontWeight = keyof typeof font;

export const textSize = {
  micro: 10,
  caption: 12,
  small: 13,
  body: 14,
  bodyLarge: 16,
  title: 18,
  heading: 20,
  display: 24,
} as const;

export const motion = {
  fast: 150,
  base: 220,
  slow: 300,
  slower: 400,
  standard: Easing.bezier(0.4, 0, 0.2, 1),
  decelerate: Easing.bezier(0, 0, 0.2, 1),
  accelerate: Easing.bezier(0.4, 0, 1, 1),
} as const;

export const layout = {
  gutter: 12,
  headerHeight: 52,
  chipRowHeight: 48,
  tabBarHeight: 58,
} as const;
