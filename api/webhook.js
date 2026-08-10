/* POST /api/webhook — Stripe webhook receiver (hardening for mixed carts).
 *
 * Handles payment_intent.succeeded: if the intent carries pending_subs
 * metadata, the trialing subscription is started server-side — so the
 * subscription exists even when the buyer never makes it back to thanks.html
 * (closed tab during an iDEAL redirect, dropped connection, …).
 *
 * Owner setup (see README): Stripe Dashboard → Developers → Webhooks → add
 * endpoint https://eatbitez.com/api/webhook for event payment_intent.succeeded,
 * then put the signing secret in the STRIPE_WEBHOOK_SECRET env var on Vercel.
 * Until the secret is configured this endpoint refuses every call.
 */
const { stripeClient, finalizeSubsForPI, send } = require("./_shared");

// Signature verification needs the exact raw bytes — read the stream
// ourselves instead of touching Vercel's parsed req.body.
function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "method not allowed" });
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!stripe || !secret) return send(res, 503, { error: "webhook not configured" });

  let event;
  try {
    const payload = await rawBody(req);
    event = stripe.webhooks.constructEvent(payload, req.headers["stripe-signature"], secret);
  } catch (error) {
    console.error("webhook signature verification failed:", error.message);
    return send(res, 400, { error: "invalid signature" });
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = await stripe.paymentIntents.retrieve(event.data.object.id, { expand: ["latest_charge"] });
      if (pi.status === "succeeded" && pi.metadata?.pending_subs) {
        const result = await finalizeSubsForPI(stripe, pi);
        console.log(`webhook finalized ${pi.id} → ${result.subscription || "no-op"}`);
      }
    }
    return send(res, 200, { received: true });
  } catch (error) {
    // non-2xx makes Stripe retry with backoff — exactly what we want here
    console.error("webhook handling failed:", error.message);
    return send(res, 500, { error: "handler failed, please retry" });
  }
};
