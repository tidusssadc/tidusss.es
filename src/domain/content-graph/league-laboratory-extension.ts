import {
  adcLabChampions,
  championCatalog,
  leagueLaboratoryBuilds,
  leagueLaboratoryConcepts,
  leagueLaboratoryMatchups,
  leagueLaboratoryRunePages,
  leagueLaboratorySynergies,
  lucian,
  officialAdcTierList,
  patch1514,
  patch2614,
} from '../../data/league-laboratory';
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
} from '../league-laboratory';
import type {
  ChampionCatalogEntry,
  Concept,
  ConceptId,
  LabChampionId,
} from '../league-laboratory';
import type { ContentEntity, ContentRelation } from './types';

/**
 * Todo lo que el League Laboratory aporta al Content Graph vive aquí, no
 * repartido dentro de `registry.ts`. Así, cada herramienta nueva del
 * Laboratorio (Build Explorer, Matchup Explorer...) solo amplía este
 * archivo — `registry.ts` no vuelve a tocarse por cada herramienta nueva.
 * Ver ADR en PLATFORM_BIBLE.md.
 *
 * Deliberadamente NO se registran los ~170 campeones del catálogo, solo los
 * que tienen curación editorial (`adcLabChampions`, hoy 4). El Content
 * Graph es para relaciones reales que ofrecer en "sigue explorando"; un
 * campeón de catálogo sin ninguna relación curada no aporta nada al grafo
 * y solo lo saturaría. Su página en `/campeones/<slug>` sigue existiendo y
 * es perfectamente visitable — solo no es un nodo navegable del grafo. El
 * Centro de Campeones (`/campeones`) sí es su punto de entrada real, por
 * eso todas esas páginas llevan además un enlace plano (no una relación de
 * grafo) de vuelta al catálogo completo — igual que ya llevan uno a
 * `/tier-list` y a `/live`.
 */

const championHubEntity: ContentEntity = {
  id: 'tool:champion-hub',
  kind: 'tool',
  title: 'Centro de Campeones',
  description:
    'Busca y filtra en el catálogo completo de campeones del Laboratorio.',
  href: '/campeones',
  source: 'editorial',
  status: 'available',
};

const preguntaToolEntity: ContentEntity = {
  id: 'tool:pregunta',
  kind: 'tool',
  title: 'Pregunta a Tidusss',
  description:
    'Resuelve dudas sobre Lucian y ADC con el contenido editorial ya publicado.',
  href: '/pregunta',
  source: 'editorial',
  status: 'available',
};

const academiaToolEntity: ContentEntity = {
  id: 'tool:academia',
  kind: 'tool',
  title: 'Academia ADC',
  description:
    'El vocabulario y los fundamentos de ADC, organizados en fichas navegables.',
  href: '/academia',
  source: 'editorial',
  status: 'available',
};

const toolsHubEntity: ContentEntity = {
  id: 'tool:tools-hub',
  kind: 'tool',
  title: 'Herramientas',
  description:
    'Todas las utilidades del Laboratorio en un solo sitio, disponibles y en camino.',
  href: '/herramientas',
  source: 'editorial',
  status: 'available',
};

/**
 * Único punto de resolución de un `LabChampionId` contra el catálogo
 * generado — usado tanto por campeones curados como por el contenido que
 * los referencia (builds, matchups). Lanza en vez de devolver `undefined`
 * porque un `championId` que no resuelve es un error de datos real, nunca
 * un estado esperado (mismo criterio que ya usaba este archivo).
 */
const getCatalogEntryOrThrow = (
  championId: LabChampionId,
): ChampionCatalogEntry => {
  const catalogEntry = championCatalog.find(
    (entry) => entry.id === championId,
  );
  if (!catalogEntry) {
    throw new Error(
      `${championId} no existe en el catálogo generado — ejecuta npm run sync:champions o revisa src/data/league-laboratory/champions.ts.`,
    );
  }
  return catalogEntry;
};

