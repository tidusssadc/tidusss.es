import type {
  MatchIcon,
  MatchParticipant,
  MatchTeam,
  RecentMatch,
} from '../../../lib/riot';
import { matchVideoLinks } from '../../../config/match-video-links';
import {
  getVideoForMatch,
  validateMatchVideoLinks,
} from '../../../lib/match-video-links';
import { madridTime } from '../../../lib/time';
import type { YouTubeVideo } from '../../../types/content';
import { wireTimeline } from './timeline-render';

interface MatchRenderOptions {
  formatNumber: (value: number) => string;
  relativeTime: (value?: string) => string | undefined;
  reducedMotion: boolean;
  videos?: YouTubeVideo[];
  /**
   * Sobrescribe el copy por defecto de `MatchEmpty` ("sin clasificatorias
   * recientes") solo cuando la lista está vacía por un motivo distinto de
   * "no hay partidas reales" — hoy, un fallo de Riot. Nunca se activa
   * cuando la muestra real es 0.
   */
  emptyState?: { label: string; title: string; detail: string };
  /** Base de `/api/riot/matches` — Match Timeline se pide siempre bajo demanda, nunca al renderizar la tarjeta. */
  matchesBase: string;
  /**
   * "ÚLTIMA" (encargo §14) solo se marca sobre la primera fila cuando la
   * lista es realmente cronológica sin filtrar — con un filtro de
   * resultado/campeón activo, la primera fila es "la última victoria" o
   * "la última con Lucian", no "la partida más reciente", y decirle
   * "ÚLTIMA" sería engañoso.
   */
  showLatestTag?: boolean;
}

const query = <T extends Element>(root: ParentNode, selector: string) =>
  root.querySelector<T>(selector);

const setText = (root: ParentNode, selector: string, value: string) => {
  const node = query<HTMLElement>(root, selector);
  if (node) node.textContent = value;
};

const fillIcons = (root: ParentNode, selector: string, icons: MatchIcon[]) => {
  root.querySelectorAll<HTMLElement>(selector).forEach((slot, index) => {
    const icon = icons[index];
    const image = query<HTMLImageElement>(slot, 'img');
    slot.hidden = !icon;
    if (!image || !icon) {
      slot.removeAttribute('tabindex');
      slot.removeAttribute('role');
      slot.removeAttribute('aria-label');
      slot.removeAttribute('data-tooltip');
      return;
    }
    image.src = icon.imageUrl ?? '';
    image.alt = icon.name;
    slot.tabIndex = 0;
    slot.setAttribute('role', 'img');
    slot.setAttribute('aria-label', icon.name);
    slot.dataset.tooltip = icon.name;
  });
};

/**
 * Objetos en la fila colapsada — puramente decorativos (el contenedor ya
 * lleva `aria-hidden`, encargo Page Design Rework §7/§10): sin
 * tabindex/tooltip propios, para no dejar "paradas fantasma" de teclado
 * dentro de un bloque oculto a lectores de pantalla. El detalle real de
 * la partida vive en el botón único de expandir.
 */
const fillCompactItems = (root: ParentNode, selector: string, urls: string[]) => {
  root.querySelectorAll<HTMLElement>(selector).forEach((slot, index) => {
    const image = query<HTMLImageElement>(slot, 'img');
    const url = urls[index];
    slot.toggleAttribute('data-empty', !url);
    if (!image) return;
    image.hidden = !url;
    if (url) image.src = url;
  });
};

