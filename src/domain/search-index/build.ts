import {
  adcLabChampions,
  championCatalog,
  leagueLaboratoryBuilds,
  leagueLaboratoryConcepts,
  leagueLaboratoryPatches,
  leagueLaboratoryRunePages,
  leagueLaboratorySynergies,
  officialAdcTierList,
} from '../../data/league-laboratory';
import { PREGUNTA_GENERAL_SUGGESTIONS, PREGUNTA_LUCIAN_SUGGESTIONS } from '../../data/pregunta';
import { siteUpdates } from '../../data/updates';
import { videoContentLinks } from '../../config/video-content-links';
import type { YouTubeVideo } from '../../types/content';
import { resolveChampionEditorialStatus } from '../league-laboratory';
import type { ConceptId, LabChampionId, PatchId } from '../league-laboratory';
import type { SearchEntry } from './types';

const championUrl = (slug: string) => `/campeones/${slug}`;

const catalogById = new Map(championCatalog.map((entry) => [entry.id, entry]));
const labChampionById = new Map(adcLabChampions.map((champion) => [champion.id, champion]));
const patchLabelById = new Map(leagueLaboratoryPatches.map((patch) => [patch.id, patch.label]));
const conceptById = new Map(leagueLaboratoryConcepts.map((concept) => [concept.id, concept]));

const championName = (id: LabChampionId) => catalogById.get(id)?.name ?? id;
const patchLabel = (id: PatchId) => patchLabelById.get(id) ?? id;
const conceptTitle = (id: ConceptId) => conceptById.get(id)?.title ?? id;

/**
 * El universo público de ADCs: exactamente los campeones con entrada
 * `reviewed` en `officialAdcTierList` — misma fuente de verdad que ya usa
 * `getAdcRoster` (domain/league-laboratory/hub.ts), nunca una segunda
 * lista mantenida a mano aquí. Search deja de ofrecer como destino
 * editorial las fichas factual-only de campeones fuera de este roster
 * (p. ej. Zed, Darius): esos nombres siguen resolviendo internamente
 * (`catalogById`, usado más abajo como metadata/keywords de vídeos,
 * builds, sinergias...) pero ya no generan una entrada `campeon` propia en
 * el índice público.
 */
const adcRosterIds = new Set(
  officialAdcTierList.entries
    .filter((entry) => entry.reviewStatus === 'reviewed')
    .map((entry) => entry.championId),
);

/**
 * Una página estática por ruta pública real — no genera thin content:
 * `/buscar` no se incluye a sí misma como resultado de sí misma, y las
 * rutas dinámicas (campeones, actualizaciones...) se indexan por su propia
 * sección más abajo, nunca aquí.
 */
const staticPageEntries = (): SearchEntry[] => [
  { id: 'page:inicio', category: 'pagina', title: 'Inicio', description: 'La portada del sitio: qué está pasando ahora mismo y por dónde seguir.', href: '/', keywords: ['home', 'portada'] },
  { id: 'page:explorar', category: 'pagina', title: 'Explorar', description: 'El índice completo del sitio, con cifras reales del catálogo.', href: '/explorar', keywords: ['indice', 'catalogo', 'todo'] },
  { id: 'page:competitivo', category: 'pagina', title: 'Competitivo', description: 'Rango, LP, partidas recientes y objetivos, actualizados en vivo.', href: '/competitivo', keywords: ['rango', 'lp', 'partidas', 'live', 'directo'] },
  { id: 'page:academia', category: 'pagina', title: 'Aprende ADC', description: 'El vocabulario y los fundamentos de ADC, en fichas navegables.', href: '/academia', keywords: ['conceptos', 'fundamentos', 'vocabulario'] },
  { id: 'page:herramientas', category: 'pagina', title: 'Herramientas', description: 'Todas las herramientas de tidusss.es en un solo sitio.', href: '/herramientas', keywords: ['tools'] },
  { id: 'page:actividad', category: 'pagina', title: 'Actividad', description: 'Vídeos, directos, partidas y cambios editoriales, en orden.', href: '/actividad', keywords: ['timeline', 'feed'] },
  { id: 'page:actualizaciones', category: 'pagina', title: 'Actualizaciones', description: 'El historial editorial completo del sitio.', href: '/actualizaciones', keywords: ['changelog', 'cambios', 'historial'] },
  { id: 'page:comunidad', category: 'pagina', title: 'Comunidad', description: 'Objetivos, roadmap y qué acaba de cambiar en el proyecto.', href: '/comunidad', keywords: ['objetivos', 'estado del proyecto'] },
  { id: 'page:roadmap', category: 'pagina', title: 'Roadmap', description: 'Qué viene después en el proyecto.', href: '/roadmap', keywords: ['futuro', 'planes'] },
  { id: 'page:campeones', category: 'pagina', title: 'ADCs', description: `Los ${adcRosterIds.size} ADC de la Tier List de Tidusss: tier, guías y vídeos relacionados.`, href: '/campeones', keywords: ['adc', 'campeones', 'roster'] },
  { id: 'page:tier-list', category: 'pagina', title: 'Tier List oficial ADC', description: officialAdcTierList.title, href: '/tier-list', keywords: ['tierlist', 'meta', 'clasificacion'] },
  { id: 'page:pregunta', category: 'pagina', title: 'Pregunta a Tidusss', description: 'Construye una respuesta editorial a una duda concreta con el contenido ya publicado.', href: '/pregunta', keywords: ['preguntar', 'duda', 'qa'] },
];