/** Mismo criterio que `getCatalogEntryOrThrow`, para conceptos referenciados por id. */
const getConceptOrThrow = (conceptId: ConceptId): Concept => {
  const concept = leagueLaboratoryConcepts.find(
    (candidate) => candidate.id === conceptId,
  );
  if (!concept) {
    throw new Error(
      `${conceptId} no existe en leagueLaboratoryConcepts — revisa src/data/league-laboratory/concepts.ts.`,
    );
  }
  return concept;
};

/**
 * Sinergias: el primer id de `championIds` es siempre el campeón curado
 * que "posee" el análisis (hoy, Lucian en las 6 sinergias reales) — el
 * resto son socios referenciados, siguiendo el mismo criterio
 * propietario/referenciado ya usado para matchups (§6.3). Los socios no
 * curados (Milio, Nami...) se registran como campeones "planos" (sin
 * `LabChampion`, igual que `championToContentEntity` ya soporta) porque,
 * a partir de esta fase, tienen una relación real que ofrecer: la propia
 * sinergia. Sin esa relación no se registrarían (§1.3/§12).
 */
const synergyPartnerIds = [
  ...new Set(
    leagueLaboratorySynergies.flatMap((synergy) => synergy.championIds.slice(1)),
  ),
].filter(
  (partnerId) => !adcLabChampions.some((champion) => champion.id === partnerId),
);

export const leagueLaboratoryEntities: ContentEntity[] = [
  ...adcLabChampions.map((labChampion) => {
    const catalogEntry = getCatalogEntryOrThrow(labChampion.id);
    return {
      ...championToContentEntity(catalogEntry, labChampion),
      href: `/campeones/${catalogEntry.slug}`,
    };
  }),
  patchToContentEntity(patch1514),
  // Fase C: registrado porque el historial editorial de Lucian genera
  // relaciones `changed-in` reales hacia este parche (ver más abajo) — sin
  // este nodo, esas relaciones serían aristas colgantes.
  patchToContentEntity(patch2614),
  { ...tierListToContentEntity(officialAdcTierList), href: '/tier-list' },
  championHubEntity,
  preguntaToolEntity,
  academiaToolEntity,
  toolsHubEntity,
  // Fase B: contenido editorial real de builds — hoy, las dos rutas
  // publicadas de Lucian. `Build` no tiene concepto de borrador/placeholder
  // en el dominio de origen: todo lo que existe en `leagueLaboratoryBuilds`
  // es, por construcción, contenido real y publicado.
  ...leagueLaboratoryBuilds.map((build) => ({
    ...buildToContentEntity(build),
    href: `/campeones/${getCatalogEntryOrThrow(build.championId).slug}#build-heading`,
  })),
  // Fase B: contenido editorial real de matchups. `leagueLaboratoryMatchups`
  // está vacío hoy (todavía no existe ningún matchup real analizado por
  // Tidusss) — este `map` no registra ninguna entidad hasta que exista una,
  // exactamente igual que el resto del grafo no registra nodos sin
  // contenido real que ofrecer (§1.3 de `docs/content-graph.md`).
  ...leagueLaboratoryMatchups.map((matchup) => ({
    ...matchupToContentEntity(
      matchup,
      getCatalogEntryOrThrow(matchup.championId).name,
      getCatalogEntryOrThrow(matchup.opponentChampionId).name,
    ),
    href: `/campeones/${getCatalogEntryOrThrow(matchup.championId).slug}#matchups-heading`,
  })),
  // Fase C: rune-page real de Lucian (parche 26.14).
  ...leagueLaboratoryRunePages.map((runePage) => ({
    ...runePageToContentEntity(runePage),
    href: `/campeones/${getCatalogEntryOrThrow(runePage.championId).slug}#runas-heading`,
  })),
  // Fase C: las 6 sinergias reales recomendadas por Tidusss para Lucian.
  ...leagueLaboratorySynergies.map((synergy) => {
    const ownerId = synergy.championIds[0];
    if (!ownerId) {
      throw new Error(`${synergy.id} no tiene ningún championId — dato de dominio inválido.`);
    }
    const championNames = synergy.championIds.map(
      (championId) => getCatalogEntryOrThrow(championId).name,
    );
    return {
      ...synergyToContentEntity(synergy, championNames),
      href: `/campeones/${getCatalogEntryOrThrow(ownerId).slug}#sinergias-heading`,
    };
  }),
  // Fase C: socios de sinergia sin curación editorial propia (Milio, Nami,
  // Yuumi, Braum, Nautilus, Pyke) — se registran como campeones "planos"
  // (sin `LabChampion`) porque, a partir de esta fase, tienen una relación
  // real que ofrecer (`synergizes-with` desde Lucian). Su página en
  // `/campeones/<slug>` ya existe para los ~173 campeones del catálogo.
  ...synergyPartnerIds.map((partnerId) => {
    const catalogEntry = getCatalogEntryOrThrow(partnerId);
    return {
      ...championToContentEntity(catalogEntry),
      href: `/campeones/${catalogEntry.slug}`,
    };
  }),
  // Fase C: solo los conceptos que Lucian enlaza directamente
  // (`coreConceptIds`, curación editorial explícita) tienen hoy una
  // relación real que ofrecer. El resto de `leagueLaboratoryConcepts`
  // (Tempo, Wave Management) no está referenciado por ningún matchup,
  // sinergia o campeón curado todavía — no se registra (§1.3/§12).
  ...(lucian.coreConceptIds ?? []).map((conceptId) => {
    const concept = getConceptOrThrow(conceptId);
    return {
      ...conceptToContentEntity(concept),
      // Ancla propia y real de la ficha del concepto en /academia (la misma
      // que ya usa `ConceptCard.astro`) — nunca la sección genérica de
      // conceptos de la guía de Lucian, que sería idéntica para los tres.
      href: `/academia#${concept.id.replace('concept:', '')}`,
    };
  }),
  // Fase C: editorial-log de Lucian — único nodo 1:1 que agrega todo su
  // historial real (`LabChampion.editorialHistory`), tal como aprueba el
  // diseño (`docs/content-graph.md` §3.2): nunca un nodo por entrada.
  ...(lucian.editorialHistory && lucian.editorialHistory.length > 0
    ? [
        {
          ...editorialLogToContentEntity(
            lucian.id,
            getCatalogEntryOrThrow(lucian.id).name,
            lucian.editorialHistory,
          ),
          href: `/campeones/${getCatalogEntryOrThrow(lucian.id).slug}#historial-editorial-heading`,
        },
      ]
    : []),
];

