import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'

// jsdom has no ResizeObserver, and AnnotationCanvas uses one to keep the zoom
// floor and the fit-on-open measurement in step with the container's real
// width. A no-op stub is enough and is honest about what jsdom can offer:
// every element there reports a zero clientWidth, so an observer that did fire
// would only ever hand the component a measurement it already rejects.
class NoopResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver ??= NoopResizeObserver
