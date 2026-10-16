import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../site/css/style.css', import.meta.url), 'utf8');
const tok = (n) => {
  const m = css.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `token --${n} mancante`);
  return m[1];
};
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

for (const [fg, bg] of [
  ['frost', 'navy'], ['frost', 'glacier'], ['muted', 'navy'], ['muted', 'glacier'],
  ['navy', 'ice'], ['navy', 'frost'],
]) {
  test(`contrasto ${fg} su ${bg} >= 4.5`, () => {
    assert.ok(ratio(tok(fg), tok(bg)) >= 4.5, `${ratio(tok(fg), tok(bg)).toFixed(2)}`);
  });
}