export const leagueLaboratoryRelations: ContentRelation[] = [
  ...officialAdcTierList.entries.flatMap((entry) => [
    tierListFeaturesChampionRelation(
      officialAdcTierList,
      entry.championId,
      `Ver el perfil de ${getCatalogEntryOrThrow(entry.championId).name}`,
    ),
    championAppearsInTierListRelation(officialAdcTierList, entry.championId),
  ]),
  tierListTracksPatchRelation(officialAdcTierList),
  ...leagueLaboratoryBuilds.map((build) =>
    buildDocumentsChampionRelation(
      build,
      getCatalogEntryOrThrow(build.championId).name,
    ),
  ),
  ...leagueLaboratoryMatchups.map((matchup) =>
    matchupRelatedToChampionRelation(
      matchup,
      getCatalogEntryOrThrow(matchup.championId).name,
      getCatalogEntryOrThrow(matchup.opponentChampionId).name,
    ),
  ),
  ...leagueLaboratoryRunePages.map((runePage) =>
    runePageDocumentsChampionRelation(
      runePage,
      getCatalogEntryOrThrow(runePage.championId).name,
    ),
  ),
  ...leagueLaboratorySynergies.flatMap((synergy) => {
    const [ownerId, ...partnerIds] = synergy.championIds;
    if (!ownerId) {
      throw new Error(`${synergy.id} no tiene ningún championId — dato de dominio inválido.`);
    }
    return [
      synergyDocumentsChampionRelation(synergy, ownerId),
      ...partnerIds.map((partnerId) =>
        championSynergizesWithRelation(
          ownerId,
          partnerId,
          getCatalogEntryOrThrow(partnerId).name,
        ),
      ),
    ];
  }),
  ...(lucian.coreConceptIds ?? []).map((conceptId) =>
    conceptExplainsRelation(
      getConceptOrThrow(conceptId),
      lucian.id,
      getCatalogEntryOrThrow(lucian.id).name,
    ),
  ),
  ...(lucian.editorialHistory && lucian.editorialHistory.length > 0
    ? [
        editorialLogDocumentsChampionRelation(
          lucian.id,
          getCatalogEntryOrThrow(lucian.id).name,
        ),
        ...editorialLogChangedInRelations(lucian.id, lucian.editorialHistory),
      ]
    : []),
  ...adcLabChampions.flatMap((labChampion) => {
    const catalogEntry = championCatalog.find(
      (entry) => entry.id === labChampion.id,
    );
    const championName = catalogEntry?.name ?? labChampion.id;
    return [
      {
        from: championHubEntity.id,
        to: labChampion.id,
        kind: 'features' as const,
        label: `Ver la ficha de ${championName}`,
        priority: 55,
        source: 'editorial' as const,
      },
      {
        from: labChampion.id,
        to: championHubEntity.id,
        kind: 'related-to' as const,
        label: 'Ver el catálogo completo de campeones',
        priority: 45,
        source: 'editorial' as const,
      },
    ];
  }),
  {
    from: championHubEntity.id,
    to: officialAdcTierList.id,
    kind: 'features',
    label: 'Ver la Tier List oficial ADC',
    priority: 60,
    source: 'editorial',
  },
  {
    from: officialAdcTierList.id,
    to: championHubEntity.id,
    kind: 'related-to',
    label: 'Explorar el catálogo completo de campeones',
    priority: 55,
    source: 'editorial',
  },
  // Herramientas: el hub de utilidades enlaza a cada herramienta real y
  // cada herramienta enlaza de vuelta — igual criterio que championHubEntity.
  ...[preguntaToolEntity, academiaToolEntity, championHubEntity, {
    ...tierListToContentEntity(officialAdcTierList),
  }].flatMap((tool) => [
    {
      from: toolsHubEntity.id,
      to: tool.id,
      kind: 'features' as const,
      label: `Abrir ${tool.title}`,
      priority: 50,
      source: 'editorial' as const,
    },
    {
      from: tool.id,
      to: toolsHubEntity.id,
      kind: 'related-to' as const,
      label: 'Ver todas las herramientas',
      priority: 40,
      source: 'editorial' as const,
    },
  ]),
  {
    from: preguntaToolEntity.id,
    to: lucian.id,
    kind: 'related-to',
    label: 'Preguntar sobre Lucian',
    priority: 55,
    source: 'editorial',
  },
  {
    from: lucian.id,
    to: preguntaToolEntity.id,
    kind: 'related-to',
    label: 'Resolver una duda sobre esta guía',
    priority: 35,
    source: 'editorial',
  },
  // Academia ADC enlaza a los conceptos ya registrados (los que Lucian
  // referencia directamente) y viceversa — nunca a los que todavía no
  // tienen ninguna relación real que ofrecer.
  ...(lucian.coreConceptIds ?? []).flatMap((conceptId) => {
    const concept = getConceptOrThrow(conceptId);
    return [
      {
        from: academiaToolEntity.id,
        to: concept.id,
        kind: 'features' as const,
        label: `Ver la ficha de ${concept.title}`,
        priority: 50,
        source: 'editorial' as const,
      },
      {
        from: concept.id,
        to: academiaToolEntity.id,
        kind: 'related-to' as const,
        label: 'Ver todos los conceptos de la Academia ADC',
        priority: 40,
        source: 'editorial' as const,
      },
    ];
  }),
];
