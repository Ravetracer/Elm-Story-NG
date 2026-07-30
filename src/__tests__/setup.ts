/**
 * Vitest setup: jest-dom matchers plus the browser APIs jsdom does not
 * implement but the editor's dependency set expects at import time.
 */
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// rc-dock, antd and react-flow-renderer all measure layout on mount.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

if (!('IntersectionObserver' in globalThis)) {
  globalThis.IntersectionObserver = class {
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds: readonly number[] = []
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  } as unknown as typeof IntersectionObserver
}

// antd's responsive observers read matchMedia during render.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
}

/*
 * Node 22's own experimental `localStorage` global shadows jsdom's and resolves
 * to undefined without --localstorage-file, warning as it goes. The renderer
 * runs in real Chromium where it exists, so it is stubbed here rather than
 * worked around in the code under test. lib/uiScale.ts stores the UI scale
 * preference through it.
 */
if (!window.localStorage) {
  const store = new Map<string, string>()

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      get length() {
        return store.size
      },
      key: (index: number) => [...store.keys()][index] ?? null,
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, `${value}`),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear()
    } as Storage
  })
}

// jsdom implements neither, and the storyteller preview touches both.
if (!window.HTMLCanvasElement.prototype.getContext) {
  window.HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null
  ) as unknown as typeof window.HTMLCanvasElement.prototype.getContext
}
