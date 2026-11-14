/**
 * Décor 3D (Three.js) : des gemmes taillées flottent dans la pénombre d'un
 * cabinet de joaillier, au milieu d'une poussière d'or. Chargé à la demande,
 * derrière l'interface ; il réagit à la souris, à l'écran courant
 * (accueil / partie) et à la victoire.
 */
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Clock,
  Color,
  DirectionalLight,
  Group,
  IcosahedronGeometry,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  OctahedronGeometry,
  PMREMGenerator,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const GEM_COLORS = {
  white: 0xf4f1ff,
  blue: 0x2f6bff,
  green: 0x12b862,
  red: 0xe0283a,
  black: 0x3a3646,
  gold: 0xf2c14e,
};

/** Profil d'une taille brillant : culasse, rondiste, couronne, table. */
function brilliant(segments) {
  const profile = [
    new Vector2(0, -1.05),
    new Vector2(1, -0.05),
    new Vector2(1, 0.05),
    new Vector2(0.62, 0.42),
    new Vector2(0, 0.42),
  ];
  return new LatheGeometry(profile, segments);
}

function sparkTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,240,200,1)');
  grad.addColorStop(0.25, 'rgba(255,210,120,.6)');
  grad.addColorStop(1, 'rgba(255,200,100,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

export function createGemScene(canvas) {
  const small = window.innerWidth < 700;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const renderer = new WebGLRenderer({ canvas, antialias: !small, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 12);

  scene.add(new AmbientLight(0x6a5a8a, 0.6));
  const key = new DirectionalLight(0xffe2a8, 2.2);
  key.position.set(4, 6, 8);
  scene.add(key);
  const rim = new PointLight(0x7c5cff, 40, 30);
  rim.position.set(-6, -3, 4);
  scene.add(rim);
  const warm = new PointLight(0xffb347, 30, 30);
  warm.position.set(6, 2, 3);
  scene.add(warm);

  // Gemmes ----------------------------------------------------------------
  const geometries = [brilliant(8), brilliant(10), new OctahedronGeometry(1, 0), new IcosahedronGeometry(0.95, 0), brilliant(6)];
  const colors = Object.keys(GEM_COLORS);
  const gems = new Group();
  scene.add(gems);
  const count = small ? 7 : 12;
  const items = [];
  const portrait = window.innerHeight > window.innerWidth;
  for (let i = 0; i < count; i++) {
    const color = colors[i % colors.length];
    const material = new MeshPhysicalMaterial({
      color: new Color(GEM_COLORS[color]),
      metalness: color === 'gold' ? 0.9 : 0.05,
      roughness: color === 'gold' ? 0.25 : 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      iridescence: color === 'white' ? 0.6 : 0.15,
      emissive: new Color(GEM_COLORS[color]).multiplyScalar(0.12),
      flatShading: true,
      envMapIntensity: 1.6,
    });
    const mesh = new Mesh(geometries[i % geometries.length], material);
    // Les gemmes encadrent le contenu : réparties sur les bords gauche et droit
    // (en haut et en bas sur écran vertical), jamais au centre.
    const side = i % 2 ? 1 : -1;
    const k = Math.floor(i / 2) / Math.max(1, Math.ceil(count / 2) - 1); // 0..1
    const home = portrait
      ? { x: side * (3.1 + (i % 3) * 0.35), y: (k - 0.5) * 13 + side * 0.8, z: -2 - (i % 4) * 1.2 }
      : { x: side * (7.4 + (i % 3) * 1.2), y: (k - 0.5) * 8 + (i % 3) * 0.4, z: -2 - (i % 4) * 1.4 };
    mesh.position.set(home.x, home.y, home.z);
    const s = (0.55 + ((i * 37) % 10) / 18) * (portrait ? 0.7 : 1);
    mesh.scale.setScalar(s);
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0.4);
    gems.add(mesh);
    items.push({ mesh, home, phase: Math.random() * Math.PI * 2, speed: 0.25 + Math.random() * 0.35, spin: 0 });
  }

  // Poussière d'or ---------------------------------------------------------
  const dustCount = small ? 160 : 380;
  const positions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 18;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 12 - 3;
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new BufferAttribute(positions, 3));
  const dust = new Points(
    dustGeo,
    new PointsMaterial({ size: 0.12, map: sparkTexture(), transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0.8 }),
  );
  scene.add(dust);

  // Interaction ------------------------------------------------------------
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener(
    'pointermove',
    (e) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    },
    { passive: true },
  );

  let mode = 'setup';
  let spread = 1; // écartement des gemmes (1 = accueil)
  let celebrate = 0;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 58 : 40;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const clock = new Clock();
  let running = false;
  let raf = 0;
  let last = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    // En partie, 30 images/s suffisent : le décor reste discret.
    if (mode === 'game' && now - last < 33) return;
    last = now;
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;

    const targetSpread = mode === 'setup' ? 1 : 1.35;
    spread += (targetSpread - spread) * 0.03;
    celebrate = Math.max(0, celebrate - dt * 0.35);

    for (const it of items) {
      const { mesh, home, phase, speed } = it;
      const lift = Math.sin(t * speed + phase) * 0.35;
      const c = celebrate;
      mesh.position.x = home.x * spread * (1 - c * 0.5);
      mesh.position.y = home.y * spread * (1 - c * 0.5) + lift + c * Math.sin(t * 3 + phase) * 0.6;
      mesh.position.z = home.z + c * 4;
      mesh.rotation.y += dt * (0.25 + speed * 0.5 + c * 4);
      mesh.rotation.x += dt * (0.1 + c * 1.5);
    }
    gems.rotation.y = pointer.x * 0.18;
    gems.rotation.x = pointer.y * 0.1;
    dust.rotation.y = t * 0.01 + pointer.x * 0.05;
    dust.position.y = Math.sin(t * 0.1) * 0.3;
    warm.position.x = Math.cos(t * 0.3) * 7;
    rim.position.y = Math.sin(t * 0.25) * 4;
    renderer.render(scene, camera);
  }

  function start() {
    if (running || reduce) return;
    running = true;
    clock.getDelta();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  window.addEventListener('splendor:screen', (e) => {
    mode = e.detail?.mode ?? 'setup';
    document.documentElement.dataset.scene = mode;
  });
  window.addEventListener('splendor:victory', () => {
    celebrate = 1;
  });

  renderer.render(scene, camera);
  start();
  canvas.classList.add('is-ready');
  return { start, stop };
}
