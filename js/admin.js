// version: 1.0.0
// Admin dashboard: inventory CRUD and order management.
//
// The `open()` guard here is a UX affordance, not a security boundary — the
// whole store runs client-side. Real authorisation has to happen server-side.
(function (global) {
  "use strict";

  const { CURRENCY_LABEL, formatPrice } = global.AkadFormat;
  const { el, icon, button, field, setFieldError, notice } = global.AkadDom;
  const { STATUSES } = global.AkadOrders;

  const TABS = { OVERVIEW: "overview", INVENTORY: "inventory", ORDERS: "orders", BANNERS: "banners", BRANDS: "brands" };

  const TEXT = {
    title: "لوحة التحكم",
    tabOverview: "نظرة عامة",
    tabInventory: "المخزون",
    tabOrders: "الطلبات",
    tabBanners: "البنرات",
    totalOrders: "إجمالي الطلبات",
    totalRevenue: "إجمالي المبيعات",
    topProduct: "المنتج الأكثر مبيعاً",
    recentOrders: "أحدث الطلبات",
    overviewNoData: "لا توجد بيانات",
    addProduct: "إضافة منتج",
    editProduct: "تعديل المنتج",
    newProduct: "منتج جديد",
    addBanner: "إضافة بنر",
    editBanner: "تعديل البنر",
    newBanner: "بنر جديد",
    save: "حفظ",
    cancel: "إلغاء",
    edit: "تعديل",
    delete: "حذف",
    confirmDelete: "تأكيد الحذف",
    productTitle: "اسم المنتج",
    brand: "الماركة",
    price: "السعر",
    imageUrl: "رابط الصورة (اختياري)",
    bannerImage: "صورة البنر",
    stockStatus: "الحالة",
    inStock: "متوفر",
    outOfStock: "نفذت",
    columnProduct: "المنتج",
    columnBrand: "الماركة",
    columnPrice: "السعر",
    columnStock: "الحالة",
    columnActions: "إجراءات",
    columnBanner: "صورة البنر",
    orderId: "رقم الطلب",
    customer: "الزبون",
    total: "الإجمالي",
    status: "الحالة",
    date: "التاريخ",
    viewDetails: "عرض التفاصيل",
    orderDetails: "تفاصيل الطلب",
    backToOrders: "رجوع إلى الطلبات",
    noOrders: "لا توجد طلبات بعد.",
    noBanners: "لا توجد بنرات.",
    orderItems: "محتويات الطلب",
    contactInfo: "معلومات الزبون",
    account: "الحساب",
    guestAccount: "طلب كزائر",
    quantity: "الكمية",
    unitPrice: "سعر الوحدة",
    lineTotal: "المجموع",
    changeStatus: "تغيير الحالة",
    saved: "تم حفظ التغييرات.",
    deleted: "تم الحذف بنجاح.",
  };

  const STATUS_LABELS = {
    processing: "قيد المعالجة",
    shipped: "تم الشحن",
    delivered: "تم التسليم",
    cancelled: "ملغي",
  };

  const PRODUCT_ERRORS = {
    TITLE_TOO_SHORT: "اسم المنتج يجب أن يكون 3 أحرف على الأقل.",
    INVALID_PRICE: "أدخل سعرًا صحيحًا.",
    UNKNOWN_BRAND: "اختر ماركة صحيحة.",
    INVALID_IMAGE_URL: "صيغة الصورة غير مدعومة، الرجاء اختيار صورة صحيحة.",
    PRODUCT_NOT_FOUND: "لم يعد هذا المنتج موجودًا.",
  };

  const BANNER_ERRORS = {
    MISSING_IMAGE: "يجب اختيار صورة للبنر.",
    INVALID_IMAGE_URL: "صيغة الصورة غير مدعومة.",
    BANNER_NOT_FOUND: "لم يعد هذا البنر موجودًا."
  };

  function formatDate(isoString) {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function moneyCell(amount, tagName = "td") {
    const cell = el(tagName, "receipt__money");
    cell.append(
      el("span", undefined, formatPrice(amount)),
      el("span", "receipt__currency", CURRENCY_LABEL)
    );
    return cell;
  }

  function statusChip(status) {
    return el(
      "span",
      `chip chip--${status}`,
      STATUS_LABELS[status] || status
    );
  }

  function init({ inventory, orders, banners, brands }) {
    const dialog = document.getElementById("admin-dialog");
    const panel = document.getElementById("admin-panel");
    const tabList = document.getElementById("admin-tabs");
    const closeButton = document.getElementById("admin-close");

    if (!dialog || !panel || !tabList || !closeButton) {
      throw new Error("Admin markup is incomplete; cannot initialise the dashboard.");
    }

    const view = {
      tab: TABS.OVERVIEW,
      editingProductId: null, // null = list, "new" = blank form, id = edit
      editingBannerId: null, // null = list, "new" = blank form, id = edit
      pendingDeleteId: null,
      selectedOrderId: null,
      flash: null,
    };
    let lastFocusedElement = null;

    /* ------------------------------------------------------- inventory -- */

    function renderProductForm() {
      const isNew = view.editingProductId === "new";
      const product = isNew ? {} : inventory.getById(view.editingProductId);

      if (!product) {
        view.editingProductId = null;
        render();
        return;
      }

      const heading = el("h3", "panel__title", isNew ? TEXT.newProduct : TEXT.editProduct);
      const form = el("form", "form form--grid");
      form.noValidate = true;

      const fields = {
        title: field({
          id: "product-title",
          label: TEXT.productTitle,
          value: product.title || "",
        }),
        brandId: field({
          id: "product-brand",
          label: TEXT.brand,
          value: product.brandId || brands.getAll()[0]?.id,
          options: brands.getAll().map((brand) => ({ value: brand.id, label: brand.label })),
        }),
        price: field({
          id: "product-price",
          label: `${TEXT.price} (${CURRENCY_LABEL})`,
          type: "number",
          value: product.price ?? "",
        }),
        stockQuantity: field({
          id: "product-qty",
          label: "الكمية المتوفرة", // Stock Quantity
          type: "number",
          value: product.stockQuantity ?? 50,
        }),
      };

      let base64Image = product.image || "";

      const imageField = field({
        id: "product-image",
        label: "صورة المنتج (رفع ملف)",
        type: "file",
        value: "",
        required: false,
      });
      imageField.input.accept = "image/*";

      const imagePreview = el("img", "table__thumbnail");
      imagePreview.style.marginTop = "var(--space-1)";
      imagePreview.style.display = base64Image ? "block" : "none";
      imagePreview.src = base64Image;
      imageField.wrapper.appendChild(imagePreview);

      imageField.input.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            base64Image = ev.target.result;
            imagePreview.src = base64Image;
            imagePreview.style.display = "block";
          };
          reader.readAsDataURL(file);
        }
      });

      fields.image = imageField;

      Object.values(fields).forEach((part) => form.appendChild(part.wrapper));

      const save = button(TEXT.save, "button button--primary", async () => {
        Object.values(fields).forEach((part) => setFieldError(part, ""));
        form.querySelector(".notice")?.remove();

        const supabase = global.AkadSupabase?.client;
        let finalImageUrl = base64Image;
        const imageFile = fields.image.input.files[0];

        try {
          save.disabled = true;
          save.textContent = "جاري الحفظ...";

          if (imageFile && supabase) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const { data, error } = await supabase.storage.from("products").upload(fileName, imageFile);
            
            if (error) {
               throw new Error("فشل رفع الصورة: " + error.message);
            }
            
            const { data: publicUrlData } = supabase.storage.from("products").getPublicUrl(fileName);
            finalImageUrl = publicUrlData.publicUrl;
          }

          const draft = {
            title: fields.title.input.value,
            brandId: fields.brandId.input.value,
            price: Number(fields.price.input.value),
            stockQuantity: Number(fields.stockQuantity.input.value),
            inStock: Number(fields.stockQuantity.input.value) > 0,
            image: finalImageUrl,
          };

          if (isNew) {
            await inventory.add(draft);
          } else {
            await inventory.update(view.editingProductId, draft);
          }
          view.editingProductId = null;
          view.flash = { tone: "success", message: TEXT.saved };
          render();
        } catch (error) {
          save.disabled = false;
          save.textContent = TEXT.save;
          const message = PRODUCT_ERRORS[error.message] || error.message;
          if (!PRODUCT_ERRORS[error.message]) console.error("[Admin] Unexpected product error.", error);
          form.appendChild(notice(message || "تعذر حفظ المنتج.", "error"));
        }
      });

      const cancel = button(TEXT.cancel, "button button--ghost", () => {
        view.editingProductId = null;
        render();
      });

      const actions = el("div", "panel__actions");
      actions.append(cancel, save);

      panel.replaceChildren(heading, form, actions);
      fields.title.input.focus();
    }

    function buildInventoryRow(product) {
      const row = el("tr");

      const imgCell = el("td");
      if (product.image) {
        const img = el("img", "table__thumbnail");
        img.src = product.image;
        img.alt = product.title;
        imgCell.appendChild(img);
      } else {
        const placeholder = el("div", "table__thumbnail");
        placeholder.style.display = "grid";
        placeholder.style.placeItems = "center";
        placeholder.appendChild(icon("icon-bottle"));
        imgCell.appendChild(placeholder);
      }
      row.appendChild(imgCell);

      row.appendChild(el("td", "receipt__name", product.title));
      
      const brand = brands.getById(product.brandId);
      row.appendChild(
        el("td", undefined, brand ? brand.label : product.brandId)
      );
      row.appendChild(moneyCell(product.price));

      const stockCell = el("td");
      const isAvailable = (product.stockQuantity ?? 50) > 0;
      stockCell.appendChild(
        el(
          "span",
          isAvailable ? "chip chip--in" : "chip chip--out",
          isAvailable ? TEXT.inStock : TEXT.outOfStock
        )
      );
      if (product.stockQuantity !== undefined) {
        const qtySpan = el("span", undefined, ` (${product.stockQuantity})`);
        qtySpan.style.fontSize = "var(--font-size-sm)";
        qtySpan.style.color = "var(--color-text-muted)";
        qtySpan.style.marginRight = "var(--space-1)";
        stockCell.appendChild(qtySpan);
      }
      row.appendChild(stockCell);

      const actionCell = el("td", "table__actions");
      if (view.pendingDeleteId === product.id) {
        actionCell.append(
          button(TEXT.confirmDelete, "button button--danger button--small", () => {
            try {
              inventory.remove(product.id);
              view.flash = { tone: "success", message: TEXT.deleted };
            } catch (error) {
              console.error("[Admin] Delete failed.", error);
              view.flash = { tone: "error", message: PRODUCT_ERRORS[error.message] };
            }
            view.pendingDeleteId = null;
            render();
          }),
          button(TEXT.cancel, "button button--ghost button--small", () => {
            view.pendingDeleteId = null;
            render();
          })
        );
      } else {
        const editButton = button("", "icon-button", () => {
          view.editingProductId = product.id;
          render();
        });
        editButton.setAttribute("aria-label", `${TEXT.edit}: ${product.title}`);
        editButton.appendChild(icon("icon-edit"));

        const deleteButton = button("", "icon-button icon-button--danger", () => {
          view.pendingDeleteId = product.id;
          render();
        });
        deleteButton.setAttribute("aria-label", `${TEXT.delete}: ${product.title}`);
        deleteButton.appendChild(icon("icon-trash"));

        actionCell.append(editButton, deleteButton);
      }
      row.appendChild(actionCell);
      return row;
    }

    function renderInventoryList() {
      const header = el("div", "panel__header");
      
      const headerTop = el("div", "panel__header-top");
      headerTop.appendChild(el("h3", "panel__title", TEXT.tabInventory));
      
      const toolbar = el("div", "admin-toolbar");
      const searchWrapper = el("div", "admin-search");
      searchWrapper.appendChild(icon("icon-search", "admin-search__icon"));
      
      const searchInput = el("input", "admin-search__input");
      searchInput.type = "search";
      searchInput.placeholder = "بحث باسم المنتج أو الماركة...";
      
      searchWrapper.appendChild(searchInput);
      
      toolbar.append(
        searchWrapper,
        button(TEXT.addProduct, "button button--primary", () => {
          view.editingProductId = "new";
          render();
        })
      );
      
      header.append(headerTop, toolbar);

      const table = el("table", "table");
      const headRow = el("tr");
      ["الصورة", TEXT.columnProduct, TEXT.columnBrand, TEXT.columnPrice, TEXT.columnStock, TEXT.columnActions]
        .forEach((label) => {
          const cell = el("th", undefined, label);
          cell.scope = "col";
          headRow.appendChild(cell);
        });
      const thead = el("thead");
      thead.appendChild(headRow);

      const tbody = el("tbody");
      inventory.getAll().forEach((product) => tbody.appendChild(buildInventoryRow(product)));
      
      searchInput.addEventListener("input", (e) => {
        const term = e.target.value.trim().toLowerCase();
        Array.from(tbody.children).forEach(row => {
          const text = row.textContent.toLowerCase();
          row.style.display = text.includes(term) ? "" : "none";
        });
      });

      table.append(thead, tbody);

      const scroll = el("div", "table-scroll");
      scroll.appendChild(table);

      const children = [header];
      if (view.flash) children.push(notice(view.flash.message, view.flash.tone));
      children.push(scroll);

      panel.replaceChildren(...children);
      view.flash = null;
    }

    /* ---------------------------------------------------------- orders -- */

    function renderOrderDetails() {
      const order = orders.getById(view.selectedOrderId);
      if (!order) {
        view.selectedOrderId = null;
        render();
        return;
      }

      const header = el("div", "panel__header");
      const headerTop = el("div", "panel__header-top");
      const backBtn = button(TEXT.back, "button button--ghost", () => {
        view.selectedOrderId = null;
        render();
      });
      
      const printBtn = button("طباعة الطلب", "button button--primary", () => {
        window.print();
      });
      printBtn.prepend(icon("icon-print", "button__icon"));
      
      headerTop.append(backBtn, el("h3", "panel__title", `${TEXT.orderDetails}: ${order.id}`), printBtn);
      header.appendChild(headerTop);

      const statusRow = el("div", "field field--inline status-row");
      const statusLabel = el("label", "field__label", TEXT.changeStatus);
      statusLabel.htmlFor = "order-status";
      const select = el("select", "field__input");
      select.id = "order-status";
      STATUSES.forEach((status) => {
        const option = el("option", undefined, STATUS_LABELS[status]);
        option.value = status;
        if (status === order.status) option.selected = true;
        select.appendChild(option);
      });
      select.addEventListener("change", () => {
        try {
          orders.setStatus(order.id, select.value);
        } catch (error) {
          console.error("[Admin] Could not update order status.", error);
        }
      });
      statusRow.append(statusLabel, select);

      const markDeliveredBtn = button("تأكيد التسليم للزبون", "button button--primary", () => {
        try {
          orders.setStatus(order.id, "delivered");
        } catch (error) {
          console.error("[Admin] Could not mark as delivered.", error);
        }
      });
      
      if (order.status === "delivered" || order.status === "cancelled") {
        markDeliveredBtn.disabled = true;
      }

      const statusActions = el("div");
      statusActions.style.display = "flex";
      statusActions.style.gap = "var(--space-4)";
      statusActions.style.alignItems = "flex-end";
      statusActions.style.justifyContent = "space-between";
      statusActions.style.marginBottom = "var(--space-4)";
      statusActions.append(statusRow, markDeliveredBtn);

      const contact = el("section", "summary");
      contact.appendChild(el("h4", "summary__title", TEXT.contactInfo));
      
      const contactTable = el("table", "table");
      const contactTbody = el("tbody");

      [
        ["الاسم الكامل", order.shipping.fullName],
        ["رقم الهاتف", order.shipping.phone],
        ["المحافظة / المدينة", order.shipping.city],
        ["العنوان التفصيلي", order.shipping.address],
        ["أقرب نقطة دالة", order.shipping.landmark],
        [TEXT.account, order.accountEmail || TEXT.guestAccount],
        [TEXT.date, formatDate(order.createdAt)],
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
        contactTbody.appendChild(tr);
      });
      contactTable.appendChild(contactTbody);
      contact.appendChild(contactTable);

      const table = el("table", "receipt");
      const headRow = el("tr");
      [TEXT.columnProduct, TEXT.quantity, TEXT.unitPrice, TEXT.lineTotal].forEach((label) => {
        const cell = el("th", undefined, label);
        cell.scope = "col";
        headRow.appendChild(cell);
      });
      const thead = el("thead");
      thead.appendChild(headRow);

      const tbody = el("tbody");
      order.items.forEach((item) => {
        const row = el("tr");
        row.append(
          el("td", "receipt__name", item.title),
          el("td", undefined, String(item.quantity)),
          moneyCell(item.price),
          moneyCell(item.price * item.quantity)
        );
        tbody.appendChild(row);
      });

      const totalRow = el("tr", "receipt__total-row");
      const totalLabel = el("th", undefined, TEXT.total);
      totalLabel.scope = "row";
      totalLabel.colSpan = 3;
      totalRow.append(totalLabel, moneyCell(order.total));
      const tfoot = el("tfoot");
      tfoot.appendChild(totalRow);

      table.append(thead, tbody, tfoot);

      panel.replaceChildren(
        header,
        statusActions,
        el("h4", "summary__title", TEXT.orderItems),
        table,
        contact
      );
    }

    function renderOrdersList() {
      const allOrders = orders.getAll();

      const header = el("div", "panel__header");
      header.appendChild(el("h3", "panel__title", TEXT.tabOrders));

      if (allOrders.length === 0) {
        panel.replaceChildren(header, el("p", "modal__empty", TEXT.noOrders));
        return;
      }

      const table = el("table", "table");
      const headRow = el("tr");
      [TEXT.orderId, TEXT.customer, "المحافظة", TEXT.total, TEXT.date, TEXT.status, ""].forEach((label) => {
        const cell = el("th", undefined, label);
        cell.scope = "col";
        headRow.appendChild(cell);
      });
      const thead = el("thead");
      thead.appendChild(headRow);

      const tbody = el("tbody");
      allOrders.forEach((order) => {
        const row = el("tr");
        
        const idCell = el("td", "receipt__name");
        const idBtn = button(order.id, "", () => {
          view.selectedOrderId = order.id;
          render();
        });
        idBtn.style.color = "var(--color-primary)";
        idBtn.style.textDecoration = "underline";
        idBtn.style.padding = "0";
        idBtn.style.minHeight = "0";
        idBtn.style.background = "none";
        idCell.appendChild(idBtn);

        // Combine Customer and Phone to save space
        const customerCell = el("td");
        customerCell.innerHTML = `<strong>${order.customerName}</strong><br/><span style="color:var(--color-text-muted);font-size:0.85em;">${order.shipping.phone}</span>`;

        row.append(
          idCell,
          customerCell,
          el("td", undefined, order.shipping.city),
          moneyCell(order.total),
          el("td", undefined, formatDate(order.createdAt).replace(", ", "\n"))
        );

        row.lastChild.style.whiteSpace = "pre-line"; // Allow date to wrap

        const statusCell = el("td");
        statusCell.appendChild(statusChip(order.status));
        row.appendChild(statusCell);

        const actionCell = el("td", "table__actions");
        
        const printButton = button("", "icon-button", () => {
          view.selectedOrderId = order.id;
          render();
          setTimeout(() => window.print(), 50); // wait for render
        });
        printButton.setAttribute("aria-label", `طباعة الطلب: ${order.id}`);
        printButton.appendChild(icon("icon-print"));

        const deleteButton = button("", "icon-button", () => {
          if (window.confirm("هل أنت متأكد من حذف هذا الطلب بشكل نهائي؟")) {
            try {
              orders.remove(order.id);
            } catch (error) {
              console.error("[Admin] Delete order failed.", error);
            }
          }
        });
        deleteButton.setAttribute("aria-label", `حذف الطلب: ${order.id}`);
        deleteButton.appendChild(icon("icon-trash"));
        
        actionCell.append(printButton, deleteButton);
        row.appendChild(actionCell);

        tbody.appendChild(row);
      });

      table.append(thead, tbody);
      const scroll = el("div", "table-scroll");
      scroll.appendChild(table);
      panel.replaceChildren(header, scroll);
    }

    /* --------------------------------------------------------- banners -- */

    function renderBannerForm() {
      const isNew = view.editingBannerId === "new";
      const banner = isNew ? {} : banners.getById(view.editingBannerId);

      if (!banner) {
        view.editingBannerId = null;
        render();
        return;
      }

      const heading = el("h3", "panel__title", isNew ? TEXT.newBanner : TEXT.editBanner);
      const form = el("form", "form form--grid");
      form.noValidate = true;

      let base64Image = banner.image || "";

      const imageField = field({
        id: "banner-image",
        label: TEXT.bannerImage,
        type: "file",
        value: "",
        required: true,
      });
      imageField.input.accept = "image/*";

      const imagePreview = el("img", "table__thumbnail");
      imagePreview.style.width = "100%";
      imagePreview.style.aspectRatio = "8 / 1";
      imagePreview.style.marginTop = "var(--space-1)";
      imagePreview.style.display = base64Image ? "block" : "none";
      imagePreview.src = base64Image;
      imageField.wrapper.appendChild(imagePreview);

      imageField.input.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            base64Image = ev.target.result;
            imagePreview.src = base64Image;
            imagePreview.style.display = "block";
          };
          reader.readAsDataURL(file);
        }
      });

      form.appendChild(imageField.wrapper);

      const save = button(TEXT.save, "button button--primary", () => {
        setFieldError(imageField, "");
        form.querySelector(".notice")?.remove();

        const draft = { image: base64Image };

        try {
          if (isNew) {
            banners.add(draft);
          } else {
            banners.update(view.editingBannerId, draft);
          }
          view.editingBannerId = null;
          view.flash = { tone: "success", message: TEXT.saved };
          render();
        } catch (error) {
          const message = BANNER_ERRORS[error.message];
          form.appendChild(notice(message || "تعذر حفظ البنر.", "error"));
        }
      });

      const cancel = button(TEXT.cancel, "button button--ghost", () => {
        view.editingBannerId = null;
        render();
      });

      const actions = el("div", "panel__actions");
      actions.append(cancel, save);

      panel.replaceChildren(heading, form, actions);
    }

    function renderBannersList() {
      const allBanners = banners.getAll();

      const header = el("div", "panel__header");
      const headerTop = el("div", "panel__header-top");
      headerTop.appendChild(el("h3", "panel__title", TEXT.tabBanners));
      
      const toolbar = el("div", "admin-toolbar");
      toolbar.appendChild(button(TEXT.addBanner, "button button--primary", () => {
        view.editingBannerId = "new";
        render();
      }));
      header.append(headerTop, toolbar);

      if (allBanners.length === 0) {
        panel.replaceChildren(header, el("p", "modal__empty", TEXT.noBanners));
        return;
      }

      const table = el("table", "table");
      const headRow = el("tr");
      [TEXT.columnBanner, TEXT.columnActions].forEach((label) => {
        const cell = el("th", undefined, label);
        cell.scope = "col";
        headRow.appendChild(cell);
      });
      const thead = el("thead");
      thead.appendChild(headRow);

      const tbody = el("tbody");
      allBanners.forEach((banner) => {
        const row = el("tr");
        
        const imgCell = el("td");
        const img = el("img", "table__thumbnail");
        img.style.width = "120px";
        img.style.aspectRatio = "8 / 1";
        img.src = banner.image;
        imgCell.appendChild(img);
        row.appendChild(imgCell);

        const actionCell = el("td", "table__actions");
        
        const editBtn = button("", "icon-button", () => {
          view.editingBannerId = banner.id;
          render();
        });
        editBtn.setAttribute("aria-label", TEXT.edit);
        editBtn.appendChild(icon("icon-edit"));

        const deleteBtn = button("", "icon-button", () => {
          if (window.confirm(TEXT.confirmDelete + "؟")) {
            try {
              banners.remove(banner.id);
            } catch (error) {
              console.error("[Admin] Delete banner failed.", error);
            }
          }
        });
        deleteBtn.setAttribute("aria-label", TEXT.delete);
        deleteBtn.appendChild(icon("icon-trash"));

        actionCell.append(editBtn, deleteBtn);
        row.appendChild(actionCell);
        tbody.appendChild(row);
      });

      table.append(thead, tbody);
      const scroll = el("div", "table-scroll");
      scroll.appendChild(table);

      const children = [header];
      if (view.flash) children.push(notice(view.flash.message, view.flash.tone));
      children.push(scroll);

      panel.replaceChildren(...children);
      view.flash = null;
    }

    /* ------------------------------------------------------- overview -- */

    function renderOverview() {
      // 7-day window
      const now = new Date().getTime();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

      // Filter orders to last 7 days
      const allOrders = orders.getAll().filter(order => {
        const orderTime = new Date(order.createdAt).getTime();
        return orderTime >= sevenDaysAgo;
      });
      
      const header = el("div", "panel__header");
      const headerTop = el("div", "panel__header-top");
      headerTop.appendChild(el("h3", "panel__title", TEXT.tabOverview + " (آخر 7 أيام)"));
      header.appendChild(headerTop);

      // Calculations
      const totalCount = allOrders.length;
      let totalRevenue = 0;
      const productCounts = {};

      allOrders.forEach((order) => {
        totalRevenue += order.total;
        order.items.forEach((item) => {
          productCounts[item.id] = (productCounts[item.id] || 0) + item.quantity;
        });
      });

      // Sort products by count
      const sortedProducts = Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3); // Top 3

      const topProductsList = el("ul", "kpi-card__list");
      if (sortedProducts.length === 0) {
        topProductsList.appendChild(el("li", undefined, TEXT.overviewNoData));
      } else {
        sortedProducts.forEach(([id, count]) => {
          let title = TEXT.overviewNoData;
          const product = inventory.getById(id);
          if (product) {
            title = product.title;
          } else {
            const anyOrderWithItem = allOrders.find(o => o.items.some(i => i.id === id));
            const itemInOrder = anyOrderWithItem?.items.find(i => i.id === id);
            if (itemInOrder) title = itemInOrder.title;
          }
          const li = el("li");
          li.textContent = `${title} (${count})`;
          li.style.fontSize = "var(--font-size-sm)";
          li.style.whiteSpace = "nowrap";
          li.style.overflow = "hidden";
          li.style.textOverflow = "ellipsis";
          topProductsList.appendChild(li);
        });
      }

      // 1. KPI Summary Cards
      const kpiGrid = el("div", "overview__kpi-grid");

      function createCard(title, value, iconId) {
        const card = el("div", "kpi-card");
        const headerRow = el("div", "kpi-card__header");
        headerRow.append(
          el("h4", "kpi-card__title", title),
          icon(iconId, "kpi-card__icon")
        );
        const body = el("div", "kpi-card__value");
        if (typeof value === "string") {
          body.textContent = value;
        } else {
          body.appendChild(value);
        }
        card.append(headerRow, body);
        return card;
      }

      const totalOrdersCard = createCard(TEXT.totalOrders, totalCount > 0 ? String(totalCount) : "0", "icon-bag");
      
      const revValue = el("span");
      if (totalCount > 0) {
        revValue.textContent = formatPrice(totalRevenue) + " ";
        const tag = el("small", undefined, CURRENCY_LABEL);
        revValue.appendChild(tag);
      } else {
        revValue.textContent = "0";
      }
      const totalRevenueCard = createCard(TEXT.totalRevenue, revValue, "icon-wallet");

      const topProductCard = createCard("أفضل 3 منتجات", topProductsList, "icon-trending");

      // Top Customers Calculation
      const customerSpent = {};
      
      allOrders.forEach((order) => {
        // Group by Email first (for registered users), then Phone (for guests)
        const customerKey = order.accountEmail || order.phone || order.customerName;
        const displayName = order.customerName || "Guest";
        
        if (!customerSpent[customerKey]) {
          customerSpent[customerKey] = { 
            name: displayName, 
            phone: order.phone || "لا يوجد", 
            totalSpent: 0 
          };
        }
        
        // Summing only the prices of this specific customer's orders
        customerSpent[customerKey].totalSpent += order.total;
      });

      // Sort in descending order and extract exactly top 3
      const sortedCustomers = Object.values(customerSpent)
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 3);
        
      const topCustomersList = el("ul", "kpi-card__list");
      if (sortedCustomers.length === 0) {
        topCustomersList.appendChild(el("li", undefined, TEXT.overviewNoData));
      } else {
        sortedCustomers.forEach(customer => {
          const li = el("li");
          
          // Partially hide phone for privacy (e.g. 078XXXX123)
          let hiddenPhone = customer.phone;
          if (hiddenPhone.length > 6) {
            hiddenPhone = hiddenPhone.substring(0, 3) + "****" + hiddenPhone.substring(hiddenPhone.length - 3);
          }
          
          const amount = formatPrice(customer.totalSpent) + " " + CURRENCY_LABEL;
          li.innerHTML = `<strong>${customer.name}</strong> <span style="color:var(--color-text-muted);font-size:0.85em;">(${hiddenPhone})</span><br/><span style="color:var(--color-primary);font-weight:bold;">${amount}</span>`;
          li.style.fontSize = "var(--font-size-sm)";
          li.style.whiteSpace = "nowrap";
          li.style.overflow = "hidden";
          li.style.textOverflow = "ellipsis";
          li.style.borderBottom = "1px solid var(--color-border)";
          li.style.paddingBottom = "4px";
          li.style.marginBottom = "4px";
          topCustomersList.appendChild(li);
        });
        // Remove border from last item
        if (topCustomersList.lastChild) {
           topCustomersList.lastChild.style.borderBottom = "none";
           topCustomersList.lastChild.style.marginBottom = "0";
        }
      }
      
      const topCustomersCard = createCard("أفضل 3 زبائن", topCustomersList, "icon-user");

      kpiGrid.append(totalOrdersCard, totalRevenueCard, topProductCard, topCustomersCard);

      // 2. Recent Activity Section
      const recentSection = el("div", "overview__recent");
      const recentTitle = el("h3", "panel__title", TEXT.recentOrders);
      recentTitle.style.marginTop = "var(--space-4)";
      recentTitle.style.marginBottom = "var(--space-2)";
      recentSection.appendChild(recentTitle);

      const recentList = allOrders.slice(0, 5);
      
      if (recentList.length === 0) {
        recentSection.appendChild(el("p", "modal__empty", TEXT.overviewNoData));
      } else {
        const table = el("table", "table");
        const thead = el("thead");
        const tr = el("tr");
        [TEXT.customer, TEXT.total, TEXT.status].forEach(label => {
          const th = el("th", undefined, label);
          th.scope = "col";
          tr.appendChild(th);
        });
        thead.appendChild(tr);
        
        const tbody = el("tbody");
        recentList.forEach(order => {
          const r = el("tr");
          r.append(
            el("td", undefined, order.customerName),
            moneyCell(order.total),
            el("td", undefined, statusChip(order.status))
          );
          tbody.appendChild(r);
        });

        table.append(thead, tbody);
        recentSection.appendChild(table);
      }

      panel.replaceChildren(header, kpiGrid, recentSection);
    }

    /* --------------------------------------------------------- brands -- */

    function renderBrandsList() {
      const allBrands = brands.getAll();
      const header = el("div", "panel__header");
      const title = el("h3", "panel__title", "إدارة الماركات والأقسام");
      
      const addButton = button("إضافة ماركة جديدة", "button button--primary", () => {
        view.editingBrandId = "new";
        render();
      });
      addButton.prepend(icon("icon-plus", "button__icon"));
      header.append(title, addButton);

      if (allBrands.length === 0) {
        panel.replaceChildren(header, el("p", "modal__empty", "لا توجد ماركات."));
        return;
      }

      const table = el("table", "table");
      const headRow = el("tr");
      ["الاسم (Label)", "المعرف (ID)", "إجراءات"].forEach((label) => {
        const cell = el("th", undefined, label);
        cell.scope = "col";
        headRow.appendChild(cell);
      });
      table.appendChild(el("thead", undefined, headRow));

      const tbody = el("tbody");
      allBrands.forEach((brand) => {
        const row = el("tr");
        row.append(
          el("td", "receipt__name", brand.label),
          el("td", undefined, brand.id)
        );

        const actionCell = el("td", "table__actions");
        const editBtn = button("", "icon-button", () => {
          view.editingBrandId = brand.id;
          render();
        });
        editBtn.appendChild(icon("icon-edit"));

        const deleteBtn = button("", "icon-button", () => {
          if (window.confirm(`هل أنت متأكد من حذف ${brand.label}؟`)) {
            brands.remove(brand.id);
            view.flash = { tone: "success", message: TEXT.deleted };
            render();
          }
        });
        deleteBtn.appendChild(icon("icon-trash"));

        actionCell.append(editBtn, deleteBtn);
        row.appendChild(actionCell);
        tbody.appendChild(row);
      });

      table.appendChild(tbody);
      const scroll = el("div", "table-scroll");
      scroll.appendChild(table);

      const children = [header];
      if (view.flash) children.push(notice(view.flash.message, view.flash.tone));
      children.push(scroll);
      
      panel.replaceChildren(...children);
      view.flash = null;
    }

    function renderBrandForm() {
      const isNew = view.editingBrandId === "new";
      const brand = isNew ? {} : brands.getById(view.editingBrandId);

      const heading = el("h3", "panel__title", isNew ? "ماركة جديدة" : "تعديل الماركة");
      const form = el("form", "form form--grid");
      form.noValidate = true;

      const titleField = field({
        id: "brand-title",
        label: "اسم الماركة / القسم",
        value: brand.label || "",
      });
      form.appendChild(titleField.wrapper);

      const save = button(TEXT.save, "button button--primary", () => {
        setFieldError(titleField, "");
        form.querySelector(".notice")?.remove();
        const newLabel = titleField.input.value.trim();
        
        if (!newLabel) {
          setFieldError(titleField, "الاسم مطلوب.");
          return;
        }

        try {
          if (isNew) {
            brands.add(newLabel);
          } else {
            brands.update(brand.id, newLabel);
          }
          view.editingBrandId = null;
          view.flash = { tone: "success", message: TEXT.saved };
          render();
        } catch (error) {
          form.appendChild(notice("تعذر حفظ الماركة. تأكد من أن الاسم غير متكرر.", "error"));
        }
      });

      const cancel = button(TEXT.cancel, "button button--ghost", () => {
        view.editingBrandId = null;
        render();
      });

      const actions = el("div", "panel__actions");
      actions.append(cancel, save);

      panel.replaceChildren(heading, form, actions);
      titleField.input.focus();
    }

    /* ---------------------------------------------------------- render -- */

    function renderTabs() {
      tabList.replaceChildren();
      [
        { id: TABS.OVERVIEW, label: TEXT.tabOverview, iconId: "icon-dashboard" },
        { id: TABS.INVENTORY, label: TEXT.tabInventory, iconId: "icon-box" },
        { id: TABS.ORDERS, label: TEXT.tabOrders, iconId: "icon-orders" },
        { id: TABS.BANNERS, label: TEXT.tabBanners, iconId: "icon-tag" },
        { id: TABS.BRANDS, label: "إدارة الماركات", iconId: "icon-tag" },
      ].forEach((tab) => {
        const tabButton = button(tab.label, "dashboard__tab", () => {
          view.tab = tab.id;
          view.editingProductId = null;
          view.editingBannerId = null;
          view.editingBrandId = null;
          view.selectedOrderId = null;
          view.pendingDeleteId = null;
          render();
        });
        tabButton.setAttribute("aria-current", String(view.tab === tab.id));
        if (view.tab === tab.id) tabButton.classList.add("dashboard__tab--active");
        tabButton.prepend(icon(tab.iconId, "dashboard__tab-icon"));
        tabList.appendChild(tabButton);
      });
    }

    function render() {
      renderTabs();

      if (view.tab === TABS.OVERVIEW) {
        renderOverview();
        return;
      }

      if (view.tab === TABS.INVENTORY) {
        if (view.editingProductId) {
          renderProductForm();
        } else {
          renderInventoryList();
        }
        return;
      }

      if (view.tab === TABS.BANNERS) {
        if (view.editingBannerId) {
          renderBannerForm();
        } else {
          renderBannersList();
        }
        return;
      }
      
      if (view.tab === TABS.BRANDS) {
        if (view.editingBrandId) {
          renderBrandForm();
        } else {
          renderBrandsList();
        }
        return;
      }

      if (view.selectedOrderId) {
        renderOrderDetails();
        return;
      }
      renderOrdersList();
    }

    function open(trigger) {
      lastFocusedElement = trigger instanceof HTMLElement ? trigger : document.activeElement;
      view.editingProductId = null;
      view.editingBannerId = null;
      view.selectedOrderId = null;
      view.pendingDeleteId = null;
      render();
      dialog.showModal();
    }

    closeButton.addEventListener("click", () => dialog.close());

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });

    dialog.addEventListener("close", () => {
      if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
    });

    // Keep an open dashboard current when data changes elsewhere.
    const rerenderIfOpen = () => {
      if (dialog.open) render();
    };
    inventory.subscribe(rerenderIfOpen);
    orders.subscribe(rerenderIfOpen);
    banners.subscribe(rerenderIfOpen);
    brands.subscribe(rerenderIfOpen);

    return { open };
  }

  global.AkadAdmin = { init };
})(window);
