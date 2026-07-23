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
import type { YouTubeVideo } from '../../../types/content';

interface MatchRenderOptions {
  formatNumber: (value: number) => string;
  relativeTime: (value?: string) => string | undefined;
  reducedMotion: boolean;
  videos?: YouTubeVideo[];
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

const fillItems = (root: ParentNode, selector: string, urls: string[]) => {
  root.querySelectorAll<HTMLElement>(selector).forEach((slot, index) => {
    const image = query<HTMLImageElement>(slot, 'img');
    const url = urls[index];
    slot.toggleAttribute('data-empty', !url);
    if (!image) return;
    image.hidden = !url;
    if (url) {
      image.src = url;
      image.alt = `Objeto ${index + 1}`;
      slot.tabIndex = 0;
      slot.setAttribute('role', 'img');
      slot.setAttribute('aria-label', `Objeto ${index + 1}`);
      slot.dataset.tooltip = `Objeto ${index + 1}`;
    } else {
      slot.removeAttribute('tabindex');
      slot.removeAttribute('role');
      slot.removeAttribute('aria-label');
      slot.removeAttribute('data-tooltip');
    }
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
  const name = document.createElement('strong');
  name.textContent = participant.displayName;
  const championName = document.createElement('span');
  championName.textContent = participant.championName;
  identity.append(name, championName);
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

const fillTeam = (
  card: HTMLElement,
  team: MatchTeam | undefined,
  side: 'blue' | 'red',
  formatNumber: (value: number) => string,
) => {
  setText(card, `[data-${side}-result]`, team?.win ? 'Victoria' : 'Derrota');
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
      ? 'Ver partida'
      : 'Cerrar partida';
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
  const championImage = query<HTMLImageElement>(
    card,
    '[data-match-champion-image]',
  );
  if (championImage) {
    championImage.src = match.championImageUrl ?? '';
    championImage.alt = match.championName;
  }
  const backdrop = query<HTMLImageElement>(card, '[data-match-backdrop]');
  if (backdrop) backdrop.src = match.championImageUrl ?? '';
  setText(
    card,
    '[data-match-score]',
    `${match.kills} / ${match.deaths} / ${match.assists}`,
  );
  setText(card, '[data-match-kda]', `KDA ${match.kda.toFixed(2)}`);
  setText(card, '[data-match-cs]', String(match.cs));
  setText(
    card,
    '[data-match-csm]',
    String(match.csPerMinute).replace('.', ','),
  );
  setText(
    card,
    '[data-match-damage]',
    options.formatNumber(match.damageToChampions),
  );
  setText(card, '[data-match-duration]', match.durationLabel);
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
  setText(card, '[data-match-mode]', match.queueLabel);
  setText(card, '[data-match-context-duration]', match.durationLabel);
  const time = query<HTMLTimeElement>(card, '[data-match-time]');
  if (time) {
    time.dateTime = match.playedAt;
    time.textContent = options.relativeTime(match.playedAt) ?? '';
  }
  fillItems(card, '[data-item-slot]', match.itemImageUrls);
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
    if (empty) container.replaceChildren(empty.content.cloneNode(true));
    return;
  }
  container.replaceChildren(
    ...matches.map((match, index) =>
      renderCard(template, match, index, options),
    ),
  );
};
