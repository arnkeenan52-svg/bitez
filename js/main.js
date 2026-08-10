/* bitez — launch site interactions */

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

/* ---------- pack chooser ---------- */
function initChooser() {
  const section = document.getElementById("preorder");
  if (!section) return;
  const tabs = [...section.querySelectorAll(".js-mode-tab")];
  const panels = [...section.querySelectorAll(".js-mode-panel")];
  const cta = section.querySelector(".js-join");
  if (!tabs.length || !panels.length || !cta) return;
  const subLines = section.querySelector(".js-sub-lines");
  let mode = "onetime";

  const picked = () => {
    const panel = panels.find((p) => p.dataset.mode === mode);
    return panel && panel.querySelector("input:checked");
  };
  const updateCta = () => {
    const radio = picked();
    if (!radio) return;
    const verb = mode === "sub" ? "start my subscription" : "join the first drop";
    cta.textContent = `${verb} · ${radio.dataset.short}`;
  };
  const setMode = (next) => {
    mode = next;
    tabs.forEach((tab) => {
      const active = tab.dataset.mode === mode;
      tab.setAttribute("aria-pressed", String(active));
      tab.classList.toggle("is-active", active);
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.mode !== mode;
    });
    if (subLines) subLines.classList.toggle("invisible", mode !== "sub");
    updateCta();
  };
  tabs.forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
  panels.forEach((panel) => panel.addEventListener("change", updateCta));
  setMode("onetime");

  cta.addEventListener("click", () => {
    const radio = picked();
    if (!radio) return;
    cartAdd({
      flavor: "green apple",
      size: radio.value,
      sizeLabel: radio.dataset.label,
      price: parseFloat(radio.dataset.price),
      qty: 1,
    });
    gummyConfetti(8);
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
  const isSub = (i) => String(i.size).startsWith("sub");
  // one-time packs are due today; subscription lines are monthly (€0 today) —
  // never fold the two into one number
  const oneTimeTotal = items.filter((i) => !isSub(i)).reduce((t, i) => t + i.price * i.qty, 0);
  const monthlyTotal = items.filter(isSub).reduce((t, i) => t + i.price * i.qty, 0);
  const hasOneTime = items.some((i) => !isSub(i));
  // "onetime-6" / "sub-9" → bags per unit, for the free-shipping hint
  const bags = items.reduce((n, i) => n + (parseInt(String(i.size).split("-")[1], 10) || 0) * i.qty, 0);

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
          <p class="text-sm font-semibold text-forest-soft">${item.sizeLabel} · €${item.price.toFixed(2)}${String(item.size).startsWith("sub") ? "/mo" : ""}</p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <button type="button" class="js-cart-minus qty-btn !text-base" data-index="${i}" aria-label="one fewer ${item.flavor}">−</button>
          <span class="w-5 text-center font-display font-bold">${item.qty}</span>
          <button type="button" class="js-cart-plus qty-btn !text-base" data-index="${i}" aria-label="one more ${item.flavor}">+</button>
        </div>
      </div>`
    )
    .join("");
  const totalEl = document.querySelector(".js-cart-total");
  if (totalEl) totalEl.textContent = `€${oneTimeTotal.toFixed(2)}`;
  const monthlyEl = document.querySelector(".js-cart-monthly");
  if (monthlyEl) {
    monthlyEl.textContent = monthlyTotal > 0 ? `+ €${monthlyTotal.toFixed(2)}/month from when your bags ship · €0 today` : "";
    monthlyEl.hidden = monthlyTotal === 0;
  }
  const shipEl = document.querySelector(".js-cart-ship");
  if (shipEl) {
    shipEl.textContent = !hasOneTime
      ? "subscription deliveries ship free — shipping is on us."
      : bags >= 6
        ? "free eu shipping unlocked 🍏"
        : `add ${6 - bags} more bag${6 - bags === 1 ? "" : "s"} for free eu shipping — standard shipping added at checkout.`;
  }
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
          <span>due today</span>
          <span class="js-cart-total">€0.00</span>
        </div>
        <p class="js-cart-monthly text-sm font-bold text-forest-soft" hidden></p>
        <p class="js-cart-ship mt-2 text-xs font-semibold text-forest-soft"></p>
        <a href="checkout.html" class="btn btn-primary mt-4 flex min-h-[52px] w-full items-center justify-center text-lg lowercase">checkout</a>
        <p class="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-forest-soft">
          <svg viewBox="0 0 24 24" class="size-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" /></svg>
          secure checkout by stripe · first drop ships in 8–12 weeks
        </p>
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
      const full = thumb.dataset.full;
      main.src = full;
      main.srcset = `${full.replace(/\.jpg$/, "-500.jpg")} 500w, ${full} 1000w`;
      if (source && thumb.dataset.webp) {
        const webp = thumb.dataset.webp;
        source.srcset = `${webp.replace(/\.webp$/, "-500.webp")} 500w, ${webp} 1000w`;
      }
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
initChooser();
initFlavorVotes();
initGallery();
initStickyCta();