const fillRunes = (card: HTMLElement, icons: MatchIcon[], matchId: string) => {
  const container = query<HTMLElement>(card, '[data-match-runes]');
  const tooltip = query<HTMLElement>(card, '[data-rune-tooltip]');
  if (!container || !tooltip) return;
  const tooltipId = `runes-${matchId.replaceAll(/[^a-zA-Z0-9_-]/g, '-')}`;
  tooltip.id = tooltipId;

  const showTooltip = (slot: HTMLElement) => {
    tooltip.textContent = slot.getAttribute('aria-label') ?? '';
    container.toggleAttribute('data-tooltip-visible', true);
  };
  const hideTooltip = () =>
    container.toggleAttribute('data-tooltip-visible', false);

  card
    .querySelectorAll<HTMLElement>('[data-rune-slot]')
    .forEach((slot, index) => {
      const icon = icons[index];
      const image = query<HTMLImageElement>(slot, 'img');
      slot.hidden = !icon;
      if (!icon || !image) return;
      const context = index === 0 ? 'Árbol principal' : 'Árbol secundario';
      const accessibleName = `${context}: ${icon.name}`;
      slot.tabIndex = 0;
      slot.setAttribute('role', 'img');
      slot.setAttribute('aria-label', accessibleName);
      slot.setAttribute('aria-describedby', tooltipId);
      slot.toggleAttribute('data-secondary-rune', index > 0);
      slot.toggleAttribute('data-missing-icon', !icon.imageUrl);
      image.hidden = !icon.imageUrl;
      image.src = icon.imageUrl ?? '';
      image.alt = '';
      slot.addEventListener('pointerenter', () => showTooltip(slot));
      slot.addEventListener('pointerleave', () => {
        const focused = container.querySelector<HTMLElement>(
          '[data-rune-slot]:focus-visible',
        );
        if (focused) showTooltip(focused);
        else hideTooltip();
      });
      slot.addEventListener('focus', () => showTooltip(slot));
      slot.addEventListener('blur', hideTooltip);
    });
};

/**
 * Encuentros PRO/STREAMER (Night Shift 2026-09-09, Fase E) — solo si Riot
 * ya trajo un PUUID exacto que coincide con el Identity Registry curado
 * (`participant.identity`, resuelto server-side en `normalizeMatch`).
 * Nunca inferida aquí por nombre/campeón; "PRO"/"STREAMER" viene tal cual
 * de un dato ya verificado, nunca de una comparación local.
 */
const identityBadge = (identity: MatchParticipant['identity']) => {
  if (!identity) return undefined;
  const badge = document.createElement('span');
  badge.className = 'encounter-badge';
  badge.textContent = identity.isPro && identity.isStreamer
    ? 'PRO / STREAMER'
    : identity.isPro
      ? 'PRO'
      : 'STREAMER';
  const details = [identity.displayName, identity.team, identity.role].filter(Boolean);
  badge.title = details.join(' · ');
  return badge;
};

const participantRow = (
  participant: MatchParticipant,
  formatNumber: (value: number) => string,
) => {
  const item = document.createElement('li');
  const champion = document.createElement('img');
  champion.width = 32;
  champion.height = 32;
  champion.loading = 'lazy';
  champion.decoding = 'async';
  champion.src = participant.championImageUrl ?? '';
  champion.alt = participant.championName;
  const identity = document.createElement('div');
  const nameRow = document.createElement('div');
  nameRow.className = 'expanded-participant-name';
  const name = document.createElement('strong');
  name.textContent = participant.displayName;
  nameRow.append(name);
  const badge = identityBadge(participant.identity);
  if (badge) nameRow.append(badge);
  const championName = document.createElement('span');
  championName.textContent = participant.championName;
  identity.append(nameRow, championName);
  const kda = document.createElement('strong');
  kda.textContent = `${participant.kills} / ${participant.deaths} / ${participant.assists}`;
  const metrics = document.createElement('span');
  metrics.textContent = `${participant.cs} CS · ${formatNumber(participant.damageToChampions)} daño · ${formatNumber(participant.goldEarned)} oro · ${participant.visionScore} visión`;
  const items = document.createElement('div');
  items.className = 'expanded-items';
  participant.itemImageUrls.forEach((url, index) => {
    const image = document.createElement('img');
    image.width = 22;
    image.height = 22;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.src = url;
    image.alt = `Objeto ${index + 1}`;
    items.append(image);
  });
  item.append(champion, identity, kda, metrics, items);
  return item;
};

// --- DUELO Tidusss vs ADC rival (encargo Signature §17-19): el centro del
// análisis, con datos de fin de partida ya presentes en `match`/`enemy` —
// nunca @10 (eso es Timeline-only, bajo demanda) y nunca lenguaje de
// "ganaste línea"/"stomp", solo el número real de cada lado. ---
const duelKda = (participant: MatchParticipant) =>
  (participant.kills + participant.assists) / Math.max(1, participant.deaths);

