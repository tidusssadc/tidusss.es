import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  championFromMatch,
  matchChampionRelation,
  matchToContentEntity,
  verifiedMatchVideoRelation,
  videoToContentEntity,
} from '../../src/domain/content-graph/adapters.ts';
import {
  buildDocumentsChampionRelation,
  buildToContentEntity,
  championAppearsInTierListRelation,
  championSynergizesWithRelation,
  championToContentEntity,
  conceptExplainsRelation,
  conceptToContentEntity,
  editorialLogChangedInRelations,
  editorialLogDocumentsChampionRelation,
  editorialLogToContentEntity,
  matchupRelatedToChampionRelation,
  matchupToContentEntity,
  patchToContentEntity,
  runePageDocumentsChampionRelation,
  runePageToContentEntity,
  synergyDocumentsChampionRelation,
  synergyToContentEntity,
  tierListFeaturesChampionRelation,
  tierListToContentEntity,
  tierListTracksPatchRelation,
} from '../../src/domain/league-laboratory/content-graph-bridge.ts';
import {
  findEntitiesWithUnknownFields,
  findRelationsWithUnknownFields,
} from '../../src/domain/content-graph/invariants.ts';
import { kaisa, lucian } from '../../src/data/league-laboratory/champions.ts';
import { lucianSolidBuild26_14 } from '../../src/data/league-laboratory/builds.ts';
import { lucianRunes26_14 } from '../../src/data/league-laboratory/rune-pages.ts';
import { lucianMilioSynergy } from '../../src/data/league-laboratory/synergies.ts';
import { spacing } from '../../src/data/league-laboratory/concepts.ts';
import { championCatalog } from '../../src/data/league-laboratory/catalog/champions.generated.ts';
import { patch1514 } from '../../src/data/league-laboratory/patches.ts';
import { officialAdcTierList } from '../../src/data/league-laboratory/official-adc-tier-list.ts';
import type { YouTubeVideo } from '../../src/types/content.ts';
import type { RecentMatch } from '../../src/lib/riot/types.ts';
import type {
  EditorialHistoryEntry,
  Matchup,
} from '../../src/domain/league-laboratory/types.ts';

const sampleVideo: YouTubeVideo = {
  id: 'abc123',
  title: 'Cómo jugar Lucian nivel Master',
  url: 'https://youtube.com/watch?v=abc123',
  thumbnailUrl: 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
  publishedAt: '2026-07-20T10:00:00.000Z',
  durationSeconds: 900,
  durationLabel: '15:00',
  isShort: false,
  contentType: 'video',
};

const sampleMatch: RecentMatch = {
  matchId: 'EUW1_1234567890',
  championId: 236,
  championName: 'Lucian',
  win: true,
  kills: 8,
  deaths: 2,
  assists: 6,
  kda: 7,
  cs: 210,
  csPerMinute: 8.4,
  durationSeconds: 1500,
  durationLabel: '25:00',
  queueId: 420,
  queueLabel: 'Solo/Duo',
  playedAt: '2026-07-20T18:30:00.000Z',
  items: [],
  itemImageUrls: [],
  damageToChampions: 22000,
  goldEarned: 14500,
  visionScore: 24,
  position: 'BOTTOM',
  summonerSpells: [],
  runes: [],
  teams: [],
  teamId: 100,
  remake: false,
};

const lucianCatalogEntry = championCatalog.find(
  (entry) => entry.id === lucian.id,
);
if (!lucianCatalogEntry) {
  throw new Error(
    'champion:lucian debe existir en el catálogo generado para poder ejecutar este test',
  );
}

/**
 * Matchup sintético para probar el adaptador en aislamiento: no hay ningún
 * matchup real todavía en `leagueLaboratoryMatchups` (Fase B lo deja
 * activado pero vacío, ver `league-laboratory-extension.ts`). Usa dos
 * campeones curados reales (Lucian/Kai'Sa) para que los ids resueltos por
 * `getCatalogEntryOrThrow` en producción sigan siendo representativos.
 */
const sampleMatchup: Matchup = {
  id: 'matchup:lucian-vs-kaisa-sample',
  championId: lucian.id,
  opponentChampionId: kaisa.id,
  role: 'BOTTOM',
  patchId: patch1514.id,
  difficulty: 'even',
  editorialTake: {
    verdict: 'Matchup de ejemplo para pruebas de adaptador, no contenido editorial real.',
    reasoning: 'Fixture sintético usado solo para verificar determinismo y ausencia de fugas.',
    confidence: 'medium',
  },
};

/**
 * Un mismo caso (determinismo, no-mutación, no-fuga de campos internos) se
 * repite para cada adaptador activo — tanto los de `content-graph/adapters`
 * (Riot/YouTube, tiempo de petición) como los ya invocados desde
 * `league-laboratory-extension.ts` (build time). `build` y `matchup` se
 * activaron en la Fase B; `guide` sigue sin fuente de datos real y no se
 * prueba aquí.
 */
