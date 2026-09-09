import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidStreamUrl, parseCandidates, splitRiotId } from '../../../scripts/identities/validate.ts';

test('splitRiotId acepta "GameName#TAG" y rechaza formas sin ambas partes', () => {
  assert.deepEqual(splitRiotId('Caps#EUW'), { gameName: 'Caps', tagLine: 'EUW' });
  assert.equal(splitRiotId('SinTag'), undefined);
  assert.equal(splitRiotId('#EUW'), undefined);
  assert.equal(splitRiotId('Caps#'), undefined);
  assert.equal(splitRiotId(''), undefined);
});

test('isValidStreamUrl solo acepta https y dominios permitidos (Twitch/YouTube/Kick)', () => {
  assert.equal(isValidStreamUrl('https://www.twitch.tv/tidussstwitch'), true);
  assert.equal(isValidStreamUrl('https://twitch.tv/algo'), true);
  assert.equal(isValidStreamUrl('https://www.youtube.com/@alguien'), true);
  assert.equal(isValidStreamUrl('https://kick.com/alguien'), true);
  assert.equal(isValidStreamUrl('http://twitch.tv/algo'), false, 'http no https');
  assert.equal(isValidStreamUrl('https://evil-mirror.example/twitch.tv'), false, 'dominio no permitido');
  assert.equal(isValidStreamUrl('no-es-una-url'), false);
});

// --- candidato válido ---

test('parseCandidates acepta un candidato válido completo', () => {
  const { candidates, errors } = parseCandidates([
    {
      displayName: 'Jugador Pro',
      riotId: 'ProPlayer#KC1',
      isPro: true,
      isStreamer: false,
      team: 'KC',
      role: 'ADC',
      streamUrl: null,
      source: 'manual-public-verification',
    },
  ]);
  assert.equal(errors.length, 0);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.displayName, 'Jugador Pro');
  assert.equal(candidates[0]?.team, 'KC');
});

test('parseCandidates rechaza un riotId inválido, sin bloquear el resto del lote', () => {
  const { candidates, errors } = parseCandidates([
    { displayName: 'Malo', riotId: 'SinTag', isPro: true },
    { displayName: 'Bueno', riotId: 'Bueno#EUW', isPro: true },
  ]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.displayName, 'Bueno');
  assert.equal(errors.length, 1);
  assert.match(errors[0]?.reason ?? '', /riotId inválido/);
});

test('parseCandidates rechaza un candidato que no marca isPro ni isStreamer', () => {
  const { candidates, errors } = parseCandidates([
    { displayName: 'Ninguno', riotId: 'Ninguno#EUW' },
  ]);
  assert.equal(candidates.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0]?.reason ?? '', /no identifica nada/);
});

test('parseCandidates rechaza displayName vacío', () => {
  const { candidates, errors } = parseCandidates([{ displayName: '', riotId: 'Alguien#EUW', isPro: true }]);
  assert.equal(candidates.length, 0);
  assert.equal(errors.length, 1);
});

test('parseCandidates rechaza isPro/isStreamer con tipo incorrecto (no booleano)', () => {
  const { candidates, errors } = parseCandidates([
    { displayName: 'Raro', riotId: 'Raro#EUW', isPro: 'true' },
  ]);
  assert.equal(candidates.length, 0);
  assert.match(errors[0]?.reason ?? '', /isPro debe ser booleano/);
});

// --- streamUrl malformada ---

test('parseCandidates rechaza una streamUrl malformada o de dominio no permitido', () => {
  const { candidates, errors } = parseCandidates([
    {
      displayName: 'Con URL mala',
      riotId: 'Con#URL',
      isStreamer: true,
      streamUrl: 'https://not-allowed.example/foo',
    },
  ]);
  assert.equal(candidates.length, 0);
  assert.match(errors[0]?.reason ?? '', /streamUrl inválida/);
});

test('parseCandidates rechaza una entrada que no es un objeto', () => {
  const { candidates, errors } = parseCandidates(['solo-texto', 42, null]);
  assert.equal(candidates.length, 0);
  assert.equal(errors.length, 3);
});

test('parseCandidates lanza si el fichero no es un array', () => {
  assert.throws(() => parseCandidates({ not: 'an array' }));
});
