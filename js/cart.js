// version: 1.1.0
// Shopping cart state. Deliberately free of DOM access: it holds line items,
// enforces quantity rules, and notifies subscribers. Views render from the
// snapshot it hands out, which keeps state and presentation separable (and
// makes this module unit-testable without a browser).
(function (global) {
  "use strict";

  /** Guards against typos and runaway quantities from repeated clicks. */
  const MAX_QUANTITY_PER_LINE = 99;

  function assertUsableProduct(product) {
    if (!product || typeof product.id !== "string" || product.id === "") {
      throw new TypeError("Cart requires a product with a non-empty string id.");
    }
    if (!Number.isFinite(product.price) || product.price < 0) {
      throw new RangeError(
        `Product "${product.id}" has an unusable price: ${product.price}`
      );
    }
  }

  function clampQuantity(quantity) {
    return Math.min(Math.max(Math.trunc(quantity), 0), MAX_QUANTITY_PER_LINE);
  }

  /**
   * @param {object} [options]
   * @param {Array} [options.initialLines] Previously persisted lines. The cart
   *   stays storage-agnostic: the caller owns loading and saving.
   */
  function createCart({ initialLines = [], emitterFactory } = {}) {
    /** @type {Map<string, {id, title, brandId, price, quantity}>} */
    const lines = new Map();
    const emitter = emitterFactory
      ? emitterFactory()
      : global.AkadEmitter.createEmitter();

    if (Array.isArray(initialLines)) {
      initialLines.forEach((line) => {
        try {
          assertUsableProduct(line);
          lines.set(line.id, {
            id: line.id,
            title: line.title,
            brandId: line.brandId,
            price: line.price,
            quantity: clampQuantity(line.quantity) || 1,
          });
        } catch (error) {
          // A corrupt stored line must not take down the whole cart.
          console.error("[AkadCart] Dropping unusable restored line.", line, error);
        }
      });
    }

    function getLines() {
      // Snapshot copies so a view can never mutate cart state by accident.
      return [...lines.values()].map((line) => ({
        ...line,
        lineTotal: line.price * line.quantity,
      }));
    }

    function getItemCount() {
      let total = 0;
      for (const line of lines.values()) total += line.quantity;
      return total;
    }

    function getTotalCost() {
      let total = 0;
      for (const line of lines.values()) total += line.price * line.quantity;
      return total;
    }

    function notify() {
      emitter.emit(getLines());
    }

    /** Adds one unit, or increments an existing line. Price is captured at
        the moment of adding, which is how a real receipt has to behave. */
    function add(product) {
      assertUsableProduct(product);

      const existing = lines.get(product.id);
      if (existing) {
        existing.quantity = clampQuantity(existing.quantity + 1);
      } else {
        lines.set(product.id, {
          id: product.id,
          title: product.title,
          brandId: product.brandId,
          price: product.price,
          quantity: 1,
        });
      }
      notify();
    }

    /** Setting a quantity of zero (or less) removes the line entirely. */
    function setQuantity(productId, quantity) {
      const line = lines.get(productId);
      if (!line) {
        throw new Error(`Cannot set quantity: "${productId}" is not in the cart.`);
      }

      const next = clampQuantity(quantity);
      if (next === 0) {
        lines.delete(productId);
      } else {
        line.quantity = next;
      }
      notify();
    }

    function remove(productId) {
      if (lines.delete(productId)) notify();
    }

    function clear() {
      if (lines.size === 0) return;
      lines.clear();
      notify();
    }

    return {
      add,
      setQuantity,
      remove,
      clear,
      getLines,
      getItemCount,
      getTotalCost,
      subscribe: emitter.subscribe,
    };
  }

  global.AkadCart = { createCart, MAX_QUANTITY_PER_LINE };
})(window);
