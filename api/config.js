/* GET /api/config — public checkout bootstrap: publishable key + catalog facts.
 * Safe to expose: contains no secrets, prices are public anyway. */
const {
  CATALOG,
  CURRENCY,
  SHIPPING_FLAT_CENTS,
  FREE_SHIPPING_MIN_BAGS,
  SUB_TRIAL_DAYS,
  SHIP_COUNTRIES,
  send,
} = require("./_shared");

module.exports = (req, res) => {
  if (req.method !== "GET") return send(res, 405, { error: "method not allowed" });
  const publishableKey =
    process.env.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLIC_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  const secretConfigured = Boolean(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY);
  return send(res, 200, {
    ready: Boolean(publishableKey && secretConfigured),
    publishableKey,
    missing: [
      ...(publishableKey ? [] : ["STRIPE_PUBLISHABLE_KEY"]),
      ...(secretConfigured ? [] : ["STRIPE_SECRET_KEY"]),
    ],
    currency: CURRENCY,
    catalog: Object.fromEntries(
      Object.entries(CATALOG).map(([sku, item]) => [sku, { label: item.label, cents: item.cents, bags: item.bags, mode: item.mode }])
    ),
    shippingFlatCents: SHIPPING_FLAT_CENTS,
    freeShippingMinBags: FREE_SHIPPING_MIN_BAGS,
    subTrialDays: SUB_TRIAL_DAYS,
    shipCountries: SHIP_COUNTRIES,
  });
};
