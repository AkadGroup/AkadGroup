// version: 1.0.0
// Shared money formatting. Lives on its own so the storefront and the receipt
// can never drift into showing the same price two different ways.
(function (global) {
  "use strict";

  const CURRENCY_LABEL = "د.ع";
  // Western digits with thousands separators, e.g. 8,500.
  const PRICE_LOCALE = "en-US";

  const priceFormatter = new Intl.NumberFormat(PRICE_LOCALE);

  /**
   * @param {number} amount Iraqi Dinar value.
   * @returns {string} e.g. "8,500"
   */
  function formatPrice(amount) {
    if (!Number.isFinite(amount)) {
      throw new TypeError(`formatPrice expects a finite number, received: ${amount}`);
    }
    return priceFormatter.format(amount);
  }

  global.AkadFormat = { CURRENCY_LABEL, formatPrice };
})(window);
