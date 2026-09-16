import type { MatchTimelinePublicResponse } from '../../../lib/riot';
import type {
  ChampionKillEvent,
  ItemPurchaseEvent,
  MatchTimeline,
  ObjectiveEvent,
  TimelineCurvePoint,
  TimelineEvent,
} from '../../../lib/riot';

export interface TimelineRenderOptions {
  /** `integrationEndpoints.riotMatchesBase` — la URL completa se construye aquí, nunca en el marcado. */
  matchesBase: string;
  formatNumber: (value: number) => string;
}

const query = <T extends Element>(root: ParentNode, selector: string) =>
  root.querySelector<T>(selector);

const mmss = (ms: number) => {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const signed = (value: number, formatNumber: (value: number) => string) =>
  `${value >= 0 ? '+' : '−'}${formatNumber(Math.abs(value))}`;

// --- Cliente: cache en memoria por matchId (una partida terminada es
// inmutable) + coordinación "solo un Timeline abierto a la vez" (encargo
// §22) — a nivel de módulo para que sobreviva a re-renders del listado. ---
const timelineCache = new Map<string, MatchTimeline | 'unavailable'>();
let openPanel: { panel: HTMLElement; trigger: HTMLButtonElement } | undefined;

const closeOpenPanel = () => {
  if (!openPanel) return;
  const { panel, trigger } = openPanel;
  panel.hidden = true;
  panel.setAttribute('aria-hidden', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.querySelector('span')!.textContent = 'Analizar partida';
  openPanel = undefined;
};

// --- Gráfico de evolución: SVG puro, sin librería, oro y CS comparten
// visualización con un selector (encargo §12/§13, "no diez charts"). ---
//
// El `viewBox` se genera con el ancho REAL del contenedor en cada
// render (nunca uno fijo) — con `viewBox` fijo y `width:100%`, el
// navegador reescala también el texto interno del SVG (ejes/leyenda),
// así que a 375px ese texto acababa en ~4px reales, ilegible (encargo
// Visual Pass §32, "no textos de 10px"). Con el viewBox = ancho real,
// la escala es siempre 1:1 y el texto se lee al tamaño que se declara.

const CHART_HEIGHT = 168;
const PAD = { top: 10, right: 12, bottom: 22, left: 42 };
const FALLBACK_CHART_WIDTH = 400;

const niceMax = (value: number) => {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const step = steps.find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
};

const xFor = (timestampMs: number, durationMs: number, plotWidth: number) =>
  PAD.left + (timestampMs / durationMs) * plotWidth;
const yFor = (value: number, maxValue: number, plotHeight: number) =>
  PAD.top + plotHeight - (value / maxValue) * plotHeight;

const pathFor = (
  points: TimelineCurvePoint[],
  durationMs: number,
  maxValue: number,
  plotWidth: number,
  plotHeight: number,
) =>
  points
    .map((point, index) => {
      const x = xFor(point.timestampMs, durationMs, plotWidth);
      const y = yFor(point.value, maxValue, plotHeight);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

interface ChartBuild {
  svg: string;
  /** Geometría necesaria para el hover — nunca se recalcula el layout dos veces. */
  self: TimelineCurvePoint[];
  rival?: TimelineCurvePoint[];
  rivalLabel?: string;
  durationMs: number;
  plotWidth: number;
  plotHeight: number;
  maxValue: number;
  chartWidth: number;
  formatValue: (value: number) => string;
}

// --- MATCH FLOW (encargo Signature §7-8): el gráfico deja de ser una
// línea muda — extremo con presencia real (punto + valor final), marca
// de @10 (mismo corte que el resumen de línea de arriba, ahora visible
// en el propio gráfico) y un hover con crosshair que lee el minuto y
// ambos valores. Nunca un área rellena entre líneas: con solo 1-2
// observaciones por minuto, un fill sugeriría una continuidad que el
// dato no tiene — precisión antes que decoración.
const buildChartSvg = (
  self: TimelineCurvePoint[],
  rival: TimelineCurvePoint[] | undefined,
  rivalLabel: string | undefined,
  durationMs: number,
  metricLabel: string,
  formatValue: (value: number) => string,
  chartWidth: number,
): ChartBuild | undefined => {
  if (self.length < 2 || durationMs <= 0) return undefined;
  const plotWidth = chartWidth - PAD.left - PAD.right;
  const plotHeight = CHART_HEIGHT - PAD.top - PAD.bottom;
  const allValues = [...self, ...(rival ?? [])].map((point) => point.value);
  const maxValue = niceMax(Math.max(...allValues, 1));
  const selfPath = pathFor(self, durationMs, maxValue, plotWidth, plotHeight);
  const hasRival = Boolean(rival && rival.length >= 2);
  const rivalPath = hasRival
    ? pathFor(rival!, durationMs, maxValue, plotWidth, plotHeight)
    : undefined;

  const yTicks = [0, 0.5, 1].map((fraction) => {
    const value = maxValue * fraction;
    const y = PAD.top + plotHeight - fraction * plotHeight;
    return `<text x="${PAD.left - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="timeline-chart-axis">${formatValue(value)}</text>
      <line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${chartWidth - PAD.right}" y2="${y.toFixed(1)}" class="timeline-chart-grid" />`;
  });

  // Menos marcas de tiempo cuando el gráfico es estrecho (mobile) para
  // que nunca se superpongan (encargo §32, "no labels superpuestos").
  const targetTickGapPx = chartWidth < 340 ? 70 : 55;
  const rawStepMinutes = Math.max(
    1,
    Math.ceil((durationMs / 60_000 / (plotWidth / targetTickGapPx)) / 1) || 1,
  );
  const minuteStep = [1, 2, 5, 10, 15, 20].find((step) => step >= rawStepMinutes) ?? 20;
  const xTicks: string[] = [];
  for (
    let minute = 0;
    minute * 60_000 <= durationMs + 1000;
    minute += minuteStep
  ) {
    const x = xFor(minute * 60_000, durationMs, plotWidth);
    xTicks.push(
      `<text x="${x.toFixed(1)}" y="${CHART_HEIGHT - 4}" text-anchor="middle" class="timeline-chart-axis">${minute}'</text>`,
    );
  }

  // Marca @10 (encargo §8): mismo corte que el resumen de línea de
  // arriba — solo si la partida llegó a ese minuto.
  const mark10 =
    durationMs > 600_000
      ? (() => {
          const x = xFor(600_000, durationMs, plotWidth);
          return `<line x1="${x.toFixed(1)}" y1="${PAD.top}" x2="${x.toFixed(1)}" y2="${PAD.top + plotHeight}" class="timeline-chart-mark10" />
      <text x="${x.toFixed(1)}" y="${PAD.top - 2}" text-anchor="middle" class="timeline-chart-mark10-label">@10</text>`;
        })()
      : '';

  // Extremo con presencia (encargo §8): el último punto real, no solo
  // una línea que se corta — con su valor final rotulado.
  const endpointFor = (points: TimelineCurvePoint[], variant: 'self' | 'rival') => {
    const last = points[points.length - 1]!;
    const x = xFor(last.timestampMs, durationMs, plotWidth);
    const y = yFor(last.value, maxValue, plotHeight);
    const anchor = x > chartWidth - PAD.right - 34 ? 'end' : 'start';
    const dx = anchor === 'end' ? -7 : 7;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${variant === 'self' ? 3.6 : 2.6}" class="timeline-chart-endpoint-${variant}" />
      <text x="${(x + dx).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="${anchor}" class="timeline-chart-endpoint-label-${variant}">${formatValue(last.value)}</text>`;
  };

  const legend = rivalPath
    ? `<g class="timeline-chart-legend">
        <circle cx="${PAD.left + 3}" cy="8" r="3" class="timeline-chart-legend-self" />
        <text x="${PAD.left + 10}" y="11" class="timeline-chart-legend-text">Tidusss</text>
        <circle cx="${PAD.left + 75}" cy="8" r="3" class="timeline-chart-legend-rival" />
        <text x="${PAD.left + 82}" y="11" class="timeline-chart-legend-text">${rivalLabel}</text>
      </g>`
    : '';

  const svg = `<svg viewBox="0 0 ${chartWidth} ${CHART_HEIGHT}" role="img" aria-label="Evolución de ${metricLabel} a lo largo de la partida${rivalLabel ? `, comparado con ${rivalLabel}` : ''}" class="timeline-chart-svg" data-timeline-svg>
    ${yTicks.join('\n')}
    ${xTicks.join('\n')}
    ${mark10}
    ${rivalPath ? `<path d="${rivalPath}" class="timeline-chart-line-rival" fill="none" />` : ''}
    <path d="${selfPath}" class="timeline-chart-line-self" fill="none" />
    ${rivalPath ? endpointFor(rival!, 'rival') : ''}
    ${endpointFor(self, 'self')}
    ${legend}
    <line data-timeline-cursor class="timeline-chart-cursor" x1="0" x2="0" y1="${PAD.top}" y2="${PAD.top + plotHeight}" />
  </svg>`;

  return { svg, self, rival: hasRival ? rival : undefined, rivalLabel, durationMs, plotWidth, plotHeight, maxValue, chartWidth, formatValue };
};

// --- Hover (encargo §8, "hover útil"): crosshair + tooltip HTML que lee
// el minuto y ambos valores en ese punto — mismo patrón que el hover de
// Evolución LP (`RankEvolution.astro`), sin depender de eventos que este
// entorno a veces no dispara de forma fiable (rAF): lectura síncrona en
// cada `pointermove`. ---
const wireChartHover = (host: HTMLElement, build: ChartBuild) => {
  const svg = host.querySelector<SVGSVGElement>('[data-timeline-svg]');
  const cursor = host.querySelector<SVGLineElement>('[data-timeline-cursor]');
  if (!svg || !cursor) return;
  let tooltip = host.querySelector<HTMLElement>('[data-timeline-tooltip]');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'timeline-chart-tooltip';
    tooltip.dataset.timelineTooltip = '';
    host.append(tooltip);
  }
  const { self, rival, rivalLabel, durationMs, plotWidth, formatValue } = build;

  const nearestIndex = (points: TimelineCurvePoint[], targetMs: number) =>
    points.reduce(
      (best, point, index) =>
        Math.abs(point.timestampMs - targetMs) <
        Math.abs(points[best]!.timestampMs - targetMs)
          ? index
          : best,
      0,
    );

  const show = (clientX: number) => {
    const rect = svg.getBoundingClientRect();
    // El SVG se escala por CSS (`width:100%`) desde su viewBox real
    // (`build.chartWidth`) — hay que deshacer esa escala para volver a
    // coordenadas de usuario del SVG antes de restar el padding.
    const scale = rect.width / build.chartWidth;
    const svgX = (clientX - rect.left) / scale;
    const ratio = Math.min(1, Math.max(0, (svgX - PAD.left) / plotWidth));
    const targetMs = ratio * durationMs;
    const selfPoint = self[nearestIndex(self, targetMs)]!;
    const x = xFor(selfPoint.timestampMs, durationMs, plotWidth);
    cursor.setAttribute('x1', String(x));
    cursor.setAttribute('x2', String(x));
    cursor.classList.add('is-on');
    const minute = Math.round(selfPoint.timestampMs / 60_000);
    const rivalPoint = rival ? rival[nearestIndex(rival, selfPoint.timestampMs)] : undefined;
    tooltip!.hidden = false;
    tooltip!.style.left = `${(x / build.chartWidth) * 100}%`;
    tooltip!.innerHTML = `<strong>${minute}'</strong><span>Tidusss ${formatValue(selfPoint.value)}</span>${
      rivalPoint ? `<span>${rivalLabel} ${formatValue(rivalPoint.value)}</span>` : ''
    }`;
  };
  const hide = () => {
    cursor.classList.remove('is-on');
    tooltip!.hidden = true;
  };

  host.addEventListener('pointermove', (event) => show(event.clientX));
  host.addEventListener('pointerleave', hide);
  host.addEventListener('pointerdown', (event) => show(event.clientX));
};

// --- Momentos clave: un icono/etiqueta discreto por tipo de evento. ---

const eventTimestamp = (event: TimelineEvent) => event.timestampMs;

const outcomeLabel: Record<ChampionKillEvent['outcome'], string> = {
  kill: 'Kill',
  death: 'Muerte',
  assist: 'Asistencia',
};

const multiKillLabel: Record<NonNullable<ChampionKillEvent['multiKill']>, string> = {
  double: '¡Doble kill!',
  triple: '¡Triple kill!',
  quadra: '¡Quadra kill!',
  penta: '¡PENTAKILL!',
};

const objectiveLabel = (event: ObjectiveEvent) =>
  event.objective === 'tower'
    ? event.teamParticipated
      ? 'Torre destruida'
      : 'Torre perdida'
    : event.teamParticipated
      ? `${event.label} (equipo)`
      : `${event.label} (rival)`;

const renderMoment = (event: TimelineEvent): HTMLLIElement => {
  const item = document.createElement('li');
  item.className = `timeline-moment timeline-moment--${event.type}`;
  const time = document.createElement('time');
  time.textContent = mmss(eventTimestamp(event));
  const label = document.createElement('span');
  if (event.type === 'item-purchase') {
    const purchase = event as ItemPurchaseEvent;
    item.classList.add('timeline-moment--item');
    const icon = document.createElement('img');
    icon.src = purchase.itemImageUrl;
    icon.alt = '';
    icon.width = 20;
    icon.height = 20;
    icon.loading = 'lazy';
    label.textContent = purchase.itemName;
    item.append(time, icon, label);
    return item;
  }
  if (event.type === 'champion-kill') {
    const kill = event as ChampionKillEvent;
    item.classList.add(`timeline-moment--${kill.outcome}`);
    // Con multi-kill real, la etiqueta ("¡Doble kill!") ya deja claro que
    // fue una kill — repetir "Kill" antes de "vs X" sería redundante.
    const parts = kill.multiKill ? [] : [outcomeLabel[kill.outcome]];
    if (kill.otherChampionName) parts.push(`vs ${kill.otherChampionName}`);
    label.textContent = kill.multiKill
      ? `${multiKillLabel[kill.multiKill]}${parts.length ? ` ${parts.join(' ')}` : ''}`
      : parts.join(' ');
    if (kill.multiKill) item.classList.add('timeline-moment--multikill');
    item.append(time, label);
    return item;
  }
  const objective = event as ObjectiveEvent;
  item.classList.add(
    objective.teamParticipated
      ? 'timeline-moment--objective-team'
      : 'timeline-moment--objective-enemy',
  );
  label.textContent = objectiveLabel(objective);
  item.append(time, label);
  return item;
};

// --- Render principal ---

const renderTimeline = (
  panel: HTMLElement,
  timeline: MatchTimeline,
  options: TimelineRenderOptions,
) => {
  const { formatNumber } = options;
  const content = query<HTMLElement>(panel, '[data-timeline-content]')!;
  content.hidden = false;

  const hasRival = Boolean(timeline.enemyAdcChampionName);
  const rivalLabel = timeline.enemyAdcChampionName;

  const setStat = (
    metric: 'cs' | 'gold' | 'xp',
    value: number | undefined,
    diff: number | undefined,
  ) => {
    const strong = query<HTMLElement>(panel, `[data-timeline-${metric}10]`);
    const small = query<HTMLElement>(panel, `[data-timeline-${metric}10-diff]`);
    if (strong) strong.textContent = value === undefined ? 'Sin dato' : formatNumber(value);
    if (small)
      small.textContent =
        diff === undefined
          ? ''
          : `${signed(diff, formatNumber)} vs ${rivalLabel ?? 'rival'}`;
  };
  setStat('cs', timeline.laneCheckpoint10?.cs, timeline.laneComparison10?.csDiff);
  setStat(
    'gold',
    timeline.laneCheckpoint10?.gold,
    timeline.laneComparison10?.goldDiff,
  );
  setStat('xp', timeline.laneCheckpoint10?.xp, timeline.laneComparison10?.xpDiff);

  const evolutionTitle = query<HTMLElement>(panel, '[data-timeline-evolution-title]');
  if (evolutionTitle)
    evolutionTitle.textContent = hasRival ? `Tidusss vs ${rivalLabel}` : 'Evolución de Tidusss';

  const note = query<HTMLElement>(panel, '[data-timeline-summary-note]')!;
  note.textContent = !timeline.laneCheckpoint10
    ? 'Esta partida no llegó al minuto 10 — sin resumen de línea real que mostrar.'
    : !hasRival
      ? 'ADC rival no identificable con certeza en esta partida — solo se muestran los datos de Tidusss.'
      : `Comparado con ${rivalLabel}, el ADC rival en la línea inferior.`;

  // --- Gráfico Oro/CS con selector ---
  const chartHost = query<HTMLElement>(panel, '[data-timeline-chart]')!;
  const chartEmpty = query<HTMLElement>(panel, '[data-timeline-chart-empty]')!;
  const toggle = query<HTMLElement>(panel, '[data-timeline-metric-toggle]');
  const renderChart = (metric: 'gold' | 'cs') => {
    const self = metric === 'gold' ? timeline.goldCurve : timeline.csCurve;
    const rival =
      metric === 'gold' ? timeline.enemyAdcGoldCurve : timeline.enemyAdcCsCurve;
    const build = buildChartSvg(
      self,
      rival,
      rivalLabel,
      timeline.durationMs,
      metric === 'gold' ? 'oro' : 'CS',
      (value) =>
        metric === 'gold' && value >= 1000
          ? `${(value / 1000).toFixed(1)}k`
          : String(Math.round(value)),
      chartHost.clientWidth || FALLBACK_CHART_WIDTH,
    );
    chartHost.hidden = !build;
    chartEmpty.hidden = Boolean(build);
    chartHost.innerHTML = build?.svg ?? '';
    if (build) wireChartHover(chartHost, build);
  };
  renderChart('gold');
  toggle?.querySelectorAll<HTMLButtonElement>('[data-timeline-metric]').forEach((button) => {
    button.addEventListener('click', () => {
      const metric = button.dataset.timelineMetric as 'gold' | 'cs';
      toggle
        .querySelectorAll<HTMLButtonElement>('[data-timeline-metric]')
        .forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
      renderChart(metric);
    });
  });

  // --- Momentos clave ---
  const moments = query<HTMLOListElement>(panel, '[data-timeline-moments]')!;
  const momentsEmpty = query<HTMLElement>(panel, '[data-timeline-moments-empty]')!;
  moments.replaceChildren(...timeline.events.map(renderMoment));
  momentsEmpty.hidden = timeline.events.length > 0;
};

const renderError = (panel: HTMLElement, code?: string) => {
  const errorBlock = query<HTMLElement>(panel, '[data-timeline-error]')!;
  errorBlock.hidden = false;
  const title = query<HTMLElement>(errorBlock, '[data-timeline-error-title]')!;
  const detail = query<HTMLElement>(errorBlock, '[data-timeline-error-detail]')!;
  title.textContent =
    code === 'RIOT_RATE_LIMITED'
      ? 'Riot está limitando las peticiones ahora mismo.'
      : 'No se ha podido analizar esta partida.';
  detail.textContent =
    'El resto del historial sigue disponible — vuelve a intentarlo en un momento.';
};

export const wireTimeline = (
  card: HTMLElement,
  matchId: string,
  options: TimelineRenderOptions,
) => {
  const trigger = query<HTMLButtonElement>(card, '[data-timeline-trigger]');
  const panel = query<HTMLElement>(card, '[data-timeline-panel]');
  if (!trigger || !panel) return;

  const load = async () => {
    const cached = timelineCache.get(matchId);
    if (cached && cached !== 'unavailable') {
      renderTimeline(panel, cached, options);
      return;
    }
    if (cached === 'unavailable') {
      renderError(panel);
      return;
    }
    const loading = query<HTMLElement>(panel, '[data-timeline-loading]')!;
    loading.hidden = false;
    try {
      const response = await fetch(
        `${options.matchesBase}/${encodeURIComponent(matchId)}/timeline`,
      );
      const payload = (await response.json()) as MatchTimelinePublicResponse;
      loading.hidden = true;
      if (!payload.ok) {
        timelineCache.set(matchId, 'unavailable');
        renderError(panel, payload.error.code);
        return;
      }
      timelineCache.set(matchId, payload.data);
      renderTimeline(panel, payload.data, options);
    } catch {
      loading.hidden = true;
      timelineCache.set(matchId, 'unavailable');
      renderError(panel);
    }
  };

  trigger.addEventListener('click', () => {
    const isOpen = trigger.getAttribute('aria-expanded') === 'true';
    if (isOpen) {
      closeOpenPanel();
      return;
    }
    // Solo un Timeline abierto a la vez (encargo §22): cerrar cualquier
    // otro antes de abrir este.
    closeOpenPanel();
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    trigger.querySelector('span')!.textContent = 'Cerrar análisis';
    openPanel = { panel, trigger };
    void load();
  });

  // Solo en `astro dev` (eliminado del bundle de producción): fuerza el
  // Timeline de ESTA tarjeta con datos sintéticos para QA visual sin
  // tocar la red real — mismo patrón que `PerformanceProfile.astro`/
  // `LiveGameModule.astro`.
  if (import.meta.env.DEV) {
    const debugHooks =
      (window as unknown as { __timelineDebugRender?: Record<string, (timeline: MatchTimeline) => void> })
        .__timelineDebugRender ?? {};
    debugHooks[matchId] = (timeline: MatchTimeline) => {
      timelineCache.set(matchId, timeline);
      closeOpenPanel();
      panel.hidden = false;
      panel.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
      trigger.querySelector('span')!.textContent = 'Cerrar análisis';
      openPanel = { panel, trigger };
      renderTimeline(panel, timeline, options);
    };
    (window as unknown as { __timelineDebugRender?: typeof debugHooks }).__timelineDebugRender =
      debugHooks;
  }
};
