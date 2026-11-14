import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cinzel/latin-800.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource-variable/inter';
import './style.css';
import { createApp } from './ui/app.js';
import { createFx } from './ui/fx.js';
import { injectSprite } from './ui/sprite.js';

const params = new URLSearchParams(window.location.search);
const aiDelay = params.has('aiDelay') ? Number(params.get('aiDelay')) : 700;
// ?fx=0 coupe le décor 3D et les animations (machines modestes, débogage).
const effects = params.get('fx') !== '0';

injectSprite();
createApp(document.getElementById('app'), { aiDelay, fx: createFx({ enabled: effects }) });

if (effects) {
  const canvas = document.createElement('canvas');
  canvas.className = 'scene3d';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  // Le décor 3D est chargé à part, une fois l'interface affichée.
  const load = () =>
    import('./ui/scene3d.js')
      .then(({ createGemScene, webglAvailable }) => {
        if (webglAvailable()) createGemScene(canvas);
        else canvas.remove();
      })
      .catch(() => canvas.remove());
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 1200 });
  else setTimeout(load, 200);
}
