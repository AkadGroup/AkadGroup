// version: 1.0.0
// Product inventory store: the single source of truth the storefront and the
// admin dashboard both read from, so a CRUD edit shows up on the grid
// immediately. Seeded from the static catalog on first run, then persisted.
(function (global) {
  "use strict";

  const STORAGE_KEY = "inventory";
  const MAX_PRICE = 100000000;

  function slugify(text) {
    return String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  /**
   * Validates and normalises a product draft coming from the admin form.
   * Throws with a machine-readable code the UI maps to a message.
   */
  function normaliseDraft(draft, knownBrandIds) {
    const title = String(draft.title || "").trim();
    if (title.length < 3) throw new Error("TITLE_TOO_SHORT");

    const price = Number(draft.price);
    if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE) {
      throw new Error("INVALID_PRICE");
    }

    if (!knownBrandIds.has(draft.brandId)) throw new Error("UNKNOWN_BRAND");

    const image = String(draft.image || "").trim();
    // Block javascript: URLs; allow http(s), relative paths, or base64 data URLs.
    if (image && !/^(https?:\/\/|\/|\.\/|data:image\/)/i.test(image)) {
      throw new Error("INVALID_IMAGE_URL");
    }

    const stockQuantity = draft.stockQuantity !== undefined ? Number(draft.stockQuantity) : 50;

    return {
      title,
      brandId: draft.brandId,
      price,
      inStock: stockQuantity > 0,
      stockQuantity,
      image: image || undefined,
    };
  }

  function createInventory({ seedProducts, brands, storage, emitterFactory }) {
    function getKnownBrandIds() {
      const list = typeof brands.getAll === 'function' ? brands.getAll() : brands;
      return new Set(list.map((brand) => brand.id));
    }
    const emitter = emitterFactory();

    // Start with local storage for instant render, then sync from Supabase
    let products = storage.read(STORAGE_KEY, null);
    if (!Array.isArray(products) || products.length === 0) {
      products = seedProducts.map((product) => ({ stockQuantity: 50, ...product }));
      storage.write(STORAGE_KEY, products);
    }

    const supabase = global.AkadSupabase?.client;

    // Fetch from Supabase on init
    if (supabase) {
      supabase.from('products').select('*').then(({ data, error }) => {
        if (error) {
          console.error('[Supabase] Failed to fetch products:', error);
        } else if (data && data.length > 0) {
          products = data;
          storage.write(STORAGE_KEY, products);
          emitter.emit(getAll());
        }
      });
    }

    function persistAndNotify() {
      storage.write(STORAGE_KEY, products);
      emitter.emit(getAll());
    }

    function getAll() {
      return products.map((product) => ({ ...product }));
    }

    function getById(id) {
      const found = products.find((product) => product.id === id);
      return found ? { ...found } : undefined;
    }

    async function add(draft) {
      const normalised = normaliseDraft(draft, getKnownBrandIds());
      const id = `${slugify(normalised.title)}-${Date.now().toString(36)}`;
      const newProduct = { id, ...normalised };
      
      // Optimistic update
      products = [newProduct, ...products];
      persistAndNotify();

      if (supabase) {
        const { error } = await supabase.from('products').insert([newProduct]);
        if (error) {
          console.error('[Supabase] Add product error:', error);
          throw new Error(error.message);
        }
      }
      return id;
    }

    async function update(id, draft) {
      const index = products.findIndex((product) => product.id === id);
      if (index === -1) throw new Error("PRODUCT_NOT_FOUND");

      const normalised = normaliseDraft(draft, getKnownBrandIds());
      const updatedProduct = { ...products[index], ...normalised };
      
      // Optimistic update
      products[index] = updatedProduct;
      persistAndNotify();

      if (supabase) {
        const { error } = await supabase.from('products').update(normalised).eq('id', id);
        if (error) {
          console.error('[Supabase] Update product error:', error);
          throw new Error(error.message);
        }
      }
    }

    async function remove(id) {
      const next = products.filter((product) => product.id !== id);
      if (next.length === products.length) throw new Error("PRODUCT_NOT_FOUND");
      
      // Optimistic update
      products = next;
      persistAndNotify();

      if (supabase) {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) console.error('[Supabase] Delete product error:', error);
      }
    }

    /** Restores the seeded catalog; used by the dashboard's reset control. */
    async function resetToSeed() {
      const resetProducts = seedProducts.map((product) => ({ stockQuantity: 50, ...product }));
      products = resetProducts;
      persistAndNotify();
      
      if (supabase) {
        // Warning: This deletes everything and re-inserts seeds. Very destructive!
        await supabase.from('products').delete().neq('id', 'placeholder-to-delete-all');
        await supabase.from('products').insert(resetProducts);
      }
    }

    return {
      getAll,
      getById,
      add,
      update,
      remove,
      resetToSeed,
      subscribe: emitter.subscribe,
    };
  }

  global.AkadInventory = { createInventory };
})(window);
