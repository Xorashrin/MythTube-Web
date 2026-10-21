// Responsive layout for the web app. Phones keep the compact layout; laptops and desktops get a side navigation,
// larger posters, wider grids and centered content with a sensible maximum width.
import { useWindowDimensions } from 'react-native';

export const SIDEBAR_WIDTH = 208;
export const BREAKPOINT_WIDE = 900;

export interface LayoutInfo {
  /** Window width in px. */
  width: number;
  /** Laptop / desktop layout (side navigation, large posters). */
  wide: boolean;
  /** Width available to page content (window minus side navigation, capped). */
  content: number;
  gutter: number;
  poster: { width: number; height: number };
  /** Poster-grid columns and the poster width that fills them exactly. */
  columns: number;
  cell: number;
}

export function useLayout(): LayoutInfo {
  const { width } = useWindowDimensions();
  const wide = width >= BREAKPOINT_WIDE;
  const available = width - (wide ? SIDEBAR_WIDTH : 0);
  const content = Math.min(available, 1760);
  const gutter = wide ? 32 : 12;
  const poster = wide ? { width: 176, height: 264 } : { width: 110, height: 160 };
  const gap = 8;
  const target = wide ? 180 : 120;
  const columns = Math.max(3, Math.floor((content - gutter * 2 + gap) / (target + gap)));
  const cell = Math.floor((content - gutter * 2 - gap * (columns - 1)) / columns);
  return { width, wide, content, gutter, poster, columns, cell };
}