/**
 * Un resultado por ADC del roster público (25) — nunca por los ~170
 * campeones del catálogo factual: presentar una ficha factual-only (p. ej.
 * Zed, Darius) como destino de búsqueda daría a entender que Tidusss tiene
 * conocimiento editorial sobre ella cuando solo existe el dato de Riot.
 */
const championEntries = (): SearchEntry[] =>
  championCatalog
    .filter((entry) => adcRosterIds.has(entry.id))
    .map((entry) => {
      const labChampion = labChampionById.get(entry.id);
      const status = resolveChampionEditorialStatus(labChampion);
      const statusLabel =
        status === 'reviewed' ? 'Guía completa' : status === 'draft' ? 'Ficha en curación' : 'ADC de la Tier List';
      return {
        // `entry.id` (LabChampionId) ya lleva el prefijo `champion:` — no se
        // vuelve a anteponer aquí. Bug real preexistente detectado y
        // corregido en esta fase: producía ids duplicados del tipo
        // `champion:champion:lucian` en vez de `champion:lucian`.
        id: entry.id,
        category: 'campeon',
        title: entry.name,
        description: `${entry.title} · ${statusLabel}`,
        href: championUrl(entry.slug),
        keywords: [entry.dataDragonKey, ...entry.tags],
        editorialStatus: status,
      };
    });

/** Un resultado por campeón realmente curado (con perfil): la guía larga, distinta de la ficha factual anterior. */
const guideEntries = (): SearchEntry[] =>
  adcLabChampions
    .filter((champion) => champion.profile)
    .map((champion): SearchEntry | undefined => {
      const catalogEntry = catalogById.get(champion.id);
      if (!catalogEntry) return undefined;
      const partnerNames = leagueLaboratorySynergies
        .filter((synergy) => synergy.championIds.includes(champion.id))
        .flatMap((synergy) => synergy.championIds)
        .filter((id) => id !== champion.id)
        .map(championName);
      return {
        id: `guide:${champion.id}`,
        category: 'guia',
        title: `Guía de ${catalogEntry.name}`,
        description: champion.profile?.summary ?? '',
        href: championUrl(catalogEntry.slug),
        keywords: [...champion.playstyleTags, ...partnerNames],
      };
    })
    .filter((entry): entry is SearchEntry => Boolean(entry));

const itemNames = (build: (typeof leagueLaboratoryBuilds)[number]): string[] => [
  ...build.startingItems.map((item) => item.name),
  ...(build.boots ?? []).map((item) => item.name),
  ...build.coreItems.map((item) => item.name),
  ...build.situationalItems.map((item) => item.name),
];

