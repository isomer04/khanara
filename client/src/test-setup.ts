import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, vi } from 'vitest';

// Guard against re-initialization when Vitest reuses workers across test batches.
try {
  getTestBed().initTestEnvironment(
    BrowserTestingModule,
    platformBrowserTesting(),
    { teardown: { destroyAfterEach: true } }
  );
} catch {
  // Already initialized in this worker — safe to ignore.
}

// Reset TestBed after every test so the next test file gets a clean module.
// This is the fix for "Cannot configure the test module when the test module
// has already been instantiated" — one global hook instead of per-file patches.
afterEach(() => {
  getTestBed().resetTestingModule();
});

// Mock IntersectionObserver
globalThis.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Create separate storage mocks with Map-based persistence
function createStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
    removeItem: vi.fn((key: string) => { store.delete(key); }),
    clear: vi.fn(() => { store.clear(); }),
    key: vi.fn((index: number) => {
      const keys = Array.from(store.keys());
      return keys[index] ?? null;
    }),
    get length() {
      return store.size;
    },
  };
}

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(globalThis, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock DataTransfer for drag and drop testing
class DataTransferMock {
  items: DataTransferItemList;
  files: FileList;
  private _files: File[] = [];

  constructor() {
    const self = this;
    this.items = {
      length: 0,
      add: function(file: File) {
        self._files.push(file);
        (this as any).length = self._files.length;
        return null as any;
      },
      remove: function(index: number) {
        self._files.splice(index, 1);
        (this as any).length = self._files.length;
      },
      clear: function() {
        self._files = [];
        (this as any).length = 0;
      },
    } as any;

    this.files = new Proxy([] as any, {
      get: (target, prop) => {
        if (prop === 'length') return self._files.length;
        if (typeof prop === 'string' && !isNaN(Number(prop))) {
          return self._files[Number(prop)];
        }
        return target[prop];
      },
    });
  }
}

globalThis.DataTransfer = DataTransferMock as any;

// Mock DragEvent
class DragEventMock extends Event {
  dataTransfer: DataTransfer | null;

  constructor(type: string, eventInitDict?: DragEventInit) {
    super(type, eventInitDict);
    this.dataTransfer = eventInitDict?.dataTransfer || null;
  }
}

globalThis.DragEvent = DragEventMock as any;
