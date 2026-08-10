/* POST /api/complete — called by the thanks page after a redirect back from
 * Stripe. { payment_intent: "pi_..." }.
 *
 * For mixed carts the PaymentIntent charged the one-time packs and saved the
 * card (setup_future_usage); this endpoint starts the trialing subscription
 * with that saved payment method. Only fully succeeded intents finalize —
 * "processing" (SEPA & friends) returns pending:true because the saved
 * payment method isn't guaranteed attached yet; the webhook (or a later
 * revisit) finishes those. Idempotent — see finalizeSubsForPI. */
const { stripeClient, finalizeSubsForPI, readJson, send } = require("./_shared");

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "method not allowed" });
  const stripe = stripeClient();
  if (!stripe) return send(res, 503, { error: "payments are not configured yet" });

  const body = readJson(req);
  const piId = typeof body?.payment_intent === "string" ? body.payment_intent : "";
  if (!/^pi_[A-Za-z0-9]+$/.test(piId)) return send(res, 400, { error: "invalid request" });

  try {
    const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
    if (pi.status === "processing") return send(res, 409, { error: "payment still processing", pending: true });
    if (pi.status !== "succeeded") return send(res, 409, { error: "payment not completed", status: pi.status });
    if (!pi.metadata?.pending_subs) return send(res, 200, { ok: true, subscription: null });
    const result = await finalizeSubsForPI(stripe, pi);
    return send(res, 200, { ok: true, ...result });
  } catch (error) {
    console.error("complete failed:", error.message);
    return send(res, 500, { error: "couldn't finalize the subscription part of your order" });
  }
};
