/**
 * Vitest setup (node env): provide localStorage and window for sessionMetadata tests.
 */
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

if (typeof (globalThis as unknown as { window?: unknown }).window === "undefined") {
  (globalThis as unknown as { window: typeof globalThis }).window = globalThis;
}

if (typeof globalThis.navigator === "undefined") {
  (globalThis as unknown as { navigator: { clipboard: { readText: () => Promise<string> } } }).navigator = {
    clipboard: { readText: () => Promise.resolve("") },
  };
}

beforeEach(() => {
  localStorageMock.clear();
});