const entityAdapterCases: Array<[string, () => unknown]> = [
  ['videoToContentEntity', () => videoToContentEntity(sampleVideo)],
  ['matchToContentEntity', () => matchToContentEntity(sampleMatch)],
  ['championFromMatch', () => championFromMatch(sampleMatch)],
  [
    'championToContentEntity',
    () => championToContentEntity(lucianCatalogEntry, lucian),
  ],
  ['patchToContentEntity', () => patchToContentEntity(patch1514)],
  [
    'tierListToContentEntity',
    () => tierListToContentEntity(officialAdcTierList),
  ],
  ['buildToContentEntity', () => buildToContentEntity(lucianSolidBuild26_14)],
  [
    'matchupToContentEntity',
    () =>
      matchupToContentEntity(
        sampleMatchup,
        lucian.id.slice('champion:'.length),
        kaisa.id.slice('champion:'.length),
      ),
  ],
  ['runePageToContentEntity', () => runePageToContentEntity(lucianRunes26_14)],
  [
    'synergyToContentEntity',
    () => synergyToContentEntity(lucianMilioSynergy, ['Lucian', 'Milio']),
  ],
  ['conceptToContentEntity', () => conceptToContentEntity(spacing)],
  [
    'editorialLogToContentEntity',
    () =>
      editorialLogToContentEntity(lucian.id, 'Lucian', lucian.editorialHistory ?? []),
  ],
];

for (const [name, run] of entityAdapterCases) {
  test(`${name} es determinista: misma entrada, misma salida`, () => {
    assert.deepEqual(run(), run());
  });

  test(`${name} no expone campos fuera del contrato público ContentEntity`, () => {
    const result = run();
    assert.deepEqual(
      findEntitiesWithUnknownFields([result as never]),
      [],
    );
  });
}

const relationAdapterCases: Array<[string, () => unknown]> = [
  [
    'matchChampionRelation',
    () => matchChampionRelation(sampleMatch),
  ],
  [
    'verifiedMatchVideoRelation',
    () => verifiedMatchVideoRelation(sampleMatch.matchId, sampleVideo.id),
  ],
  [
    'tierListFeaturesChampionRelation',
    () =>
      tierListFeaturesChampionRelation(officialAdcTierList, lucian.id),
  ],
  [
    'tierListTracksPatchRelation',
    () => tierListTracksPatchRelation(officialAdcTierList),
  ],
  [
    'championAppearsInTierListRelation',
    () =>
      championAppearsInTierListRelation(officialAdcTierList, lucian.id),
  ],
  [
    'buildDocumentsChampionRelation',
    () => buildDocumentsChampionRelation(lucianSolidBuild26_14, 'Lucian'),
  ],
  [
    'matchupRelatedToChampionRelation',
    () =>
      matchupRelatedToChampionRelation(
        sampleMatchup,
        lucian.id.slice('champion:'.length),
        kaisa.id.slice('champion:'.length),
      ),
  ],
  [
    'runePageDocumentsChampionRelation',
    () => runePageDocumentsChampionRelation(lucianRunes26_14, 'Lucian'),
  ],
  [
    'synergyDocumentsChampionRelation',
    () => synergyDocumentsChampionRelation(lucianMilioSynergy, lucian.id),
  ],
  [
    'championSynergizesWithRelation',
    () => championSynergizesWithRelation(lucian.id, kaisa.id, 'Kai\'Sa'),
  ],
  [
    'conceptExplainsRelation',
    () => conceptExplainsRelation(spacing, lucian.id, 'Lucian'),
  ],
  [
    'editorialLogDocumentsChampionRelation',
    () => editorialLogDocumentsChampionRelation(lucian.id, 'Lucian'),
  ],
];

for (const [name, run] of relationAdapterCases) {
  test(`${name} es determinista: misma entrada, misma salida`, () => {
    assert.deepEqual(run(), run());
  });

  test(`${name} no expone campos fuera del contrato público ContentRelation`, () => {
    const result = run();
    assert.deepEqual(
      findRelationsWithUnknownFields([result as never]),
      [],
    );
  });
}

// --- No mutación del dominio de origen ---

test('championToContentEntity no muta el LabChampion ni el ChampionCatalogEntry de origen', () => {
  const labChampionClone = structuredClone(lucian);
  const catalogEntryClone = structuredClone(lucianCatalogEntry);
  championToContentEntity(lucianCatalogEntry, lucian);
  assert.deepEqual(lucian, labChampionClone);
  assert.deepEqual(lucianCatalogEntry, catalogEntryClone);
});

