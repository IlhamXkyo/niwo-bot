const FILTER_STATE = Symbol.for("niwo.signalLogFilter");
const NOISY_MESSAGES = new Set([
  "Closing session:",
  "Session already closed",
]);

export function installSignalLogFilter() {
  const existing = globalThis[FILTER_STATE];
  if (existing) {
    existing.references += 1;
    return createRestore(existing);
  }

  const originalInfo = console.info;
  const state = {
    originalInfo,
    references: 1,
  };

  console.info = (...args) => {
    if (NOISY_MESSAGES.has(args[0])) return;
    originalInfo.apply(console, args);
  };

  globalThis[FILTER_STATE] = state;
  return createRestore(state);
}

function createRestore(state) {
  let restored = false;

  return () => {
    if (restored) return;
    restored = true;
    state.references -= 1;

    if (state.references === 0) {
      console.info = state.originalInfo;
      delete globalThis[FILTER_STATE];
    }
  };
}
