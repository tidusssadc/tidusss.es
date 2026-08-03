import {
  adcLabChampions,
  championCatalog,
  leagueLaboratoryBuilds,
  leagueLaboratoryConcepts,
  leagueLaboratoryRunePages,
  leagueLaboratorySynergies,
  lucian,
  officialAdcTierList,
} from '../../data/league-laboratory';
import type { ChampionCatalogEntry, LabChampionId } from '../league-laboratory';
import {
  buildDocuments,
  championIdentityDocuments,
  championProfileTraitDocuments,
  championUnderstandingDocuments,
  conceptDocuments,
  editorialHistoryDocuments,
  runePageDocuments,
  synergyDocuments,
  tierListEntryDocuments,
} from './builders';
import type { KnowledgeDocument } from './types';

/**
 * Ensambla el Índice de Conocimiento real a partir de
 * `src/data/league-laboratory` — sin red, sin APIs, sin secretos, sin
 * estado mutable entre llamadas (se calcula una vez, en build time, como
 * el resto del dominio). Excluye explícitamente:
 *
 * - campeones curados sin `profile` (Kai'Sa, Jinx, Ezreal — "draft", sin
 *   veredicto editorial real que citar);
 * - entradas de Tier List con `reviewStatus !== 'reviewed'` (los 3
 *   placeholders de la Tier List oficial);
 * - conceptos sin ninguna relación real con contenido curado (Tempo, Wave
 *   Management — mismo criterio que ya aplica `content-graph` a `concept`,
 *   por consistencia entre los dos dominios, aunque no se importen entre
 *   sí);
 * - ramas de runas vacías (pendientes de análisis) — producen cero
 *   documentos por construcción, nunca un documento de relleno.
 *
 * El resultado se ordena por `id` antes de exportarse: el orden en que se
 * recorren builds/rune-pages/synergies/etc. arriba no afecta al array
 * final, ni a qué documentos existen ni en qué posición.
 */

const getCatalogEntryOrThrow = (
  championId: LabChampionId,
): ChampionCatalogEntry => {
  const catalogEntry = championCatalog.find((entry) => entry.id === championId);
  if (!catalogEntry) {
    throw new Error(
      `${championId} no existe en el catálogo generado — ejecuta npm run sync:champions.`,
    );
  }
  return catalogEntry;
};

const championUrl = (slug: string): string => `/campeones/${slug}`;

const byId = (a: KnowledgeDocument, b: KnowledgeDocument): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

const buildKnowledgeDocuments = (): KnowledgeDocument[] => {
  const documents: KnowledgeDocument[] = [];

  for (const labChampion of adcLabChampions) {
    if (!labChampion.profile) continue; // sin perfil real = draft, sin contenido editorial que indexar
    const catalogEntry = getCatalogEntryOrThrow(labChampion.id);
    const url = championUrl(catalogEntry.slug);
    documents.push(
      ...championIdentityDocuments(labChampion, catalogEntry, url),
      ...championUnderstandingDocuments(labChampion, catalogEntry.name, url),
      ...championProfileTraitDocuments(labChampion, catalogEntry.name, url),
      ...editorialHistoryDocuments(labChampion, catalogEntry.name, url),
    );
  }

  for (const build of leagueLaboratoryBuilds) {
    const catalogEntry = getCatalogEntryOrThrow(build.championId);
    documents.push(
      ...buildDocuments(
        build,
        catalogEntry.name,
        `${championUrl(catalogEntry.slug)}#build-heading`,
      ),
    );
  }

  for (const runePage of leagueLaboratoryRunePages) {
    const catalogEntry = getCatalogEntryOrThrow(runePage.championId);
    documents.push(
      ...runePageDocuments(
        runePage,
        catalogEntry.name,
        `${championUrl(catalogEntry.slug)}#runas-heading`,
      ),
    );
  }

  for (const synergy of leagueLaboratorySynergies) {
    const championNames = synergy.championIds.map(
      (championId) => getCatalogEntryOrThrow(championId).name,
    );
    const [ownerId] = synergy.championIds;
    if (!ownerId) continue; // dato de dominio inválido, defensivo — no ocurre en los datos reales
    const ownerSlug = getCatalogEntryOrThrow(ownerId).slug;
    documents.push(
      ...synergyDocuments(
        synergy,
        championNames,
        `${championUrl(ownerSlug)}#sinergias-heading`,
      ),
    );
  }

  // Solo los conceptos que Lucian enlaza directamente (coreConceptIds) tienen hoy contenido editorial real que citar.
  const lucianCatalogEntry = getCatalogEntryOrThrow(lucian.id);
  for (const conceptId of lucian.coreConceptIds ?? []) {
    const concept = leagueLaboratoryConcepts.find((candidate) => candidate.id === conceptId);
    if (!concept) {
      throw new Error(`${conceptId} no existe en leagueLaboratoryConcepts.`);
    }
    documents.push(
      ...conceptDocuments(
        concept,
        [lucian.id],
        `${championUrl(lucianCatalogEntry.slug)}#concepts-heading`,
      ),
    );
  }

  // Solo entradas revisadas de la Tier List — nunca placeholders.
  for (const entry of officialAdcTierList.entries) {
    if (entry.reviewStatus !== 'reviewed') continue;
    const catalogEntry = getCatalogEntryOrThrow(entry.championId);
    documents.push(
      ...tierListEntryDocuments(officialAdcTierList, entry, catalogEntry.name, '/tier-list'),
    );
  }

  return documents.sort(byId);
};

export const knowledgeDocuments: readonly KnowledgeDocument[] = buildKnowledgeDocuments();
