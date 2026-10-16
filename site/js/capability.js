// shortcut: euristica su core/RAM dichiarati dal browser, da rivedere se device reali sbagliano.
export function shouldUseWebGL({ reducedMotion, hasWebGL, cores = 4, memory = 4 }) {
  if (reducedMotion || !hasWebGL) return false;
  return cores >= 4 && memory >= 2;
}

export const pixelRatioFor = (dpr, width) => Math.min(dpr, width < 820 ? 1.5 : 2);

export function detect(win) {
  const probe = win.document.createElement('canvas');
  const hasWebGL = !!(probe.getContext('webgl2') || probe.getContext('webgl'));
  const nav = win.navigator;
  const useWebGL = shouldUseWebGL({
    reducedMotion: win.matchMedia('(prefers-reduced-motion: reduce)').matches,
    hasWebGL,
    cores: nav.hardwareConcurrency ?? 4,
    memory: nav.deviceMemory ?? 4,
  });
  return { useWebGL, pixelRatio: pixelRatioFor(win.devicePixelRatio || 1, win.innerWidth) };
}
