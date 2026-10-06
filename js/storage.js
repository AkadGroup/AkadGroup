// version: 1.0.0
// Namespaced localStorage wrapper. Every access is guarded because storage
// throws in private-browsing modes and when the quota is exceeded; failures
// are logged rather than swallowed, and callers fall back to in-memory data.
(function (global) {
  "use strict";

  const NAMESPACE = "akad";

  function storageKey(name) {
    return `${NAMESPACE}.${name}`;
  }

  function read(name, fallback) {
    try {
      const raw = global.localStorage.getItem(storageKey(name));
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      console.error(`[AkadStorage] Could not read "${name}"; using fallback.`, error);
      return fallback;
    }
  }

  function write(name, value) {
    try {
      global.localStorage.setItem(storageKey(name), JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`[AkadStorage] Could not persist "${name}".`, error);
      return false;
    }
  }

  function remove(name) {
    try {
      global.localStorage.removeItem(storageKey(name));
    } catch (error) {
      console.error(`[AkadStorage] Could not remove "${name}".`, error);
    }
  }

  global.AkadStorage = { read, write, remove };
})(window);
