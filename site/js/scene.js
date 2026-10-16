import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createIceObjects } from './ice-objects.js';
import { vert, bgFrag, frostFrag } from './shaders/frost.js';

const FOV = 35;
const CAM_Z = 8;
const BUBBLES = 40;
const CRYSTALS = 48;

export function createScene(canvas, { pixelRatio }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  camera.position.z = CAM_Z;
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fdcff, 2.2);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  // sfondo e brina: quad a schermo intero, uniform condivisi
  const u = {
    u_time: { value: 0 }, u_freeze: { value: 0 },
    u_res: { value: new THREE.Vector2(1, 1) }, u_mouse: { value: new THREE.Vector2(-1, -1) },
  };
  const quad = (fragmentShader, extra) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader, uniforms: u, depthTest: false, depthWrite: false, ...extra }),
    );
    m.frustumCulled = false;
    return m;
  };
  const bg = quad(bgFrag, {});
  bg.renderOrder = -10;
  const frost = quad(frostFrag, { transparent: true });
  frost.renderOrder = 10;
  scene.add(bg, frost);

  // shortcut: nebbia ridotta fissata alla creazione (sotto 820px), non segue un resize che attraversa la soglia
  //const ice = createIceObjects(THREE, { fogDensity: window.innerWidth <= 820 ? 1 : 1 });
  const ice = createIceObjects(THREE, { fogDensity: 1 });
  scene.add(ice.group);

  // sprite tondo per bolle e cristalli (Points è quadrato di default)
  const dot = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.6, 'rgba(255,255,255,0.9)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  // bolle
  const bpos = new Float32Array(BUBBLES * 3);
  const bspd = new Float32Array(BUBBLES);
  for (let i = 0; i < BUBBLES; i++) {
    bpos[i * 3] = (Math.random() - 0.5) * 12;
    bpos[i * 3 + 1] = (Math.random() - 0.5) * 10;
    bpos[i * 3 + 2] = (Math.random() - 0.5) * 4;
    bspd[i] = 0.15 + Math.random() * 0.35;
  }
  const bubbles = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(bpos, 3)),
    new THREE.PointsMaterial({ color: 0xcfefff, size: 0.09, transparent: true, opacity: 0.35, map: dot, depthWrite: false }),
  );
  bubbles.frustumCulled = false;
  scene.add(bubbles);

  // cristalli del cursore (shortcut: opacità globale, niente fade per particella)
  const cpos = new Float32Array(CRYSTALS * 3).fill(1e4);
  const clife = new Float32Array(CRYSTALS);
  let cnext = 0;
  const crystals = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(cpos, 3)),
    new THREE.PointsMaterial({ color: 0xf0f8ff, size: 0.07, transparent: true, opacity: 0.8, map: dot, depthWrite: false }),
  );
  crystals.frustumCulled = false;
  scene.add(crystals);

  // stato: target dal main, cur interpolato per fluidità
  const target = { freeze: 0, cube: 0, service: 0, y: 0, grow: 0, exit: 0 };
  const cur = { freeze: 0, cube: 0, service: 0, grow: 0, exit: 0 };
  let baseScale = 1;
  let mobile = false;
  let dx = 0;
  let dy = 0;
  let raf = 0;
  let last = 0;

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    u.u_res.value.set(w, h);
    // oggetti proporzionati alla finestra e centrati nello spazio libero accanto alla scheda (a 1440px: scala 1, dx 1.9)
    const halfH = Math.tan((FOV * Math.PI) / 360) * CAM_Z;
    mobile = w <= 820;
    // mobile: oggetto sempre nello stesso punto, sotto la scheda; cresce (vedi frame) man mano che la scheda sale; desktop: accanto alla scheda
    baseScale = Math.min(1, Math.max(0.6, Math.sqrt(w / 1440)));
    dx = mobile ? 0 : halfH * camera.aspect * 0.47;
    dy = mobile ? -halfH * 0.25 : 0;
  }
  resize();
  window.addEventListener('resize', resize);

  function pointer(nx, ny) {
    u.u_mouse.value.set(nx, 1 - ny);
    if (cur.freeze < 0.15) return;
    const halfH = Math.tan((FOV * Math.PI) / 360) * CAM_Z;
    const i = cnext++ % CRYSTALS;
    cpos[i * 3] = (nx * 2 - 1) * halfH * camera.aspect + (Math.random() - 0.5) * 0.2;
    cpos[i * 3 + 1] = (1 - ny * 2) * halfH + (Math.random() - 0.5) * 0.2;
    cpos[i * 3 + 2] = 0;
    clife[i] = 1;
  }

  function frame(t) {
    const time = t / 1000;
    const raw = time - last;
    const dt = Math.min(0.05, raw);
    last = time;
    for (const k of ['freeze', 'cube', 'service', 'grow', 'exit']) cur[k] += (target[k] - cur[k]) * (1 - Math.exp(-Math.min(1, raw) * 8));

    u.u_time.value = time;
    u.u_freeze.value = cur.freeze;

    ice.update(time, cur.service, target.y, cur.cube, (mobile ? 0.87 * cur.grow : baseScale) * Math.max(0, 1 - cur.exit * 1.1), // *1.1: arriva a 0 davvero, senza coda asintotica
       dx, dy);

    bubbles.material.opacity = 0.55 * (1 - Math.min(1, cur.freeze * 1.6));
    for (let i = 0; i < BUBBLES; i++) {
      bpos[i * 3 + 1] += bspd[i] * dt;
      if (bpos[i * 3 + 1] > 5) bpos[i * 3 + 1] = -5;
    }
    bubbles.geometry.attributes.position.needsUpdate = true;

    for (let i = 0; i < CRYSTALS; i++) {
      if (clife[i] <= 0) { cpos[i * 3] = 1e4; continue; }
      clife[i] -= dt / 1.2;
      cpos[i * 3 + 1] -= dt * 0.25;
    }
    crystals.geometry.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  return {
    setState: (s) => Object.assign(target, s),
    pointer,
    start() { if (!raf) raf = requestAnimationFrame(frame); },
    stop() { cancelAnimationFrame(raf); raf = 0; },
  };
}