const duelRow = (
  label: string,
  selfValue: number,
  enemyValue: number,
  format: (value: number) => string,
) => {
  const row = document.createElement('li');
  row.className = 'duel-row';
  const max = Math.max(selfValue, enemyValue, 1);
  const selfValueEl = document.createElement('strong');
  selfValueEl.className = 'duel-value duel-value--self';
  selfValueEl.textContent = format(selfValue);
  const selfTrack = document.createElement('span');
  selfTrack.className = 'duel-track duel-track--self';
  const selfBar = document.createElement('i');
  selfBar.style.width = `${Math.round((selfValue / max) * 100)}%`;
  selfTrack.append(selfBar);
  const labelEl = document.createElement('span');
  labelEl.className = 'duel-label';
  labelEl.textContent = label;
  const enemyTrack = document.createElement('span');
  enemyTrack.className = 'duel-track duel-track--enemy';
  const enemyBar = document.createElement('i');
  enemyBar.style.width = `${Math.round((enemyValue / max) * 100)}%`;
  enemyTrack.append(enemyBar);
  const enemyValueEl = document.createElement('strong');
  enemyValueEl.className = 'duel-value duel-value--enemy';
  enemyValueEl.textContent = format(enemyValue);
  row.append(selfValueEl, selfTrack, labelEl, enemyTrack, enemyValueEl);
  return row;
};

const fillDuelItems = (container: HTMLElement, urls: string[]) => {
  container.replaceChildren(
    ...urls.map((url, index) => {
      const image = document.createElement('img');
      image.width = 22;
      image.height = 22;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.src = url;
      image.alt = `Objeto ${index + 1}`;
      return image;
    }),
  );
};

const renderDuel = (
  card: HTMLElement,
  match: RecentMatch,
  enemy: MatchParticipant | undefined,
  formatNumber: (value: number) => string,
) => {
  const duel = query<HTMLElement>(card, '[data-match-duel]');
  if (!duel) return;
  const body = query<HTMLElement>(duel, '[data-duel-body]');
  const empty = query<HTMLElement>(duel, '[data-duel-empty]');
  if (!enemy) {
    if (body) body.hidden = true;
    if (empty) empty.hidden = false;
    return;
  }
  if (body) body.hidden = false;
  if (empty) empty.hidden = true;

  const selfChampion = query<HTMLImageElement>(duel, '[data-duel-self-champion]');
  if (selfChampion) {
    selfChampion.src = match.championImageUrl ?? '';
    selfChampion.alt = match.championName;
  }
  setText(duel, '[data-duel-self-champion-name]', match.championName);

  const enemyChampion = query<HTMLImageElement>(duel, '[data-duel-enemy-champion]');
  if (enemyChampion) {
    enemyChampion.src = enemy.championImageUrl ?? '';
    enemyChampion.alt = enemy.championName;
  }
  setText(duel, '[data-duel-enemy-champion-name]', enemy.championName);
  setText(duel, '[data-duel-enemy-name]', enemy.displayName);
  const badge = query<HTMLElement>(duel, '[data-duel-enemy-badge]');
  if (badge) {
    badge.hidden = !enemy.identity;
    if (enemy.identity) {
      badge.textContent = encounterLabel(enemy.identity);
      badge.title = [enemy.identity.displayName, enemy.identity.team, enemy.identity.role]
        .filter(Boolean)
        .join(' · ');
    }
  }

  const rows = query<HTMLElement>(duel, '[data-duel-compare]');
  if (rows)
    rows.replaceChildren(
      duelRow('KDA', match.kda, duelKda(enemy), (v) => v.toFixed(2).replace('.', ',')),
      duelRow('CS', match.cs, enemy.cs, (v) => String(Math.round(v))),
      duelRow('ORO', match.goldEarned, enemy.goldEarned, formatNumber),
      duelRow('DAÑO', match.damageToChampions, enemy.damageToChampions, formatNumber),
    );

  const selfItems = query<HTMLElement>(duel, '[data-duel-self-items]');
  if (selfItems) fillDuelItems(selfItems, match.itemImageUrls);
  const enemyItems = query<HTMLElement>(duel, '[data-duel-enemy-items]');
  if (enemyItems) fillDuelItems(enemyItems, enemy.itemImageUrls);

  const support = query<HTMLElement>(duel, '[data-duel-support]');
  const allySupport = match.teams
    .find((team) => team.teamId === match.teamId)
    ?.participants.find((p) => (p.position ?? '').toUpperCase() === 'UTILITY');
  if (support) {
    support.hidden = !allySupport;
    if (allySupport) {
      setText(duel, '[data-duel-support-name]', allySupport.displayName);
      setText(duel, '[data-duel-support-champion]', allySupport.championName);
    }
  }
};

