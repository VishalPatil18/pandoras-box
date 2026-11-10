// Mockup behavior only. It mimics the real app's rules so the design can be judged in motion:
// the 60-second server window (countdown), optimistic edit with revert, and every fact state.
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const WINDOW_SECONDS = 60;
const FACTS = {
  inception: [
    "Inception (2010): the rotating hallway fight was shot for real, in a corridor set built inside a huge rotating rig in a former airship hangar in Cardington, England.",
    "Inception (2010): the snow fortress sequence was filmed at Fortress Mountain, a closed ski resort in Alberta, Canada.",
    "Inception (2010): Hans Zimmer built parts of the score from a slowed-down Non, je ne regrette rien, the song the team uses as its wake-up signal.",
  ],
  "the matrix": [
    "The Matrix (1999): the bullet-time shots used a ring of about 120 still cameras fired in sequence around the actor.",
    "The Matrix (1999): the falling green code was made from scanned Japanese cookbook recipes, according to its designer Simon Whiteley.",
  ],
};

const state = {
  movie: "Inception",
  fact: "fresh",
  factIndex: 0,
  generatedAt: Date.now() - 12_000,
  failSaves: false,
  hasPhoto: true,
  hasName: true,
};

const factsFor = (movie) => FACTS[movie.toLowerCase()] ?? [`${movie}: a fact about this film would appear here.`];

// Same rule the server enforces: trim, squash spaces, 1 to 100 characters, no control characters.
function validateMovie(raw) {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return { error: "Enter a movie title." };
  if (value.length > 100) return { error: "Keep the title under 100 characters." };
  if (/[\u0000-\u001F\u007F]/.test(value)) return { error: "Remove the hidden characters from the title." };
  return { value };
}

function showError(errorEl, input, message) {
  errorEl.hidden = !message;
  errorEl.querySelector("span").textContent = message ?? "";
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

function showScreen(name) {
  $$("[data-screen]").forEach((el) => (el.hidden = el.dataset.screen !== name));
  $('[data-control="screen"]').value = name;
}

let toastTimer;
function toast(message) {
  $("[data-toast-text]").textContent = message;
  $("[data-toast]").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("[data-toast]").hidden = true), 5000);
}

function renderProfile() {
  const display = state.hasName ? "Vishal Patil" : "vishal"; // email local part when Google sends no name
  $("[data-name]").textContent = display;
  $("[data-initials]").textContent = display.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  $("[data-avatar-img]").hidden = !state.hasPhoto;
}
$("[data-avatar-img]").addEventListener("error", (e) => (e.target.hidden = true)); // broken photo falls back to initials

function setMovie(title) {
  state.movie = title;
  $("[data-movie-title]").textContent = title;
  $("[data-stub-movie]").textContent = title;
}

function renderFact() {
  const ticket = $("[data-fact]");
  ticket.setAttribute("aria-busy", state.fact === "loading");
  $$("[data-fact] [data-state]").forEach((el) => (el.hidden = !el.dataset.state.split(" ").includes(state.fact)));
  const list = factsFor(state.movie);
  $("[data-fact-text]").textContent = list[state.factIndex % list.length];
  $('[data-control="fact"]').value = state.fact;
  tick();
}

function tick() {
  const age = Math.floor((Date.now() - state.generatedAt) / 1000);
  $("[data-age]").textContent = state.fact === "stale" ? "Generated 4 minutes ago" : `Generated ${age < 5 ? "just now" : `${age}s ago`}`;
  const remaining = WINDOW_SECONDS - age;
  const waiting = state.fact === "fresh" && remaining > 0;
  const busy = state.fact === "loading";
  const btn = $("[data-new-fact]");
  btn.hidden = state.fact === "error"; // the ticket's own "Try again" covers this state
  btn.disabled = busy || waiting;
  $("[data-new-fact-label]").textContent = busy ? "Getting a fact" : waiting ? `New fact in ${remaining}s` : "New fact";
  $("[data-new-fact-icon] use").setAttribute("href", waiting ? "#i-clock" : busy ? "#i-refresh-cw" : "#i-sparkles");
  $("[data-new-fact-icon]").classList.toggle("spin", busy);
}

function loadNewFact() {
  state.fact = "loading";
  renderFact();
  setTimeout(() => {
    state.factIndex += 1;
    state.generatedAt = Date.now();
    state.fact = "fresh";
    renderFact();
    const ticket = $("[data-fact]");
    ticket.classList.remove("reveal");
    void ticket.offsetWidth; // restart the print animation
    ticket.classList.add("reveal");
  }, 1300);
}

function startEdit() {
  $("[data-movie-view]").hidden = true;
  $('[data-form="edit"]').hidden = false;
  const input = $("#edit-input");
  showError($("#edit-error"), input, null);
  input.value = state.movie;
  input.focus();
  input.select();
}

function stopEdit() {
  $("[data-movie-view]").hidden = false;
  $('[data-form="edit"]').hidden = true;
  $('[data-action="edit"]').focus();
}

function saveEdit(e) {
  e.preventDefault();
  const input = $("#edit-input");
  const result = validateMovie(input.value);
  if (result.error) return showError($("#edit-error"), input, result.error);

  const previous = state.movie;
  if (result.value.toLowerCase() === previous.toLowerCase()) {
    setMovie(result.value); // capitalization-only change keeps the cached fact
    return stopEdit();
  }
  // Optimistic: show the new title now, put the old one back if the server refuses.
  setMovie(result.value);
  stopEdit();
  $("[data-saving]").hidden = false;
  setTimeout(() => {
    $("[data-saving]").hidden = true;
    if (state.failSaves) {
      setMovie(previous);
      return toast(`Couldn't save "${result.value}". Your favorite is still ${previous}.`);
    }
    state.factIndex = 0;
    loadNewFact(); // different movie, so the cached fact no longer applies
  }, 900);
}

function submitOnboarding(e) {
  e.preventDefault();
  const input = $("#onboard-input");
  const result = validateMovie(input.value);
  showError($("#onboard-error"), input, result.error);
  if (result.error) return;
  setMovie(result.value);
  state.factIndex = 0;
  showScreen("dashboard");
  loadNewFact();
}

document.addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (action === "signin") showScreen("onboarding");
  if (action === "logout") showScreen("landing");
  if (action === "edit") startEdit();
  if (action === "cancel") stopEdit();
  if (action === "new-fact" || action === "retry") loadNewFact();
});
$('[data-form="edit"]').addEventListener("submit", saveEdit);
$('[data-form="onboarding"]').addEventListener("submit", submitOnboarding);
$('[data-form="edit"]').addEventListener("keydown", (e) => e.key === "Escape" && stopEdit());

$('[data-control="screen"]').addEventListener("change", (e) => showScreen(e.target.value));
$('[data-control="fact"]').addEventListener("change", (e) => {
  state.fact = e.target.value;
  if (state.fact === "fresh") state.generatedAt = Date.now() - 12_000;
  renderFact();
});
$('[data-control="fail"]').addEventListener("change", (e) => (state.failSaves = e.target.checked));
$('[data-control="photo"]').addEventListener("change", (e) => { state.hasPhoto = e.target.checked; renderProfile(); });
$('[data-control="name"]').addEventListener("change", (e) => { state.hasName = e.target.checked; renderProfile(); });

const params = new URLSearchParams(location.search);
showScreen(params.get("screen") ?? "landing");
if (params.get("fact")) state.fact = params.get("fact");
renderProfile();
renderFact();
setInterval(tick, 1000);