test('patchToContentEntity no muta el Patch de origen', () => {
  const clone = structuredClone(patch1514);
  patchToContentEntity(patch1514);
  assert.deepEqual(patch1514, clone);
});

test('tierListToContentEntity no muta el TierList de origen', () => {
  const clone = structuredClone(officialAdcTierList);
  tierListToContentEntity(officialAdcTierList);
  assert.deepEqual(officialAdcTierList, clone);
});

test('videoToContentEntity no muta el YouTubeVideo de origen', () => {
  const clone = structuredClone(sampleVideo);
  videoToContentEntity(sampleVideo);
  assert.deepEqual(sampleVideo, clone);
});

test('matchToContentEntity y championFromMatch no mutan el RecentMatch de origen', () => {
  const clone = structuredClone(sampleMatch);
  matchToContentEntity(sampleMatch);
  championFromMatch(sampleMatch);
  matchChampionRelation(sampleMatch);
  assert.deepEqual(sampleMatch, clone);
});

// --- Los adaptadores no inventan información ausente en el dominio de origen ---

test('championFromMatch deriva el id únicamente del nombre real de campeón de la partida', () => {
  const entity = championFromMatch(sampleMatch);
  assert.equal(entity.id, `champion:${sampleMatch.championName.toLocaleLowerCase('es-ES')}`);
  assert.equal(entity.title, sampleMatch.championName);
});

test('verifiedMatchVideoRelation exige explícitamente los dos ids reales, nunca los infiere', () => {
  const relation = verifiedMatchVideoRelation(sampleMatch.matchId, sampleVideo.id);
  assert.equal(relation.from, `video:${sampleVideo.id}`);
  assert.equal(relation.to, `match:${sampleMatch.matchId}`);
  assert.equal(relation.source, 'verified-manual');
});

// --- Fase B: build/matchup, activados en esta fase ---

test('buildToContentEntity y buildDocumentsChampionRelation no mutan la Build de origen', () => {
  const clone = structuredClone(lucianSolidBuild26_14);
  buildToContentEntity(lucianSolidBuild26_14);
  buildDocumentsChampionRelation(lucianSolidBuild26_14, 'Lucian');
  assert.deepEqual(lucianSolidBuild26_14, clone);
});

test('matchupToContentEntity y matchupRelatedToChampionRelation no mutan el Matchup de origen', () => {
  const clone = structuredClone(sampleMatchup);
  matchupToContentEntity(sampleMatchup, 'Lucian', "Kai'Sa");
  matchupRelatedToChampionRelation(sampleMatchup, 'Lucian', "Kai'Sa");
  assert.deepEqual(sampleMatchup, clone);
});

test('buildDocumentsChampionRelation apunta exactamente al championId real de la build, nunca a otro campeón', () => {
  const relation = buildDocumentsChampionRelation(lucianSolidBuild26_14, 'Lucian');
  assert.equal(relation.to, lucianSolidBuild26_14.championId);
  assert.equal(relation.to, lucian.id);
});

/**
 * Corrección: el label debía usar el nombre editorial real ("Lucian"), no
 * el slug derivado del championId ("lucian"). No se acepta una
 * capitalización artificial del slug — el nombre viene siempre del
 * catálogo real, pasado explícitamente como parámetro.
 */
test('buildDocumentsChampionRelation usa "Lucian" en el label, nunca el slug "lucian"', () => {
  const relation = buildDocumentsChampionRelation(
    lucianSolidBuild26_14,
    lucianCatalogEntry.name,
  );
  assert.equal(relation.label, 'Cómo jugar Lucian con esta build');
  assert.ok(!relation.label.includes('lucian'), 'el label no debe contener el slug en minúsculas');
});

test('matchupRelatedToChampionRelation apunta exactamente al championId propietario del matchup, nunca al oponente', () => {
  const relation = matchupRelatedToChampionRelation(sampleMatchup, 'Lucian', "Kai'Sa");
  assert.equal(relation.to, sampleMatchup.championId);
  assert.notEqual(relation.to, sampleMatchup.opponentChampionId);
});

// --- Fase C: rune-page, synergy, concept, editorial-log ---

test('runePageToContentEntity y runePageDocumentsChampionRelation no mutan la RunePage de origen', () => {
  const clone = structuredClone(lucianRunes26_14);
  runePageToContentEntity(lucianRunes26_14);
  runePageDocumentsChampionRelation(lucianRunes26_14, 'Lucian');
  assert.deepEqual(lucianRunes26_14, clone);
});

test('synergyToContentEntity y synergyDocumentsChampionRelation no mutan la Synergy de origen', () => {
  const clone = structuredClone(lucianMilioSynergy);
  synergyToContentEntity(lucianMilioSynergy, ['Lucian', 'Milio']);
  synergyDocumentsChampionRelation(lucianMilioSynergy, lucian.id);
  assert.deepEqual(lucianMilioSynergy, clone);
});

