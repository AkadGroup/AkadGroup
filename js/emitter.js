// version: 1.0.0
// Minimal observable. Every store needs subscribe/notify; keeping one
// implementation here avoids four slightly different copies of it.
(function (global) {
  "use strict";

  function createEmitter() {
    const listeners = new Set();

    return {
      /** @returns {() => void} unsubscribe */
      subscribe(listener) {
        if (typeof listener !== "function") {
          throw new TypeError("Subscriber must be a function.");
        }
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      emit(payload) {
        // Copy first: a listener may unsubscribe during iteration.
        [...listeners].forEach((listener) => listener(payload));
      },
    };
  }

  global.AkadEmitter = { createEmitter };
})(window);
