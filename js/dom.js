// version: 1.0.0
// Shared DOM builders. Every view creates elements with textContent rather
// than innerHTML, so product titles, customer names, and addresses can never
// be interpreted as markup.
(function (global) {
  "use strict";

  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

  function el(tagName, className, textContent) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (textContent !== undefined) element.textContent = textContent;
    return element;
  }

  function icon(symbolId, className) {
    const svg = document.createElementNS(SVG_NAMESPACE, "svg");
    if (className) svg.setAttribute("class", className);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const use = document.createElementNS(SVG_NAMESPACE, "use");
    use.setAttribute("href", `#${symbolId}`);
    svg.appendChild(use);
    return svg;
  }

  function button(label, className, onClick) {
    const element = el("button", className, label);
    element.type = "button";
    if (onClick) element.addEventListener("click", onClick);
    return element;
  }

  /**
   * Labeled form control with an inline error slot wired via aria-describedby.
   * @returns {{wrapper: HTMLElement, input: HTMLElement, error: HTMLElement}}
   */
  function field({
    id,
    label,
    type = "text",
    value = "",
    placeholder = "",
    autocomplete,
    options,
    multiline = false,
    required = true,
  }) {
    const wrapper = el("div", "field");

    const labelElement = el("label", "field__label", label);
    labelElement.htmlFor = id;

    let input;
    let inputWrapper;
    if (options) {
      input = el("select", "field__input");
      options.forEach((option) => {
        const optionElement = el("option", undefined, option.label);
        optionElement.value = option.value;
        if (option.value === value) optionElement.selected = true;
        input.appendChild(optionElement);
      });
      inputWrapper = input;
    } else if (multiline) {
      input = el("textarea", "field__input");
      input.rows = 2;
      input.value = value;
      inputWrapper = input;
    } else {
      input = el("input", "field__input");
      input.type = type;
      input.value = value;
      
      if (type === "password") {
        inputWrapper = el("div", "field__password-wrapper");
        inputWrapper.style.position = "relative";
        inputWrapper.style.display = "flex";
        inputWrapper.style.alignItems = "center";
        
        input.style.flex = "1";
        input.style.paddingLeft = "45px"; // space for the button on the left (RTL)
        
        const toggleBtn = el("button", "field__password-toggle", "عرض");
        toggleBtn.type = "button";
        toggleBtn.style.position = "absolute";
        toggleBtn.style.left = "10px";
        toggleBtn.style.background = "none";
        toggleBtn.style.border = "none";
        toggleBtn.style.cursor = "pointer";
        toggleBtn.style.color = "var(--color-text-muted)";
        toggleBtn.style.fontSize = "0.9em";
        toggleBtn.style.padding = "4px";
        
        toggleBtn.addEventListener("click", () => {
          if (input.type === "password") {
            input.type = "text";
            toggleBtn.textContent = "إخفاء";
          } else {
            input.type = "password";
            toggleBtn.textContent = "عرض";
          }
        });
        
        inputWrapper.append(input, toggleBtn);
      } else {
        inputWrapper = input;
      }
    }

    input.id = id;
    if (placeholder) input.placeholder = placeholder;
    if (autocomplete) input.autocomplete = autocomplete;
    if (required) input.required = true;

    const error = el("p", "field__error");
    error.id = `${id}-error`;
    input.setAttribute("aria-describedby", error.id);

    wrapper.append(labelElement, inputWrapper, error);
    return { wrapper, input, error };
  }

  function setFieldError(fieldParts, message) {
    fieldParts.error.textContent = message || "";
    fieldParts.input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  /** Non-blocking inline message; `tone` is "error" or "success". */
  function notice(message, tone) {
    const element = el("p", `notice notice--${tone}`, message);
    element.setAttribute("role", tone === "error" ? "alert" : "status");
    return element;
  }

  global.AkadDom = { el, icon, button, field, setFieldError, notice };
})(window);