/** Un resultado por build real — el nombre de cada objeto elegido entra como keyword, así "navori" encuentra la build exacta que lo usa. */
const buildEntries = (): SearchEntry[] =>
  leagueLaboratoryBuilds.map((build) => {
    const catalogEntry = catalogById.get(build.championId);
    const name = catalogEntry?.name ?? build.championId;
    return {
      id: `build:${build.id}`,
      category: 'build',
      title: `Build: ${build.title} (${name})`,
      description: build.editorialTake.verdict,
      href: `${championUrl(catalogEntry?.slug ?? '')}#build-heading`,
      keywords: itemNames(build),
      patchLabel: patchLabel(build.patchId),
    };
  });

/** Un resultado por página de runas real — el nombre de cada runa elegida entra como keyword. */
const runePageEntries = (): SearchEntry[] =>
  leagueLaboratoryRunePages.map((runePage) => {
    const catalogEntry = catalogById.get(runePage.championId);
    const name = catalogEntry?.name ?? runePage.championId;
    const runeNames = [...runePage.primaryRunes, ...runePage.secondaryRunes, ...runePage.statShards].map(
      (choice) => choice.name,
    );
    return {
      id: `rune-page:${runePage.id}`,
      category: 'build',
      title: `Runas de ${name}`,
      description: runePage.editorialTake.verdict,
      href: `${championUrl(catalogEntry?.slug ?? '')}#runas-heading`,
      keywords: runeNames,
      patchLabel: patchLabel(runePage.patchId),
    };
  });

/** Un resultado por sinergia real — los nombres de los socios entran como keyword, así "milio" encuentra la sinergia real con Lucian. */
const synergyEntries = (): SearchEntry[] =>
  leagueLaboratorySynergies.map((synergy) => {
    const names = synergy.championIds.map(championName);
    const ownerId = synergy.championIds[0];
    const ownerSlug = ownerId ? catalogById.get(ownerId)?.slug : undefined;
    return {
      id: `synergy:${synergy.id}`,
      category: 'build',
      title: `Sinergia: ${names.join(' + ')}`,
      description: synergy.editorialTake.verdict,
      href: `${championUrl(ownerSlug ?? '')}#sinergias-heading`,
      keywords: names,
      patchLabel: patchLabel(synergy.patchId),
    };
  });

/** Un resultado por concepto de la Academia — ya tiene ficha propia con ancla real en /academia, se aplique o no hoy a un campeón curado. */
const academiaEntries = (): SearchEntry[] =>
  leagueLaboratoryConcepts.map((concept) => ({
    id: `concept:${concept.id}`,
    category: 'academia',
    title: concept.title,
    description: concept.summary,
    href: `/academia#${concept.id.replace('concept:', '')}`,
    keywords: [concept.category],
  }));

/** Un resultado por herramienta con destino real — nunca las "próximamente" de /herramientas, que no tienen `href`. */
const herramientaEntries = (): SearchEntry[] => [
  { id: 'tool:tier-list', category: 'herramienta', title: 'Tier List oficial ADC', description: 'Clasificación editorial del meta actual, con filtros por tier.', href: '/tier-list', keywords: [] },
  { id: 'tool:campeones', category: 'herramienta', title: 'ADCs', description: 'Los ADC de la Tier List de Tidusss: tier, guías y vídeos relacionados.', href: '/campeones', keywords: [] },
  { id: 'tool:academia', category: 'herramienta', title: 'Aprende ADC', description: 'El vocabulario y los fundamentos de ADC, organizados en fichas.', href: '/academia', keywords: [] },
  { id: 'tool:competitivo', category: 'herramienta', title: 'Centro competitivo', description: 'Rango, LP, últimas partidas y objetivos, actualizados en vivo.', href: '/competitivo', keywords: [] },
];

/** Un resultado por entrada revisada de la Tier List — nunca por un placeholder sin veredicto. */
const tierListEntries = (): SearchEntry[] =>
  officialAdcTierList.entries
    .filter((entry) => entry.reviewStatus === 'reviewed')
    .map((entry) => {
      const name = championName(entry.championId);
      return {
        id: `tier-list-entry:${entry.championId}`,
        category: 'tier-list' as const,
        title: `${name} en la Tier List (${entry.tier})`,
        description: entry.editorialTake.verdict,
        href: '/tier-list',
        keywords: [name],
        patchLabel: patchLabel(officialAdcTierList.patchId),
      };
    });

