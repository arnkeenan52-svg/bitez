/* bitez — launch site interactions */

/**
 * Pre-order endpoint (Formspree/Mailchimp-style POST target).
 * Receives fields: size, qty, email, total_eur.
 * Leave empty to demo the success state without a backend.
 * Example: const FORM_ENDPOINT = "https://formspree.io/f/yourFormId";
 */
const FORM_ENDPOINT = "";

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const GUMMY_COLORS = ["#a4d65e", "#e63950", "#f5c242"];

// gates the scroll-reveal styles so a no-JS visitor sees everything statically
document.documentElement.classList.add("js-enabled");

/* ---------- scroll-triggered reveals ---------- */
function initScrollReveals() {
  const els = document.querySelectorAll(".reveal");
  if (REDUCED_MOTION || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-inview"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-inview");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  els.forEach((el) => io.observe(el));
}

/* ---------- graceful placeholders for missing assets ---------- */
function initAssetFallbacks() {
  document.querySelectorAll(".asset-frame img").forEach((img) => {
    const markMissing = () => img.closest(".asset-frame").classList.add("img-missing");
    if (img.complete && img.naturalWidth === 0) markMissing();
    img.addEventListener("error", markMissing);
  });
}

/* ---------- gummy bear confetti ---------- */
function bearSvg(color, size) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 120 140");
  svg.setAttribute("width", size);
  svg.setAttribute("height", (size * 140) / 120);
  svg.style.color = color;
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", "#gummy-bear");
  svg.appendChild(use);
  return svg;
}

function gummyConfetti(count = 26) {
  if (REDUCED_MOTION) return;
  for (let i = 0; i < count; i += 1) {
    const bear = document.createElement("div");
    bear.className = "confetti-bear";
    bear.style.left = `${4 + Math.random() * 92}vw`;
    bear.style.setProperty("--fall-time", `${2.2 + Math.random() * 1.3}s`);
    bear.style.setProperty("--spin", `${Math.random() > 0.5 ? "" : "-"}${180 + Math.random() * 220}deg`);
    bear.style.animationDelay = `${Math.random() * 0.45}s`;
    bear.appendChild(bearSvg(GUMMY_COLORS[i % GUMMY_COLORS.length], 16 + Math.random() * 18));
    document.body.appendChild(bear);
    bear.addEventListener("animationend", () => bear.remove());
  }
}

/* ---------- pre-order form ---------- */
function showError(form, message) {
  const status = form.parentElement.querySelector(".js-form-status");
  if (!status) return;
  status.innerHTML = message
    ? `<p class="inline-block rounded-full bg-white px-4 py-2 text-sm font-bold text-berry-deep">${message}</p>`
    : "";
}

function initPreorderForms() {
  document.querySelectorAll("form.js-preorder").forEach((form) => {
    const button = form.querySelector('button[type="submit"]');

    const selection = () => {
      const pack = form.querySelector('input[name="pack"]:checked');
      return {
        flavor: form.dataset.flavor || "green apple",
        size: pack.value,
        sizeLabel: pack.dataset.label || pack.value,
        price: parseFloat(pack.dataset.price),
        qty: 1,
      };
    };
    const updateTotal = () => {
      button.textContent = `add to bag · €${selection().price.toFixed(2)}`;
    };

    form.querySelectorAll('input[name="pack"]').forEach((radio) => radio.addEventListener("change", updateTotal));
    updateTotal();

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      cartAdd(selection());
      gummyConfetti(8);
    });
  });
}

/* ---------- cart (first-party localStorage, UI injected on every page) ---------- */
const CART_KEY = "bitez-cart";
const BAG_ICON =
  '<svg viewBox="0 0 24 24" class="size-6" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6.2 7.5h11.6l.8 9.6a3.6 3.6 0 0 1-3.6 3.9H9a3.6 3.6 0 0 1-3.6-3.9z" stroke-linejoin="round"/><path d="M8.8 7.5a3.2 3.2 0 0 0 6.4 0"/></svg>';

function cartLoad() {
  try {
    const items = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}
function cartSave(items) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {
    /* private mode: cart lives for the page view only */
  }
  renderCart(items);
}
function cartAdd(item) {
  const items = cartLoad();
  const existing = items.find((i) => i.flavor === item.flavor && i.size === item.size);
  if (existing) {
    existing.qty = Math.min(10, existing.qty + item.qty);
  } else {
    items.push(item);
  }
  cartSave(items);
  openCart();
}
function cartSetQty(index, qty) {
  const items = cartLoad();
  if (!items[index]) return;
  items[index].qty = qty;
  if (items[index].qty < 1) items.splice(index, 1);
  cartSave(items);
}

