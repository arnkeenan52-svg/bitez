/* bitez — shared server-side commerce config + helpers for /api functions.
 * Files prefixed with "_" in /api are not exposed as endpoints by Vercel.
 *
 * SECURITY: prices live HERE and only here. The client sends SKUs + quantities;
 * every amount is computed server-side from this table. Never trust a price,
 * total, or discount coming from the browser.
 */

const Stripe = require("stripe");

/* One product (green apple, 96g bag), six SKUs. Amounts in euro cents.
 * ⚠️ Owner: keep in sync with the chooser in green-apple.html and README. */
const CATALOG = {
  "onetime-3": { label: "green apple · 3-pack (3 × 96g)", cents: 1999, bags: 3, mode: "payment" },
  "onetime-6": { label: "green apple · 6-pack (6 × 96g)", cents: 4999, bags: 6, mode: "payment" },
  "onetime-9": { label: "green apple · 9-pack (9 × 96g)", cents: 6999, bags: 9, mode: "payment" },
  "sub-3": { label: "green apple · 3 bags / month", cents: 1699, bags: 3, mode: "subscription", lookupKey: "bitez_sub_3" },
  "sub-6": { label: "green apple · 6 bags / month", cents: 4249, bags: 6, mode: "subscription", lookupKey: "bitez_sub_6" },
  "sub-9": { label: "green apple · 9 bags / month", cents: 5899, bags: 9, mode: "subscription", lookupKey: "bitez_sub_9" },
};

/* ⚠️ Owner-configurable shipping + pre-order settings. */
const SHIPPING_FLAT_CENTS = 490; // standard EU shipping under the free threshold
const FREE_SHIPPING_MIN_BAGS = 6; // "free shipping on 6-packs and up"
const SUB_TRIAL_DAYS = 70; // subscriptions: card saved today, first charge when the drop ships (~10 weeks)
const CURRENCY = "eur";
const MAX_QTY = 10;

/* EU-27 ship-to countries (site promise: "EU first"). ⚠️ Owner-configurable. */
const SHIP_COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
];

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || "";
  if (!key) return null;
  return new Stripe(key, { maxNetworkRetries: 2 });
}

/* Parse + validate cart items from the client: [{sku, qty}] → normalized lines. */
function normalizeItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 12) return null;
  const seen = new Set();
  const lines = [];
  for (const entry of raw) {
    const sku = typeof entry?.sku === "string" ? entry.sku : "";
    const qty = Number.parseInt(entry?.qty, 10);
    if (!Object.hasOwn(CATALOG, sku)) return null;
    const item = CATALOG[sku];
    if (!item || seen.has(sku)) return null;
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return null;
    seen.add(sku);
    lines.push({ sku, qty, ...item });
  }
  return lines;
}

function totals(lines) {
  const oneTime = lines.filter((l) => l.mode === "payment");
  const subs = lines.filter((l) => l.mode === "subscription");
  const itemsCents = oneTime.reduce((t, l) => t + l.cents * l.qty, 0);
  const subMonthlyCents = subs.reduce((t, l) => t + l.cents * l.qty, 0);
  const bags = lines.reduce((t, l) => t + l.bags * l.qty, 0);
  const shippingCents = oneTime.length === 0 || bags >= FREE_SHIPPING_MIN_BAGS ? 0 : SHIPPING_FLAT_CENTS;
  return { oneTime, subs, itemsCents, subMonthlyCents, shippingCents, bags };
}

/* Resolve an active promotion code → discount description, or null.
 * Codes with max_redemptions or first_time_transaction restrictions are
 * rejected: our one-time legs are discounted by adjusting the amount, which
 * never registers a Stripe redemption, so those caps can't be enforced. */
async function findPromo(stripe, code) {
  if (!code || typeof code !== "string" || code.length > 60) return null;
  const res = await stripe.promotionCodes.list({ code: code.trim(), active: true, limit: 1 });
  const promo = res.data[0];
  if (!promo || !promo.coupon || !promo.coupon.valid) return null;
  if (promo.max_redemptions || promo.restrictions?.first_time_transaction) return null;
  return promo;
}

/* Apply a promo's coupon to a one-time amount (in cents), respecting restrictions. */
function discountedCents(promo, itemsCents) {
  if (!promo) return { discount: 0, itemsCents };
  const min = promo.restrictions?.minimum_amount;
  const minCurrency = promo.restrictions?.minimum_amount_currency;
  if (min && (itemsCents < min || (minCurrency && minCurrency !== CURRENCY))) return { discount: 0, itemsCents };
  const c = promo.coupon;
  let discount = 0;
  if (c.percent_off) discount = Math.round((itemsCents * c.percent_off) / 100);
  else if (c.amount_off && c.currency === CURRENCY) discount = c.amount_off;
  discount = Math.min(discount, itemsCents);
  return { discount, itemsCents: itemsCents - discount };
}

/* Compact order snapshot for Stripe metadata (500-char value limit). */
function orderMeta(lines, extras = {}) {
  return {
    order: lines.map((l) => `${l.sku} x${l.qty}`).join(", ").slice(0, 490),
    ...extras,
  };
}

