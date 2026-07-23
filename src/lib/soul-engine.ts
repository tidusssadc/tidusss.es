import type {
  BrandReference,
  MomentType,
  ReferenceRarity,
} from '../data/references';

interface SoulEngineElements {
  root: HTMLElement;
  label: HTMLElement;
  message: HTMLElement;
  sentinel: HTMLElement;
}

const rarityWeight: Record<ReferenceRarity, number> = {
  common: 12,
  rare: 5,
  epic: 2,
  legendary: 1,
};

const storage = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage is optional; Moments still work for the current visit.
    }
  },
  sessionGet(key: string) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  sessionSet(key: string, value: string) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Session persistence is an enhancement, never a requirement.
    }
  },
};

const momentLabel = (reference: BrandReference) =>
  reference.category === 'tidusss'
    ? 'Tidusss'
    : reference.category === 'final-fantasy-x'
      ? 'Una historia que continúa'
      : 'Referencia detectada';

const weightedPick = (
  references: BrandReference[],
  previousId?: string | null,
) => {
  const candidates = references.filter(({ id }) => id !== previousId);
  const pool = candidates.length ? candidates : references;
  const weighted = pool.flatMap((reference) =>
    Array.from(
      {
        length:
          rarityWeight[reference.rarity] * Math.max(1, reference.priority),
      },
      () => reference,
    ),
  );
  return weighted[Math.floor(Math.random() * weighted.length)];
};

