// version: 1.0.0
(function (global) {
  "use strict";

  const STORAGE_KEY = "brands";

  function createBrands({ seedBrands, storage, emitterFactory }) {
    const emitter = emitterFactory();

    let brands = storage.read(STORAGE_KEY, null);
    if (!Array.isArray(brands) || brands.length === 0) {
      brands = [...seedBrands];
      storage.write(STORAGE_KEY, brands);
    }

    const supabase = global.AkadSupabase?.client;

    if (supabase) {
      supabase.from('brands').select('*').then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          brands = data;
          notify();
        }
      });
    }

    function notify() {
      storage.write(STORAGE_KEY, brands);
      emitter.emit(getAll());
    }

    function getAll() {
      return brands.map((brand) => ({ ...brand }));
    }

    function getById(id) {
      const found = brands.find((brand) => brand.id === id);
      return found ? { ...found } : undefined;
    }

    async function add(label) {
      const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      if (!id) throw new Error("INVALID_BRAND_NAME");
      if (brands.some((b) => b.id === id)) throw new Error("BRAND_EXISTS");

      const newBrand = { id, label };
      brands.push(newBrand);
      notify();

      if (supabase) {
        await supabase.from('brands').insert([newBrand]);
      }
      return newBrand;
    }

    async function update(id, newLabel) {
      const index = brands.findIndex((b) => b.id === id);
      if (index === -1) throw new Error("UNKNOWN_BRAND");

      brands[index].label = newLabel;
      notify();

      if (supabase) {
        await supabase.from('brands').update({ label: newLabel }).eq('id', id);
      }
    }

    async function remove(id) {
      const index = brands.findIndex((b) => b.id === id);
      if (index === -1) throw new Error("UNKNOWN_BRAND");

      brands.splice(index, 1);
      notify();

      if (supabase) {
        await supabase.from('brands').delete().eq('id', id);
      }
    }

    return {
      getAll,
      getById,
      add,
      update,
      remove,
      subscribe: emitter.subscribe,
    };
  }

  global.AkadBrands = { createBrands };
})(window);