test('conceptToContentEntity y conceptExplainsRelation no mutan el Concept de origen', () => {
  const clone = structuredClone(spacing);
  conceptToContentEntity(spacing);
  conceptExplainsRelation(spacing, lucian.id, 'Lucian');
  assert.deepEqual(spacing, clone);
});

test('editorialLogToContentEntity y editorialLogChangedInRelations no mutan el historial de origen', () => {
  const history = lucian.editorialHistory ?? [];
  const clone = structuredClone(history);
  editorialLogToContentEntity(lucian.id, 'Lucian', history);
  editorialLogDocumentsChampionRelation(lucian.id, 'Lucian');
  editorialLogChangedInRelations(lucian.id, history);
  assert.deepEqual(history, clone);
});

test('synergyToContentEntity compone el título a partir de los nombres reales de campeón, nunca de texto libre inventado', () => {
  const entity = synergyToContentEntity(lucianMilioSynergy, ['Lucian', 'Milio']);
  assert.equal(entity.title, 'Lucian + Milio');
});

/**
 * `explains` y `synergizes-with` deben tiparse contra `ContentEntityId`
 * genérico, no contra `LabChampionId` (`docs/content-graph.md` §4.2). Se
 * comprueba pasando un id que no es de tipo `champion` — si la función
 * exigiera un `LabChampionId` en tiempo de compilación, esto no
 * compilaría; en tiempo de ejecución, el valor se propaga sin más
 * validación que la del propio tipo (no se inventa ninguna comprobación
 * adicional específica de campeón).
 */
test('conceptExplainsRelation acepta un ContentEntityId genérico, no solo un campeón', () => {
  const relation = conceptExplainsRelation(spacing, 'build:algun-build-futuro', 'una build futura');
  assert.equal(relation.to, 'build:algun-build-futuro');
});

test('championSynergizesWithRelation acepta ContentEntityId genérico en ambos extremos', () => {
  const relation = championSynergizesWithRelation(
    'build:algun-build-futuro',
    'concept:algun-concepto-futuro',
    'un concepto futuro',
  );
  assert.equal(relation.from, 'build:algun-build-futuro');
  assert.equal(relation.to, 'concept:algun-concepto-futuro');
});

test('editorialLogToContentEntity es el mismo nodo (mismo id) sin importar cuántas entradas tenga el historial', () => {
  const oneEntry: EditorialHistoryEntry[] = [
    { date: '2026-01-01', summary: 'Una entrada.' },
  ];
  const fourEntries: EditorialHistoryEntry[] = [
    ...oneEntry,
    { date: '2026-02-01', summary: 'Otra entrada.' },
    { date: '2026-03-01', summary: 'Otra más.' },
    { date: '2026-04-01', summary: 'Y otra.' },
  ];
  const entityWithOne = editorialLogToContentEntity(lucian.id, 'Lucian', oneEntry);
  const entityWithFour = editorialLogToContentEntity(lucian.id, 'Lucian', fourEntries);
  assert.equal(entityWithOne.id, entityWithFour.id);
  assert.equal(entityWithOne.id, 'editorial-log:lucian');
});

test('editorialLogChangedInRelations solo genera una relación por entrada con patchId explícito, nunca por fecha o texto libre', () => {
  const history: EditorialHistoryEntry[] = [
    { date: '2026-01-01', summary: 'Sin parche asociado.' },
    { date: '2026-02-01', patchId: 'patch:15-14', summary: 'Con parche.' },
  ];
  const relations = editorialLogChangedInRelations(lucian.id, history);
  assert.equal(relations.length, 1);
  assert.equal(relations[0]?.to, 'patch:15-14');
  assert.equal(relations[0]?.kind, 'changed-in');
});

test('editorialLogChangedInRelations deduplica: dos entradas con el mismo patchId producen una única relación', () => {
  const history: EditorialHistoryEntry[] = [
    { date: '2026-01-01', patchId: 'patch:15-14', summary: 'Primera entrada de ese parche.' },
    { date: '2026-02-01', patchId: 'patch:15-14', summary: 'Segunda entrada del mismo parche.' },
  ];
  const relations = editorialLogChangedInRelations(lucian.id, history);
  assert.equal(relations.length, 1);
});

test('editorialLogChangedInRelations sobre el historial real de Lucian genera exactamente 2 relaciones (patch:15-14 y patch:26-14)', () => {
  const relations = editorialLogChangedInRelations(
    lucian.id,
    lucian.editorialHistory ?? [],
  );
  const targets = relations.map((relation) => relation.to).sort();
  assert.deepEqual(targets, ['patch:15-14', 'patch:26-14']);
});
