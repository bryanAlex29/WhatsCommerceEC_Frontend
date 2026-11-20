import { useWindowDimensions } from 'react-native';

/** Logical window size, not device/model detection. Safe areas stay in screen frames. */
export function responsiveLayout({ width, height, fontScale = 1 }: { width: number; height: number; fontScale?: number }) {
  const compact = height < 720 || width < 360 || width > height || fontScale > 1.25;
  const padding = width < 360 ? 16 : width < 768 ? 24 : 32;
  const contentWidth = Math.min(width, width >= 768 ? 560 : 480);
  return {
    compact, padding, contentWidth,
    gap: compact ? 12 : 20,
    controlGap: compact ? 12 : 16,
    logoWidth: Math.min(compact ? 200 : 240, Math.max(0, contentWidth - 2 * padding)),
    loginGap: compact ? 8 : 12,
    loginControlGap: compact ? 8 : 10,
    welcomeLogoWidth: compact ? 240 : 360,
    illustrationWidth: compact ? 200 : 320,
  };
}
export function useResponsiveLayout() { return responsiveLayout(useWindowDimensions()); }
