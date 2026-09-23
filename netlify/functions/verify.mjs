// GET /.netlify/functions/verify?provider=paystack&reference=...
// GET /.netlify/functions/verify?provider=flutterwave&transaction_id=...&tx_ref=...
// Confirms with the provider (server-side, using the secret key) that the payment succeeded.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default async (req) => {
  const q = new URL(req.url).searchParams;
  const provider = q.get('provider');

  try {
    if (provider === 'paystack') {
      const reference = q.get('reference');
      if (!reference) return json({ paid: false, message: 'Missing payment reference.' });
      const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      });
      const d = await r.json();
      const paid = Boolean(d.status && d.data?.status === 'success' && d.data?.currency === 'NGN');
      return json({
        paid, reference, amount: paid ? d.data.amount / 100 : 0, email: d.data?.customer?.email,
        message: paid ? undefined : 'The payment was not successful.',
      });
    }

    if (provider === 'flutterwave') {
      const id = q.get('transaction_id');
      const txRef = q.get('tx_ref');
      if (!id || !/^\d+$/.test(id)) return json({ paid: false, message: 'The payment was not completed.' });
      const r = await fetch(`https://api.flutterwave.com/v3/transactions/${id}/verify`, {
        headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
      });
      const d = await r.json();
      const paid = d.status === 'success' && d.data?.status === 'successful' && d.data?.tx_ref === txRef && d.data?.currency === 'NGN';
      return json({
        paid, reference: txRef, amount: paid ? d.data.amount : 0, email: d.data?.customer?.email,
        message: paid ? undefined : 'The payment was not successful.',
      });
    }

    return json({ paid: false, message: 'Unknown payment provider.' }, 400);
  } catch (err) {
    console.error('verify failed:', err);
    return json({ paid: false, message: 'We could not confirm this payment yet.' }, 502);
  }
};