export const startSoulEngine = (
  elements: SoulEngineElements,
  references: BrandReference[],
) => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let hideTimer: number | undefined;
  let holdTimer: number | undefined;
  let matchTimer: number | undefined;
  let finalTimer: number | undefined;
  let keyBuffer = '';
  let konamiIndex = 0;
  let lastMatchMoment = 0;
  const cleanups: Array<() => void> = [];

  const show = (type: MomentType, duration = 4800) => {
    const available = references.filter((reference) => reference.type === type);
    if (!available.length) return;
    const previousId = storage.sessionGet('tidusss:soul:last-reference');
    const selected = weightedPick(available, previousId);
    if (!selected) return;
    storage.sessionSet('tidusss:soul:last-reference', selected.id);
    elements.label.textContent = momentLabel(selected);
    elements.message.textContent = selected.text;
    elements.message.lang = selected.language;
    elements.root.hidden = false;
    requestAnimationFrame(() =>
      elements.root.toggleAttribute('data-visible', true),
    );
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      elements.root.removeAttribute('data-visible');
      const delay = reducedMotion.matches ? 0 : 360;
      window.setTimeout(() => {
        if (!elements.root.hasAttribute('data-visible'))
          elements.root.hidden = true;
      }, delay);
    }, duration);
  };

  const hour = new Date().getHours();
  const greeting: MomentType =
    hour >= 5 && hour < 12
      ? 'greeting-morning'
      : hour >= 12 && hour < 20
        ? 'greeting-afternoon'
        : 'greeting-evening';
  if (!storage.sessionGet('tidusss:soul:greeted')) {
    storage.sessionSet('tidusss:soul:greeted', 'true');
    window.setTimeout(() => show(greeting), 1400);
  }

  if (!storage.sessionGet('tidusss:soul:visit-counted')) {
    storage.sessionSet('tidusss:soul:visit-counted', 'true');
    const visits = Number(storage.get('tidusss:soul:visits') ?? 0) + 1;
    storage.set('tidusss:soul:visits', String(visits));
    if (
      visits >= 25 &&
      storage.get('tidusss:soul:returning-moment') !== 'shown'
    ) {
      storage.set('tidusss:soul:returning-moment', 'shown');
      window.setTimeout(() => show('returning-visitor', 6000), 7200);
    }
  }

  const logo = document.querySelector<HTMLElement>('.brand-mark');
  const beginLogoHold = () => {
    window.clearTimeout(holdTimer);
    holdTimer = window.setTimeout(() => show('logo-hold'), 2200);
  };
  const cancelLogoHold = () => window.clearTimeout(holdTimer);
  logo?.addEventListener('pointerenter', beginLogoHold);
  logo?.addEventListener('pointerleave', cancelLogoHold);
  logo?.addEventListener('focus', beginLogoHold);
  logo?.addEventListener('blur', cancelLogoHold);
  cleanups.push(() => {
    logo?.removeEventListener('pointerenter', beginLogoHold);
    logo?.removeEventListener('pointerleave', cancelLogoHold);
    logo?.removeEventListener('focus', beginLogoHold);
    logo?.removeEventListener('blur', cancelLogoHold);
  });

  const twitch = document.querySelector<HTMLElement>(
    '[data-twitch-panel], [data-live-root]',
  );
  const announceLive = () => {
    if (
      (twitch?.hasAttribute('data-online') ||
        twitch?.hasAttribute('data-stream-live')) &&
      !storage.sessionGet('tidusss:soul:live-seen')
    ) {
      storage.sessionSet('tidusss:soul:live-seen', 'true');
      show('twitch-live', 6000);
    }
  };
  const twitchObserver = twitch
    ? new MutationObserver(announceLive)
    : undefined;
  twitchObserver?.observe(twitch!, {
    attributes: true,
    attributeFilter: ['data-online', 'data-stream-live'],
  });
  announceLive();
  cleanups.push(() => twitchObserver?.disconnect());

  const onPointerOver = (event: PointerEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const card = target.closest<HTMLElement>('[data-match-card]');
    const related = event.relatedTarget;
    if (!card || (related instanceof Node && card.contains(related))) return;
    window.clearTimeout(matchTimer);
    matchTimer = window.setTimeout(() => {
      if (Date.now() - lastMatchMoment < 14_000) return;
      lastMatchMoment = Date.now();
      show(
        card.classList.contains('is-victory')
          ? 'match-victory'
          : 'match-defeat',
      );
    }, 1000);
  };
  const onPointerOut = (event: PointerEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const card = target.closest<HTMLElement>('[data-match-card]');
    const related = event.relatedTarget;
    if (!card || (related instanceof Node && card.contains(related))) return;
    window.clearTimeout(matchTimer);
  };
  document.addEventListener('pointerover', onPointerOver);
  document.addEventListener('pointerout', onPointerOut);
  cleanups.push(() => {
    document.removeEventListener('pointerover', onPointerOver);
    document.removeEventListener('pointerout', onPointerOut);
  });

  const finalObserver = new IntersectionObserver((entries) => {
    const visible = entries.some(({ isIntersecting }) => isIntersecting);
    window.clearTimeout(finalTimer);
    if (visible && !storage.sessionGet('tidusss:soul:end-seen'))
      finalTimer = window.setTimeout(() => {
        storage.sessionSet('tidusss:soul:end-seen', 'true');
        show('scroll-final');
      }, 2400);
  });
  finalObserver.observe(elements.sentinel);
  cleanups.push(() => finalObserver.disconnect());

  const konami = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'b',
    'a',
  ];
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    )
      return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    keyBuffer = `${keyBuffer}${event.key.toLowerCase()}`.slice(-12);
    if (keyBuffer.endsWith('tidus')) {
      keyBuffer = '';
      show('typed-tidus', 6500);
    }
    konamiIndex = key === konami[konamiIndex] ? konamiIndex + 1 : 0;
    if (konamiIndex === konami.length) {
      konamiIndex = 0;
      show('konami', 6500);
    }
  };
  document.addEventListener('keydown', onKeyDown);
  cleanups.push(() => document.removeEventListener('keydown', onKeyDown));

  const onExternalMoment = (event: Event) => {
    const type = (event as CustomEvent<{ type?: MomentType }>).detail?.type;
    if (type) show(type);
  };
  window.addEventListener('tidusss:moment', onExternalMoment);
  cleanups.push(() =>
    window.removeEventListener('tidusss:moment', onExternalMoment),
  );

  const onHomeState = (event: Event) => {
    const state = (event as CustomEvent<{ id?: string }>).detail?.id;
    if (
      state === 'new-record' &&
      !storage.sessionGet('tidusss:soul:new-record-seen')
    ) {
      storage.sessionSet('tidusss:soul:new-record-seen', 'true');
      show('new-record', 6000);
    }
  };
  window.addEventListener('tidusss:home-state-changed', onHomeState);
  cleanups.push(() =>
    window.removeEventListener('tidusss:home-state-changed', onHomeState),
  );

  return () => {
    window.clearTimeout(hideTimer);
    window.clearTimeout(holdTimer);
    window.clearTimeout(matchTimer);
    window.clearTimeout(finalTimer);
    cleanups.forEach((cleanup) => cleanup());
  };
};
