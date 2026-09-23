// packages/client/src/renderer/test-setup.ts
import '@testing-library/jest-dom';
import { configurarBridge } from '@core/ui';

configurarBridge('ferreteria');

// Fix AbortSignal mismatch between jsdom and Node's undici.
// React Router's data router (createMemoryRouter) creates Request objects during
// navigation. In jsdom, global.AbortController is jsdom's implementation, but Node's
// built-in fetch/Request (undici) validates signals against its own captured
// AbortSignal reference. The fix: patch global.Request to strip the signal before
// passing to undici's Request constructor, preserving the signal reference separately.
// This is safe in tests because we have no fetch loaders/actions that need abort signals.
// See: https://github.com/remix-run/react-router/issues/11289
const _OriginalRequest = globalThis.Request;
globalThis.Request = class PatchedRequest extends _OriginalRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    const { signal, ...rest } = (init ?? {}) as RequestInit & { signal?: AbortSignal };
    super(input, rest as RequestInit);
    if (signal !== undefined) {
      // Re-attach the signal reference (bypasses undici validation)
      Object.defineProperty(this, 'signal', {
        get: () => signal,
        configurable: true,
      });
    }
  }
};