const fillTeam = (
  card: HTMLElement,
  team: MatchTeam | undefined,
  side: 'blue' | 'red',
  formatNumber: (value: number) => string,
) => {
  setText(card, `[data-${side}-result]`, team?.win ? 'Victoria' : 'Derrota');
  // Mismo lenguaje visual de victoria/derrota que la fila colapsada
  // (encargo Art Direction §15) — un atributo, no una clase por rama.
  const section = query<HTMLElement>(card, `[data-${side}-section]`);
  if (section && team) section.dataset.teamResult = team.win ? 'win' : 'loss';
  setText(
    card,
    `[data-${side}-objectives]`,
    team
      ? `${team.objectives.towers} torres · ${team.objectives.dragons} dragones · ${team.objectives.barons} barones`
      : 'Objetivos no disponibles',
  );
  const list = query<HTMLOListElement>(card, `[data-${side}-team]`);
  if (list)
    list.replaceChildren(
      ...(team?.participants ?? []).map((participant) =>
        participantRow(participant, formatNumber),
      ),
    );
};

/**
 * ADC rival de la partida (equipo contrario, `position === 'BOTTOM'`) —
 * derivado de datos que Riot ya trajo en `match.teams`, cero llamadas
 * nuevas. La `identity` (PRO/STREAMER) ya viene resuelta server-side por
 * PUUID exacto (`normalizeMatch`), nunca se infiere aquí.
 */
const enemyLaner = (match: RecentMatch): MatchParticipant | undefined => {
  const enemy = match.teams.find((team) => team.teamId !== match.teamId);
  return enemy?.participants.find((p) => (p.position ?? '').toUpperCase() === 'BOTTOM');
};

const encounterLabel = (identity: NonNullable<MatchParticipant['identity']>) =>
  identity.isPro && identity.isStreamer
    ? 'PRO / STREAMER'
    : identity.isPro
      ? 'PRO'
      : 'STREAMER';

const killParticipation = (match: RecentMatch) => {
  const team = match.teams.find(({ teamId }) => teamId === match.teamId);
  if (!team) return undefined;
  const teamKills = team.participants.reduce(
    (total, participant) => total + participant.kills,
    0,
  );
  if (teamKills <= 0) return undefined;
  return Math.min(
    100,
    Math.round(((match.kills + match.assists) / teamKills) * 100),
  );
};

const wireExpansion = (card: HTMLElement, matchId: string) => {
  const button = query<HTMLButtonElement>(card, '[data-match-expand]');
  const expanded = query<HTMLElement>(card, '[data-match-expanded]');
  if (!button || !expanded) return;
  const panelId = `match-${matchId.replaceAll(/[^a-zA-Z0-9_-]/g, '-')}`;
  expanded.id = panelId;
  expanded.inert = true;
  button.setAttribute('aria-controls', panelId);
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    button.querySelector('span')!.textContent = open
      ? 'Ver detalle de la partida'
      : 'Cerrar detalle de la partida';
    expanded.toggleAttribute('data-open', !open);
    expanded.setAttribute('aria-hidden', String(open));
    expanded.inert = open;
  });
};

