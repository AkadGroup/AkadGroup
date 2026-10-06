// version: 1.0.0
// Submitted orders. Written by checkout, read by the admin dashboard; both
// talk to this store rather than to each other.
(function (global) {
  "use strict";

  const STORAGE_KEY = "orders";
  const COUNTER_KEY = "orderCounter";
  const ORDER_ID_PADDING = 4;

  /** Status codes; the UI owns the Arabic labels. */
  const STATUSES = ["processing", "shipped", "delivered", "cancelled"];

  function createOrders({ storage, emitterFactory }) {
    const emitter = emitterFactory();

    let orders = storage.read(STORAGE_KEY, []);
    if (!Array.isArray(orders)) orders = [];

    let counter = storage.read(COUNTER_KEY, 0);
    if (!Number.isInteger(counter) || counter < 0) counter = orders.length;

    const supabase = global.AkadSupabase?.client;

    if (supabase) {
      supabase.from('orders').select('*').order('createdAt', { ascending: false }).then(({ data, error }) => {
        if (!error && data) {
          // Map DB structure back to UI structure if needed, or just use directly
          orders = data.map(dbOrder => ({
            ...dbOrder,
            items: dbOrder.lines,
          }));
          storage.write(STORAGE_KEY, orders);
          counter = Math.max(counter, orders.length);
          storage.write(COUNTER_KEY, counter);
          emitter.emit(getAll());
        }
      });
    }

    function persistAndNotify() {
      storage.write(STORAGE_KEY, orders);
      storage.write(COUNTER_KEY, counter);
      emitter.emit(getAll());
    }

    function getAll() {
      // Newest first: that's the order an operator wants to work through.
      return orders.map((order) => ({ ...order }));
    }

    function getById(id) {
      const found = orders.find((order) => order.id === id);
      return found ? { ...found } : undefined;
    }

    function nextOrderId() {
      counter += 1;
      return `AKD-${String(counter).padStart(ORDER_ID_PADDING, "0")}`;
    }

    /**
     * @param {object} draft
     * @param {Array} draft.items Cart lines snapshotted at purchase time.
     * @param {object} draft.shipping Validated shipping details.
     * @param {object|null} draft.account Session identity, or null for a guest.
     */
    async function add({ items, shipping, account }) {
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error("EMPTY_ORDER");
      }
      if (!shipping || !shipping.fullName) throw new Error("MISSING_SHIPPING");

      const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const order = {
        id: nextOrderId(),
        createdAt: new Date().toISOString(),
        status: STATUSES[0],
        customerName: shipping.fullName,
        accountEmail: account?.email || "",
        accountRole: account?.role || "guest",
        shipping: { ...shipping },
        items: items.map((item) => ({ ...item })),
        total,
      };

      orders = [order, ...orders];
      persistAndNotify();

      if (supabase) {
        const dbOrder = {
          id: order.id,
          customerName: order.customerName,
          accountEmail: order.accountEmail,
          phone: order.shipping.phone || "",
          total: order.total,
          status: order.status,
          shipping: order.shipping,
          lines: order.items,
          createdAt: order.createdAt
        };
        await supabase.from('orders').insert([dbOrder]);
      }
      return { ...order };
    }

    async function setStatus(id, status) {
      if (!STATUSES.includes(status)) throw new Error("UNKNOWN_STATUS");

      const order = orders.find((candidate) => candidate.id === id);
      if (!order) throw new Error("ORDER_NOT_FOUND");

      order.status = status;
      persistAndNotify();

      if (supabase) {
        await supabase.from('orders').update({ status }).eq('id', id);
      }
    }

    async function remove(id) {
      const initialLength = orders.length;
      orders = orders.filter((order) => order.id !== id);
      if (orders.length === initialLength) throw new Error("ORDER_NOT_FOUND");
      persistAndNotify();

      if (supabase) {
        await supabase.from('orders').delete().eq('id', id);
      }
    }

    return { getAll, getById, add, setStatus, remove, subscribe: emitter.subscribe };
  }

  global.AkadOrders = { createOrders, STATUSES };
})(window);
