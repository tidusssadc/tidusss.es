#!/usr/bin/env node
/**
 * Genera src/data/league-laboratory/catalog/champions.generated.ts a partir
 * de Data Dragon (catálogo oficial y público de Riot, sin API key).
 *
 * No se ejecuta en build ni en producción: es una herramienta de desarrollo
 * que un humano corre a mano (`npm run sync:champions`) cuando Riot publica
 * campeones nuevos, y el resultado se revisa y se commitea como cualquier
 * otro cambio de datos. El build estático nunca depende de la red para
 * generar `/campeones/*` — sigue el mismo principio que ya aplica el resto
 * del sitio: el build nunca llama a APIs externas en tiempo real.
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { slugifyChampionKey } from '../src/domain/league-laboratory/normalize.ts';

const OUTPUT_PATH = fileURLToPath(
  new URL(
    '../src/data/league-laboratory/catalog/champions.generated.ts',
    import.meta.url,
  ),
);

export const assertUniqueSlugs = (entries) => {
  const seen = new Map();
  for (const entry of entries) {
    const previous = seen.get(entry.slug);
    if (previous) {
      throw new Error(
        `Slug duplicado "${entry.slug}" para ${previous} y ${entry.name}. Revisa slugifyChampionKey().`,
      );
    }
    seen.set(entry.slug, entry.name);
  }
};

/**
 * Transforma un registro crudo de `champion.json` (Data Dragon) en un
 * `ChampionCatalogEntry`. Pura y sin red: dado el mismo `champion` de
 * entrada, siempre produce la misma salida — es lo que hace determinista
 * (y testeable sin depender de la red) la generación del catálogo.
 */
export const buildCatalogEntry = (champion) => ({
  id: `champion:${slugifyChampionKey(champion.id)}`,
  slug: slugifyChampionKey(champion.id),
  name: champion.name,
  title: champion.title,
  tags: champion.tags,
  riotDifficulty: champion.info.difficulty,
  dataDragonKey: champion.id,
});

export const sortCatalogEntries = (entries) =>
  [...entries].sort((a, b) => a.name.localeCompare(b.name, 'es'));

const main = async () => {
  const versionsResponse = await fetch(
    'https://ddragon.leagueoflegends.com/api/versions.json',
  );
  if (!versionsResponse.ok) {
    throw new Error(
      `No se pudo obtener versions.json: ${versionsResponse.status}`,
    );
  }
  const [version] = await versionsResponse.json();

  const championsResponse = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/es_ES/champion.json`,
  );
  if (!championsResponse.ok) {
    throw new Error(
      `No se pudo obtener champion.json: ${championsResponse.status}`,
    );
  }
  const payload = await championsResponse.json();

  const entries = sortCatalogEntries(
    Object.values(payload.data).map(buildCatalogEntry),
  );

  assertUniqueSlugs(entries);

  const contents = `/**
 * GENERADO — no editar a mano.
 * Fuente: Data Dragon (Riot Games), catálogo oficial y público de campeones,
 * versión ${version}.
 * Para regenerar: npm run sync:champions
 *
 * Este archivo es la capa FACTUAL del catálogo: nombre, título oficial,
 * clases de Riot y dificultad oficial. No contiene ningún criterio editorial
 * de Tidusss — eso vive exclusivamente en src/data/league-laboratory/champions.ts.
 *
 * Deliberadamente NO incluye una marca de tiempo de generación: con los
 * mismos datos de origen (misma versión de Data Dragon), este archivo debe
 * ser byte-a-byte idéntico en cualquier máquina y en cualquier momento. La
 * versión de arriba ya identifica de forma determinista qué snapshot de
 * datos representa; una fecha de generación no tendría ningún consumidor y
 * solo introduciría diffs espurios en cada regeneración.
 */
import type { ChampionCatalogEntry } from '../../../domain/league-laboratory';

export const championCatalogVersion = ${JSON.stringify(version)};

export const championCatalog: ChampionCatalogEntry[] = ${JSON.stringify(entries, null, 2)};
`;

  await writeFile(OUTPUT_PATH, contents, 'utf8');
  console.log(
    `✓ Catálogo generado: ${entries.length} campeones (Data Dragon ${version}) → ${OUTPUT_PATH}`,
  );
};

/**
 * Solo dispara la sincronización real (con red) cuando el archivo se ejecuta
 * directamente (`npm run sync:champions`), no cuando los tests importan
 * `buildCatalogEntry`/`sortCatalogEntries`/`assertUniqueSlugs` para probar la
 * transformación pura sin depender de la red.
 */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(
      '✗ Falló la sincronización del catálogo de campeones:',
      error,
    );
    process.exitCode = 1;
  });
}
