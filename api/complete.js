/* POST /api/complete — called by the thanks page after a redirect back from
 * Stripe. { payment_intent: "pi_..." }.
 *
 * For mixed carts the PaymentIntent charged the one-time packs and saved the
 * card (setup_future_usage); this endpoint starts the trialing subscription
 * with that saved card. Idempotent: retries reuse the same idempotency key,
 * so refresh-spamming the thanks page can never create duplicates.
 * No-ops (with ok:true) when the intent has no pending subscription items. */
const { CATALOG, SUB_TRIAL_DAYS, stripeClient, readJson, send } = require("./_shared");

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "method not allowed" });
  const stripe = stripeClient();
  if (!stripe) return send(res, 503, { error: "payments are not configured yet" });

  const body = readJson(req);
  const piId = typeof body?.payment_intent === "string" ? body.payment_intent : "";
  if (!/^pi_[A-Za-z0-9]+$/.test(piId)) return send(res, 400, { error: "invalid request" });

  try {
    const pi = await stripe.paymentIntents.retrieve(piId);
    if (!["succeeded", "processing"].includes(pi.status)) {
      return send(res, 409, { error: "payment not completed", status: pi.status });
    }
    const pending = pi.metadata?.pending_subs;
    if (!pending) return send(res, 200, { ok: true, subscription: null });
    if (!pi.customer || !pi.payment_method) {
      return send(res, 409, { error: "no saved payment method on this order" });
    }
    const customerId = typeof pi.customer === "string" ? pi.customer : pi.customer.id;

    // Deterministic duplicate guard: idempotency keys expire after 24h, so a
    // thanks-page revisit on day 2 must find the existing subscription instead
    // of creating a second one.
    const existing = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
    const already = existing.data.find((s) => s.metadata?.source_payment_intent === pi.id);
    if (already) return send(res, 200, { ok: true, subscription: already.id });

    // "sub-6 x1, sub-3 x2" → subscription items, priced via lookup keys.
    const items = [];
    for (const part of pending.split(",")) {
      const m = part.trim().match(/^(sub-\d+) x(\d+)$/);
      const line = m && CATALOG[m[1]];
      if (!line || line.mode !== "subscription") continue;
      const prices = await stripe.prices.list({ lookup_keys: [line.lookupKey], active: true, limit: 1 });
      if (!prices.data[0]) return send(res, 500, { error: "subscription price missing" });
      items.push({ price: prices.data[0].id, quantity: Math.min(10, Number(m[2])) });
    }
    if (!items.length) return send(res, 200, { ok: true, subscription: null });

    const subscription = await stripe.subscriptions.create(
      {
        customer: customerId,
        items,
        default_payment_method: typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method.id,
        trial_end: Math.floor(Date.now() / 1000) + SUB_TRIAL_DAYS * 86400,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        proration_behavior: "none",
        metadata: { source_payment_intent: pi.id, order: pending },
      },
      { idempotencyKey: `bitez-sub-for-${pi.id}` }
    );
    return send(res, 200, { ok: true, subscription: subscription.id });
  } catch (error) {
    console.error("complete failed:", error.message);
    return send(res, 500, { error: "couldn't finalize the subscription part of your order" });
  }
};
