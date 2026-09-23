import '@testing-library/jest-dom/vitest'

// 后端测试跑在 node 环境（没有 window），这里只给浏览器环境补 jsdom 缺的能力。
if (typeof window !== 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  if (!('ResizeObserver' in globalThis)) {
    Object.defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverStub })
  }

  // jsdom does not implement matchMedia, and the theme / reduced-motion hooks query it.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })

  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {}
  }
}
