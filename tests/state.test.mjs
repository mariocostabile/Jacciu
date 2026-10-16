import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stateAt, temperature } from '../site/js/state.js';
import { shouldUseWebGL, pixelRatioFor } from '../site/js/capability.js';

const vh = 1000;
const s = {
  about: { top: 1000, height: 1000 },
  services: { top: 2000, height: 3000 },
  portfolio: { top: 5000, height: 600 },
  boxes: [{ top: 2400, height: 200 }, { top: 3200, height: 200 }, { top: 4000, height: 200 }],
};
const at = (c) => stateAt(c - vh / 2, vh, s); // c = centro del viewport

test('freeze: 0 prima di about, 1 a fine about', () => {
  assert.equal(at(900).freeze, 0);
  assert.equal(at(2000).freeze, 1);
  assert.ok(at(1500).freeze > 0.4 && at(1500).freeze < 0.6);
});

test('cube: assente prima di services, pieno a metà, assente dopo portfolio', () => {
  assert.equal(at(1500).cube, 0);
  assert.equal(at(3500).cube, 1);
  assert.equal(at(5400).cube, 0);
});

test('service: 0 prima del primo box, 2 dopo ultimo, 1 al secondo, frazionario in mezzo', () => {
  assert.equal(at(2000).service, 0);
  assert.equal(at(5000).service, 2);
  assert.equal(at(3300).service, 1);
  const m = at(2900).service;
  assert.ok(m > 0 && m < 1);
});

test('temperature solo numeri', () => {
  assert.equal(temperature({ freeze: 0 }), '0.0 °C');
  assert.equal(temperature({ freeze: 1 }), '-18.0 °C');
  assert.equal(temperature({ freeze: 0.5 }), '-9.0 °C');
});

test('capability: reduced-motion, no webgl e device debole spengono WebGL', () => {
  assert.equal(shouldUseWebGL({ reducedMotion: false, hasWebGL: true, cores: 8, memory: 8 }), true);
  assert.equal(shouldUseWebGL({ reducedMotion: true, hasWebGL: true, cores: 8, memory: 8 }), false);
  assert.equal(shouldUseWebGL({ reducedMotion: false, hasWebGL: false, cores: 8, memory: 8 }), false);
  assert.equal(shouldUseWebGL({ reducedMotion: false, hasWebGL: true, cores: 2, memory: 8 }), false);
  assert.equal(shouldUseWebGL({ reducedMotion: false, hasWebGL: true, cores: 8, memory: 1 }), false);
});

test('pixel ratio: max 2 desktop, 1.5 mobile', () => {
  assert.equal(pixelRatioFor(3, 1440), 2);
  assert.equal(pixelRatioFor(3, 390), 1.5);
  assert.equal(pixelRatioFor(1, 390), 1);
});
