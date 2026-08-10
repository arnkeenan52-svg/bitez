/* bitez — launch site interactions */

/**
 * First-drop list endpoint (Formspree/Mailchimp-style POST target).
 * Receives fields: email, selection (e.g. "onetime-6" or "sub-9"),
 * selection_label (e.g. "6-pack · €49.99"). No payments are taken.
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

/* ---------- first-drop list form ---------- */
function showError(form, message) {
  const status = form.querySelector(".js-form-status") || form.parentElement.querySelector(".js-form-status");
  if (!status) return;
  status.innerHTML = message
    ? `<p class="inline-block rounded-full bg-white px-4 py-2 text-sm font-bold text-berry-deep">${message}</p>`
    : "";
}

function initChooser() {
  const section = document.getElementById("preorder");
  if (!section) return;
  const tabs = [...section.querySelectorAll(".js-mode-tab")];
  const panels = [...section.querySelectorAll(".js-mode-panel")];
  const form = section.querySelector(".js-join-form");
  if (!tabs.length || !panels.length || !form) return;
  const selectionInput = form.querySelector('input[name="selection"]');
  const selectionLabel = form.querySelector('input[name="selection_label"]');
  const selectionNote = form.querySelector(".js-selection-note");
  const submit = form.querySelector('button[type="submit"]');

  const setMode = (mode) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.mode === mode;
      tab.setAttribute("aria-pressed", String(active));
      tab.classList.toggle("is-active", active);
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.mode !== mode;
    });
  };
  tabs.forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));

  section.querySelectorAll(".js-choose").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectionInput.value = btn.dataset.selection;
      selectionLabel.value = btn.dataset.label;
      selectionNote.textContent = `your pick: ${btn.dataset.label}`;
      submit.textContent = btn.dataset.selection.startsWith("sub") ? "reserve my subscription" : "join the first drop";
      form.scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth", block: "center" });
      const email = form.querySelector('input[type="email"]');
      setTimeout(() => email.focus({ preventScroll: true }), REDUCED_MOTION ? 0 : 350);
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = form.querySelector('input[type="email"]');
    const email = input.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError(form, "that email doesn't look right. mind checking it?");
      input.focus();
      return;
    }
    showError(form, "");
    submit.disabled = true;
    const restore = submit.textContent;
    submit.textContent = "saving your spot…";
    try {
      if (FORM_ENDPOINT) {
        const data = new FormData(form);
        const response = await fetch(FORM_ENDPOINT, { method: "POST", headers: { Accept: "application/json" }, body: data });
        if (!response.ok) throw new Error(`endpoint responded ${response.status}`);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 450));
      }
      form.innerHTML = `
        <p class="rounded-2xl border-[3px] border-apple bg-white/70 px-5 py-4 font-display text-xl font-bold lowercase text-forest">
          you're on the list 🍏
          <span class="mt-1 block font-body text-sm font-semibold text-forest-soft">first drop goes to you before anyone else.</span>
        </p>`;
      gummyConfetti();
    } catch (error) {
      showError(form, "something went wrong. mind trying again?");
      submit.disabled = false;
      submit.textContent = restore;
    }
  });
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
initChooser();
initFlavorVotes();
initGallery();
initStickyCta();
