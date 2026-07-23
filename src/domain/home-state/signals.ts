import type { HomeSignal } from './types';

type SignalListener = (signals: readonly HomeSignal[]) => void;

const signals = new Map<HomeSignal['type'], HomeSignal>();
const listeners = new Set<SignalListener>();

export const publishHomeSignal = (signal: HomeSignal) => {
  signals.set(signal.type, signal);
  const snapshot = [...signals.values()];
  listeners.forEach((listener) => listener(snapshot));
};

export const subscribeHomeSignals = (listener: SignalListener) => {
  listeners.add(listener);
  listener([...signals.values()]);
  return () => listeners.delete(listener);
};
