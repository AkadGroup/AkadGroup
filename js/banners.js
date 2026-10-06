// version: 1.0.0
// Banner store for managing hero carousel images
(function (global) {
  "use strict";

  const STORAGE_KEY = "banners";

  const DEFAULT_BANNERS = [
    { id: "b1", image: "https://images.unsplash.com/photo-1617897903246-719242758050?q=80&w=1200&h=200&fit=crop" },
    { id: "b2", image: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=1200&h=200&fit=crop" },
    { id: "b3", image: "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?q=80&w=1200&h=200&fit=crop" }
  ];

  function createBanners({ storage, emitterFactory }) {
    const emitter = emitterFactory();
    let banners = storage.read(STORAGE_KEY, null);
    
    if (!Array.isArray(banners) || banners.length === 0) {
      banners = DEFAULT_BANNERS.map(b => ({ ...b }));
      storage.write(STORAGE_KEY, banners);
    }

    const supabase = global.AkadSupabase?.client;

    if (supabase) {
      supabase.from('banners').select('*').then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          banners = data;
          persistAndNotify();
        } else if (!error && data && data.length === 0) {
          // If Supabase is totally empty, seed it with defaults
          supabase.from('banners').insert(DEFAULT_BANNERS).then();
        }
      });
    }

    function persistAndNotify() {
      storage.write(STORAGE_KEY, banners);
      emitter.emit(getAll());
    }

    function getAll() {
      return banners.map((b) => ({ ...b }));
    }

    function getById(id) {
      const found = banners.find((b) => b.id === id);
      return found ? { ...found } : undefined;
    }

    function normaliseDraft(draft) {
      const image = String(draft.image || "").trim();
      if (!image) throw new Error("MISSING_IMAGE");
      if (!/^(https?:\/\/|\/|\.\/|data:image\/)/i.test(image)) {
        throw new Error("INVALID_IMAGE_URL");
      }
      return { image };
    }

    async function add(draft) {
      const normalised = normaliseDraft(draft);
      const id = `banner-${Date.now().toString(36)}`;
      const newBanner = { id, ...normalised };
      banners = [...banners, newBanner];
      persistAndNotify();
      
      if (supabase) {
        await supabase.from('banners').insert([newBanner]);
      }
      return id;
    }

    async function update(id, draft) {
      const index = banners.findIndex((b) => b.id === id);
      if (index === -1) throw new Error("BANNER_NOT_FOUND");
      const normalised = normaliseDraft(draft);
      banners[index] = { ...banners[index], ...normalised };
      persistAndNotify();

      if (supabase) {
        await supabase.from('banners').update(normalised).eq('id', id);
      }
    }

    async function remove(id) {
      const next = banners.filter((b) => b.id !== id);
      if (next.length === banners.length) throw new Error("BANNER_NOT_FOUND");
      banners = next;
      persistAndNotify();

      if (supabase) {
        await supabase.from('banners').delete().eq('id', id);
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

  global.AkadBanners = { createBanners };
})(window);
