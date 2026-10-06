// version: 1.0.0
// Global Toast Notification System
(function (global) {
  "use strict";

  const { el, icon } = global.AkadDom;

  let container = null;

  function init() {
    if (container) return;
    container = el("div", "toast-container");
    document.body.appendChild(container);
  }

  /**
   * @param {string} message Text to display
   * @param {string} type 'success', 'warning', 'error', 'info'
   */
  function show(message, type = "info") {
    if (!container) init();

    const toast = el("div", `toast toast--${type}`);
    
    let iconId = "icon-check";
    if (type === "warning") iconId = "icon-tag"; // Or a warning icon if exists
    if (type === "error") iconId = "icon-close";

    toast.appendChild(icon(iconId, "toast__icon"));
    toast.appendChild(el("span", "toast__message", message));

    container.appendChild(toast);

    // Trigger reflow for animation
    void toast.offsetWidth;
    toast.classList.add("toast--visible");

    setTimeout(() => {
      toast.classList.remove("toast--visible");
      setTimeout(() => toast.remove(), 300); // Wait for transition
    }, 4000);
  }

  global.AkadToast = { init, show };
})(window);