const renderCard = (
  template: HTMLTemplateElement,
  match: RecentMatch,
  index: number,
  options: MatchRenderOptions,
) => {
  const fragment = template.content.cloneNode(true) as DocumentFragment;
  const card = query<HTMLElement>(fragment, '[data-match-card]')!;
  card.classList.toggle('is-victory', match.win);
  card.classList.toggle('is-defeat', !match.win);
  card.style.setProperty('--match-index', String(index));
  setText(
    card,
    '[data-match-status]',
    match.remake ? 'REMAKE' : match.win ? 'VICTORIA' : 'DERROTA',
  );
  setText(
    card,
    '[data-match-relative]',
    options.relativeTime(match.playedAt) ?? '',
  );
  setText(card, '[data-match-champion]', match.championName);
  setText(card, '[data-match-position]', match.position);
  const latestTag = query<HTMLElement>(card, '[data-match-latest]');
  if (latestTag) latestTag.hidden = !(index === 0 && options.showLatestTag);
  const championImage = query<HTMLImageElement>(
    card,
    '[data-match-champion-image]',
  );
  if (championImage) {
    championImage.src = match.championImageUrl ?? '';
    championImage.alt = match.championName;
  }
  // ADC rival + insignia de encuentro (Rediseño V3 §9/§10): en la fila
  // colapsada, no en una sección aparte. Solo si Riot trajo la posición.
  const enemy = enemyLaner(match);
  const vs = query<HTMLElement>(card, '[data-match-vs]');
  if (vs && enemy) {
    vs.hidden = false;
    const vsChampion = query<HTMLImageElement>(vs, '[data-match-vs-champion]');
    if (vsChampion) {
      vsChampion.src = enemy.championImageUrl ?? '';
      vsChampion.alt = `Rival: ${enemy.championName}`;
    }
    const vsBadge = query<HTMLElement>(vs, '[data-match-vs-badge]');
    if (vsBadge && enemy.identity) {
      vsBadge.hidden = false;
      vsBadge.textContent = encounterLabel(enemy.identity);
      vsBadge.title = [enemy.identity.displayName, enemy.identity.team, enemy.identity.role]
        .filter(Boolean)
        .join(' · ');
    }
  }
  setText(
    card,
    '[data-match-score]',
    `${match.kills} / ${match.deaths} / ${match.assists}`,
  );
  setText(card, '[data-match-kda]', `KDA ${match.kda.toFixed(2)}`);
  setText(
    card,
    '[data-match-csm]',
    String(match.csPerMinute).replace('.', ','),
  );
  setText(card, '[data-match-vision]', String(match.visionScore));
  const participation = killParticipation(match);
  setText(
    card,
    '[data-match-participation]',
    participation === undefined ? '—' : `${participation}%`,
  );
  setText(
    card,
    '[data-match-lp]',
    match.lpDelta === undefined
      ? 'Pendiente'
      : `${match.lpDelta >= 0 ? '+' : ''}${match.lpDelta} LP`,
  );
  card.toggleAttribute('data-lp-pending', match.lpDelta === undefined);
  card.toggleAttribute(
    'data-lp-positive',
    match.lpDelta !== undefined && match.lpDelta > 0,
  );
  card.toggleAttribute(
    'data-lp-negative',
    match.lpDelta !== undefined && match.lpDelta < 0,
  );
  setText(card, '[data-match-context-duration]', match.durationLabel);
  const time = query<HTMLTimeElement>(card, '[data-match-time]');
  if (time) {
    time.dateTime = match.playedAt;
    // Hora exacta, no relativa — `[data-match-relative]` (junto al
    // resultado) ya cubre "hace cuánto"; repetir el mismo "hace 3h" aquí
    // era la misma información dos veces en la misma fila (encargo §11).
    time.textContent = madridTime(match.playedAt) ?? '';
  }
  fillCompactItems(card, '[data-item-slot]', match.itemImageUrls);
  fillRunes(card, match.runes, match.matchId);
  fillIcons(card, '[data-summoner-slot]', match.summonerSpells);
  const badges = query<HTMLElement>(card, '[data-match-badges]');
  if (badges) {
    badges.hidden = !match.badges?.length;
    badges.replaceChildren(
      ...(match.badges ?? []).map((badge) => {
        const item = document.createElement('span');
        item.textContent = badge;
        return item;
      }),
    );
  }
  const video = getVideoForMatch(
    match.matchId,
    options.videos ?? [],
    matchVideoLinks,
  );
  const videoBadge = query<HTMLElement>(card, '[data-match-video-badge]');
  const videoPanel = query<HTMLElement>(card, '[data-match-video-panel]');
  if (video && videoBadge && videoPanel) {
    videoBadge.hidden = false;
    videoPanel.hidden = false;
    const thumbnail = query<HTMLImageElement>(
      videoPanel,
      '[data-match-video-thumbnail]',
    );
    if (thumbnail) {
      thumbnail.src = video.thumbnailUrl;
      thumbnail.alt = `Miniatura de ${video.title}`;
    }
    setText(videoPanel, '[data-match-video-title]', video.title);
    const date = query<HTMLTimeElement>(videoPanel, '[data-match-video-date]');
    if (date) {
      date.dateTime = video.publishedAt;
      date.textContent = options.relativeTime(video.publishedAt) ?? '';
    }
    setText(
      videoPanel,
      '[data-match-video-duration]',
      video.durationLabel ?? '',
    );
    const link = query<HTMLAnchorElement>(
      videoPanel,
      '[data-match-video-link]',
    );
    if (link) {
      link.href = video.url;
      link.setAttribute('aria-label', `Ver gameplay completo: ${video.title}`);
    }
  }
  setText(card, '[data-expanded-mode]', match.queueLabel);
  setText(card, '[data-expanded-duration]', match.durationLabel);
  setText(
    card,
    '[data-expanded-played]',
    options.relativeTime(match.playedAt) ?? '',
  );
  renderDuel(card, match, enemy, options.formatNumber);
  fillTeam(
    card,
    match.teams.find((team) => team.teamId === 100),
    'blue',
    options.formatNumber,
  );
  fillTeam(
    card,
    match.teams.find((team) => team.teamId === 200),
    'red',
    options.formatNumber,
  );
  const blueIsAlly = match.teamId === 100;
  setText(
    card,
    '[data-blue-label]',
    blueIsAlly ? 'Equipo aliado' : 'Equipo enemigo',
  );
  setText(
    card,
    '[data-red-label]',
    blueIsAlly ? 'Equipo enemigo' : 'Equipo aliado',
  );
  query<HTMLElement>(card, '[data-blue-section]')?.setAttribute(
    'aria-label',
    blueIsAlly ? 'Equipo aliado' : 'Equipo enemigo',
  );
  query<HTMLElement>(card, '[data-red-section]')?.setAttribute(
    'aria-label',
    blueIsAlly ? 'Equipo enemigo' : 'Equipo aliado',
  );
  wireExpansion(card, match.matchId);
  wireTimeline(card, match.matchId, {
    matchesBase: options.matchesBase,
    formatNumber: options.formatNumber,
  });
  requestAnimationFrame(() => card.classList.add('is-ready'));
  return fragment;
};

export const renderMatchCards = (
  container: Element,
  matches: RecentMatch[],
  options: MatchRenderOptions,
) => {
  if (import.meta.env.DEV) {
    const issues = validateMatchVideoLinks(matchVideoLinks, options.videos);
    if (issues.length)
      console.warn('[match-video-links]', {
        code: 'INVALID_MATCH_VIDEO_LINKS',
        issues,
      });
  }
  const template = document.querySelector<HTMLTemplateElement>(
    '[data-match-card-template]',
  );
  if (!template) return;
  if (!matches.length) {
    const empty = document.querySelector<HTMLTemplateElement>(
      '[data-match-empty-template]',
    );
    if (empty) {
      const fragment = empty.content.cloneNode(true) as DocumentFragment;
      if (options.emptyState) {
        const label = fragment.querySelector('span');
        const title = fragment.querySelector('strong');
        const detail = fragment.querySelector('p');
        if (label) label.textContent = options.emptyState.label;
        if (title) title.textContent = options.emptyState.title;
        if (detail) detail.textContent = options.emptyState.detail;
      }
      container.replaceChildren(fragment);
    }
    return;
  }
  container.replaceChildren(
    ...matches.map((match, index) =>
      renderCard(template, match, index, options),
    ),
  );
};
