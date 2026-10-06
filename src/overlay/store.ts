import { useLayoutEffect, useState } from 'preact/hooks';

export interface Store<T> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(fn: () => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set(patch) {
      value = { ...value, ...patch };
      subs.forEach((fn) => fn());
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export function useStore<T extends object>(store: Store<T>): T {
  const value = store.get();
  const [, force] = useState(0);
  useLayoutEffect(() => {
    const unsubscribe = store.subscribe(() => force((n) => n + 1));
    // The store may have changed between render and subscription.
    if (store.get() !== value) force((n) => n + 1);
    return unsubscribe;
  }, [store]);
  return value;
}