function readJson(req) {
  // req.body is a lazy getter on Vercel that THROWS on malformed JSON —
  // the whole access has to sit inside the try.
  try {
    if (req.body && typeof req.body === "object") return req.body;
    return JSON.parse(req.body || "{}");
  } catch {
    return null;
  }
}

/* Sanitize a client-supplied shipping block into Stripe's shape (or null).
 * The country must be on the ship-to whitelist — the client-side list is
 * cosmetic, this is the enforcement point. */
function shippingParam(raw) {
  if (!raw || typeof raw !== "object" || !raw.address) return null;
  const s = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const address = {
    line1: s(raw.address.line1),
    line2: s(raw.address.line2),
    city: s(raw.address.city, 100),
    postal_code: s(raw.address.postal_code, 20),
    country: SHIP_COUNTRIES.includes(raw.address.country) ? raw.address.country : "",
  };
  if (!address.line1 || !address.country) return null;
  return { name: s(raw.name, 120) || "pre-order customer", phone: s(raw.phone, 30) || undefined, address };
}

function send(res, status, payload) {
  res.status(status).setHeader("Cache-Control", "no-store").json(payload);
}

/* Reuse an existing customer for this email instead of minting one per attempt.
 * Never mutate an existing customer's address from an unauthenticated request
 * (email is unverified) — per-order addresses live on the intent/metadata. */
async function findOrCreateCustomer(stripe, email, shipping) {
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data[0]) return existing.data[0];
  return stripe.customers.create({
    email,
    metadata: { source: "eatbitez.com pre-order" },
    ...(shipping ? { name: shipping.name, shipping, address: shipping.address } : {}),
  });
}

/* Start the trialing subscription(s) recorded in a paid PaymentIntent's
 * metadata.pending_subs, with the payment method the intent saved. Shared by
 * /api/complete (thanks-page fast path) and /api/webhook (reliable path).
 * Idempotent: a deterministic lookup plus a keyed create make retries safe.
 * Returns { subscription: id|null } or throws. */
async function finalizeSubsForPI(stripe, pi) {
  const pending = pi.metadata?.pending_subs;
  if (!pending) return { subscription: null };
  if (!pi.customer || !pi.payment_method) throw new Error("no saved payment method on intent");
  const customerId = typeof pi.customer === "string" ? pi.customer : pi.customer.id;

  // Deterministic duplicate guard: idempotency keys expire after 24h, so a
  // thanks-page revisit on day 2 must find the existing subscription instead
  // of creating a second one.
  const existing = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
  const already = existing.data.find((s) => s.metadata?.source_payment_intent === pi.id);
  if (already) return { subscription: already.id };

  // iDEAL/Bancontact payments are single-use; the reusable payment method is
  // the generated SEPA debit hanging off the charge — prefer it when present.
  let pmId = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method.id;
  const charge = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  const details = charge?.payment_method_details;
  const generated = details && details[details.type]?.generated_sepa_debit;
  if (generated) pmId = typeof generated === "string" ? generated : generated.id;

  // "sub-6 x1, sub-3 x2" → subscription items, priced via lookup keys.
  const items = [];
  for (const part of pending.split(",")) {
    const m = part.trim().match(/^(sub-\d+) x(\d+)$/);
    const line = m && Object.hasOwn(CATALOG, m[1]) ? CATALOG[m[1]] : null;
    if (!line || line.mode !== "subscription") continue;
    const prices = await stripe.prices.list({ lookup_keys: [line.lookupKey], active: true, limit: 1 });
    const price = prices.data[0];
    if (!price) throw new Error(`subscription price missing for ${line.lookupKey}`);
    if (price.unit_amount !== line.cents || price.currency !== CURRENCY) {
      throw new Error(`price drift on ${line.lookupKey}: stripe has ${price.unit_amount}, site has ${line.cents}`);
    }
    items.push({ price: price.id, quantity: Math.min(MAX_QTY, Number(m[2])) });
  }
  if (!items.length) return { subscription: null };

  const subscription = await stripe.subscriptions.create(
    {
      customer: customerId,
      items,
      default_payment_method: pmId,
      payment_behavior: "default_incomplete",
      trial_end: Math.floor(Date.now() / 1000) + SUB_TRIAL_DAYS * 86400,
      trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
      proration_behavior: "none",
      metadata: { source_payment_intent: pi.id, order: pending },
    },
    // pm id in the key: if a retry resolves a different (generated) pm, the
    // params change — a fresh key avoids Stripe's 409 on key reuse, while the
    // list() guard above still prevents duplicates.
    { idempotencyKey: `bitez-sub-for-${pi.id}-${pmId.slice(-8)}` }
  );
  return { subscription: subscription.id };
}

module.exports = {
  CATALOG,
  CURRENCY,
  SHIPPING_FLAT_CENTS,
  FREE_SHIPPING_MIN_BAGS,
  SUB_TRIAL_DAYS,
  SHIP_COUNTRIES,
  MAX_QTY,
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
  finalizeSubsForPI,
};
