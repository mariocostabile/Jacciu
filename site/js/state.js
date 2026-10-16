export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

// sections: { about, services, portfolio }, ognuna { top, height } in px di pagina.
// c = centro del viewport: tutti gli stati sono funzione di dove sta il centro.
export function stateAt(y, vh, s) {
  const c = y + vh / 2;
  const freeze = smooth((c - s.about.top) / s.about.height);
  const cubeIn = smooth((c - s.services.top - vh * 0.35) / (vh * 0.5));
  const cubeOut = smooth((c - s.portfolio.top + vh * 0.25) / (vh * 0.5));
  const m = (s.boxes || []).map((b) => b.top + b.height / 2);
  let service = 0;
  if (m.length === 3 && c >= m[2]) service = 2;
  else if (m.length === 3 && c > m[0]) {
    const i = c < m[1] ? 0 : 1;
    service = i + smooth((c - m[i]) / (m[i + 1] - m[i]));
  }
  return { freeze, cube: cubeIn * (1 - cubeOut), service };
}

export function temperature({ freeze }) {
  const v = -18 * freeze;
  return (Math.abs(v) < 0.05 ? '0.0' : v.toFixed(1)) + ' °C';
}
