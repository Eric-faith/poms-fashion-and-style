// POST /.netlify/functions/checkout
// Re-prices the bag from the published catalog (never trusts browser prices),
// then starts a Paystack or Flutterwave payment and returns the hosted payment URL.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid request.' }, 400); }

  const provider = body?.provider === 'flutterwave' ? 'flutterwave' : 'paystack';
  const items = Array.isArray(body?.items) ? body.items.slice(0, 30) : [];
  const c = body?.customer ?? {};
  const customer = {
    name: clean(c.name), email: clean(c.email, 120), phone: clean(c.phone, 30),
    address: clean(c.address), city: clean(c.city, 80), state: clean(c.state, 40), note: clean(c.note, 300),
  };

  if (!items.length) return json({ error: 'Your bag is empty.' }, 400);
  if (!customer.name || !customer.phone || !customer.address || !customer.city || !customer.state)
    return json({ error: 'Fill in your name, phone number and delivery address.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))
    return json({ error: 'Enter a valid email address for your receipt.' }, 400);

  const site = process.env.URL || new URL(req.url).origin;
  let catalog;
  try {
    const r = await fetch(`${site}/products.json`);
    catalog = await r.json();
  } catch {
    return json({ error: 'The shop is updating. Try again in a minute.' }, 503);
  }

  const lines = [];
  let subtotal = 0;
  for (const item of items) {
    const p = catalog.find((x) => x.slug === item?.slug);
    if (!p) return json({ error: 'An item in your bag is no longer available. Remove it and try again.' }, 409);
    const size = clean(item.size, 20);
    if (p.sizes.length) {
      const s = p.sizes.find((x) => x.size === size);
      if (!s || !s.in_stock)
        return json({ error: `${p.title}${size ? ` in size ${size}` : ''} is sold out. Remove it from your bag and try again.` }, 409);
    }
    const qty = Math.min(Math.max(parseInt(item.qty, 10) || 1, 1), 10);
    subtotal += p.price * qty;
    lines.push({ title: p.title, size, qty, price: p.price });
  }

  const fee = Math.max(Number(process.env.PUBLIC_DELIVERY_FEE) || 0, 0);
  const freeOver = Math.max(Number(process.env.PUBLIC_FREE_DELIVERY_OVER) || 0, 0);
  const delivery = freeOver && subtotal >= freeOver ? 0 : fee;
  const total = subtotal + delivery;
  const reference = `POMS-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  const itemsText = lines.map((l) => `${l.qty} x ${l.title}${l.size ? ` (${l.size})` : ''}`).join('; ');
  const addressText = `${customer.address}, ${customer.city}, ${customer.state}`;

  try {
    if (provider === 'paystack') {
      if (!process.env.PAYSTACK_SECRET_KEY) throw new Error('PAYSTACK_SECRET_KEY is not set');
      const r = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customer.email,
          amount: total * 100, // kobo
          currency: 'NGN',
          reference,
          callback_url: `${site}/order/success/?provider=paystack`,
          metadata: {
            lines, subtotal, delivery,
            // custom_fields show up on the transaction in the Paystack dashboard
            custom_fields: [
              { display_name: 'Customer', variable_name: 'customer', value: customer.name },
              { display_name: 'Phone', variable_name: 'phone', value: customer.phone },
              { display_name: 'Delivery address', variable_name: 'address', value: addressText },
              { display_name: 'Items', variable_name: 'items', value: itemsText },
              { display_name: 'Note', variable_name: 'note', value: customer.note || '-' },
            ],
          },
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.status) throw new Error(d.message || 'Paystack error');
      return json({ url: d.data.authorization_url, reference });
    }

    if (!process.env.FLW_SECRET_KEY) throw new Error('FLW_SECRET_KEY is not set');
    const r = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_ref: reference,
        amount: total,
        currency: 'NGN',
        redirect_url: `${site}/order/success/?provider=flutterwave`,
        customer: { email: customer.email, name: customer.name, phonenumber: customer.phone },
        // meta shows on the transaction in the Flutterwave dashboard
        meta: { phone: customer.phone, delivery_address: addressText, items: itemsText, note: customer.note || '-' },
        customizations: { title: 'POMS Fashion', description: `Order ${reference}`, logo: `${site}/favicon.svg` },
      }),
    });
    const d = await r.json();
    if (!r.ok || d.status !== 'success') throw new Error(d.message || 'Flutterwave error');
    return json({ url: d.data.link, reference });
  } catch (err) {
    console.error('checkout failed:', err);
    return json({ error: 'Payment could not be started. Try again, or choose another payment option.' }, 502);
  }
};
