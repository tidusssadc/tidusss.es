#!/usr/bin/env node
/**
 * Importador OFFLINE de identidades conocidas (PRO/streamer) para "Partida
 * en curso". Ejecución MANUAL únicamente — nunca se llama desde
 * producción ni desde build. Ver README.md de esta carpeta.
 *
 *   npm run identities:verify -- --input=candidatos.json [--dry-run]
 *
 * Cada PUUID escrito viene siempre de una llamada real a Riot Account-V1
 * en este mismo proceso — nunca se copia un PUUID de una fuente externa
 * (LoLPros, DeepLoL o cualquier otra) sin revalidarlo aquí.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRiotClient } from '../../src/lib/riot/client.ts';
import { getRiotConfig } from '../../src/config/riot.ts';
import { knownPlayerIdentities as existingRegistry } from '../../src/config/known-players.generated.ts';
import { parseCandidates } from './validate.ts';
import { verifyBatch } from './resolve.ts';
import type { AccountResolver, VerifyBatchResult } from './types.ts';
import type { KnownPlayerIdentity } from '../../src/lib/riot/live-types.ts';
import type { RiotAccountDto } from '../../src/lib/riot/types.ts';

const DEFAULT_OUTPUT_PATH = fileURLToPath(
  new URL('../../src/config/known-players.generated.ts', import.meta.url),
);

export interface CliArgs {
  input?: string;
  dryRun: boolean;
  outputPath: string;
}

export const parseArgs = (argv: readonly string[]): CliArgs => {
  let input: string | undefined;
  let dryRun = false;
  let outputPath = DEFAULT_OUTPUT_PATH;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--input=')) input = arg.slice('--input='.length);
    else if (arg.startsWith('--out=')) outputPath = arg.slice('--out='.length);
  }
  return { input, dryRun, outputPath };
};

/**
 * Mismo formato que `champions.generated.ts` (ver `sync-champion-catalog.mjs`):
 * `JSON.stringify(..., null, 2)` decide el formato exacto, no Prettier —
 * regenerar dos veces con el mismo registro produce el mismo fichero byte
 * a byte (excluido de `.prettierignore` por el mismo motivo).
 */
export const serializeRegistry = (registry: readonly KnownPlayerIdentity[]): string =>
  `/**
 * GENERADO — no editar a mano.
 * Fuente: \`scripts/identities/verify-identities.ts\` — cada identidad de
 * aquí viene de un batch de candidatos verificado a mano por un humano y
 * resuelto contra Riot Account-V1 (cada \`puuid\` es real, nunca copiado de
 * LoLPros/DeepLoL/ninguna fuente externa sin revalidar).
 * Para regenerar: npm run identities:verify -- --input <candidatos.json>
 */
import type { KnownPlayerIdentity } from '../lib/riot/live-types';

export const knownPlayerIdentities: readonly KnownPlayerIdentity[] = ${JSON.stringify(registry, null, 2)};
`;

export const writeRegistry = async (
  outputPath: string,
  registry: readonly KnownPlayerIdentity[],
): Promise<void> => {
  await writeFile(outputPath, serializeRegistry(registry), 'utf8');
};

/** Único punto que toca red de verdad — Riot Account-V1, misma configuración (.env) que el resto del proyecto. */
export const createRealAccountResolver = (): AccountResolver => {
  const config = getRiotConfig(process.env);
  if (!config.apiKey) {
    throw new Error(
      'RIOT_API_KEY no está configurada. Ejecuta con `node --env-file=.env ...` o exporta la variable.',
    );
  }
  const client = createRiotClient({ apiKey: config.apiKey });
  const regionalBase = `https://${config.regionalRoute}.api.riotgames.com`;
  return async (gameName, tagLine) => {
    const dto = await client.get<RiotAccountDto>(
      `${regionalBase}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      {
        phase: 'account',
        endpoint: 'ACCOUNT-V1 /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}',
      },
    );
    if (!dto.puuid || !dto.gameName || !dto.tagLine) {
      throw new Error('RIOT_INVALID_RESPONSE: la cuenta no trae puuid/gameName/tagLine');
    }
    return { puuid: dto.puuid, gameName: dto.gameName, tagLine: dto.tagLine };
  };
};

export const printReport = (result: VerifyBatchResult, args: CliArgs): void => {
  const lines = [
    '',
    `Candidatos:        ${result.candidatesTotal}`,
    `Verificados:       ${result.verifiedIdentities}`,
    `Cuentas:           ${result.accountsResolved}`,
    `PUUIDs:            ${result.puuidsResolved}`,
    `Profesionales:     ${result.pros}`,
    `Streamers:         ${result.streamers}`,
    `PRO + STREAMER:    ${result.proAndStreamer}`,
    `Multicuentas:      ${result.multiAccountIdentities}`,
    `Errores:           ${result.errors.length}`,
    `Conflictos:        ${result.conflicts.length}`,
    '',
  ];
  lines.forEach((line) => console.log(line));
  if (result.errors.length) {
    console.log('--- Errores ---');
    result.errors.forEach((error) => console.log(`  - ${error.reason}`));
    console.log('');
  }
  if (result.conflicts.length) {
    console.log('--- Conflictos (no resueltos automáticamente — revisa y corrige el fichero de candidatos) ---');
    result.conflicts.forEach((conflict) => console.log(`  - [${conflict.reason}] ${conflict.detail}`));
    console.log('');
  }
  console.log(
    args.dryRun
      ? `DRY-RUN: ${args.outputPath} NO se ha modificado.`
      : `Escrito: ${args.outputPath}`,
  );
};

export interface RunOptions {
  /** Inyectable en tests — nunca llama a Riot real. Por defecto, `createRealAccountResolver()`. */
  resolveAccount?: AccountResolver;
  /** Inyectable en tests — por defecto, el registro real (`known-players.generated.ts`). */
  existingRegistry?: readonly KnownPlayerIdentity[];
  /** Inyectable en tests, para no depender del reloj real en aserciones. */
  verifiedAt?: string;
}

export const run = async (
  argv: readonly string[],
  options: RunOptions = {},
): Promise<VerifyBatchResult> => {
  const args = parseArgs(argv);
  if (!args.input) {
    throw new Error(
      'Falta --input=<candidatos.json>. Ver scripts/identities/README.md.',
    );
  }
  const raw: unknown = JSON.parse(await readFile(args.input, 'utf8'));
  const { candidates, errors: parseErrors } = parseCandidates(raw);
  const resolveAccount = options.resolveAccount ?? createRealAccountResolver();
  const registry = options.existingRegistry ?? existingRegistry;
  const verifiedAt = options.verifiedAt ?? new Date().toISOString();
  const result = await verifyBatch(candidates, registry, resolveAccount, verifiedAt);
  const combined: VerifyBatchResult = { ...result, errors: [...parseErrors, ...result.errors] };
  if (!args.dryRun) await writeRegistry(args.outputPath, combined.mergedRegistry);
  printReport(combined, args);
  return combined;
};

const isMainModule =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  run(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
