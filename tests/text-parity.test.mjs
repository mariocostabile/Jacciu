import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');

const bodyText = (html) =>
  decode(
    html
      .replace(/<head[\s\S]*?<\/head>/i, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, ' ')
  ).replace(/\s+/g, ' ').trim();

const title = (html) => html.match(/<title>([\s\S]*?)<\/title>/i)[1].trim();
const hrefs = (html) => [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]).filter((h) => !h.startsWith('css'));

const orig = read('./fixtures/original.html');
const next = read('../site/index.html');

test('titolo identico', () => assert.equal(title(next), title(orig)));

test('testo visibile identico all originale', () => assert.equal(bodyText(next), bodyText(orig)));

test('stessi link e ancore', () => {
  const want = hrefs(orig).sort();
  const got = hrefs(next).sort();
  assert.deepEqual(got, want);
});

test('id di sezione originali presenti', () => {
  for (const id of ['page-top', 'about', 'services', 'portfolio', 'contact']) {
    assert.match(next, new RegExp(`id="${id}"`), id);
  }
});
