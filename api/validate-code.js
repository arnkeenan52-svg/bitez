/* POST /api/validate-code — pre-flight discount check so the order summary can
 * show the discount before paying. { items:[{sku,qty}], code } → discount info.
 * The final amount is always recomputed in /api/create-intent; this endpoint
 * only drives the UI. */
const { stripeClient, normalizeItems, totals, findPromo, discountedCents, readJson, send } = require("./_shared");

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "method not allowed" });
  const stripe = stripeClient();
  if (!stripe) return send(res, 503, { error: "payments are not configured yet" });

  const body = readJson(req);
  const lines = body && normalizeItems(body.items);
  if (!lines) return send(res, 400, { error: "invalid bag" });

  try {
    const t = totals(lines);
    const promo = await findPromo(stripe, body.code);
    if (!promo) return send(res, 200, { valid: false, reason: "that code isn't valid" });
    if (t.oneTime.length === 0) return send(res, 200, { valid: false, reason: "codes apply to one-time packs only for now" });
    const { discount } = discountedCents(promo, t.itemsCents);
    if (discount === 0) return send(res, 200, { valid: false, reason: "that code needs a larger order" });
    return send(res, 200, { valid: true, code: promo.code, discountCents: discount });
  } catch (error) {
    console.error("validate-code failed:", error.message);
    return send(res, 500, { error: "couldn't check that code — please try again" });
  }
};
