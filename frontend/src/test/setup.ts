import "@testing-library/jest-dom";
import { vi } from "vitest";

// Node 25+ defines its own global localStorage, which is an empty stub unless
// Node is started with --localstorage-file, and it shadows jsdom's. Install
// an in-memory Storage so tests behave the same on every Node version.
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
}

for (const name of ["localStorage", "sessionStorage"] as const) {
  const current = (globalThis as Record<string, unknown>)[name] as Storage | undefined;
  if (!current || typeof current.setItem !== "function") {
    const storage = createMemoryStorage();
    Object.defineProperty(globalThis, name, { value: storage, configurable: true, writable: true });
    Object.defineProperty(window, name, { value: storage, configurable: true, writable: true });
  }
}

// jsdom does not implement blob URLs; previews only need a string handle.
if (typeof URL.createObjectURL !== "function") {
  let counter = 0;
  URL.createObjectURL = () => `blob:test/${++counter}`;
  URL.revokeObjectURL = () => undefined;
}

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