function openCart() {
  document.body.classList.add("cart-open");
  const drawer = document.querySelector(".cart-drawer");
  if (drawer) drawer.querySelector(".js-cart-dismiss").focus();
}
function closeCart() {
  document.body.classList.remove("cart-open");
  const btn = document.querySelector(".js-cart-open");
  if (btn) btn.focus();
}

function renderCart(items = cartLoad()) {
  const count = items.reduce((n, i) => n + i.qty, 0);
  const total = items.reduce((t, i) => t + i.price * i.qty, 0).toFixed(2);

  const badge = document.querySelector(".js-cart-count");
  if (badge) {
    badge.textContent = count;
    badge.hidden = count === 0;
  }
  const list = document.querySelector(".js-cart-items");
  const footer = document.querySelector(".js-cart-footer");
  if (!list || !footer) return;

  if (!items.length) {
    list.innerHTML =
      '<p class="font-semibold text-forest-soft">your bag is empty.</p><a href="green-apple.html" class="mt-2 inline-block font-display font-bold lowercase text-forest underline underline-offset-4">add some gummies →</a>';
    footer.hidden = true;
    return;
  }
  footer.hidden = false;
  list.innerHTML = items
    .map(
      (item, i) => `
      <div class="cart-item">
        <div class="min-w-0">
          <p class="truncate font-display font-bold lowercase">${item.flavor}</p>
          <p class="text-sm font-semibold text-forest-soft">${item.sizeLabel} · €${item.price.toFixed(2)}</p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <button type="button" class="js-cart-minus qty-btn !size-9 !text-base" data-index="${i}" aria-label="one fewer ${item.flavor}">−</button>
          <span class="w-5 text-center font-display font-bold">${item.qty}</span>
          <button type="button" class="js-cart-plus qty-btn !size-9 !text-base" data-index="${i}" aria-label="one more ${item.flavor}">+</button>
        </div>
      </div>`
    )
    .join("");
  const totalEl = document.querySelector(".js-cart-total");
  if (totalEl) totalEl.textContent = `€${total}`;
}

