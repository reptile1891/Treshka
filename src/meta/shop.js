// Магазин: каталог и покупки. Реальные платежи — только через заменяемый PaymentProvider.

// Заглушка-интерфейс для будущей интеграции. Реализация должна вернуть Promise<{ ok, error? }>:
//   purchase(item) — провести платёж за item.price.real (item.id используется как SKU).
export const NullPaymentProvider = {
  async purchase() { return { ok: false, error: 'payments_unavailable' }; },
};

export function createShop({ bus, state, save, cfg, economy, lives }) {
  let provider = NullPaymentProvider;
  const items = cfg.items;
  const find = (id) => items.find((i) => i.id === id);

  function catalog() {
    return items.map((i) => ({ ...i, available: !i.price.real || provider !== NullPaymentProvider }));
  }

  function done(item) {
    state.purchases[item.id] = (state.purchases[item.id] ?? 0) + 1;
    economy.grant(item.give, 'shop');
    save();
    bus.emit('shop:purchased', { id: item.id });
  }

  // Асинхронно, т.к. платёж за реальные деньги асинхронен. Результат: { ok, error? }
  async function buy(id) {
    const item = find(id);
    if (!item) return { ok: false, error: 'unknown_item' };
    if (item.kind === 'life' && lives.full()) return { ok: false, error: 'lives_full' }; // не продаём лишнее
    if (item.price.real) {
      const res = await provider.purchase(item);
      if (!res?.ok) return { ok: false, error: res?.error ?? 'payment_failed' };
    } else if (!economy.spend(item.price.coins)) {
      return { ok: false, error: 'not_enough_coins' };
    }
    done(item);
    return { ok: true };
  }

  return { catalog, buy, setPaymentProvider: (p) => { provider = p ?? NullPaymentProvider; } };
}
