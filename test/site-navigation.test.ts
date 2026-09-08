import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navigation } from '../src/data/site.ts';

// --- Arquitectura pública del Navbar (fase "ecosistema ADC") ---
// El naming interno "El Laboratorio" se retira del producto público: el
// grupo pasa a llamarse "ADCs". Herramientas se retira del dropdown (era
// 100% enlaces a páginas ya alcanzables desde aquí mismo). "Explorar" no
// vuelve al Navbar.

test('el Navbar tiene exactamente 2 elementos de primer nivel: ADCs y Competitivo', () => {
  assert.equal(navigation.length, 2);
  assert.equal(navigation[0]?.label, 'ADCs');
  assert.equal(navigation[1]?.label, 'Competitivo');
});

test('Competitivo es un enlace directo, sin dropdown', () => {
  const competitivo = navigation[1];
  assert.ok(competitivo);
  assert.equal('items' in competitivo, false);
  assert.equal((competitivo as { href: string }).href, '/competitivo');
});

test('el dropdown ADCs contiene exactamente 4 entradas, en este orden, con rutas válidas', () => {
  const adcs = navigation[0];
  assert.ok(adcs && 'items' in adcs);
  assert.deepEqual(
    adcs.items.map((item) => ({ label: item.label, href: item.href })),
    [
      { label: 'Todos los ADCs', href: '/campeones' },
      { label: 'Tier List', href: '/tier-list' },
      { label: 'Aprende ADC', href: '/academia' },
      { label: 'Pregunta a Tidusss', href: '/pregunta' },
    ],
  );
});

test('ningún label del Navbar usa el naming público retirado (El Laboratorio, Centro de Campeones, Academia ADC, Herramientas, Explorar)', () => {
  const retiredLabels = [
    'El Laboratorio',
    'Centro de Campeones',
    'Academia ADC',
    'Herramientas',
    'Explorar',
  ];
  const allLabels: string[] = navigation.flatMap((item) =>
    'items' in item ? [item.label, ...item.items.map((sub) => sub.label)] : [item.label],
  );
  for (const retired of retiredLabels) {
    assert.equal(
      allLabels.includes(retired),
      false,
      `"${retired}" no debería aparecer en el Navbar público`,
    );
  }
});

test('todos los hrefs del Navbar son rutas internas reales (empiezan por "/")', () => {
  const allHrefs = navigation.flatMap((item) =>
    'items' in item ? item.items.map((sub) => sub.href) : [item.href],
  );
  for (const href of allHrefs) {
    assert.ok(href.startsWith('/'), `href no interno: "${href}"`);
  }
});
