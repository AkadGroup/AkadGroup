// version: 2.0.0
// Composition root: builds the stores, wires them to the views, and renders
// the storefront. Product data comes from the inventory store (not the static
// catalog) so admin edits appear on the grid immediately.
(function (global) {
  "use strict";

  const { CURRENCY_LABEL, formatPrice } = global.AkadFormat;
  const { el, icon } = global.AkadDom;

  const ALL_BRANDS_ID = "all";
  const ALL_BRANDS_LABEL = "كل الماركات";
  const IN_STOCK_LABEL = "متوفر";
  const OUT_OF_STOCK_LABEL = "نفذت";
  const ADD_TO_CART_LABEL = "أضف إلى السلة";
  const UNAVAILABLE_LABEL = "غير متوفر";
  const SIGN_IN_LABEL = "تسجيل الدخول";

  const catalog = global.AkadCatalog;
  if (!catalog) {
    throw new Error("AkadCatalog is missing. Ensure js/catalog.js loads before js/app.js.");
  }

  const { BRANDS } = catalog;
  let brandsStore = null;

  const dom = {
    categoryList: document.getElementById("category-list"),
    productGrid: document.getElementById("product-grid"),
    resultsTitle: document.getElementById("results-title"),
    resultsCount: document.getElementById("results-count"),
    emptyState: document.getElementById("empty-state"),
    searchInput: document.getElementById("search-input"),
    currentYear: document.getElementById("current-year"),
    cartButton: document.getElementById("cart-button"),
    cartCount: document.getElementById("cart-count"),
    cartButtonLabel: document.getElementById("cart-button-label"),
    accountButton: document.getElementById("account-button"),
    accountLabel: document.getElementById("account-label"),
    adminButton: document.getElementById("admin-button"),
  };

  const state = {
    selectedBrandId: ALL_BRANDS_ID,
    searchTerm: "",
  };

  function buildCategoryButton({ id, label, iconId }) {
    const item = el("li");
    const categoryButton = el("button", "category");
    categoryButton.type = "button";
    categoryButton.dataset.brandId = id;
    categoryButton.setAttribute("aria-pressed", String(state.selectedBrandId === id));

    categoryButton.append(icon(iconId, "category__icon"), el("span", "category__label", label));
    item.appendChild(categoryButton);
    return item;
  }

  function renderCategories() {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(
      buildCategoryButton({ id: ALL_BRANDS_ID, label: ALL_BRANDS_LABEL, iconId: "icon-grid" })
    );
    const currentBrands = brandsStore ? brandsStore.getAll() : BRANDS;
    currentBrands.forEach((brand) => {
      fragment.appendChild(
        buildCategoryButton({ id: brand.id, label: brand.label, iconId: "icon-tag" })
      );
    });
    dom.categoryList.replaceChildren(fragment);
  }

  function syncCategorySelection() {
    dom.categoryList.querySelectorAll(".category").forEach((categoryButton) => {
      const isSelected = categoryButton.dataset.brandId === state.selectedBrandId;
      categoryButton.setAttribute("aria-pressed", String(isSelected));
      categoryButton.classList.toggle("category--active", isSelected);
    });
  }

  function buildProductMedia(product) {
    const media = el("div", "card__media");

    const isAvailable = product.stockQuantity > 0;

    media.appendChild(
      el(
        "span",
        `badge ${isAvailable ? "badge--in" : "badge--out"}`,
        isAvailable ? IN_STOCK_LABEL : OUT_OF_STOCK_LABEL
      )
    );

    if (product.image) {
      const image = el("img", "card__image");
      image.src = product.image;
      image.alt = product.title;
      image.loading = "lazy";
      media.appendChild(image);
    } else {
      // No photography yet: show a neutral placeholder instead of a broken image.
      media.appendChild(icon("icon-bottle", "card__placeholder"));
    }

    return media;
  }

  function buildAddToCartButton(product) {
    const actionButton = el("button", "button button--primary card__action");
    actionButton.type = "button";
    actionButton.dataset.productId = product.id;

    const isAvailable = product.stockQuantity > 0;

    if (isAvailable) {
      actionButton.textContent = ADD_TO_CART_LABEL;
    } else {
      // Sold-out items must not be purchasable, so disable rather than hide:
      // the price stays visible and the reason is explicit.
      actionButton.textContent = UNAVAILABLE_LABEL;
      actionButton.disabled = true;
    }
    return actionButton;
  }

  function buildProductCard(product) {
    const item = el("li", "card");
    const isAvailable = product.stockQuantity > 0;
    if (!isAvailable) item.classList.add("card--sold-out");
    item.appendChild(buildProductMedia(product));

    const body = el("div", "card__body");
    body.appendChild(el("h3", "card__title", product.title));

    const brandRow = el("p", "card__brand");
    const brand = brandsStore ? brandsStore.getById(product.brandId) : null;
    brandRow.append(
      icon("icon-store", "card__brand-icon"),
      el("span", undefined, brand ? brand.label : product.brandId)
    );
    body.appendChild(brandRow);

    const priceRow = el("p", "card__price");
    priceRow.append(
      el("span", "card__amount", formatPrice(product.price)),
      el("span", "card__currency", CURRENCY_LABEL)
    );
    body.appendChild(priceRow);
    body.appendChild(buildAddToCartButton(product));

    item.appendChild(body);
    return item;
  }

  function getVisibleProducts(products) {
    const term = state.searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesBrand =
        state.selectedBrandId === ALL_BRANDS_ID || product.brandId === state.selectedBrandId;
      if (!matchesBrand) return false;
      if (!term) return true;

      const brand = brandsStore ? brandsStore.getById(product.brandId) : null;
      const brandLabel = brand ? brand.label : (product.brandId || "");
      return (
        product.title.toLowerCase().includes(term) ||
        brandLabel.toLowerCase().includes(term)
      );
    });
  }

  function init() {
    const missingNode = Object.entries(dom).find(([, node]) => !node);
    if (missingNode) {
      throw new Error(`Required element "${missingNode[0]}" is missing from the document.`);
    }

    const storage = global.AkadStorage;
    const emitterFactory = global.AkadEmitter.createEmitter;

    brandsStore = global.AkadBrands.createBrands({
      seedBrands: catalog.BRANDS,
      storage,
      emitterFactory,
    });

    const inventory = global.AkadInventory.createInventory({
      seedProducts: catalog.PRODUCTS,
      brands: brandsStore,
      storage,
      emitterFactory,
    });
    const banners = global.AkadBanners.createBanners({ storage, emitterFactory });
    const auth = global.AkadAuth.createAuth({ storage, emitterFactory });
    const orders = global.AkadOrders.createOrders({ storage, emitterFactory });
    const cart = global.AkadCart.createCart({
      initialLines: storage.read("cart", []),
      emitterFactory,
    });

    const checkout = global.AkadCheckout.init({ cart, orders, auth, storage, inventory });
    const authUi = global.AkadAuthUi.init({ auth });
    const admin = global.AkadAdmin.init({ inventory, orders, banners, brands: brandsStore });

    function renderProducts() {
      const products = getVisibleProducts(inventory.getAll());
      const fragment = document.createDocumentFragment();
      products.forEach((product) => fragment.appendChild(buildProductCard(product)));
      dom.productGrid.replaceChildren(fragment);

      const activeBrand = brandsStore ? brandsStore.getById(state.selectedBrandId) : null;
      dom.resultsTitle.textContent =
        state.selectedBrandId === ALL_BRANDS_ID
          ? ALL_BRANDS_LABEL
          : (activeBrand ? activeBrand.label : ALL_BRANDS_LABEL);
      dom.resultsCount.textContent = `${products.length} منتج`;
      dom.emptyState.hidden = products.length > 0;
    }

    function renderCartBadge() {
      const itemCount = cart.getItemCount();
      dom.cartCount.textContent = String(itemCount);
      dom.cartCount.hidden = itemCount === 0;
      dom.cartButtonLabel.textContent =
        itemCount === 0 ? "سلة التسوق فارغة" : `سلة التسوق: ${itemCount} عنصر`;
    }

    let notificationHistory = storage.read("notifications", []);

    function addNotification(notif) {
      notif.id = Date.now().toString() + Math.random().toString(36).slice(2);
      notif.read = false;
      notif.timestamp = new Date().toISOString();
      notificationHistory.unshift(notif);
      if (notificationHistory.length > 50) notificationHistory.length = 50;
      storage.write("notifications", notificationHistory);
      
      if (auth.isAdmin()) {
        global.AkadToast.show(notif.message, notif.type);
        renderNotifications();
      }
    }

    function renderNotifications() {
      if (!auth.isAdmin()) {
        document.getElementById("notifications-button").hidden = true;
        document.getElementById("notifications-dropdown").hidden = true;
        return;
      }
      document.getElementById("notifications-button").hidden = false;
      
      const unreadCount = notificationHistory.filter(n => !n.read).length;
      const countEl = document.getElementById("notifications-count");
      countEl.textContent = unreadCount > 9 ? "9+" : unreadCount;
      countEl.hidden = unreadCount === 0;

      const listEl = document.getElementById("notifications-list");
      listEl.replaceChildren();

      if (notificationHistory.length === 0) {
        const empty = el("div", "notification-item", "لا توجد إشعارات.");
        empty.style.textAlign = "center";
        listEl.appendChild(empty);
      } else {
        notificationHistory.forEach(notif => {
          const item = el("div", "notification-item");
          if (!notif.read) item.classList.add("notification-item--unread");
          
          const msg = el("div", undefined, notif.message);
          const time = el("div", undefined, new Date(notif.timestamp).toLocaleTimeString("en-GB"));
          time.style.fontSize = "10px";
          time.style.marginTop = "4px";
          time.style.opacity = "0.7";
          
          item.append(msg, time);
          
          item.addEventListener("click", () => {
            notif.read = true;
            storage.write("notifications", notificationHistory);
            renderNotifications();
          });
          
          listEl.appendChild(item);
        });
      }
    }

    document.getElementById("notifications-button").addEventListener("click", (e) => {
      const dropdown = document.getElementById("notifications-dropdown");
      dropdown.hidden = !dropdown.hidden;
      e.stopPropagation();
    });

    document.addEventListener("click", (e) => {
      const dropdown = document.getElementById("notifications-dropdown");
      const btn = document.getElementById("notifications-button");
      if (dropdown && !dropdown.hidden && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.hidden = true;
      }
    });

    let lastOrderCount = orders.getAll().length;
    orders.subscribe(() => {
      const currentOrders = orders.getAll();
      if (currentOrders.length > lastOrderCount) {
        // New orders added (assuming prepended)
        const newOrders = currentOrders.slice(0, currentOrders.length - lastOrderCount);
        // Process oldest to newest so they appear in correct order
        newOrders.reverse().forEach(order => {
          addNotification({
            message: `طلب جديد! تم استلام طلب من ${order.customerName}`,
            type: "success"
          });
          
          order.items.forEach(item => {
            const product = inventory.getById(item.id);
            if (product) {
              const currentStock = product.stockQuantity ?? 50;
              const newStock = Math.max(0, currentStock - item.quantity);
              inventory.update(product.id, { ...product, stockQuantity: newStock });
              
              if (newStock < 5) {
                addNotification({
                  message: `تنبيه انخفاض المخزون: تبقى أقل من 5 قطع من ${product.title}`,
                  type: "warning"
                });
              }
            }
          });
        });
      }
      lastOrderCount = currentOrders.length;
    });

    function renderSession() {
      const session = auth.getSession();
      dom.accountLabel.textContent = session ? session.username : SIGN_IN_LABEL;
      // The dashboard entry point only exists for admins.
      dom.adminButton.hidden = !auth.isAdmin();
      renderNotifications();
    }

    cart.subscribe(() => {
      storage.write("cart", cart.getLines());
      renderCartBadge();
    });
    inventory.subscribe(renderProducts);
    auth.subscribe(renderSession);
    brandsStore.subscribe(() => {
      renderCategories();
      syncCategorySelection();
    });

    dom.currentYear.textContent = String(new Date().getFullYear());
    renderCategories();
    syncCategorySelection();
    renderProducts();
    renderCartBadge();
    renderSession();

    function renderBanners() {
      const track = document.getElementById("carousel-track");
      if (!track) return;
      const allBanners = banners.getAll();
      const fragment = document.createDocumentFragment();
      allBanners.forEach((b) => {
        const slide = el("div", "carousel__slide");
        const img = el("img", "carousel__image");
        img.src = b.image;
        slide.appendChild(img);
        fragment.appendChild(slide);
      });
      track.replaceChildren(fragment);
      
      const carousel = document.getElementById("main-carousel");
      if (carousel) {
        const cloned = carousel.cloneNode(true);
        carousel.replaceWith(cloned);
      }
      
      if (global.AkadCarousel) {
        global.AkadCarousel.init();
      }
    }

    renderBanners();
    banners.subscribe(renderBanners);

    dom.categoryList.addEventListener("click", (event) => {
      const categoryButton = event.target.closest(".category");
      if (!categoryButton) return;
      state.selectedBrandId = categoryButton.dataset.brandId;
      syncCategorySelection();
      renderProducts();
    });

    dom.searchInput.addEventListener("input", (event) => {
      state.searchTerm = event.target.value;
      renderProducts();
    });

    dom.productGrid.addEventListener("click", (event) => {
      const actionButton = event.target.closest(".card__action");
      if (!actionButton || actionButton.disabled) return;

      const product = inventory.getById(actionButton.dataset.productId);
      if (!product) {
        console.error(`[App] Add to cart failed: unknown product "${actionButton.dataset.productId}".`);
        return;
      }

      const currentCartLine = cart.getLines().find(line => line.id === product.id);
      const currentQuantity = currentCartLine ? currentCartLine.quantity : 0;
      const maxStock = product.stockQuantity ?? 50;

      if (currentQuantity + 1 > maxStock) {
        global.AkadToast.show(`عذراً، لا يمكنك إضافة المزيد. الكمية المتاحة هي ${maxStock} فقط`, "warning");
        return;
      }

      cart.add(product);
    });

    dom.cartButton.addEventListener("click", () => checkout.open(dom.cartButton));
    dom.accountButton.addEventListener("click", () => authUi.open(dom.accountButton));
    dom.adminButton.addEventListener("click", () => {
      if (!auth.isAdmin()) return; // Affordance guard; real auth is server-side.
      admin.open(dom.adminButton);
    });
    
    const themeToggleButton = document.getElementById("theme-toggle");
    const themeIconUse = document.getElementById("theme-icon-use");
    if (themeToggleButton && themeIconUse) {
      // Sync initial icon state
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      themeIconUse.setAttribute("href", isDark ? "#icon-sun" : "#icon-moon");
      
      themeToggleButton.addEventListener("click", () => {
        const currentDark = document.documentElement.getAttribute("data-theme") === "dark";
        const newTheme = currentDark ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
        themeIconUse.setAttribute("href", newTheme === "dark" ? "#icon-sun" : "#icon-moon");
      });
    }

    // Mobile Menu
    const mobileMenuBtn = document.getElementById("mobile-menu-btn");
    const mobileDrawer = document.getElementById("mobile-drawer");
    const mobileDrawerOverlay = document.getElementById("mobile-drawer-overlay");
    const mobileMenuClose = document.getElementById("mobile-menu-close");
    const headerActions = document.querySelector(".header-actions");
    const drawerBody = document.getElementById("mobile-drawer-body");
    
    // Elements to move
    const btnAccount = document.getElementById("account-button");
    const btnAdmin = document.getElementById("admin-button");
    const btnTheme = document.getElementById("theme-toggle");
    
    function toggleMobileMenu() {
      if (!mobileDrawer) return;
      const isHidden = mobileDrawer.hidden;
      mobileDrawer.hidden = !isHidden;
      
      if (isHidden) {
        // Opening: move buttons to drawer
        if (btnTheme) drawerBody.appendChild(btnTheme);
        if (btnAccount) drawerBody.appendChild(btnAccount);
        if (btnAdmin) drawerBody.appendChild(btnAdmin);
      } else {
        // Closing: move buttons back to header
        if (btnAdmin) headerActions.insertBefore(btnAdmin, dom.cartButton);
        if (btnAccount) headerActions.insertBefore(btnAccount, dom.cartButton);
        if (btnTheme) headerActions.insertBefore(btnTheme, btnAccount || dom.cartButton);
      }
    }
    
    if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", toggleMobileMenu);
    if (mobileMenuClose) mobileMenuClose.addEventListener("click", toggleMobileMenu);
    if (mobileDrawerOverlay) mobileDrawerOverlay.addEventListener("click", toggleMobileMenu);
    
    // Handle resizing to restore desktop view
    window.addEventListener("resize", () => {
      if (window.innerWidth >= 768 && mobileDrawer && !mobileDrawer.hidden) {
        toggleMobileMenu(); // close it and restore elements
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})(window);
