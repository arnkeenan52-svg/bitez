/* bitez — order confirmation page.
 * One landing path for every payment method: checkout.js (card, on-page) and
 * Stripe redirects (iDEAL/bancontact/wallets) both arrive with
 * payment_intent/setup_intent + client_secret + redirect_status params.
 * For mixed carts this page also triggers /api/complete, which starts the
 * subscription with the just-saved card (idempotent server-side). */
(() => {
  const CART_KEY = "bitez-cart";
  const SNAP_KEY = "bitez-last-order";
  const $ = (sel) => document.querySelector(sel);
  const eur = (cents) => `€${(cents / 100).toFixed(2)}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const params = new URLSearchParams(location.search);
  const piId = params.get("payment_intent");
  const siId = params.get("setup_intent");
  const piSecret = params.get("payment_intent_client_secret");
  const siSecret = params.get("setup_intent_client_secret");

  function show(which) {
    [".js-ok", ".js-processing", ".js-failed"].forEach((sel) => $(sel).classList.add("hidden"));
    $(which).classList.remove("hidden");
  }

  function loadSnapshot() {
    try {
      const snap = JSON.parse(sessionStorage.getItem(SNAP_KEY));
      return snap && Array.isArray(snap.lines) ? snap : null;
    } catch {
      return null;
    }
  }

  function renderRecap(snap) {
    const box = $(".js-recap");
    if (!snap) {
      box.innerHTML = '<p class="text-sm font-semibold text-forest-soft">your full order details are in the email receipt.</p>';
      return;
    }
    const rows = snap.lines
      .map(
        (l) =>
          `<div class="flex items-baseline justify-between gap-3 text-sm font-semibold"><span class="min-w-0 flex-1 lowercase">${esc(l.label)} × ${l.qty}</span><span class="shrink-0 font-bold">${eur(l.cents * l.qty)}${l.mode === "subscription" ? '<span class="font-semibold text-forest-soft">/mo</span>' : ""}</span></div>`
      )
      .join("");
    const a = snap.amounts || {};
    box.innerHTML = `
      <h2 class="font-display text-xl font-extrabold lowercase">your order<span class="text-apple">.</span></h2>
      <div class="mt-3 flex flex-col gap-2">${rows}</div>
      <div class="mt-3 flex flex-col gap-1.5 border-t-2 border-forest/10 pt-3 text-sm font-semibold text-forest-soft">
        ${a.discountCents ? `<div class="flex justify-between"><span>discount</span><span>−${eur(a.discountCents)}</span></div>` : ""}
        ${a.shippingCents !== undefined && snap.lines.some((l) => l.mode === "payment") ? `<div class="flex justify-between"><span>shipping</span><span>${a.shippingCents === 0 ? "free" : eur(a.shippingCents)}</span></div>` : ""}
        <div class="flex justify-between font-display text-lg font-extrabold lowercase text-forest"><span>paid today</span><span>${eur(a.dueTodayCents || 0)}</span></div>
        ${a.subMonthlyCents ? `<p class="text-xs leading-relaxed">+ ${eur(a.subMonthlyCents)}/month from when your bags ship — €0 charged today, we email you first. pause or cancel anytime.</p>` : ""}
      </div>`;
  }

  async function finalizeSubscriptions() {
    if (!piId) return;
    const note = $(".js-sub-finalizing");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch("/api/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_intent: piId }),
        });
        if (response.ok) return;
      } catch {
        /* retry once below */
      }
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    // only relevant for mixed carts; the server no-ops otherwise
    const snap = loadSnapshot();
    if (snap?.lines?.some((l) => l.mode === "subscription")) {
      note.textContent = "your subscription is still being set up — it's saved with your payment and we'll finish it for you. nothing you need to do.";
      note.classList.remove("hidden");
    }
  }

  function succeed(refId) {
    try {
      localStorage.removeItem(CART_KEY);
    } catch {
      /* fine */
    }
    if (refId) $(".js-order-ref").textContent = `order ${refId.slice(-8).toUpperCase()}`;
    const snap = loadSnapshot();
    renderRecap(snap);
    if (snap && snap.kind === "setup") {
      $(".js-ok-lede").textContent = "your subscription is reserved — card saved, €0 charged today. the first charge happens when your bags ship, and we email you before it does.";
    }
    show(".js-ok");
    finalizeSubscriptions();
  }

  async function init() {
    if (!piId && !siId) {
      location.replace("index.html");
      return;
    }

    // authoritative status check when possible; falls back to redirect_status
    let status = params.get("redirect_status") || "succeeded";
    try {
      const configRes = await fetch("/api/config", { headers: { Accept: "application/json" } });
      const config = configRes.ok ? await configRes.json() : null;
      if (config?.publishableKey && window.Stripe) {
        const stripe = Stripe(config.publishableKey);
        if (piSecret) {
          const { paymentIntent } = await stripe.retrievePaymentIntent(piSecret);
          if (paymentIntent) status = paymentIntent.status;
        } else if (siSecret) {
          const { setupIntent } = await stripe.retrieveSetupIntent(siSecret);
          if (setupIntent) status = setupIntent.status;
        }
      }
    } catch {
      /* fall back to the redirect_status param */
    }

    if (["succeeded", "requires_capture"].includes(status)) {
      succeed(piId || siId);
    } else if (status === "processing") {
      try {
        localStorage.removeItem(CART_KEY);
      } catch {
        /* fine */
      }
      show(".js-processing");
      finalizeSubscriptions();
    } else {
      show(".js-failed");
    }
  }

  init();
})();