function initCart() {
  const header = document.querySelector("header");
  if (!header) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cart-btn js-cart-open";
  btn.setAttribute("aria-label", "open your bag");
  btn.innerHTML = `${BAG_ICON}<span class="cart-badge js-cart-count" hidden>0</span>`;
  (header.querySelector(".js-header-actions") || header).appendChild(btn);

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="cart-overlay" aria-hidden="true"></div>
    <aside class="cart-drawer" role="dialog" aria-modal="true" aria-label="your bag">
      <div class="flex items-center justify-between border-b-2 border-forest/10 p-5">
        <h2 class="font-display text-2xl font-extrabold lowercase">your bag</h2>
        <button type="button" class="js-cart-dismiss qty-btn" aria-label="close your bag">×</button>
      </div>
      <div class="js-cart-items flex flex-1 flex-col gap-3 overflow-y-auto p-5"></div>
      <div class="js-cart-footer border-t-2 border-forest/10 p-5" hidden>
        <div class="flex items-baseline justify-between font-display text-xl font-extrabold lowercase">
          <span>total</span>
          <span class="js-cart-total">€0.00</span>
        </div>
        <form class="js-cart-checkout mt-4 flex flex-col gap-3" novalidate>
          <label for="cart-email" class="sr-only">email address</label>
          <input id="cart-email" name="email" type="email" required autocomplete="email" placeholder="your email"
            class="min-h-[52px] rounded-2xl border-[3px] border-forest/25 bg-white px-5 text-base font-semibold text-forest placeholder:text-forest/45 focus:border-forest" />
          <button type="submit" class="btn btn-primary min-h-[52px] text-lg lowercase">reserve pre-order</button>
        </form>
        <div class="js-form-status mt-3" role="status" aria-live="polite"></div>
        <p class="mt-3 text-xs font-semibold text-forest-soft">nothing charged today. we email a payment link when your order ships, 8–12 weeks out.</p>
      </div>
    </aside>`;
  document.body.appendChild(wrap);

  btn.addEventListener("click", openCart);
  wrap.querySelector(".cart-overlay").addEventListener("click", closeCart);
  wrap.querySelector(".js-cart-dismiss").addEventListener("click", closeCart);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("cart-open")) closeCart();
  });
  wrap.addEventListener("click", (e) => {
    const minus = e.target.closest(".js-cart-minus");
    const plus = e.target.closest(".js-cart-plus");
    if (minus) cartSetQty(Number(minus.dataset.index), cartLoad()[Number(minus.dataset.index)].qty - 1);
    if (plus) cartSetQty(Number(plus.dataset.index), Math.min(10, cartLoad()[Number(plus.dataset.index)].qty + 1));
  });

  const checkout = wrap.querySelector(".js-cart-checkout");
  checkout.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = checkout.querySelector('input[type="email"]');
    const email = input.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError(checkout, "that email doesn't look right. mind checking it?");
      input.focus();
      return;
    }
    showError(checkout, "");
    const items = cartLoad();
    const total = items.reduce((t, i) => t + i.price * i.qty, 0).toFixed(2);
    const button = checkout.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "reserving…";
    try {
      if (FORM_ENDPOINT) {
        const data = new FormData();
        data.set("email", email);
        data.set("order", items.map((i) => `${i.flavor} ${i.sizeLabel} x${i.qty}`).join("; "));
        data.set("total_eur", total);
        const response = await fetch(FORM_ENDPOINT, { method: "POST", headers: { Accept: "application/json" }, body: data });
        if (!response.ok) throw new Error(`endpoint responded ${response.status}`);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 450));
      }
      cartSave([]);
      const status = wrap.querySelector(".js-form-status");
      const list = wrap.querySelector(".js-cart-items");
      list.innerHTML = `
        <p class="rounded-2xl border-[3px] border-apple bg-white/70 px-5 py-4 font-display text-xl font-bold lowercase text-forest">
          pre-order reserved 🍏 · €${total}
          <span class="mt-1 block font-body text-sm font-semibold text-forest-soft">nothing charged today. your payment link lands in your inbox before your order ships, 8–12 weeks out.</span>
        </p>`;
      status.innerHTML = "";
      gummyConfetti();
    } catch (error) {
      showError(checkout, "something went wrong. mind trying again?");
      button.disabled = false;
      button.textContent = "reserve pre-order";
    }
  });

  renderCart();
}

/* ---------- product gallery ---------- */
function initGallery() {
  const main = document.querySelector(".js-pdp-main");
  const thumbs = [...document.querySelectorAll(".js-thumb")];
  if (!main || thumbs.length < 2) return;
  const source = main.closest("picture")?.querySelector("source");
  thumbs.forEach((thumb) => {
    thumb.addEventListener("click", () => {
      main.src = thumb.dataset.full;
      if (source && thumb.dataset.webp) source.srcset = thumb.dataset.webp;
      main.alt = thumb.dataset.alt || main.alt;
      thumbs.forEach((t) => t.setAttribute("aria-current", String(t === thumb)));
    });
  });
}

/* ---------- flavor votes (one vote per visitor, front-end only) ---------- */
function initFlavorVotes() {
  const buttons = [...document.querySelectorAll(".js-vote")];
  buttons.forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        const emoji = button.dataset.emoji || "";
        const note = button.parentElement.querySelector(".js-vote-note");
        buttons.forEach((b) => {
          b.disabled = true;
          b.classList.add("opacity-60", "pointer-events-none");
        });
        const label = button.querySelector(".vote-label");
        if (label) label.textContent = "vote counted";
        if (note) note.textContent = `vote counted ${emoji} · your vote picks the next drop.`;
        gummyConfetti(10);
      },
      { once: true }
    );
  });
}

/* ---------- sticky mobile CTA ---------- */
function initStickyCta() {
  const bar = document.getElementById("sticky-cta");
  const heroForm = document.getElementById("preorder") || document.getElementById("cta");
  const footer = document.querySelector("footer");
  if (!bar || !heroForm || !footer || !("IntersectionObserver" in window)) return;

  let heroVisible = true;
  let footerVisible = false;
  // on product pages (buy box present) the bar only appears on upward scroll intent
  const scrollUpOnly = Boolean(document.getElementById("preorder"));
  let scrollingUp = false;
  let lastY = window.scrollY;
  const update = () =>
    bar.classList.toggle("is-visible", !heroVisible && !footerVisible && (!scrollUpOnly || scrollingUp));

  if (scrollUpOnly) {
    window.addEventListener(
      "scroll",
      () => {
        const y = Math.max(0, window.scrollY);
        if (Math.abs(y - lastY) > 4) {
          // require real depth so the iOS top bounce and page open never show the bar
          scrollingUp = y < lastY && y > 400;
          lastY = y;
          update();
        }
      },
      { passive: true }
    );
  }

  new IntersectionObserver(
    ([entry]) => {
      heroVisible = entry.isIntersecting;
      update();
    },
    { rootMargin: "-64px 0px 0px 0px" }
  ).observe(heroForm);

  new IntersectionObserver(
    ([entry]) => {
      footerVisible = entry.isIntersecting;
      update();
    },
    { threshold: 0.08 }
  ).observe(footer);
}

initAssetFallbacks();
initScrollReveals();
initCart();
initPreorderForms();
initFlavorVotes();
initGallery();
initStickyCta();
