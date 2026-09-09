import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile as readFileFs, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseArgs,
  run,
  serializeRegistry,
  writeRegistry,
} from '../../../scripts/identities/verify-identities.ts';
import type { AccountResolver } from '../../../scripts/identities/types.ts';
import type { KnownPlayerIdentity } from '../../../src/lib/riot/live-types.ts';

const withTempDir = async <T>(fn: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'identities-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

const mockResolver: AccountResolver = async (gameName, tagLine) => ({
  puuid: `puuid-${gameName}-${tagLine}`,
  gameName,
  tagLine,
});

test('parseArgs lee --input, --dry-run y --out', () => {
  const args = parseArgs(['--input=candidatos.json', '--dry-run', '--out=salida.ts']);
  assert.equal(args.input, 'candidatos.json');
  assert.equal(args.dryRun, true);
  assert.equal(args.outputPath, 'salida.ts');
});

test('parseArgs sin --dry-run deja dryRun en false', () => {
  const args = parseArgs(['--input=candidatos.json']);
  assert.equal(args.dryRun, false);
});

test('serializeRegistry produce salida determinista para el mismo registro', () => {
  const registry: KnownPlayerIdentity[] = [
    { displayName: 'A', puuids: ['p1'], riotIds: ['A#EUW'], isPro: true, isStreamer: false },
  ];
  assert.equal(serializeRegistry(registry), serializeRegistry(registry));
});

test('serializeRegistry genera un array vacío legible cuando el registro está vacío', () => {
  const output = serializeRegistry([]);
  assert.match(output, /knownPlayerIdentities: readonly KnownPlayerIdentity\[] = \[]/);
});

test('writeRegistry escribe exactamente lo que produce serializeRegistry', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'out.ts');
    const registry: KnownPlayerIdentity[] = [
      { displayName: 'A', puuids: ['p1'], isPro: true, isStreamer: false },
    ];
    await writeRegistry(path, registry);
    const written = await readFileFs(path, 'utf8');
    assert.equal(written, serializeRegistry(registry));
  });
});

// --- dry-run no modifica fichero ---

test('run() con --dry-run NO escribe el fichero de salida, aunque haya candidatos verificados', async () => {
  await withTempDir(async (dir) => {
    const inputPath = join(dir, 'candidatos.json');
    const outputPath = join(dir, 'known-players.generated.ts');
    await writeFile(
      inputPath,
      JSON.stringify([{ displayName: 'Jugador', riotId: 'Jugador#EUW', isPro: true }]),
      'utf8',
    );
    const result = await run([`--input=${inputPath}`, `--out=${outputPath}`, '--dry-run'], {
      resolveAccount: mockResolver,
      existingRegistry: [],
      verifiedAt: '2026-09-09T00:00:00.000Z',
    });
    assert.equal(result.verifiedIdentities, 1);
    await assert.rejects(readFileFs(outputPath, 'utf8'), 'el fichero de salida no debe existir en dry-run');
  });
});

test('run() SIN --dry-run sí escribe el registro fusionado en el fichero de salida', async () => {
  await withTempDir(async (dir) => {
    const inputPath = join(dir, 'candidatos.json');
    const outputPath = join(dir, 'known-players.generated.ts');
    await writeFile(
      inputPath,
      JSON.stringify([{ displayName: 'Jugador', riotId: 'Jugador#EUW', isPro: true }]),
      'utf8',
    );
    await run([`--input=${inputPath}`, `--out=${outputPath}`], {
      resolveAccount: mockResolver,
      existingRegistry: [],
      verifiedAt: '2026-09-09T00:00:00.000Z',
    });
    const written = await readFileFs(outputPath, 'utf8');
    assert.match(written, /puuid-Jugador-EUW/);
  });
});

// --- Riot API error parcial: batch sigue, y el resto SÍ se escribe ---

test('run(): un candidato que Riot no resuelve no bloquea a los demás — el resto se verifica y se escribe', async () => {
  await withTempDir(async (dir) => {
    const inputPath = join(dir, 'candidatos.json');
    const outputPath = join(dir, 'known-players.generated.ts');
    await writeFile(
      inputPath,
      JSON.stringify([
        { displayName: 'Fantasma', riotId: 'Fantasma#EUW', isPro: true },
        { displayName: 'Real', riotId: 'Real#EUW', isPro: true },
      ]),
      'utf8',
    );
    const flakyResolver: AccountResolver = async (gameName, tagLine) => {
      if (gameName === 'Fantasma') throw new Error('RIOT_ACCOUNT_NOT_FOUND');
      return { puuid: `puuid-${gameName}`, gameName, tagLine };
    };
    const result = await run([`--input=${inputPath}`, `--out=${outputPath}`], {
      resolveAccount: flakyResolver,
      existingRegistry: [],
      verifiedAt: '2026-09-09T00:00:00.000Z',
    });
    assert.equal(result.errors.length, 1);
    assert.equal(result.verifiedIdentities, 1);
    const written = await readFileFs(outputPath, 'utf8');
    assert.match(written, /puuid-Real/);
    assert.doesNotMatch(written, /Fantasma/);
  });
});
