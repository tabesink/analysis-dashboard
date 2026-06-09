import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { StoreApi, UseBoundStore } from "zustand";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function randomColor(seed = Math.random()) {
  const hue = Math.floor(seed * 360);
  return `hsl(${hue} 72% 52%)`;
}

export function createSelectors<S extends UseBoundStore<StoreApi<object>>>(_store: S) {
  const store = _store as S & { use: Record<string, () => unknown> };
  store.use = {};
  for (const key of Object.keys(store.getState())) {
    store.use[key] = () => store((state) => state[key as keyof typeof state]);
  }
  return store as S & {
    use: {
      [K in keyof ReturnType<S["getState"]>]: () => ReturnType<S["getState"]>[K];
    };
  };
}
