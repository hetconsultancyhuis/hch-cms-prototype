import { useState, useEffect } from 'react';
import CanvasKitInit from 'canvaskit-wasm';

const FONT_URLS = {
  sans: '/NotoSans-Regular.ttf',
  mono: '/NotoMono-Regular.ttf',
};

let cachedCk = null;
let cachedFontData = null;

export function useCanvasKit() {
  const [state, setState] = useState({ ck: null, fonts: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        if (!cachedCk || !cachedFontData) {
          const [ck, sansBytes, monoBytes] = await Promise.all([
            CanvasKitInit({ locateFile: (f) => `/${f}` }),
            fetch(FONT_URLS.sans).then(r => {
              if (!r.ok) throw new Error('Font load failed');
              return r.arrayBuffer();
            }),
            fetch(FONT_URLS.mono).then(r => {
              if (!r.ok) throw new Error('Font load failed');
              return r.arrayBuffer();
            }),
          ]);
          cachedCk = ck;
          cachedFontData = { sansBytes, monoBytes };
        }

        if (cancelled) return;

        const ck = cachedCk;
        const { sansBytes, monoBytes } = cachedFontData;

        const sansFace = ck.Typeface.MakeFreeTypeFaceFromData(sansBytes);
        const monoFace = ck.Typeface.MakeFreeTypeFaceFromData(monoBytes);

        // Create reusable font objects — caller can setSize() before use
        const fonts = {
          sans: new ck.Font(sansFace, 13),
          mono: new ck.Font(monoFace, 12),
          sansFace,
          monoFace,
        };

        setState({ ck, fonts, loading: false, error: null });
      } catch (e) {
        if (!cancelled) setState({ ck: null, fonts: null, loading: false, error: e.message });
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  return state;
}
