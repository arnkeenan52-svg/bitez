/* bitez — launch site interactions */

/**
 * Waitlist form endpoint (Formspree/Mailchimp-style POST target).
 * Leave empty during phase 1 to demo the success state without a backend.
 * Example: const FORM_ENDPOINT = "https://formspree.io/f/yourFormId";
 */
const FORM_ENDPOINT = "";

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const GUMMY_COLORS = ["#a4d65e", "#e63950", "#f5c242"];

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

/* ---------- waitlist forms ---------- */
function showSuccess(form) {
  const status = form.parentElement.querySelector(".js-form-status");
  form.hidden = true;
  if (status) {
    const onDark = Boolean(form.closest("footer"));
    status.innerHTML = `
      <p class="rounded-2xl border-[3px] ${onDark ? "border-apple/60 bg-white/10 text-cream" : "border-apple bg-white/70 text-forest"} px-5 py-4 font-display text-xl font-bold lowercase">
        you're on the list 🍏
        <span class="mt-1 block font-body text-sm font-semibold ${onDark ? "text-cream/80" : "text-forest/70"}">we'll email you when the first drop lands.</span>
      </p>`;
  }
  gummyConfetti();
}

function showError(form, message) {
  const status = form.parentElement.querySelector(".js-form-status");
  if (status) {
    status.innerHTML = `<p class="px-2 pt-1 text-sm font-bold text-berry">${message}</p>`;
  }
}

function initWaitlistForms() {
  document.querySelectorAll("form.js-waitlist").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = form.querySelector('input[type="email"]');
      const button = form.querySelector('button[type="submit"]');
      const email = input.value.trim();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError(form, "that email doesn't look right — mind checking it?");
        input.focus();
        return;
      }

      showError(form, "");
      button.disabled = true;
      const originalLabel = button.textContent;
      button.textContent = "joining…";

      try {
        if (FORM_ENDPOINT) {
          const response = await fetch(FORM_ENDPOINT, {
            method: "POST",
            headers: { Accept: "application/json" },
            body: new FormData(form),
          });
          if (!response.ok) throw new Error(`endpoint responded ${response.status}`);
        } else {
          // no endpoint wired yet — demo the success state
          await new Promise((resolve) => setTimeout(resolve, 450));
        }
        showSuccess(form);
      } catch (error) {
        showError(form, "something went wrong — mind trying again?");
        button.disabled = false;
        button.textContent = originalLabel;
      }
    });
  });
}

/* ---------- pineapple vote ---------- */
function initPineappleVote() {
  const button = document.getElementById("vote-pineapple");
  const note = document.getElementById("vote-note");
  if (!button || !note) return;
  button.addEventListener(
    "click",
    () => {
      button.disabled = true;
      button.classList.add("opacity-60", "pointer-events-none");
      button.textContent = "vote counted 🍍";
      note.classList.remove("hidden");
      gummyConfetti(10);
    },
    { once: true }
  );
}

/* ---------- sticky mobile CTA ---------- */
function initStickyCta() {
  const bar = document.getElementById("sticky-cta");
  const heroForm = document.getElementById("waitlist");
  const footer = document.querySelector("footer");
  if (!bar || !heroForm || !footer || !("IntersectionObserver" in window)) return;

  let heroVisible = true;
  let footerVisible = false;
  const update = () => bar.classList.toggle("is-visible", !heroVisible && !footerVisible);

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
initWaitlistForms();
initPineappleVote();
initStickyCta();
