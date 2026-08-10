/* POST /api/create-intent — the only place an order is priced and a Stripe
 * intent is minted. Body: { items:[{sku,qty}], email, code?, shipping?, newsletter? }
 *
 * Three cart shapes:
 *  - one-time only        → PaymentIntent (charged today)
 *  - subscription only    → Customer + trialing Subscription (€0 today, card
 *                           saved via its pending SetupIntent, first charge
 *                           when the first drop ships)
 *  - mixed                → PaymentIntent with setup_future_usage so the same
 *                           card can start the subscription afterwards
 *                           (finalized by /api/complete from the thanks page)
 */
const {
  CURRENCY,
  SUB_TRIAL_DAYS,
  stripeClient,
  normalizeItems,
  totals,
  findPromo,
  discountedCents,
  orderMeta,
  readJson,
  send,
  shippingParam,
  findOrCreateCustomer,
} = require("./_shared");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function ensureSubPrice(stripe, line) {
  const existing = await stripe.prices.list({ lookup_keys: [line.lookupKey], active: true, limit: 1 });
  if (existing.data[0]) {
    const price = existing.data[0];
    // Guard: if the dashboard price drifted from the site price, fail loudly
    // instead of charging an amount the customer never saw.
    if (price.unit_amount !== line.cents || price.currency !== CURRENCY) {
      throw new Error(`price drift on ${line.lookupKey}: stripe has ${price.unit_amount}, site has ${line.cents}`);
    }
    return price;
  }
  return stripe.prices.create({
    currency: CURRENCY,
    unit_amount: line.cents,
    recurring: { interval: "month" },
    lookup_key: line.lookupKey,
    transfer_lookup_key: true,
    product_data: { name: `bitez ${line.label}`, metadata: { sku: line.sku } },
    metadata: { sku: line.sku },
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "method not allowed" });
  const stripe = stripeClient();
  if (!stripe) return send(res, 503, { error: "payments are not configured yet" });

  const body = readJson(req);
  if (!body) return send(res, 400, { error: "invalid request" });

  const lines = normalizeItems(body.items);
  if (!lines) return send(res, 400, { error: "your bag looks invalid — please re-add your packs" });

  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
  if (!EMAIL_RE.test(email)) return send(res, 400, { error: "that email doesn't look right" });

  const shipping = shippingParam(body.shipping);
  const t = totals(lines);
  // physical goods need somewhere to go — and the country whitelist is
  // enforced inside shippingParam, so a null here also covers non-EU tampering
  if (!shipping) return send(res, 400, { error: "we need a delivery address in an eu country we ship to" });

  try {
    let promo = null;
    let discount = 0;
    let itemsCents = t.itemsCents;
    if (body.code) {
      promo = await findPromo(stripe, body.code);
      if (!promo) return send(res, 400, { error: "that code isn't valid", code: "bad_promo" });
      if (t.oneTime.length === 0) return send(res, 400, { error: "codes apply to one-time packs only for now", code: "bad_promo" });
      const applied = discountedCents(promo, t.itemsCents);
      discount = applied.discount;
      itemsCents = applied.itemsCents;
      if (discount === 0) return send(res, 400, { error: "that code needs a larger order", code: "bad_promo" });
      // Stripe's minimum charge is €0.50 — a code that (nearly) zeroes the
      // order can't be processed as a payment
      if (itemsCents + t.shippingCents < 50) {
        return send(res, 400, { error: "that code covers the whole order — email us and we'll sort it personally", code: "bad_promo" });
      }
    }

    const amounts = {
      itemsCents: t.itemsCents,
      discountCents: discount,
      shippingCents: t.shippingCents,
      dueTodayCents: itemsCents + t.shippingCents,
      subMonthlyCents: t.subMonthlyCents,
    };

    const meta = orderMeta(lines, {
      email,
      newsletter: body.newsletter ? "yes" : "no",
      shipping_eur: (t.shippingCents / 100).toFixed(2),
      ...(promo ? { promo_code: promo.code, discount_eur: (discount / 100).toFixed(2) } : {}),
    });

    /* ---- subscription-only: trialing subscription, card saved via SetupIntent ---- */
    if (t.oneTime.length === 0) {
      const customer = await findOrCreateCustomer(stripe, email, shipping);
      const items = [];
      for (const line of t.subs) {
        const price = await ensureSubPrice(stripe, line);
        items.push({ price: price.id, quantity: line.qty });
      }
      // ship-to lives in metadata: the shared Customer object is never
      // mutated by unauthenticated checkouts
      meta.ship_to = `${shipping.name}, ${shipping.address.line1}${shipping.address.line2 ? " " + shipping.address.line2 : ""}, ${shipping.address.postal_code} ${shipping.address.city}, ${shipping.address.country}`.slice(0, 490);
      const day = new Date().toISOString().slice(0, 10);
      const skuSig = t.subs.map((l) => `${l.sku}x${l.qty}`).join("-");
      const subscription = await stripe.subscriptions.create(
        {
          customer: customer.id,
          items,
          payment_behavior: "default_incomplete",
          trial_end: Math.floor(Date.now() / 1000) + SUB_TRIAL_DAYS * 86400,
          trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
          // explicit types keep the subscription's SetupIntent aligned with
          // the Payment Element (js/checkout.js pins the same list)
          payment_settings: { save_default_payment_method: "on_subscription", payment_method_types: ["card"] },
          proration_behavior: "none",
          metadata: meta,
          expand: ["pending_setup_intent"],
        },
        // same customer + same cart + same day → reuse, don't duplicate
        { idempotencyKey: `bitez-subonly-${customer.id}-${skuSig}-${day}` }
      );
      const si = subscription.pending_setup_intent;
      if (!si || !si.client_secret) throw new Error("subscription created without a pending setup intent");
      return send(res, 200, { kind: "setup", clientSecret: si.client_secret, amounts });
    }

    /* ---- one-time (optionally with subscription items to start afterwards) ---- */
    const hasSubs = t.subs.length > 0;
    let customerId;
    if (hasSubs) {
      const customer = await findOrCreateCustomer(stripe, email, shipping);
      customerId = customer.id;
      meta.pending_subs = t.subs.map((l) => `${l.sku} x${l.qty}`).join(", ");
    }
    const intent = await stripe.paymentIntents.create({
      amount: amounts.dueTodayCents,
      currency: CURRENCY,
      receipt_email: email,
      automatic_payment_methods: { enabled: true },
      ...(shipping ? { shipping } : {}),
      metadata: meta,
      ...(customerId ? { customer: customerId, setup_future_usage: "off_session" } : {}),
    });
    return send(res, 200, { kind: "payment", clientSecret: intent.client_secret, amounts });
  } catch (error) {
    console.error("create-intent failed:", error.message);
    return send(res, 500, { error: "couldn't start checkout — please try again" });
  }
};
