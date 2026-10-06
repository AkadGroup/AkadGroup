// version: 2.0.0
// Checkout flow: cart -> shipping details -> receipt -> confirmed.
// Renders each step into the shared modal and writes the finished order into
// the orders store, which is what surfaces it in the admin dashboard.
(function (global) {
  "use strict";

  const { CURRENCY_LABEL, formatPrice } = global.AkadFormat;
  const { el, icon, button, field, setFieldError, notice } = global.AkadDom;

  const SHIPPING_STORAGE_KEY = "shipping";
  const STEPS = { CART: "cart", SHIPPING: "shipping", RECEIPT: "receipt", DONE: "done" };

  const TEXT = {
    titleCart: "سلة التسوق",
    titleShipping: "معلومات التوصيل",
    titleReceipt: "مراجعة الطلب",
    titleDone: "تم تأكيد الطلب",
    emptyCart: "سلتك فارغة.",
    columnProduct: "المنتج",
    columnQuantity: "الكمية",
    columnUnitPrice: "سعر الوحدة",
    columnLineTotal: "المجموع",
    totalLabel: "الإجمالي",
    decrease: "إنقاص الكمية",
    increase: "زيادة الكمية",
    remove: "إزالة المنتج",
    proceed: "متابعة الشراء",
    back: "رجوع",
    continueToReview: "مراجعة الطلب",
    confirm: "تأكيد الطلب",
    print: "طباعة الإيصال",
    close: "إغلاق",
    shippingHeading: "معلومات المستلم",
    fullName: "الاسم الكامل",
    phone: "رقم الهاتف",
    city: "المحافظة / المدينة",
    address: "العنوان التفصيلي",
    landmark: "أقرب نقطة دالة",
    orderNumber: "رقم الطلب",
    thanks: "شكرًا لتسوقك مع AKAD GROUP. سنتواصل معك لتأكيد التوصيل.",
  };

  const ERRORS = {
    REQUIRED: "هذا الحقل مطلوب.",
    SHORT_NAME: "الرجاء إدخال الاسم الكامل.",
    INVALID_PHONE: "أدخل رقم هاتف عراقي صحيح، مثال: 07701234567.",
    SHORT_ADDRESS: "أدخل عنوانًا تفصيليًا أوضح.",
  };

  // Iraqi mobile numbers: 07 followed by nine digits.
  const PHONE_PATTERN = /^07\d{9}$/;
  const MIN_NAME_LENGTH = 3;
  const MIN_ADDRESS_LENGTH = 8;

  const GOVERNORATES = [
    "بغداد", "البصرة", "نينوى", "أربيل", "النجف", "كربلاء", "ذي قار", "الأنبار",
    "بابل", "ديالى", "دهوك", "السليمانية", "كركوك", "ميسان", "المثنى",
    "القادسية", "صلاح الدين", "واسط",
  ];

  function createMoneyCell(amount, tagName = "td", className = "receipt__money") {
    const cell = el(tagName, className);
    cell.appendChild(el("span", undefined, formatPrice(amount)));
    cell.appendChild(el("span", "receipt__currency", CURRENCY_LABEL));
    return cell;
  }

  /** @returns {{value: object}|{errors: Record<string,string>}} */
  function validateShipping(values) {
    const errors = {};
    if (values.fullName.trim().length < MIN_NAME_LENGTH) errors.fullName = ERRORS.SHORT_NAME;
    if (!PHONE_PATTERN.test(values.phone.trim())) errors.phone = ERRORS.INVALID_PHONE;
    if (!values.city) errors.city = ERRORS.REQUIRED;
    if (values.address.trim().length < MIN_ADDRESS_LENGTH) errors.address = ERRORS.SHORT_ADDRESS;
    if (values.landmark.trim().length === 0) errors.landmark = ERRORS.REQUIRED;

    return Object.keys(errors).length > 0 ? { errors } : { value: values };
  }

  function init({ cart, orders, auth, storage, inventory }) {
    const dialog = document.getElementById("checkout-dialog");
    const title = document.getElementById("checkout-title");
    const body = document.getElementById("checkout-body");
    const actions = document.getElementById("checkout-actions");
    const closeButton = document.getElementById("checkout-close");

    if (!dialog || !title || !body || !actions || !closeButton) {
      throw new Error("Checkout markup is incomplete; cannot initialise the flow.");
    }

    let step = STEPS.CART;
    let shipping = storage.read(SHIPPING_STORAGE_KEY, null);
    let confirmedOrder = null;
    let lastFocusedElement = null;

    function goTo(nextStep) {
      step = nextStep;
      render();
    }

    /* ------------------------------------------------------------ cart -- */

    function renderCartStep() {
      const lines = cart.getLines();
      if (lines.length === 0) {
        body.replaceChildren(el("p", "modal__empty", TEXT.emptyCart));
        actions.replaceChildren();
        return;
      }

      body.replaceChildren(buildItemsTable(lines, { editable: true }));
      actions.replaceChildren(
        button(TEXT.proceed, "button button--primary", () => goTo(STEPS.SHIPPING))
      );
    }

    function buildStepperButton(symbolId, label, productId, nextQuantity) {
      const stepButton = el("button", "stepper__button");
      stepButton.type = "button";
      stepButton.setAttribute("aria-label", label);
      stepButton.dataset.productId = productId;
      stepButton.dataset.quantity = String(nextQuantity);
      stepButton.appendChild(icon(symbolId));
      return stepButton;
    }

    function buildItemsTable(lines, { editable }) {
      const table = el("table", "receipt");

      const headRow = el("tr");
      [TEXT.columnProduct, TEXT.columnQuantity, TEXT.columnUnitPrice, TEXT.columnLineTotal]
        .forEach((label) => {
          const cell = el("th", undefined, label);
          cell.scope = "col";
          headRow.appendChild(cell);
        });
      if (editable) {
        const actionHead = el("th", "receipt__actions-head");
        actionHead.scope = "col";
        actionHead.appendChild(el("span", "visually-hidden", TEXT.remove));
        headRow.appendChild(actionHead);
      }
      const thead = el("thead");
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = el("tbody");
      lines.forEach((line) => {
        const row = el("tr");
        row.appendChild(el("td", "receipt__name", line.title));

        const quantityCell = el("td");
        if (editable) {
          const product = inventory.getById(line.id);
          const maxStock = product ? (product.stockQuantity ?? 50) : 0;

          const stepper = el("div", "stepper");
          const minusBtn = buildStepperButton("icon-minus", TEXT.decrease, line.id, line.quantity - 1);
          const plusBtn = buildStepperButton("icon-plus", TEXT.increase, line.id, line.quantity + 1);
          
          if (line.quantity >= maxStock) {
            plusBtn.disabled = true;
          }

          stepper.append(
            minusBtn,
            el("span", "stepper__value", String(line.quantity)),
            plusBtn
          );
          quantityCell.appendChild(stepper);
        } else {
          quantityCell.textContent = String(line.quantity);
        }
        row.appendChild(quantityCell);

        row.appendChild(createMoneyCell(line.price));
        row.appendChild(createMoneyCell(line.price * line.quantity));

        if (editable) {
          const removeCell = el("td");
          const removeButton = el("button", "receipt__remove");
          removeButton.type = "button";
          removeButton.dataset.removeId = line.id;
          removeButton.setAttribute("aria-label", `${TEXT.remove}: ${line.title}`);
          removeButton.appendChild(icon("icon-close"));
          removeCell.appendChild(removeButton);
          row.appendChild(removeCell);
        }

        tbody.appendChild(row);
      });
      table.appendChild(tbody);

      const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
      const totalRow = el("tr", "receipt__total-row");
      const totalLabel = el("th", undefined, TEXT.totalLabel);
      totalLabel.scope = "row";
      totalLabel.colSpan = 3;
      totalRow.append(totalLabel, createMoneyCell(total));
      if (editable) totalRow.appendChild(el("td"));

      const tfoot = el("tfoot");
      tfoot.appendChild(totalRow);
      table.appendChild(tfoot);

      return table;
    }

    /* -------------------------------------------------------- shipping -- */

    function renderShippingStep() {
      const saved = shipping || {};
      const form = el("form", "form");
      form.noValidate = true; // Validated in JS so messages stay in Arabic.

      const fields = {
        fullName: field({
          id: "ship-name",
          label: TEXT.fullName,
          value: saved.fullName || "",
          autocomplete: "name",
        }),
        phone: field({
          id: "ship-phone",
          label: TEXT.phone,
          type: "tel",
          value: saved.phone || "",
          placeholder: "07701234567",
          autocomplete: "tel",
        }),
        city: field({
          id: "ship-city",
          label: TEXT.city,
          value: saved.city || "",
          options: [
            { value: "", label: "اختر المحافظة" },
            ...GOVERNORATES.map((name) => ({ value: name, label: name })),
          ],
        }),
        address: field({
          id: "ship-address",
          label: TEXT.address,
          value: saved.address || "",
          multiline: true,
          autocomplete: "street-address",
        }),
        landmark: field({
          id: "ship-landmark",
          label: TEXT.landmark,
          value: saved.landmark || "",
          placeholder: "مثال: قرب صيدلية الرشيد",
        }),
      };

      Object.values(fields).forEach((part) => form.appendChild(part.wrapper));
      body.replaceChildren(form);

      const submit = button(TEXT.continueToReview, "button button--primary", () => {
        const values = {
          fullName: fields.fullName.input.value,
          phone: fields.phone.input.value,
          city: fields.city.input.value,
          address: fields.address.input.value,
          landmark: fields.landmark.input.value,
        };

        const result = validateShipping(values);
        Object.entries(fields).forEach(([name, part]) => {
          setFieldError(part, result.errors?.[name] || "");
        });

        if (result.errors) {
          const firstInvalid = form.querySelector('[aria-invalid="true"]');
          if (firstInvalid) firstInvalid.focus();
          return;
        }

        shipping = {
          fullName: values.fullName.trim(),
          phone: values.phone.trim(),
          city: values.city,
          address: values.address.trim(),
          landmark: values.landmark.trim(),
        };
        storage.write(SHIPPING_STORAGE_KEY, shipping);
        goTo(STEPS.RECEIPT);
      });

      actions.replaceChildren(
        button(TEXT.back, "button button--ghost", () => goTo(STEPS.CART)),
        submit
      );
    }

    /* --------------------------------------------------------- receipt -- */

    function buildShippingSummary(details) {
      const section = el("section", "summary");
      section.style.marginTop = "var(--space-4)";
      section.appendChild(el("h3", "summary__title", TEXT.shippingHeading));

      const table = el("table", "table");
      const tbody = el("tbody");

      [
        [TEXT.fullName, details.fullName],
        [TEXT.phone, details.phone],
        [TEXT.city, details.city],
        [TEXT.address, details.address],
        [TEXT.landmark, details.landmark],
      ].forEach(([label, value]) => {
        const tr = el("tr");
        const th = el("th", undefined, label);
        th.scope = "row";
        th.style.width = "40%";
        th.style.color = "var(--color-text-muted)";
        th.style.fontWeight = "normal";
        const td = el("td", undefined, value);
        td.style.fontWeight = "600";
        tr.append(th, td);
        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      section.appendChild(table);
      return section;
    }

    function renderReceiptStep() {
      const lines = cart.getLines();
      if (lines.length === 0) {
        goTo(STEPS.CART);
        return;
      }

      body.replaceChildren(
        buildItemsTable(lines, { editable: false }),
        buildShippingSummary(shipping)
      );

      actions.replaceChildren(
        button(TEXT.back, "button button--ghost", () => goTo(STEPS.SHIPPING)),
        button(TEXT.confirm, "button button--primary", confirmOrder)
      );
    }

    function confirmOrder() {
      const lines = cart.getLines();
      
      // Final failsafe against race conditions or multi-tab ordering
      for (const line of lines) {
        const product = inventory.getById(line.id);
        const maxStock = product ? (product.stockQuantity ?? 50) : 0;
        if (line.quantity > maxStock) {
          global.AkadToast.show(`نعتذر، ${line.title} لم يعد متوفراً بالكمية المطلوبة.`, "error");
          cart.setQuantity(line.id, maxStock);
          goTo(STEPS.CART); // send back to cart so they see the fix
          return;
        }
      }

      try {
        confirmedOrder = orders.add({
          items: lines,
          shipping,
          account: auth.getSession(),
        });
      } catch (error) {
        console.error("[Checkout] Could not record the order.", error);
        body.prepend(notice("تعذر حفظ الطلب. حاول مرة أخرى.", "error"));
        return;
      }

      cart.clear();
      goTo(STEPS.DONE);
    }

    /* ------------------------------------------------------------ done -- */

    function renderDoneStep() {
      const banner = el("div", "confirmation");
      banner.append(
        icon("icon-check", "confirmation__icon"),
        el("p", "confirmation__title", TEXT.titleDone),
        el("p", "confirmation__order", `${TEXT.orderNumber}: ${confirmedOrder.id}`),
        el("p", undefined, TEXT.thanks)
      );

      body.replaceChildren(
        banner,
        buildItemsTable(confirmedOrder.items, { editable: false }),
        buildShippingSummary(confirmedOrder.shipping)
      );

      actions.replaceChildren(
        button(TEXT.print, "button button--ghost", () => window.print()),
        button(TEXT.close, "button button--primary", () => dialog.close())
      );
    }

    /* ---------------------------------------------------------- render -- */

    const RENDERERS = {
      [STEPS.CART]: { title: TEXT.titleCart, render: renderCartStep },
      [STEPS.SHIPPING]: { title: TEXT.titleShipping, render: renderShippingStep },
      [STEPS.RECEIPT]: { title: TEXT.titleReceipt, render: renderReceiptStep },
      [STEPS.DONE]: { title: TEXT.titleDone, render: renderDoneStep },
    };

    function render() {
      const renderer = RENDERERS[step];
      title.textContent = renderer.title;
      renderer.render();
    }

    /**
     * @param {HTMLElement} [trigger] Element to restore focus to on close.
     *   Passed explicitly because a programmatic click leaves document
     *   .activeElement on <body>, which would strand keyboard focus.
     */
    function open(trigger) {
      lastFocusedElement = trigger instanceof HTMLElement ? trigger : document.activeElement;
      step = STEPS.CART;
      confirmedOrder = null;
      render();
      dialog.showModal();
    }

    body.addEventListener("click", (event) => {
      const stepperButton = event.target.closest(".stepper__button");
      if (stepperButton) {
        const productId = stepperButton.dataset.productId;
        const requestedQuantity = Number(stepperButton.dataset.quantity);
        const product = inventory.getById(productId);
        const maxStock = product ? (product.stockQuantity ?? 50) : 0;
        
        cart.setQuantity(productId, Math.min(requestedQuantity, maxStock));
        return;
      }

      const removeButton = event.target.closest(".receipt__remove");
      if (removeButton) cart.remove(removeButton.dataset.removeId);
    });

    closeButton.addEventListener("click", () => dialog.close());

    // A click landing on the dialog itself (not the panel) is a backdrop click.
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });

    dialog.addEventListener("close", () => {
      step = STEPS.CART;
      if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
    });

    // Editing quantities re-renders the open cart step only; the receipt and
    // confirmation are snapshots and must not change underneath the customer.
    cart.subscribe(() => {
      if (dialog.open && step === STEPS.CART) render();
    });

    return { open };
  }

  global.AkadCheckout = { init };
})(window);
