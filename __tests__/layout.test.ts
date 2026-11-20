import { responsiveLayout } from '../src/layout';

const viewports: [number, number][] = [
  [240, 320], [320, 568], [360, 640], [390, 844], [430, 932],
  [568, 320], [844, 390], [768, 1024], [1024, 768], [1280, 800],
];
describe('reglas adaptables, no medición de layout nativo', () => {
  it.each(viewports.flatMap(([width, height]) => [1, 1.5, 2].map(fontScale => ({ width, height, fontScale }))))(
    'acota columna y logo en $width×$height con fuente $fontScale', viewport => {
      const layout = responsiveLayout(viewport);
      expect(layout.contentWidth).toBeLessThanOrEqual(viewport.width);
      expect(layout.contentWidth).toBeLessThanOrEqual(560);
      expect(layout.logoWidth).toBeGreaterThan(0);
      expect(layout.logoWidth).toBeLessThanOrEqual(layout.contentWidth - 2 * layout.padding);
      expect(layout.padding).toBeGreaterThanOrEqual(16);
      if (viewport.width > viewport.height || viewport.height < 720 || viewport.fontScale > 1.25) expect(layout.compact).toBe(true);
    });
  it('compacta espacio cuando aparece el teclado o gira la ventana sin cambiar objetivos táctiles', () => {
    const portrait = responsiveLayout({ width: 390, height: 844 });
    const keyboard = responsiveLayout({ width: 390, height: 420 });
    const landscape = responsiveLayout({ width: 844, height: 390 });
    expect(keyboard.gap).toBeLessThan(portrait.gap);
    expect(landscape.logoWidth).toBeLessThan(portrait.logoWidth);
    expect(keyboard.illustrationWidth).toBeLessThan(portrait.illustrationWidth);
  });
  it('no bloquea orientación ni limita iOS a la ventana de iPhone', () => {
    const config = require('../app.json');
    expect(config.expo.orientation).toBe('default');
    expect(config.expo.ios.supportsTablet).toBe(true);
  });
});
