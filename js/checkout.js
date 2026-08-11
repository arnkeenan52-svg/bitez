/* bitez — checkout page (Shopify-style single page, Stripe under the hood).
 *
 * Flow: bag (localStorage) → /api/config (publishable key + server catalog) →
 * Stripe Elements in DEFERRED mode (amount known up front, intent minted at
 * submit by /api/create-intent) → confirmPayment/confirmSetup → thanks.html.
 * Prices shown here are display-only; the server re-prices everything.
 */
(() => {
  const CART_KEY = "bitez-cart";
  const SNAP_KEY = "bitez-last-order";
  const THUMB = "assets/greenapple-front-500.jpg";

  /* display fallback when /api/config is unreachable (static preview) —
   * the real checkout always uses the server's numbers */
  const FALLBACK = {
    ready: false,
    publishableKey: "",
    currency: "eur",
    catalog: {
      "onetime-3": { label: "green apple · 3-pack (3 × 96g)", cents: 1999, bags: 3, mode: "payment" },
      "onetime-6": { label: "green apple · 6-pack (6 × 96g)", cents: 4999, bags: 6, mode: "payment" },
      "onetime-9": { label: "green apple · 9-pack (9 × 96g)", cents: 6999, bags: 9, mode: "payment" },
      "sub-3": { label: "green apple · 3 bags / month", cents: 1699, bags: 3, mode: "subscription" },
      "sub-6": { label: "green apple · 6 bags / month", cents: 4249, bags: 6, mode: "subscription" },
      "sub-9": { label: "green apple · 9 bags / month", cents: 5899, bags: 9, mode: "subscription" },
    },
    shippingFlatCents: 490,
    freeShippingMinBags: 6,
    subTrialDays: 70,
    shipCountries: ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"],
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const eur = (cents) => `€${(cents / 100).toFixed(2)}`;
  const firstChargeDate = () => {
    const d = new Date(Date.now() + (config.subTrialDays || 70) * 86400000);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long" }).toLowerCase();
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let config = FALLBACK;
  let stripe = null;
  let elements = null;
  let paymentElement = null;
  let promo = null; // {code, discountCents}
  let submitting = false;
  let elementsKind = null; // "payment" | "setup" — cart shape the elements were built for
  let elementsHadSubs = false;

  /* ---------- bag ---------- */
  function loadLines() {
    let items = [];
    try {
      items = JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch {
      items = [];
    }
    return items
      .filter((i) => config.catalog[i.size] && Number(i.qty) > 0)
      .map((i) => ({ sku: i.size, qty: Math.min(10, Math.round(Number(i.qty))), ...config.catalog[i.size] }));
  }

  function totals(lines) {
    const oneTime = lines.filter((l) => l.mode === "payment");
    const subs = lines.filter((l) => l.mode === "subscription");
    const itemsCents = oneTime.reduce((t, l) => t + l.cents * l.qty, 0);
    const subMonthlyCents = subs.reduce((t, l) => t + l.cents * l.qty, 0);
    const bags = lines.reduce((t, l) => t + l.bags * l.qty, 0);
    const shippingCents = oneTime.length === 0 || bags >= config.freeShippingMinBags ? 0 : config.shippingFlatCents;
    const discountCents = promo ? Math.min(promo.discountCents, itemsCents) : 0;
    const dueTodayCents = itemsCents - discountCents + shippingCents;
    return { oneTime, subs, itemsCents, subMonthlyCents, bags, shippingCents, discountCents, dueTodayCents };
  }

  const kindOf = (t) => (t.oneTime.length === 0 ? "setup" : "payment");

  /* ---------- order summary (rendered into desktop + mobile slots) ---------- */
  function renderSummary(lines, t) {
    const weeks = Math.round(config.subTrialDays / 7);
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const itemsHtml = lines
      .map(
        (l) => `
      <div class="flex items-center gap-3.5">
        <span class="relative inline-block shrink-0">
          <img src="${THUMB}" alt="" width="64" height="64" class="ck-thumb" loading="lazy" />
          <span class="ck-qty-badge">${l.qty}</span>
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-extrabold lowercase">${esc(l.label)}</span>
          ${l.mode === "subscription" ? `<span class="block text-xs font-semibold text-forest-soft">monthly · €0 today, starts when the drop ships</span>` : `<span class="block text-xs font-semibold text-forest-soft">one-time pre-order</span>`}
        </span>
        <span class="shrink-0 text-sm font-bold">${eur(l.cents * l.qty)}${l.mode === "subscription" ? '<span class="font-semibold text-forest-soft">/mo</span>' : ""}</span>
      </div>`
      )
      .join("");

    const discountHtml = promo
      ? `<div class="ck-row"><span class="flex items-center gap-2">discount <span class="ck-tag"><svg viewBox="0 0 24 24" class="size-3" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M4 4h7l9 9-7 7-9-9z" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" r="1.6" fill="currentColor" stroke="none"/></svg>${esc(promo.code)} <button type="button" class="js-promo-remove -mr-1 px-1 text-forest-soft hover:text-berry-deep" aria-label="remove discount code">×</button></span></span><span>−${eur(t.discountCents)}</span></div>`
      : "";

    return `
      <div class="mb-4 flex items-baseline justify-between gap-3">
        <span class="text-xs font-extrabold lowercase text-forest-soft">${count} item${count === 1 ? "" : "s"} in your bag</span>
        <a href="green-apple.html#preorder" class="text-xs font-bold lowercase text-forest underline underline-offset-4">edit bag</a>
      </div>
      <div class="flex flex-col gap-4">${itemsHtml}</div>
      <form class="js-promo-form mt-5 flex gap-2" novalidate>
        <label class="ck-field min-w-0 flex-1">
          <input class="ck-input js-promo-input !h-[48px]" type="text" placeholder="discount code" autocomplete="off" ${promo ? "disabled" : ""} />
          <span class="ck-label">discount code</span>
        </label>
        <button type="submit" class="btn btn-ghost shrink-0 px-4 py-2 text-sm lowercase" disabled>apply</button>
      </form>
      <p class="js-promo-msg mt-1.5 hidden text-xs font-bold text-berry-deep" role="status"></p>
      <div class="mt-5 flex flex-col gap-2 border-t-2 border-forest/10 pt-4">
        ${t.itemsCents > 0 ? `<div class="ck-row"><span>subtotal · ${t.oneTime.reduce((n, l) => n + l.qty, 0)} pack${t.oneTime.reduce((n, l) => n + l.qty, 0) === 1 ? "" : "s"}</span><span>${eur(t.itemsCents)}</span></div>` : ""}
        ${discountHtml}
        ${t.oneTime.length ? `<div class="ck-row"><span>shipping</span><span>${t.shippingCents === 0 ? "free" : eur(t.shippingCents)}</span></div>` : ""}
        ${t.subs.length ? `<div class="ck-row"><span>subscription · from ship date</span><span>${eur(t.subMonthlyCents)}/mo</span></div>` : ""}
        <div class="ck-total mt-1.5 border-t-2 border-forest/10 pt-3">
          <span>total due today</span>
          <span class="flex items-baseline gap-1.5"><span class="text-xs font-bold text-forest-soft">EUR</span>${eur(t.dueTodayCents)}</span>
        </div>
        ${t.subs.length ? `<p class="text-xs font-semibold leading-relaxed text-forest-soft">subscription is €0 today — card saved now, first charge of ${eur(t.subMonthlyCents)} around ${firstChargeDate()} (~${weeks} weeks, when the first drop ships). we email you before it happens. pause or cancel anytime.</p>` : ""}
      </div>`;
  }

  function paint() {
    const lines = loadLines();
    if (!lines.length) {
      $(".js-ck-page").classList.add("hidden");
      $(".js-ck-empty").classList.remove("hidden");
      return null;
    }
    const t = totals(lines);
    const html = renderSummary(lines, t);
    $$(".js-summary-slot").forEach((slot) => {
      slot.innerHTML = html;
    });
    $(".js-summary-total-mini").textContent = eur(t.dueTodayCents);
    renderShipping(t);
    const pay = $(".js-pay-label");
    pay.textContent = kindOf(t) === "setup" ? "start subscription · €0 today" : "pay now";
    // recurring terms must sit next to the pay button, not only inside the
    // (mobile-collapsed) summary — EU consumer + card-network requirement
    const legal = $(".js-ck-legal");
    if (legal) {
      const base = "pre-order: the first drop ships in 8–12 weeks, eu first. 14-day money-back guarantee from delivery — your statutory eu rights are unaffected.";
      legal.textContent = t.subs.length
        ? `${base} subscription: €0 today — first charge of ${eur(t.subMonthlyCents)} around ${firstChargeDate()}, then monthly until you cancel. pause or cancel anytime.`
        : base;
    }
    if (elements && kindOf(t) === "payment") elements.update({ amount: t.dueTodayCents });
    return t;
  }

  /* Shopify behavior: shipping options stay hidden behind a placeholder until
   * the delivery address is actually filled in. */
  const addressComplete = () =>
    $(".js-address").value.trim().length > 1 && $(".js-postal").value.trim().length > 1 && $(".js-city").value.trim().length > 0;

  function renderShipping(t) {
    const wrap = $(".js-ship-options");
    if (!addressComplete()) {
      wrap.innerHTML = `<p class="rounded-[10px] border-[1.5px] border-dashed border-forest/30 bg-white/50 p-3.5 text-sm font-semibold text-forest-soft">enter your delivery address to see shipping options.</p>`;
      $(".js-ship-note").classList.add("hidden");
      return;
    }
    if (!t.oneTime.length) {
      wrap.innerHTML = `<p class="rounded-[10px] border-[1.5px] border-forest/20 bg-tint-apple/40 p-3.5 text-sm font-semibold text-forest-soft">subscription deliveries ship monthly once the first drop lands — shipping is on us.</p>`;
    } else {
      wrap.innerHTML = `
        <label class="ck-option rounded-[10px]">
          <input type="radio" name="ship-method" value="standard" checked />
          <span class="min-w-0 flex-1">standard shipping (eu) <span class="block text-xs font-semibold text-forest-soft">arrives with the first drop, 8–12 weeks</span></span>
          <span class="shrink-0 font-bold">${t.shippingCents === 0 ? "free" : eur(t.shippingCents)}</span>
        </label>`;
    }
    $(".js-ship-note").classList.toggle("hidden", !t.oneTime.length);
  }

  /* ---------- countries ---------- */
  function fillCountries() {
    let names;
    try {
      names = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      names = { of: (c) => c };
    }
    const options = config.shipCountries
      .map((c) => ({ code: c, name: names.of(c) || c }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => `<option value="${c.code}">${esc(c.name)}</option>`)
      .join("");
    [$(".js-country"), $(".js-bill-country")].forEach((select) => {
      if (!select) return;
      select.innerHTML = options;
      select.value = "DK";
    });
  }

  /* ---------- stripe ---------- */
  function appearance() {
    return {
      theme: "stripe",
      variables: {
        colorPrimary: "#225e30",
        colorText: "#225e30",
        colorTextSecondary: "#4a7354",
        colorDanger: "#c21f37",
        colorBackground: "#ffffff",
        borderRadius: "12px",
        fontFamily: "Nunito, ui-rounded, system-ui, sans-serif",
        focusOutline: "3px solid #a4d65e",
        focusBoxShadow: "none",
      },
      rules: {
        ".Input": { borderColor: "rgba(34, 94, 48, 0.25)", borderWidth: "2px", fontWeight: "600" },
        ".Input:hover": { borderColor: "rgba(34, 94, 48, 0.4)" },
        ".Input--invalid": { borderColor: "#c21f37" },
        ".Label": { fontWeight: "700", color: "#4a7354" },
        ".AccordionItem": { borderColor: "rgba(34, 94, 48, 0.2)", borderWidth: "2px", fontWeight: "700" },
        ".Tab": { borderColor: "rgba(34, 94, 48, 0.2)", borderWidth: "2px" },
      },
    };
  }

  function initStripe(t) {
    if (!config.ready || !window.Stripe) {
      $(".js-ck-offline").classList.remove("hidden");
      return;
    }
    stripe = Stripe(config.publishableKey);
    const kind = kindOf(t);
    elementsKind = kind;
    elementsHadSubs = t.subs.length > 0;
    const options = {
      appearance: appearance(),
      fonts: [{ cssSrc: `${location.origin}/fonts/fonts.css` }],
      locale: "en", // match the site's €49.99 formatting inside the iframe
      currency: config.currency,
      ...(kind === "payment"
        ? { mode: "payment", amount: t.dueTodayCents, ...(t.subs.length ? { setupFutureUsage: "off_session" } : {}) }
        : { mode: "setup", paymentMethodTypes: ["card"] }), // matches the subscription's payment_settings server-side
    };
    elements = stripe.elements(options);

    paymentElement = elements.create("payment", {
      layout: { type: "accordion", radios: true, spacedAccordionItems: false },
      fields: { billingDetails: "never" },
    });
    paymentElement.mount(".js-payment-mount");
    paymentElement.on("ready", () => {
      $$(".js-payment-mount .ck-skel").forEach((el) => el.remove());
      $(".js-pay").disabled = false;
    });
    paymentElement.on("change", () => showError(""));
    paymentElement.on("loaderror", (e) => showError(e.error?.message || "payment form failed to load — refresh to retry."));

    // express checkout (apple pay / google pay / link) — collects its own
    // contact + shipping, so it can skip the form entirely, Shopify-style.
    // one-time-ONLY carts: any cart with a subscription goes through the form,
    // where the recurring amount, first-charge date and cancel terms are
    // disclosed before paying — a wallet sheet shows none of that.
    if (kind !== "payment" || t.subs.length > 0) return;
    try {
      const express = elements.create("expressCheckout", {
        emailRequired: true,
        phoneNumberRequired: false,
        shippingAddressRequired: true,
        allowedShippingCountries: config.shipCountries,
        shippingRates: [
          {
            id: "standard",
            displayName: "standard shipping (eu) — with the first drop",
            amount: t.shippingCents,
          },
        ],
        buttonHeight: 52,
      });
      express.mount("#express-checkout");
      express.on("ready", (event) => {
        if (event.availablePaymentMethods) $(".js-express-wrap").classList.remove("hidden");
      });
      express.on("confirm", (event) => submitOrder({ express: event }));
    } catch {
      /* express checkout unavailable — the form still works */
    }
  }

  /* ---------- validation ---------- */
  function collectShipping() {
    return {
      name: `${$(".js-first").value.trim()} ${$(".js-last").value.trim()}`.trim(),
      phone: $(".js-phone").value.trim(),
      address: {
        line1: $(".js-address").value.trim(),
        line2: $(".js-address2").value.trim(),
        city: $(".js-city").value.trim(),
        postal_code: $(".js-postal").value.trim(),
        country: $(".js-country").value,
      },
    };
  }

  const billingDifferent = () => $('input[name="billing-choice"]:checked')?.value === "different";

  function collectBilling(shipping, email) {
    if (!billingDifferent()) return { name: shipping.name, email, phone: shipping.phone || undefined, address: shipping.address };
    // validated by validateForm() — a chosen "different" address is never
    // silently swapped for the shipping one
    return {
      name: `${$(".js-bill-first").value.trim()} ${$(".js-bill-last").value.trim()}`.trim(),
      email,
      address: {
        line1: $(".js-bill-address").value.trim(),
        line2: "",
        city: $(".js-bill-city").value.trim(),
        postal_code: $(".js-bill-postal").value.trim(),
        country: $(".js-bill-country").value,
      },
    };
  }

  /* one source of truth for field rules — used by submit validation AND
   * blur-time validation (Shopify validates on blur, clears on typing) */
  const BASE_CHECKS = [
    [".js-email", (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)],
    [".js-first", (v) => v.length > 0],
    [".js-last", (v) => v.length > 0],
    [".js-address", (v) => v.length > 1],
    [".js-postal", (v) => v.length > 1],
    [".js-city", (v) => v.length > 0],
  ];
  const BILLING_CHECKS = [
    [".js-bill-first", (v) => v.length > 0],
    [".js-bill-last", (v) => v.length > 0],
    [".js-bill-address", (v) => v.length > 1],
    [".js-bill-postal", (v) => v.length > 1],
    [".js-bill-city", (v) => v.length > 0],
  ];
  const activeChecks = () => [...BASE_CHECKS, ...(billingDifferent() ? BILLING_CHECKS : [])];

  function validateForm() {
    let firstBad = null;
    for (const [sel, ok] of activeChecks()) {
      const input = $(sel);
      const good = ok(input.value.trim());
      input.setAttribute("aria-invalid", String(!good));
      if (!good && !firstBad) firstBad = input;
    }
    if (firstBad) {
      firstBad.focus();
      showError("almost there — fill in the highlighted fields.", { scroll: false }); // the focused field is the anchor
      return false;
    }
    return true;
  }

  function initFieldValidation() {
    for (const [sel, ok] of [...BASE_CHECKS, ...BILLING_CHECKS]) {
      const input = $(sel);
      if (!input) continue;
      input.addEventListener("blur", () => {
        if (input.value.trim() === "") return; // never scold an untouched field
        input.setAttribute("aria-invalid", String(!ok(input.value.trim())));
      });
      input.addEventListener("input", () => input.removeAttribute("aria-invalid"));
    }
  }

  function showError(message, { scroll = true } = {}) {
    const box = $(".js-ck-error");
    box.textContent = message;
    box.classList.toggle("hidden", !message);
    if (message && scroll) box.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function setSubmitting(on, kind) {
    submitting = on;
    const btn = $(".js-pay");
    btn.disabled = on;
    btn.setAttribute("aria-busy", String(on));
    const label = $(".js-pay-label");
    if (on) {
      label.innerHTML =
        '<span class="inline-flex items-center gap-2"><svg viewBox="0 0 24 24" class="size-5 animate-spin motion-reduce:animate-none" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M12 3a9 9 0 1 1-9 9" stroke-linecap="round"/></svg>processing…</span>';
    } else {
      label.textContent = kind === "setup" ? "start subscription · €0 today" : "pay now";
    }
  }

  /* ---------- submit ---------- */
  async function submitOrder({ express } = {}) {
    if (submitting) return;
    const lines = loadLines();
    if (!lines.length) return;
    const t = totals(lines);
    const kind = kindOf(t);
    if (!express && !validateForm()) return;
    if (!stripe || !elements) {
      showError("payments aren't switched on yet — your bag is saved, try again in a bit.");
      return;
    }
    // the bag may have changed in another tab since this page initialized —
    // deferred elements must match the intent exactly, so re-sync or reload
    if (kind !== elementsKind || (kind === "payment" && t.subs.length > 0 !== elementsHadSubs)) {
      showError("your bag changed — refreshing so the totals are right.");
      setTimeout(() => location.reload(), 1200);
      return;
    }
    if (kind === "payment") elements.update({ amount: t.dueTodayCents });

    let email;
    let shipping;
    let billing = null;
    if (express) {
      email = express.billingDetails?.email || express.shippingAddress?.email || "";
      const addr = express.shippingAddress;
      shipping = addr
        ? { name: addr.name || "", phone: addr.phone || "", address: { line1: addr.address.line1 || "", line2: addr.address.line2 || "", city: addr.address.city || "", postal_code: addr.address.postal_code || "", country: addr.address.country || "" } }
        : collectShipping();
    } else {
      email = $(".js-email").value.trim();
      shipping = collectShipping();
      billing = collectBilling(shipping, email);
    }

    showError("");
    setSubmitting(true, kind);
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) throw { soft: true, message: submitError.message };

      const response = await fetch("/api/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ sku: l.sku, qty: l.qty })),
          email,
          code: promo?.code || undefined,
          newsletter: Boolean($(".js-newsletter")?.checked),
          shipping,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.clientSecret) throw { soft: true, message: data.error || "couldn't start checkout — please try again." };

      try {
        sessionStorage.setItem(
          SNAP_KEY,
          JSON.stringify({ lines: lines.map(({ sku, label, cents, qty, mode }) => ({ sku, label, cents, qty, mode })), amounts: data.amounts, email, kind: data.kind, ts: Date.now() })
        );
      } catch {
        /* snapshot is optional */
      }

      const thanksUrl = `${location.origin}${location.pathname.replace(/[^/]*$/, "")}thanks.html`;
      const confirmParams = {
        return_url: thanksUrl,
        ...(billing ? { payment_method_data: { billing_details: billing } } : {}),
      };
      // Cards resolve on-page ("if_required"); redirect methods (iDEAL,
      // bancontact, klarna, wallets) go to Stripe and land on thanks.html with
      // the same query params we build here — one landing path either way.
      if (data.kind === "payment") {
        const result = await stripe.confirmPayment({ elements, clientSecret: data.clientSecret, confirmParams, redirect: "if_required" });
        if (result.error) throw { soft: true, message: result.error.message };
        if (result.paymentIntent) {
          location.assign(`${thanksUrl}?payment_intent=${encodeURIComponent(result.paymentIntent.id)}&payment_intent_client_secret=${encodeURIComponent(data.clientSecret)}&redirect_status=${encodeURIComponent(result.paymentIntent.status)}`);
        }
      } else {
        const result = await stripe.confirmSetup({ elements, clientSecret: data.clientSecret, confirmParams, redirect: "if_required" });
        if (result.error) throw { soft: true, message: result.error.message };
        if (result.setupIntent) {
          location.assign(`${thanksUrl}?setup_intent=${encodeURIComponent(result.setupIntent.id)}&setup_intent_client_secret=${encodeURIComponent(data.clientSecret)}&redirect_status=${encodeURIComponent(result.setupIntent.status)}`);
        }
      }
    } catch (error) {
      showError(error?.message || "something went wrong — you have not been charged. please try again.");
      setSubmitting(false, kind);
    }
  }

  /* ---------- promo ---------- */
  async function applyPromo(code) {
    // the summary (incl. .js-promo-msg) exists twice — desktop aside + mobile
    // panel — so error text must land in both
    const say = (text) =>
      $$(".js-promo-msg").forEach((msg) => {
        msg.textContent = text;
        msg.classList.remove("hidden");
      });
    try {
      const lines = loadLines();
      const response = await fetch("/api/validate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lines.map((l) => ({ sku: l.sku, qty: l.qty })), code }),
      });
      const data = await response.json().catch(() => ({}));
      if (data.valid) {
        promo = { code: data.code, discountCents: data.discountCents };
        paint();
      } else {
        say(data.reason || data.error || "that code isn't valid");
      }
    } catch {
      say("couldn't check that code — please try again");
    }
  }

  /* ---------- wire up ---------- */
  async function init() {
    try {
      const response = await fetch("/api/config", { headers: { Accept: "application/json" } });
      if (response.ok) config = { ...FALLBACK, ...(await response.json()) };
    } catch {
      /* static preview: fallback config, offline notice below */
    }

    fillCountries();
    const t = paint();
    if (!t) return; // empty bag

    initStripe(t);
    if (!config.ready) $(".js-ck-offline").classList.remove("hidden");

    $(".js-summary-toggle").addEventListener("click", () => {
      const btn = $(".js-summary-toggle");
      const panel = document.getElementById("summary-mobile");
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      panel.classList.toggle("hidden", open);
      $(".js-summary-label").textContent = open ? "show order summary" : "hide order summary";
    });

    $$('input[name="billing-choice"]').forEach((radio) =>
      radio.addEventListener("change", () => {
        const different = $('input[name="billing-choice"]:checked')?.value === "different";
        const fields = $(".js-billing-fields");
        fields.classList.toggle("hidden", !different);
        fields.classList.toggle("flex", different);
      })
    );

    document.addEventListener("submit", (event) => {
      const promoForm = event.target.closest(".js-promo-form");
      if (promoForm) {
        event.preventDefault();
        const input = promoForm.querySelector(".js-promo-input");
        if (input.value.trim()) applyPromo(input.value.trim());
        return;
      }
      if (event.target.closest(".js-ck-form")) {
        event.preventDefault();
        submitOrder();
      }
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest(".js-promo-remove")) {
        promo = null;
        paint();
      }
    });

    // apply button wakes up only once a code is typed (summary re-renders,
    // so this is delegated)
    document.addEventListener("input", (event) => {
      const input = event.target.closest(".js-promo-input");
      if (!input) return;
      const button = input.closest(".js-promo-form")?.querySelector('button[type="submit"]');
      if (button && !promo) button.disabled = input.value.trim() === "";
    });

    initFieldValidation();

    // reveal shipping options live as the address gets completed
    [".js-address", ".js-postal", ".js-city"].forEach((sel) =>
      $(sel).addEventListener("input", () => renderShipping(totals(loadLines())))
    );
    $(".js-country").addEventListener("change", () => renderShipping(totals(loadLines())));

    // Shopify starts the journey in the email field — desktop only, a popping
    // mobile keyboard is hostile
    if (window.matchMedia("(min-width: 1024px)").matches) $(".js-email")?.focus({ preventScroll: true });
  }

  init();
})();