/** Un resultado por cambio editorial real ya publicado en /actualizaciones. */
const updateEntries = (): SearchEntry[] =>
  siteUpdates.map((entry, index) => ({
    id: `update:${index}:${entry.date}`,
    category: 'actualizacion',
    title: entry.title,
    description: entry.description,
    href: entry.href,
    keywords: [entry.kind],
  }));

/** Una pregunta sugerida real (ya verificada contra el motor de respuesta) por resultado — nunca las tres del subconjunto de Home, que duplicarían las generales. */
const preguntaEntries = (): SearchEntry[] =>
  [...new Set([...PREGUNTA_GENERAL_SUGGESTIONS, ...PREGUNTA_LUCIAN_SUGGESTIONS])].map((question, index) => ({
    id: `question:${index}`,
    category: 'pregunta',
    title: question,
    description: 'Pregunta sugerida — ábrela en Pregunta a Tidusss para ver la respuesta completa.',
    href: `/pregunta?q=${encodeURIComponent(question)}`,
    keywords: [],
  }));

/**
 * Un resultado por vídeo CURADO (`config/video-content-links.ts`) — nunca
 * el volcado completo del canal: solo los que ya tienen relaciones
 * editoriales `verified-manual` reales. Recibe los `YouTubeVideo` ya
 * resueltos como parámetro (nunca hace la llamada a YouTube ella misma,
 * ver `buildSearchIndex`); si un id curado todavía no se ha podido
 * resolver (sin clave, fallo de red), simplemente no genera entrada — el
 * mismo criterio de "sin dato real, no aparece" que ya usa el resto del
 * índice. Las relaciones (`championIds`/`allySupportIds`/
 * `enemyChampionIds`/`conceptIds`) se resuelven a nombres reales del
 * catálogo/Academia como `keywords` — nunca ids internos: así "milio" o
 * "snowball" encuentran el vídeo aunque esas palabras no estén en el
 * título real de YouTube.
 */
const videoEntries = (videos: readonly YouTubeVideo[]): SearchEntry[] => {
  if (videos.length === 0) return [];
  const videoById = new Map(videos.map((video) => [video.id, video] as const));
  return videoContentLinks.flatMap((link): SearchEntry[] => {
    const video = videoById.get(link.youtubeVideoId);
    if (!video) return [];
    const keywords = [
      ...(link.championIds ?? []).map(championName),
      ...(link.allySupportIds ?? []).map(championName),
      ...(link.enemyChampionIds ?? []).map(championName),
      ...(link.conceptIds ?? []).map(conceptTitle),
    ];
    return [
      {
        id: `video:${video.id}`,
        category: 'video',
        title: video.title,
        description: video.durationLabel ? `Vídeo · ${video.durationLabel}` : 'Vídeo',
        href: video.url,
        keywords,
      },
    ];
  });
};

/**
 * Ensambla el índice público de búsqueda a partir de datos ya conocidos en
 * build time — sin red, sin secretos, sin estado mutable entre llamadas.
 * Los vídeos son la única excepción parcial: su metadata real de YouTube
 * (`YouTubeVideo[]`) se recibe ya resuelta como parámetro OPCIONAL — esta
 * función nunca hace la llamada ella misma, así sigue siendo pura y
 * ejecutable sin red ni credenciales (los 480 tests existentes la llaman
 * sin argumentos). Quien sí conoce la red (`buscar-index.json.ts`) le pasa
 * `resolvedVideoContent`, ya resuelto una única vez en build time.
 */
export const buildSearchIndex = (
  options: { videos?: readonly YouTubeVideo[] } = {},
): SearchEntry[] => [
  ...staticPageEntries(),
  ...championEntries(),
  ...guideEntries(),
  ...buildEntries(),
  ...runePageEntries(),
  ...synergyEntries(),
  ...academiaEntries(),
  ...herramientaEntries(),
  ...tierListEntries(),
  ...videoEntries(options.videos ?? []),
  ...updateEntries(),
  ...preguntaEntries(),
];
