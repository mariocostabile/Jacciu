// Tre oggetti di ghiaccio procedurali, dissolti in base a `service` (0..2).
const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

// rumore 3D value, basato su hash intero
const hash = (x, y, z) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const noise = (x, y, z) => {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w,
  ) * 2 - 1;
};
// PRNG deterministico
const rng = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };

// opts.flat: materiale semitrasparente senza transmission (per canvas alpha); opts.pointScale: px per il fumo con camera ortografica
export function createIceObjects(THREE, opts = {}) {
  const { flat = false, pointScale = 1, fogDensity = 1 } = opts;
  // sposta ogni vertice lungo la normale con rumore a due scale; round = raggio smusso (0 = nessuno)
  const sculpt = (geo, { round = 0, amp, freq, amp2 = 0, freq2 = 0, seed = 0 }) => {
    geo.computeBoundingBox();
    const p = geo.attributes.position, n = geo.attributes.normal;
    const half = new THREE.Vector3();
    geo.boundingBox.getSize(half).multiplyScalar(0.5);
    const v = new THREE.Vector3(), nm = new THREE.Vector3(), inner = new THREE.Vector3(), off = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      nm.fromBufferAttribute(n, i);
      if (round) {
        inner.set(
          Math.max(round - half.x, Math.min(half.x - round, v.x)),
          Math.max(round - half.y, Math.min(half.y - round, v.y)),
          Math.max(round - half.z, Math.min(half.z - round, v.z)),
        );
        off.copy(v).sub(inner);
        if (off.lengthSq() > 1e-12) { nm.copy(off).normalize(); v.copy(inner).addScaledVector(nm, round); }
      }
      const d = amp * noise(v.x * freq + seed, v.y * freq, v.z * freq)
        + (amp2 ? amp2 * noise(v.x * freq2, v.y * freq2 + seed, v.z * freq2) : 0);
      p.setXYZ(i, v.x + nm.x * d, v.y + nm.y * d, v.z + nm.z * d);
    }
    geo.computeVertexNormals();
    return geo;
  };

  // brina: fbm in scala di grigi, usata come roughnessMap (chiazze opache su fondo lucido) e bumpMap (microrilievo)
  const frost = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d'), img = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const n = (noise(x / 40, y / 40, 1) * 0.55 + noise(x / 14, y / 14, 7) * 0.3 + noise(x / 5, y / 5, 3) * 0.15) * 0.5 + 0.5;
      const v = Math.round(255 * Math.min(1, 0.08 + 0.92 * n * n * 1.3));
      img.data.set([v, v, v, 255], (y * 256 + x) * 4);
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();

  const iceMat = (o) => new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transmission: 0.9, thickness: 1.4, roughness: 0.4, roughnessMap: frost, bumpMap: frost, bumpScale: 1.2, ior: 1.31, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1,
    attenuationColor: new THREE.Color(0xdaf4ff), attenuationDistance: 12, envMapIntensity: 3,
    emissive: new THREE.Color(0xcfeaf6), emissiveIntensity: 0.03,
    ...(flat ? { transmission: 0, transparent: true, opacity: 0.8, depthWrite: false } : {}), ...o,
  });

  const group = new THREE.Group();
  const objs = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  objs.forEach((o) => group.add(o));
  const m4 = new THREE.Matrix4();

  // mucchietto di istanze: spirale aurea a cupola, rotazioni e scale deterministiche
  const q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
  const heap = (mesh, n, seed, rad) => {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const d = Math.sqrt(i / n) * rad, th = i * 2.4;
      pos.set(Math.cos(th) * d, (1 - (d / rad) ** 2) * 0.55 - 0.3, Math.sin(th) * d);
      e.set(r() * 6.28, r() * 6.28, r() * 6.28);
      sc.setScalar(0.8 + r() * 0.4);
      mesh.setMatrixAt(i, m4.compose(pos, q.setFromEuler(e), sc));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
  };

  // a) cubetto
  const cube = new THREE.Mesh(
    sculpt(new THREE.BoxGeometry(1.5, 1.4, 1.6, 28, 28, 28), { round: 0.16, amp: 0.035, freq: 2.2, amp2: 0.012, freq2: 7 }),
    iceMat({}),
  );
  const r1 = rng(7);
  const bub = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.3 }), 24,
  );
  for (let i = 0; i < 24; i++) {
    const s = 0.012 + r1() * 0.02;
    m4.makeScale(s, s, s).setPosition((r1() - 0.5) * 1.2, (r1() - 0.5) * 1.1, (r1() - 0.5) * 1.3);
    bub.setMatrixAt(i, m4);
  }
  bub.instanceMatrix.needsUpdate = true;
  bub.frustumCulled = false;
  const shardMat = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: 0.7, emissive: 0xbfe3f5, emissiveIntensity: 0.25 });
  const shards = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), shardMat, 9);
  for (let i = 0; i < 9; i++) {
    const s = 0.12 + r1() * 0.2;
    e.set(r1() * 6.28, r1() * 6.28, r1() * 6.28);
    shards.setMatrixAt(i, m4.compose(pos.set((r1() - 0.5) * 0.9, (r1() - 0.5) * 0.8, (r1() - 0.5) * 0.9), q.setFromEuler(e), sc.set(s * 1.4, 0.012, s)));
  }
  shards.instanceMatrix.needsUpdate = true;
  shards.frustumCulled = false;
  objs[0].add(cube, bub, shards);

  // b) nuggets
  const N = 46;
  const nug = new THREE.InstancedMesh(
    sculpt(new THREE.CylinderGeometry(0.16, 0.16, 0.24, 14, 4), { round: 0.05, amp: 0.025, freq: 6, amp2: 0.01, freq2: 14, seed: 5 }),
    iceMat({ roughness: 0.3, emissiveIntensity: 0.06 }), N,
  );
  heap(nug, N, 42, 0.95);
  objs[1].add(nug);

  // c) ghiaccio secco + nebbia
  const pel = new THREE.InstancedMesh(
    sculpt(new THREE.CylinderGeometry(0.09, 0.09, 0.26, 14, 6), { round: 0.03, amp: 0.035, freq: 12, amp2: 0.02, freq2: 26, seed: 11 }),
    // opaco, gessoso, quasi senza riflessi: il plasticoso veniva da flatShading + luce speculare
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, envMapIntensity: 0.25, bumpMap: frost, bumpScale: 1 }), 80,
  );
  heap(pel, 80, 17, 0.9);
  const tint = new THREE.Color();
  for (let i = 0; i < 80; i++) pel.setColorAt(i, tint.setHSL(0.56, 0.1, 0.7 + (((i * 37) % 100) / 100) * 0.25));
  pel.instanceColor.needsUpdate = true;
  const sprite = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.6)');
    gr.addColorStop(0.4, 'rgba(255,255,255,0.25)');
    gr.addColorStop(0.7, 'rgba(255,255,255,0.05)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const F = 1000;
  const fcol = new Float32Array(F * 4).fill(1); // RGBA per particella: l'alpha d� dissolvenza in entrata/uscita
  const fpos = new Float32Array(F * 3), fvel = new Float32Array(F * 3), flife = new Float32Array(F);
  const spawn = (i) => {
    const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * 0.8;
    fpos[i * 3] = Math.cos(a) * d; fpos[i * 3 + 1] = -0.12; fpos[i * 3 + 2] = Math.sin(a) * d * 0.8;
    const out = Math.random() < 0.1 ? 0.30 : 0.12; // pochi fili sfuggono piu lontano
    fvel[i * 3] = Math.cos(a) * out; fvel[i * 3 + 1] = 0.03 + Math.random() * 0.07; fvel[i * 3 + 2] = Math.sin(a) * out;
    flife[i] = 0;
  };
  for (let i = 0; i < F; i++) { spawn(i); flife[i] = Math.random(); }
  const fogMat = new THREE.PointsMaterial({ color: 0xdff3ff, size: 1.3, map: sprite, transparent: true, opacity: 0.4, vertexColors: true, depthWrite: false });
  const fog = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(fpos, 3)).setAttribute('color', new THREE.BufferAttribute(fcol, 4)), fogMat);
  fog.frustumCulled = false;
  fog.geometry.setDrawRange(0, Math.ceil(F * fogDensity)); // oggetto piccolo (mobile) = meno particelle, stessa densità percepita
  objs[2].add(pel);
  const fogG = new THREE.Group();
  fogG.add(fog);
  group.add(fogG);

  let last = 0;
  function update(time, service, scrollY, vis, baseScale, dx = 0, dy = 0, anchors = null) {
    const dt = Math.min(0.05, time - last);
    last = time;
    objs.forEach((o, i) => {
      // mobile: ogni oggetto sta nella finestra della sua scheda; desktop: dissolvenza in base a `service`
      const w = anchors ? anchors[i].w : smooth(1 - Math.abs(service - i) * 1.4);
      const k = anchors ? 1 : vis;
      o.visible = k * w > 0.01 && baseScale > 0.05; // scala quasi 0 = nascosto, niente puntino
      o.scale.setScalar(Math.max(1e-4, baseScale * k * w));
      o.position.set(anchors ? anchors[i].x : (i % 2 === 0 ? 1 : -1) * dx, anchors ? anchors[i].y : dy, 0);
      o.rotation.set(0.5 + i * 0.3, time * 0.25 + scrollY * 0.0015 + i * 2.1, 0);
      if (i === 2) {
        fogMat.opacity = 0.4 * Math.max(0, (w - 0.8) / 0.2) * k; // la nebbia entra solo quando il modello e quasi del tutto apparso
        fogMat.size = 1.3 * baseScale * pointScale;
        fogG.visible = o.visible;
        fogG.position.copy(o.position);
        fogG.rotation.copy(o.rotation); // il fumo segue l orientamento del mucchio
        fogG.scale.setScalar(Math.max(1e-4, baseScale));
      }
    });
    if (!objs[2].visible) return;
    for (let i = 0; i < F; i++) {
      flife[i] += dt / 3.8;
      if (flife[i] >= 1) { spawn(i); continue; }
      fvel[i * 3 + 1] -= dt * 0.05; // nebbia fredda: sale appena, poi cola verso il basso
      const k = 1;
      fpos[i * 3] += fvel[i * 3] * dt * k;
      fpos[i * 3 + 1] += fvel[i * 3 + 1] * dt;
      fpos[i * 3 + 2] += fvel[i * 3 + 2] * dt * k;
      fcol[i * 4 + 3] = Math.min(1, flife[i] * 6) * (1 - flife[i]);
    }
    fog.geometry.attributes.position.needsUpdate = true;
    fog.geometry.attributes.color.needsUpdate = true;
  }
  return { group, update };
}
