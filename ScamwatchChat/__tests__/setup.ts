import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "node:util";

// jsdom doesn't provide these; Node's versions support the same encodings browsers do.
Object.assign(globalThis, { TextDecoder, TextEncoder });

// Fluent's MessageBar measures itself; jsdom has no layout, so a no-op observer is enough.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (!("ResizeObserver" in globalThis)) {
  Object.assign(globalThis, { ResizeObserver: ResizeObserverStub });
}
