/* ============================================================
   MedGuard Care — frontend app
   ============================================================ */

const API = location.protocol.startsWith("http") ? location.origin : "http://localhost:8790";

const state = {
  medicines: [],
  categories: [],
  providers: [],
  labTests: [],
  labCategories: [],
  labSelection: null, // { tests: Set, slot }
  cart: [], // { id, name, price, qty, rx }
  coupon: null, // { code, discount, label }
  location: null, // { lat, lon }
  role: "all",
  careSelection: null, // { provider, mode, slot }
  user: null, // logged-in user { id, name, email, plusActive }
  token: null, // session token
  plan: null, // MedGuard Plus plan details
  view: "medicines", // active section view
  labQuery: "", // free-text filter for lab tests
  safetyPicks: [], // medicine ids selected in the standalone safety checker
  consult: null, // { id, provider } active in-app doctor chat
  rx: null, // last prescription object being viewed
  health: null, // My Health dashboard data { summary, orders, consultations, prescriptions }
};

const DEVICE_CATEGORIES = ["Devices", "Mobility Aids", "Protection"];
const MEMBER_RATE = 0.05;
const VIEWS = ["medicines", "devices", "labs", "care", "plus", "track", "support"];

const CONDITIONS = [
  { emoji: "🤒", label: "Fever", term: "fever" },
  { emoji: "🩸", label: "Diabetes", term: "sugar" },
  { emoji: "❤️", label: "BP / Heart", term: "bp" },
  { emoji: "🤧", label: "Allergy & Cold", term: "allergy" },
  { emoji: "🦋", label: "Thyroid", term: "thyroid" },
  { emoji: "💊", label: "Pain", term: "pain" },
  { emoji: "🦴", label: "Bones & Vitamins", term: "bones" },
  { emoji: "🫁", label: "Breathing", term: "breathing" },
  { emoji: "🤢", label: "Digestion", term: "acidity" },
];

const dom = {};

/* ---------- utilities ---------- */
function $(id) {
  return document.getElementById(id);
}
function inr(n) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
function isPlus() {
  return Boolean(state.user && state.user.plusActive);
}
function authHeaders() {
  return state.token ? { "x-auth-token": state.token } : {};
}
function escapeHtml(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
function toast(msg) {
  const host = $("toastHost");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
function avatarColor(name) {
  const colors = ["#0e7490", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#2563eb", "#0891b2"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}
function initials(name) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

/* ---------- data loading ---------- */
async function loadCatalog() {
  try {
    const res = await fetch(`${API}/api/catalog`);
    const data = await res.json();
    state.medicines = data.medicines || [];
    state.categories = data.categories || [];
    const sel = $("medCategory");
    state.categories
      .filter((c) => !DEVICE_CATEGORIES.includes(c))
      .forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
      });
    renderMedicines();
    renderDevices();
  } catch (_e) {
    $("medGrid").innerHTML = "<p>Could not load medicines. Is the server running?</p>";
  }
}

async function loadLabTests() {
  try {
    const res = await fetch(`${API}/api/lab-tests`);
    const data = await res.json();
    state.labTests = data.tests || [];
    state.labCategories = data.categories || [];
    const sel = $("labCategory");
    state.labCategories.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });
    renderLabTests();
  } catch (_e) {
    $("labGrid").innerHTML = "<p>Could not load lab tests.</p>";
  }
}

async function loadProviders() {
  try {
    const params = new URLSearchParams({ role: state.role });
    if (state.location) {
      params.set("lat", state.location.lat);
      params.set("lon", state.location.lon);
    }
    const res = await fetch(`${API}/api/providers?${params.toString()}`);
    const data = await res.json();
    state.providers = data.providers || [];
    renderProviders();
  } catch (_e) {
    $("providerGrid").innerHTML = "<p>Could not load care providers.</p>";
  }
}

/* ---------- medicines ---------- */
function filteredMedicines() {
  const q = $("medSearch").value.trim().toLowerCase();
  const cat = $("medCategory").value;
  return state.medicines.filter((m) => {
    if (DEVICE_CATEGORIES.includes(m.category)) return false;
    if (cat !== "all" && m.category !== cat) return false;
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      (m.tags || []).some((t) => t.includes(q))
    );
  });
}

function medCardHtml(m) {
  return `
    <div class="med-card">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:.4rem">
        <h4>${escapeHtml(m.name)}</h4>
        ${m.rx ? '<span class="rx-badge">Rx</span>' : ""}
      </div>
      <div class="med-meta">${escapeHtml(m.category)} · ${escapeHtml(m.form)}</div>
      <div class="med-tags">${(m.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
      <div class="med-foot">
        <span class="med-price">${inr(m.price)}</span>
        <button class="add-btn" data-add="${m.id}">Add +</button>
      </div>
    </div>`;
}

function renderDevices() {
  const grid = $("deviceGrid");
  if (!grid) return;
  const list = state.medicines.filter((m) => DEVICE_CATEGORIES.includes(m.category));
  grid.innerHTML = list.length ? list.map(medCardHtml).join("") : "<p>No devices available.</p>";
}

/* ---------- lab tests ---------- */
function renderLabTests() {
  const grid = $("labGrid");
  if (!grid) return;
  const cat = $("labCategory") ? $("labCategory").value : "all";
  const q = (state.labQuery || "").toLowerCase();
  const list = state.labTests.filter((t) => {
    if (cat !== "all" && t.category !== cat) return false;
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      (t.tags || []).some((x) => x.includes(q))
    );
  });
  if (!list.length) {
    grid.innerHTML = "<p>No lab tests found.</p>";
    return;
  }
  grid.innerHTML = list
    .map(
      (t) => `
    <div class="lab-card${t.imaging ? " imaging-card" : ""}">
      <div class="lab-card-top">
        <h4>${t.imaging ? "🩻 " : "🧪 "}${escapeHtml(t.name)}</h4>
        <span class="lab-cat">${escapeHtml(t.category)}</span>
      </div>
      <div class="lab-meta">
        ${
          t.imaging
            ? '<span class="lab-flag scan">🏥 At-center scan</span>'
            : t.fasting
              ? '<span class="lab-flag">🍽️ Fasting</span>'
              : '<span class="lab-flag ok">No fasting</span>'
        }
        <span>📄 Report in ${t.reportHours}h</span>
      </div>
      ${t.imaging && t.prep ? `<div class="lab-prep">📋 ${escapeHtml(t.prep)}</div>` : ""}
      <div class="lab-tags">${(t.tags || []).map((x) => `<span class="tag">${escapeHtml(x)}</span>`).join("")}</div>
      <div class="med-foot">
        <span class="med-price">${inr(t.price)}</span>
        <button class="add-btn" data-lab="${t.id}">${t.imaging ? "Book scan" : "Book test"}</button>
      </div>
    </div>`
    )
    .join("");
}

function renderMedicines() {
  const list = filteredMedicines();
  const grid = $("medGrid");
  if (!list.length) {
    grid.innerHTML = "<p>No medicines match your search.</p>";
    return;
  }
  grid.innerHTML = list
    .map(
      (m) => `
    <div class="med-card">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:.4rem">
        <h4>${escapeHtml(m.name)}</h4>
        ${m.rx ? '<span class="rx-badge">Rx</span>' : ""}
      </div>
      <div class="med-meta">${escapeHtml(m.category)} · ${escapeHtml(m.form)}</div>
      <div class="med-tags">${(m.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
      <div class="med-foot">
        <span class="med-price">${inr(m.price)}</span>
        <button class="add-btn" data-add="${m.id}">Add +</button>
      </div>
    </div>`
    )
    .join("");
}

/* ---------- cart ---------- */
function cartQty(id) {
  const item = state.cart.find((i) => i.id === id);
  return item ? item.qty : 0;
}
function addToCart(id) {
  const med = state.medicines.find((m) => m.id === id);
  if (!med) return;
  const existing = state.cart.find((i) => i.id === id);
  if (existing) existing.qty += 1;
  else state.cart.push({ id: med.id, name: med.name, price: med.price, qty: 1, rx: med.rx });
  renderCart();
  toast(`${med.name} added to cart`);
}
function setQty(id, qty) {
  const item = state.cart.find((i) => i.id === id);
  if (!item) return;
  item.qty = qty;
  if (item.qty <= 0) state.cart = state.cart.filter((i) => i.id !== id);
  renderCart();
}
function cartTotals() {
  const subtotal = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const plus = isPlus();
  const deliveryFee = plus ? 0 : subtotal >= 500 || subtotal === 0 ? 0 : 40;
  const requiresRx = state.cart.some((i) => i.rx);
  const discount = state.coupon ? Math.min(state.coupon.discount, subtotal) : 0;
  const memberDiscount = plus ? Math.round(subtotal * MEMBER_RATE) : 0;
  return {
    subtotal,
    deliveryFee,
    discount,
    memberDiscount,
    total: Math.max(0, subtotal + deliveryFee - discount - memberDiscount),
    requiresRx,
  };
}
function renderCart() {
  const count = state.cart.reduce((s, i) => s + i.qty, 0);
  $("cartCount").textContent = count;
  const items = $("cartItems");
  if (!state.cart.length) {
    items.innerHTML = '<p class="cart-empty">Your cart is empty. Add medicines to get started.</p>';
    $("cartTotals").innerHTML = "";
    $("rxLine").hidden = true;
    return;
  }
  items.innerHTML = state.cart
    .map(
      (i) => `
    <div class="cart-item">
      <div class="cart-item-body">
        <strong>${escapeHtml(i.name)}</strong>
        <small>${inr(i.price)} × ${i.qty} = ${inr(i.price * i.qty)}</small>
      </div>
      <div class="qty-stepper">
        <button data-dec="${i.id}">−</button>
        <span>${i.qty}</span>
        <button data-inc="${i.id}">+</button>
      </div>
      <button class="cart-item-remove" data-remove="${i.id}" aria-label="Remove">🗑️</button>
    </div>`
    )
    .join("");
  const t = cartTotals();
  $("cartTotals").innerHTML = `
    <div class="row"><span>Subtotal</span><span>${inr(t.subtotal)}</span></div>
    <div class="row"><span>Delivery${isPlus() ? " <b class='mini-plus'>PLUS</b>" : ""}</span><span>${t.deliveryFee === 0 ? "FREE" : inr(t.deliveryFee)}</span></div>
    ${t.memberDiscount > 0 ? `<div class="row discount"><span>Plus member −5%</span><span>−${inr(t.memberDiscount)}</span></div>` : ""}
    ${t.discount > 0 ? `<div class="row discount"><span>Discount ${state.coupon ? "(" + escapeHtml(state.coupon.code) + ")" : ""}</span><span>−${inr(t.discount)}</span></div>` : ""}
    <div class="row grand"><span>Total</span><span>${inr(t.total)}</span></div>`;
  $("rxLine").hidden = !t.requiresRx;
  renderCartSafety();
}

/* ---------- GARMA Rx safety ---------- */
const SEVERITY_META = {
  CRITICAL: { label: "Critical", icon: "🚨", cls: "sev-critical" },
  HIGH: { label: "High", icon: "⛔", cls: "sev-high" },
  MEDIUM: { label: "Caution", icon: "⚠️", cls: "sev-medium" },
  LOW: { label: "Note", icon: "ℹ️", cls: "sev-low" },
};

function alertCardHtml(al) {
  const meta = SEVERITY_META[al.severity] || SEVERITY_META.LOW;
  return `
    <div class="safety-alert ${meta.cls}">
      <div class="safety-alert-top">
        <span class="safety-badge">${meta.icon} ${meta.label}</span>
        <strong>${escapeHtml(al.title)}</strong>
      </div>
      <div class="safety-pair">${escapeHtml(al.drugA)} + ${escapeHtml(al.drugB)}</div>
      <p class="safety-detail">${escapeHtml(al.detail)}</p>
      <p class="safety-advice">👉 ${escapeHtml(al.advice)}</p>
    </div>`;
}

async function checkRx(items) {
  const res = await fetch(`${API}/api/rx/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error("check failed");
  return res.json();
}

async function renderCartSafety() {
  const host = $("cartSafety");
  if (!host) return;
  const meds = state.cart.map((i) => ({ id: i.id, name: i.name }));
  if (meds.length < 2) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }
  try {
    const data = await checkRx(meds);
    if (!data.alerts.length) {
      host.hidden = false;
      host.innerHTML = `
        <div class="safety-banner safety-ok">
          <b>🛡️ Safety check passed</b>
          <span>No known risky combinations found in your cart.</span>
        </div>`;
      return;
    }
    host.hidden = false;
    host.innerHTML = `
      <div class="safety-banner ${(SEVERITY_META[data.maxSeverity] || SEVERITY_META.LOW).cls}">
        <b>🛡️ Safety check — ${data.alerts.length} note${data.alerts.length > 1 ? "s" : ""} found</b>
        <span>Please review before you order.</span>
      </div>
      ${data.alerts.map(alertCardHtml).join("")}
      <p class="safety-disclaimer">${escapeHtml(data.disclaimer)}</p>`;
  } catch (_) {
    host.hidden = true;
  }
}

/* ---------- standalone Safety Checker modal ---------- */
function openSafetyModal() {
  const sel = $("safetySelect");
  if (sel && sel.options.length <= 1) {
    const meds = state.medicines
      .filter((m) => m.category !== "Devices" && m.category !== "Mobility Aids")
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    sel.innerHTML =
      '<option value="">➕ Add a medicine…</option>' +
      meds.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join("");
  }
  $("safetyModal").hidden = false;
  renderSafetyModal();
}

function renderSafetyModal() {
  const chips = $("safetyChips");
  const picks = state.safetyPicks
    .map((id) => state.medicines.find((m) => m.id === id))
    .filter(Boolean);
  chips.innerHTML = picks.length
    ? picks
        .map(
          (m) =>
            `<span class="safety-chip">${escapeHtml(m.name)}<button data-remove-pick="${m.id}" aria-label="Remove">✕</button></span>`
        )
        .join("")
    : '<span class="safety-empty">No medicines added yet.</span>';
  const result = $("safetyResult");
  if (picks.length < 2) {
    result.innerHTML = '<p class="safety-hint">Add at least two medicines to run a check.</p>';
    return;
  }
  result.innerHTML = '<p class="safety-hint">Checking…</p>';
  checkRx(picks.map((m) => ({ id: m.id, name: m.name })))
    .then((data) => {
      if (!data.alerts.length) {
        result.innerHTML = `
          <div class="safety-banner safety-ok">
            <b>🛡️ No known interactions</b>
            <span>These medicines have no flagged combinations in our database.</span>
          </div>`;
        return;
      }
      result.innerHTML = `
        <div class="safety-banner ${(SEVERITY_META[data.maxSeverity] || SEVERITY_META.LOW).cls}">
          <b>${data.alerts.length} interaction note${data.alerts.length > 1 ? "s" : ""}</b>
        </div>
        ${data.alerts.map(alertCardHtml).join("")}`;
    })
    .catch(() => {
      result.innerHTML = '<p class="safety-hint">Could not run the check. Please try again.</p>';
    });
}

/* ---------- in-app doctor consultation (live chat) ---------- */
function consultBubbleHtml(m) {
  if (m.from === "system") {
    return `<div class="cmsg cmsg-system">${escapeHtml(m.text)}</div>`;
  }
  const isDoc = m.from === "doctor";
  const sug = m.suggestions || {};
  const meds = (sug.meds || [])
    .map((name) => {
      const med = state.medicines.find((x) => x.name === name);
      return med
        ? `<button class="csug-btn" data-consult-add="${med.id}">➕ ${escapeHtml(name)}</button>`
        : `<span class="csug-tag">💊 ${escapeHtml(name)}</span>`;
    })
    .join("");
  const labs = (sug.labs || [])
    .map((name) => {
      const t = state.labTests.find((x) => x.name === name);
      return t
        ? `<button class="csug-btn" data-consult-lab="${t.id}">🧪 ${escapeHtml(name)}</button>`
        : `<span class="csug-tag">🧪 ${escapeHtml(name)}</span>`;
    })
    .join("");
  const suggestions =
    meds || labs
      ? `<div class="csug">${meds ? `<div class="csug-row">${meds}</div>` : ""}${labs ? `<div class="csug-row">${labs}</div>` : ""}</div>`
      : "";
  return `
    <div class="cmsg ${isDoc ? "cmsg-doc" : "cmsg-me"} ${m.emergency ? "cmsg-emergency" : ""}">
      ${isDoc && m.author ? `<div class="cmsg-author">${escapeHtml(m.author)}</div>` : ""}
      <div class="cmsg-text">${escapeHtml(m.text).replace(/\n/g, "<br>")}</div>
      ${suggestions}
    </div>`;
}

function renderConsultMessages(messages, append) {
  const host = $("consultMessages");
  if (!host) return;
  const html = messages.map(consultBubbleHtml).join("");
  if (append) host.insertAdjacentHTML("beforeend", html);
  else host.innerHTML = html;
  host.scrollTop = host.scrollHeight;
}

function showConsultTyping(on) {
  const host = $("consultMessages");
  if (!host) return;
  const existing = $("consultTyping");
  if (on) {
    if (!existing) {
      host.insertAdjacentHTML(
        "beforeend",
        '<div class="cmsg cmsg-doc" id="consultTyping"><div class="cmsg-text typing"><span></span><span></span><span></span></div></div>'
      );
      host.scrollTop = host.scrollHeight;
    }
  } else if (existing) {
    existing.remove();
  }
}

async function openConsult(providerId) {
  const provider = providerId ? state.providers.find((p) => p.id === providerId) : null;
  $("consultModal").hidden = false;
  $("consultMessages").innerHTML = '<p class="safety-hint">Connecting you to a doctor…</p>';
  $("consultText").value = "";
  try {
    const res = await fetch(`${API}/api/consult/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        providerId: provider ? provider.id : null,
        name: state.user ? state.user.name : "",
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not start consultation");
    state.consult = { id: data.consultId, provider: data.provider };
    const doc = data.provider || { name: "MedGuard Doctor", specialty: "General Physician" };
    $("consultDocName").textContent = doc.name;
    $("consultDocSpec").textContent = doc.specialty || "Online consultation";
    renderConsultMessages(data.messages, false);
    $("consultText").focus();
  } catch (err) {
    $("consultMessages").innerHTML = `<p class="safety-hint">⚠️ ${escapeHtml(err.message)}</p>`;
  }
}

async function sendConsultMessage(e) {
  if (e) e.preventDefault();
  const input = $("consultText");
  const text = input.value.trim();
  if (!text || !state.consult) return;
  renderConsultMessages([{ from: "patient", text }], true);
  input.value = "";
  $("consultSend").disabled = true;
  showConsultTyping(true);
  try {
    const res = await fetch(`${API}/api/consult/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ consultId: state.consult.id, text }),
    });
    const data = await res.json();
    showConsultTyping(false);
    if (!res.ok) throw new Error(data.error || "Message failed");
    renderConsultMessages([data.reply], true);
  } catch (err) {
    showConsultTyping(false);
    renderConsultMessages([{ from: "system", text: `⚠️ ${err.message}` }], true);
  } finally {
    $("consultSend").disabled = false;
    $("consultText").focus();
  }
}

/* ---------- prescription ---------- */
async function getPrescription() {
  if (!state.consult) return;
  const btn = $("consultRxBtn");
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`${API}/api/consult/prescription`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ consultId: state.consult.id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not generate prescription");
    openRx(data.prescription);
    renderConsultMessages(
      [{ from: "system", text: `📄 Prescription ${data.prescription.rxNo} is ready. You can view or download it anytime from “My Health”.` }],
      true
    );
  } catch (err) {
    renderConsultMessages([{ from: "system", text: `⚠️ ${err.message}` }], true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function rxSheetHtml(rx) {
  const medRows = (rx.meds || [])
    .map(
      (m, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(m.name)}</strong><br><small>${escapeHtml(m.note || "")}</small></td>
        <td>${escapeHtml(m.dose || "")}</td>
        <td>${escapeHtml(m.freq || "")}</td>
        <td>${escapeHtml(m.duration || "")}</td>
      </tr>`
    )
    .join("");
  const labRows = (rx.labs || []).map((l) => `<li>${escapeHtml(l)}</li>`).join("");
  const complaints = (rx.complaints || []).length
    ? (rx.complaints || []).map((c) => escapeHtml(c)).join(", ")
    : "General consultation";
  const date = new Date(rx.issuedAt).toLocaleString();
  return `
    <div class="rx-header">
      <div class="rx-brand">
        <span class="rx-logo">⚕️</span>
        <div>
          <strong>MedGuard Care</strong>
          <small>Online Consultation Summary</small>
        </div>
      </div>
      <div class="rx-meta">
        <div><span>Rx No.</span> <strong>${escapeHtml(rx.rxNo)}</strong></div>
        <div><span>Date</span> ${escapeHtml(date)}</div>
      </div>
    </div>
    <div class="rx-parties">
      <div><span>Doctor</span><strong>${escapeHtml(rx.doctor)}</strong><small>${escapeHtml(rx.specialty || "")}</small></div>
      <div><span>Patient</span><strong>${escapeHtml(rx.patientName || "Patient")}</strong><small>Complaints: ${complaints}</small></div>
    </div>
    ${
      (rx.meds || []).length
        ? `<h4 class="rx-sec">℞ Medicines</h4>
    <table class="rx-table">
      <thead><tr><th>#</th><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th></tr></thead>
      <tbody>${medRows}</tbody>
    </table>`
        : ""
    }
    ${(rx.labs || []).length ? `<h4 class="rx-sec">🧪 Suggested tests</h4><ul class="rx-labs">${labRows}</ul>` : ""}
    <h4 class="rx-sec">📝 Advice</h4>
    <p class="rx-advice">${escapeHtml(rx.advice || "")}</p>
    <p class="rx-disclaimer">${escapeHtml(rx.disclaimer || "")}</p>
  `;
}

function openRx(rx) {
  state.rx = rx;
  $("rxSheet").innerHTML = rxSheetHtml(rx);
  $("rxModal").hidden = false;
}

function printRx() {
  if (!state.rx) return;
  const rx = state.rx;
  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) {
    toast("Please allow pop-ups to print your prescription.");
    return;
  }
  win.document.write(`<!doctype html><html><head><title>${escapeHtml(rx.rxNo)} — MedGuard</title>
    <style>
      body{font-family:Segoe UI,Arial,sans-serif;color:#1f2937;margin:32px;line-height:1.5}
      .rx-header,.rx-parties{display:flex;justify-content:space-between;gap:16px}
      .rx-header{border-bottom:2px solid #2563eb;padding-bottom:12px;margin-bottom:12px}
      .rx-brand strong{font-size:20px;color:#2563eb;display:block}
      .rx-meta{text-align:right;font-size:13px}
      .rx-meta span,.rx-parties span{color:#6b7280;font-size:12px;display:block}
      .rx-parties{background:#f8fafc;border-radius:10px;padding:12px;margin:12px 0}
      .rx-parties small{color:#6b7280}
      .rx-sec{color:#2563eb;margin:18px 0 8px;border-left:4px solid #2563eb;padding-left:8px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border:1px solid #e5e7eb;padding:7px 9px;text-align:left;vertical-align:top}
      th{background:#eff6ff}
      ul{margin:4px 0 0 18px}
      .rx-disclaimer{margin-top:20px;font-size:11px;color:#6b7280;border-top:1px dashed #d1d5db;padding-top:10px}
    </style></head><body>${rxSheetHtml(rx)}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

/* ---------- My Health dashboard ---------- */
async function openMyHealth() {
  if (!state.user) return openAuthModal("login");
  $("healthModal").hidden = false;
  $("healthStats").innerHTML = "";
  $("healthBody").innerHTML = "<p>Loading your health records…</p>";
  try {
    const res = await fetch(`${API}/api/my/health`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load your health records");
    state.health = data;
    const s = data.summary;
    $("healthStats").innerHTML = `
      <div class="hstat"><strong>${s.prescriptions}</strong><span>Prescriptions</span></div>
      <div class="hstat"><strong>${s.reminders || 0}</strong><span>Refill reminders</span></div>
      <div class="hstat"><strong>${s.consultations}</strong><span>Consultations</span></div>
      <div class="hstat"><strong>${s.medicineOrders}</strong><span>Medicine orders</span></div>
      <div class="hstat"><strong>${s.labOrders}</strong><span>Lab / scan orders</span></div>`;
    document.querySelectorAll(".health-tab").forEach((t) =>
      t.classList.toggle("active", t.getAttribute("data-htab") === "prescriptions")
    );
    renderHealthTab("prescriptions");
  } catch (err) {
    $("healthBody").innerHTML = `<p>⚠️ ${escapeHtml(err.message)}</p>`;
  }
}

function renderHealthTab(tab) {
  const data = state.health;
  const host = $("healthBody");
  if (!data) return;
  if (tab === "prescriptions") {
    const list = data.prescriptions || [];
    host.innerHTML = list.length
      ? list
          .map(
            (rx) => `
        <div class="hcard">
          <div class="hcard-head">
            <strong>📄 ${escapeHtml(rx.rxNo)}</strong>
            <small>${new Date(rx.issuedAt).toLocaleDateString()}</small>
          </div>
          <small>${escapeHtml(rx.doctor)} · ${(rx.meds || []).length} medicine(s), ${(rx.labs || []).length} test(s)</small>
          <div class="hcard-foot">
            <button class="btn btn-outline btn-sm" data-rx="${escapeHtml(rx.rxNo)}">View / download</button>
          </div>
        </div>`
          )
          .join("")
      : `<p class="health-empty">No prescriptions yet. Start a doctor chat and tap “Get prescription”.</p>`;
  } else if (tab === "consultations") {
    const list = data.consultations || [];
    host.innerHTML = list.length
      ? list
          .map((c) => {
            const doc = c.provider ? c.provider.name : "MedGuard Doctor";
            return `
        <div class="hcard">
          <div class="hcard-head">
            <strong>💬 ${escapeHtml(doc)}</strong>
            <small>${new Date(c.createdAt).toLocaleDateString()}</small>
          </div>
          <small>${escapeHtml(c.provider && c.provider.specialty ? c.provider.specialty : "General Physician")} · ${c.messageCount} messages · ${escapeHtml(c.status)}</small>
          ${c.prescription ? `<div class="hcard-foot"><button class="btn btn-outline btn-sm" data-rx="${escapeHtml(c.prescription.rxNo)}">📄 View prescription</button></div>` : ""}
        </div>`;
          })
          .join("")
      : `<p class="health-empty">No consultations yet. Tap “Talk to a doctor now” in Doctors & Care.</p>`;
  } else if (tab === "reminders") {
    renderReminders();
  } else {
    const list = data.orders || [];
    host.innerHTML = list.length
      ? list
          .map((o) => {
            const icon = o.type === "lab" ? "🧪" : o.type === "medicine" ? "📦" : "⚕️";
            let detail = "";
            const isMed = o.type === "medicine" && (o.items || []).length;
            if (o.type === "medicine") detail = (o.items || []).map((i) => `${i.name} ×${i.qty}`).join(", ");
            else if (o.type === "lab") detail = (o.tests || []).map((t) => t.name).join(", ");
            else detail = `${o.provider ? o.provider.name : ""} · ${o.visitMode || ""}`;
            const actions = isMed
              ? `<div class="hcard-actions">
                   <button class="btn btn-outline btn-sm" data-reorder="${escapeHtml(o.id)}">🔁 Reorder</button>
                   <button class="btn btn-outline btn-sm" data-remind="${escapeHtml(o.id)}">🔔 Refill reminder</button>
                 </div>`
              : "";
            return `
        <div class="hcard">
          <div class="hcard-head">
            <strong>${icon} ${escapeHtml(o.id)}</strong>
            <span class="order-status">${escapeHtml(o.status)}</span>
          </div>
          <small>${escapeHtml(detail)}</small>
          <div class="hcard-foot"><small>${new Date(o.createdAt).toLocaleDateString()}</small><strong>${inr(o.total)}</strong></div>
          ${actions}
        </div>`;
          })
          .join("")
      : `<p class="health-empty">No orders yet.</p>`;
  }
}

/* ---------- refill reminders ---------- */
async function renderReminders() {
  const host = $("healthBody");
  host.innerHTML = "<p>Loading reminders…</p>";
  try {
    const res = await fetch(`${API}/api/my/reminders`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load reminders");
    const list = data.reminders || [];
    if (!list.length) {
      host.innerHTML = `<p class="health-empty">No refill reminders yet. Open the “Orders &amp; Tests” tab and tap “🔔 Refill reminder” on a medicine order.</p>`;
      return;
    }
    host.innerHTML = list
      .map((r) => {
        const items = (r.items || []).map((i) => `${i.name} ×${i.qty}`).join(", ");
        const when = r.due
          ? `<span class="remind-due">Due now</span>`
          : `<span class="remind-soon">in ${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"}</span>`;
        return `
      <div class="hcard ${r.due ? "hcard-due" : ""}">
        <div class="hcard-head">
          <strong>🔔 Refill ${when}</strong>
          <small>${new Date(r.dueAt).toLocaleDateString()}</small>
        </div>
        <small>${escapeHtml(items)}</small>
        <div class="hcard-actions">
          <button class="btn btn-primary btn-sm" data-remind-reorder="${escapeHtml(r.id)}">🔁 Reorder now</button>
          <button class="btn btn-outline btn-sm" data-remind-snooze="${escapeHtml(r.id)}">😴 Snooze 7d</button>
          <button class="btn btn-outline btn-sm" data-remind-done="${escapeHtml(r.id)}">✓ Done</button>
        </div>
      </div>`;
      })
      .join("");
  } catch (err) {
    host.innerHTML = `<p class="health-empty">⚠️ ${escapeHtml(err.message)}</p>`;
  }
}

let pendingReminder = null; // { items, orderId, days }

function openRemindModal(orderId) {
  const order = (state.health && state.health.orders || []).find((o) => o.id === orderId);
  if (!order || !(order.items || []).length) return toast("Nothing to remind about for this order.");
  pendingReminder = {
    orderId,
    items: order.items.map((i) => ({ id: i.id, qty: i.qty })),
    days: 30,
  };
  $("remindItems").textContent = order.items.map((i) => `${i.name} ×${i.qty}`).join(", ");
  document.querySelectorAll(".remind-opt").forEach((b) =>
    b.classList.toggle("active", b.getAttribute("data-days") === "30")
  );
  $("remindModal").hidden = false;
}

async function confirmReminder() {
  if (!pendingReminder) return;
  $("remindConfirmBtn").disabled = true;
  try {
    const res = await fetch(`${API}/api/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(pendingReminder),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not set reminder");
    $("remindModal").hidden = true;
    toast(`🔔 We'll remind you in ${pendingReminder.days} days`);
  } catch (err) {
    toast(err.message);
  } finally {
    $("remindConfirmBtn").disabled = false;
  }
}

function reorderItems(items) {
  let added = 0;
  (items || []).forEach((it) => {
    const med = state.medicines.find((m) => m.id === it.id);
    if (med) {
      const existing = state.cart.find((c) => c.id === med.id);
      const qty = Math.max(1, it.qty || 1);
      if (existing) existing.qty += qty;
      else state.cart.push({ id: med.id, name: med.name, price: med.price, qty, rx: med.rx });
      added += qty;
    }
  });
  renderCart();
  if (added) {
    $("healthModal").hidden = true;
    toast(`🛒 ${added} item${added === 1 ? "" : "s"} added to your cart`);
    openCart();
  } else {
    toast("Those items are no longer available.");
  }
}

async function reorderFromOrder(orderId) {
  const order = (state.health && state.health.orders || []).find((o) => o.id === orderId);
  if (order) reorderItems(order.items);
}

async function reminderAction(id, action) {
  try {
    const res = await fetch(`${API}/api/reminders/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Action failed");
    if (action === "snooze") toast("😴 Snoozed for 7 days");
    if (action === "done") toast("✓ Reminder cleared");
    renderReminders();
  } catch (err) {
    toast(err.message);
  }
}

async function reorderFromReminder(id) {
  const res = await fetch(`${API}/api/my/reminders`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  const r = (data.reminders || []).find((x) => x.id === id);
  if (r) reorderItems(r.items);
}

function findPrescriptionByRxNo(rxNo) {
  if (!state.health) return null;
  const direct = (state.health.prescriptions || []).find((r) => r.rxNo === rxNo);
  if (direct) return direct;
  const c = (state.health.consultations || []).find((c) => c.prescription && c.prescription.rxNo === rxNo);
  return c ? c.prescription : null;
}


/* ---------- coupons ---------- */
async function applyCoupon() {
  const code = $("couponInput").value.trim();
  const msg = $("couponMsg");
  if (!code) {
    state.coupon = null;
    msg.textContent = "";
    renderCart();
    return;
  }
  const t = cartTotals();
  try {
    const res = await fetch(`${API}/api/coupon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, amount: t.subtotal }),
    });
    const data = await res.json();
    if (!res.ok || !data.valid) {
      state.coupon = null;
      msg.className = "coupon-msg err";
      msg.textContent = `⚠️ ${data.reason || "Invalid coupon."}`;
    } else {
      state.coupon = { code: data.code, discount: data.discount, label: data.label };
      msg.className = "coupon-msg ok";
      msg.textContent = `✅ ${data.label} applied — you save ${inr(data.discount)}.`;
    }
    renderCart();
  } catch (_e) {
    msg.className = "coupon-msg err";
    msg.textContent = "⚠️ Could not validate coupon.";
  }
}

function openCart() {
  $("cartDrawer").classList.add("open");
  $("cartBackdrop").hidden = false;
}
function closeCart() {
  $("cartDrawer").classList.remove("open");
  $("cartBackdrop").hidden = true;
}

async function placeOrder(e) {
  e.preventDefault();
  if (!state.cart.length) return toast("Your cart is empty.");
  const name = $("custName").value.trim();
  const phone = $("custPhone").value.trim();
  const address = $("custAddress").value.trim();
  const email = $("custEmail") ? $("custEmail").value.trim() : "";
  if (!name || !phone) return toast("Please enter name and phone.");
  const t = cartTotals();
  if (t.requiresRx && !$("rxUploaded").checked) {
    return toast("Please confirm you have a prescription for the Rx items.");
  }
  $("placeOrderBtn").disabled = true;
  try {
    const res = await fetch(`${API}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        type: "medicine",
        items: state.cart.map((i) => ({ id: i.id, qty: i.qty })),
        rxUploaded: $("rxUploaded").checked,
        coupon: state.coupon ? state.coupon.code : null,
        customer: {
          name,
          phone,
          address,
          email,
          lat: state.location ? state.location.lat : null,
          lon: state.location ? state.location.lon : null,
        },
      }),
    });
    const order = await res.json();
    if (!res.ok) throw new Error(order.error || "Order failed");
    const saved = (order.discount || 0) + (order.memberDiscount || 0);
    $("checkoutResult").textContent =
      `✅ Order placed!\nReference: ${order.id}\nTotal: ${inr(order.total)}\n` +
      (saved ? `You saved: ${inr(saved)}${order.memberDiscount ? " (incl. Plus)" : ""}\n` : "") +
      `From: ${order.fulfilledBy.name}\nETA: ~${order.etaMinutes} min\nStatus: ${order.status}`;
    state.cart = [];
    state.coupon = null;
    $("couponInput").value = "";
    $("couponMsg").textContent = "";
    renderCart();
    $("trackInput").value = order.id;
    toast("Order placed! Track it below.");
  } catch (err) {
    $("checkoutResult").textContent = `⚠️ ${err.message}`;
  } finally {
    $("placeOrderBtn").disabled = false;
  }
}

/* ---------- providers ---------- */
function renderProviders() {
  const grid = $("providerGrid");
  if (!state.providers.length) {
    grid.innerHTML = "<p>No providers found.</p>";
    return;
  }
  grid.innerHTML = state.providers
    .map((p) => {
      const dist = p.distanceKm != null ? `📍 ${p.distanceKm} km` : "";
      const chat =
        p.role === "doctor"
          ? `<button class="btn btn-ghost" data-consult="${p.id}">💬 Chat now</button>`
          : "";
      const modes = p.modes.includes("online")
        ? `<button class="btn btn-ghost" data-book="${p.id}" data-mode="online">💻 Online ${inr(p.feeOnline)}</button>`
        : "";
      const home = p.modes.includes("home")
        ? `<button class="btn btn-primary" data-book="${p.id}" data-mode="home">🏠 Home ${inr(p.feeHome)}</button>`
        : "";
      return `
      <div class="provider-card">
        <div class="provider-top">
          <div class="avatar" style="background:${avatarColor(p.name)}">${initials(p.name)}</div>
          <div>
            <div class="provider-name">${escapeHtml(p.name)}</div>
            <div class="provider-spec">${escapeHtml(p.specialty)}</div>
          </div>
        </div>
        <div class="provider-meta">
          <span class="role-pill role-${p.role}">${p.role}</span>
          <span>⭐ ${p.rating}</span>
          <span>🎓 ${p.exp} yrs</span>
          ${dist ? `<span>${dist}</span>` : ""}
        </div>
        <div class="provider-meta">🗣️ ${p.languages.join(", ")}</div>
        <div class="provider-actions">${chat}${home}${modes}</div>
      </div>`;
    })
    .join("");
}

/* ---------- care booking modal ---------- */
const SLOTS = ["09:00 AM", "11:00 AM", "01:00 PM", "03:00 PM", "05:00 PM", "07:00 PM"];

function openCareModal(providerId, mode) {
  const provider = state.providers.find((p) => p.id === providerId);
  if (!provider) return;
  state.careSelection = { provider, mode, slot: SLOTS[0] };
  renderCareModal();
  $("careModal").hidden = false;
}
function renderCareModal() {
  const { provider, mode, slot } = state.careSelection;
  const fee = mode === "online" ? provider.feeOnline : provider.feeHome;
  const modeOptions = provider.modes
    .map(
      (m) => `
      <div class="mode-option ${m === mode ? "active" : ""}" data-set-mode="${m}">
        <b>${m === "online" ? "💻 Online" : "🏠 Home visit"}</b>
        <small>${inr(m === "online" ? provider.feeOnline : provider.feeHome)}</small>
      </div>`
    )
    .join("");
  $("careModalBody").innerHTML = `
    <h3>Book ${escapeHtml(provider.name)}</h3>
    <p class="provider-spec">${escapeHtml(provider.specialty)} · ⭐ ${provider.rating}</p>
    <div class="mode-options">${modeOptions}</div>
    <label style="font-weight:700;font-size:.85rem">Choose a slot</label>
    <div class="slot-grid">
      ${SLOTS.map((s) => `<button class="slot-btn ${s === slot ? "active" : ""}" data-slot="${s}">${s}</button>`).join("")}
    </div>
    <input id="careName" type="text" placeholder="Your name" />
    <input id="carePhone" type="tel" placeholder="Phone number" />
    ${mode === "home" ? '<input id="careAddress" type="text" placeholder="Home address" />' : ""}
    <button class="btn btn-primary btn-block" id="confirmCareBtn">
      ${mode === "online" ? "Confirm online consult" : "Confirm home visit"} · ${inr(fee)}
    </button>
    <div id="careResult" class="checkout-result"></div>`;
}
async function confirmCare() {
  const { provider, mode, slot } = state.careSelection;
  const name = $("careName").value.trim();
  const phone = $("carePhone").value.trim();
  const address = mode === "home" && $("careAddress") ? $("careAddress").value.trim() : "";
  if (!name || !phone) {
    $("careResult").textContent = "⚠️ Please enter your name and phone.";
    return;
  }
  $("confirmCareBtn").disabled = true;
  try {
    const res = await fetch(`${API}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        type: "care",
        providerId: provider.id,
        visitMode: mode,
        slot,
        customer: {
          name,
          phone,
          address,
          lat: state.location ? state.location.lat : null,
          lon: state.location ? state.location.lon : null,
        },
      }),
    });
    const order = await res.json();
    if (!res.ok) throw new Error(order.error || "Booking failed");
    $("careResult").textContent =
      `✅ Booked!\nReference: ${order.id}\n${provider.name} · ${mode === "online" ? "Online" : "Home visit"}\n` +
      `Slot: ${slot}\nFee: ${inr(order.fee)} (${order.paymentStatus})`;
    $("trackInput").value = order.id;
    toast("Care booking confirmed!");
  } catch (err) {
    $("careResult").textContent = `⚠️ ${err.message}`;
  } finally {
    if ($("confirmCareBtn")) $("confirmCareBtn").disabled = false;
  }
}

/* ---------- lab test booking modal ---------- */
const LAB_SLOTS = ["06:00 AM", "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "05:00 PM"];

function openLabModal(testId) {
  const test = state.labTests.find((t) => t.id === testId);
  if (!test) return;
  const tests = state.labSelection ? state.labSelection.tests : new Set();
  tests.add(testId);
  state.labSelection = { tests, slot: LAB_SLOTS[0] };
  renderLabModal();
  $("labModal").hidden = false;
}
function labSelectionTotals() {
  const chosen = state.labTests.filter((t) => state.labSelection.tests.has(t.id));
  const subtotal = chosen.reduce((s, t) => s + t.price, 0);
  const allImaging = chosen.length > 0 && chosen.every((t) => t.imaging);
  const collectionFee = allImaging ? 0 : subtotal >= 500 ? 0 : 50;
  return { chosen, subtotal, collectionFee, total: subtotal + collectionFee, allImaging };
}
function renderLabModal() {
  const { slot } = state.labSelection;
  const { chosen, subtotal, collectionFee, total, allImaging } = labSelectionTotals();
  const fasting = chosen.some((t) => t.fasting);
  const anyImaging = chosen.some((t) => t.imaging);
  const prepNotes = chosen.filter((t) => t.imaging && t.prep);
  $("labModalBody").innerHTML = `
    <h3>${anyImaging ? "🩻 Book Lab Tests & Scans" : "🧪 Book Lab Tests"}</h3>
    <p class="provider-spec">${allImaging ? "At-center appointment · reports on your phone" : "Home sample collection · reports on your phone"}</p>
    <div class="lab-pick-list">
      ${state.labTests
        .map(
          (t) => `
        <label class="lab-pick ${state.labSelection.tests.has(t.id) ? "active" : ""}">
          <input type="checkbox" data-lab-toggle="${t.id}" ${state.labSelection.tests.has(t.id) ? "checked" : ""} />
          <span>${t.imaging ? "🩻 " : ""}${escapeHtml(t.name)}</span>
          <b>${inr(t.price)}</b>
        </label>`
        )
        .join("")}
    </div>
    <label style="font-weight:700;font-size:.85rem">${allImaging ? "Preferred appointment slot" : "Preferred collection slot"}</label>
    <div class="slot-grid">
      ${LAB_SLOTS.map((s) => `<button class="slot-btn ${s === slot ? "active" : ""}" data-lab-slot="${s}">${s}</button>`).join("")}
    </div>
    ${fasting ? '<p class="lab-fast-note">🍽️ One or more tests require 8–12h fasting.</p>' : ""}
    ${prepNotes.length ? `<div class="lab-prep-list">${prepNotes.map((t) => `<p class="lab-prep">📋 <b>${escapeHtml(t.name)}:</b> ${escapeHtml(t.prep)}</p>`).join("")}</div>` : ""}
    <input id="labName" type="text" placeholder="Patient name" />
    <input id="labPhone" type="tel" placeholder="Phone number" />
    <input id="labAddress" type="text" placeholder="${allImaging ? "Address (for directions to nearest centre)" : "Collection address"}" />
    <div class="cart-totals" style="margin:.6rem 0">
      <div class="row"><span>Tests (${chosen.length})</span><span>${inr(subtotal)}</span></div>
      <div class="row"><span>${allImaging ? "Centre visit" : "Home collection"}</span><span>${collectionFee === 0 ? "FREE" : inr(collectionFee)}</span></div>
      <div class="row grand"><span>Total</span><span>${inr(total)}</span></div>
    </div>
    <button class="btn btn-primary btn-block" id="confirmLabBtn" ${chosen.length ? "" : "disabled"}>
      ${anyImaging ? "Confirm booking" : "Confirm booking"} · ${inr(total)}
    </button>
    <div id="labResult" class="checkout-result"></div>`;
}
async function confirmLab() {
  const { chosen } = labSelectionTotals();
  if (!chosen.length) return;
  const name = $("labName").value.trim();
  const phone = $("labPhone").value.trim();
  const address = $("labAddress").value.trim();
  if (!name || !phone) {
    $("labResult").textContent = "⚠️ Please enter patient name and phone.";
    return;
  }
  $("confirmLabBtn").disabled = true;
  try {
    const res = await fetch(`${API}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        type: "lab",
        tests: chosen.map((t) => t.id),
        slot: state.labSelection.slot,
        customer: {
          name,
          phone,
          address,
          lat: state.location ? state.location.lat : null,
          lon: state.location ? state.location.lon : null,
        },
      }),
    });
    const order = await res.json();
    if (!res.ok) throw new Error(order.error || "Booking failed");
    $("labResult").textContent =
      `✅ Lab tests booked!\nReference: ${order.id}\nTests: ${order.tests.map((t) => t.name).join(", ")}\n` +
      `Slot: ${order.slot}\nTotal: ${inr(order.total)}\nReport in ~${order.reportHours}h`;
    $("trackInput").value = order.id;
    state.labSelection = null;
    toast("Lab tests booked!");
  } catch (err) {
    $("labResult").textContent = `⚠️ ${err.message}`;
  } finally {
    if ($("confirmLabBtn")) $("confirmLabBtn").disabled = false;
  }
}

/* ---------- customer support ---------- */
async function submitTicket(e) {
  e.preventDefault();
  const name = $("supName").value.trim();
  const contact = $("supContact").value.trim();
  const message = $("supMessage").value.trim();
  if (!name || !contact || !message) return toast("Please fill name, contact and message.");
  const btn = e.target.querySelector("button[type=submit]");
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`${API}/api/support`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        contact,
        category: $("supCategory").value,
        orderRef: $("supOrderRef").value.trim(),
        message,
        callbackRequested: $("supCallback").checked,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not submit request");
    $("supportResult").className = "support-result ok";
    $("supportResult").textContent = `✅ Ticket ${data.ticket.id} created. ${data.eta}`;
    $("supportForm").reset();
    $("ticketInput").value = data.ticket.id;
    toast("Support request submitted!");
  } catch (err) {
    $("supportResult").className = "support-result err";
    $("supportResult").textContent = `⚠️ ${err.message}`;
  } finally {
    if (btn) btn.disabled = false;
  }
}
async function lookupTicket() {
  const id = $("ticketInput").value.trim();
  if (!id) return;
  $("ticketOutput").textContent = "Checking…";
  try {
    const res = await fetch(`${API}/api/support/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("Ticket not found");
    const t = await res.json();
    $("ticketOutput").textContent =
      `🎫 Ticket ${t.id}\nStatus: ${t.status}\nCategory: ${t.category}\n` +
      `${t.callbackRequested ? "Callback: requested\n" : ""}Raised: ${new Date(t.createdAt).toLocaleString()}`;
  } catch (err) {
    $("ticketOutput").textContent = `⚠️ ${err.message}`;
  }
}

/* ---------- accounts / auth ---------- */
function setUser(user, token) {
  state.user = user;
  if (token) {
    state.token = token;
    localStorage.setItem("mg_token", token);
  }
  renderAccount();
  renderPlus();
  renderCart();
  prefillCheckout();
}
function clearUser() {
  state.user = null;
  state.token = null;
  localStorage.removeItem("mg_token");
  renderAccount();
  renderPlus();
  renderCart();
}
async function restoreSession() {
  const token = localStorage.getItem("mg_token");
  if (!token) {
    renderAccount();
    return;
  }
  state.token = token;
  try {
    const res = await fetch(`${API}/api/auth/me`, { headers: authHeaders() });
    if (!res.ok) throw new Error("expired");
    const data = await res.json();
    setUser(data.user, token);
  } catch (_e) {
    clearUser();
  }
}
function renderAccount() {
  const loginBtn = $("loginBtn");
  const userMenu = $("userMenu");
  if (state.user) {
    loginBtn.hidden = true;
    userMenu.hidden = false;
    const name = state.user.name || "User";
    $("userName").textContent = name.split(" ")[0];
    $("userAvatar").textContent = (name[0] || "U").toUpperCase();
    $("userAvatar").style.background = avatarColor(name);
    $("ddName").textContent = name;
    $("ddEmail").textContent = state.user.email || "";
    const plus = isPlus();
    $("plusBadge").hidden = !plus;
    $("ddPlusStatus").innerHTML = plus
      ? `<span class="dd-plus-on">⭐ MedGuard Plus active</span>`
      : `<span class="dd-plus-off">Not a Plus member yet</span>`;
  } else {
    loginBtn.hidden = false;
    userMenu.hidden = true;
    $("userDropdown").hidden = true;
  }
}
function prefillCheckout() {
  if (!state.user) return;
  if ($("custName") && !$("custName").value) $("custName").value = state.user.name || "";
  if ($("custPhone") && !$("custPhone").value) $("custPhone").value = state.user.phone || "";
  if ($("custEmail") && !$("custEmail").value) $("custEmail").value = state.user.email || "";
}
function openAuthModal(tab) {
  switchAuthTab(tab || "login");
  $("authModal").hidden = false;
}
function switchAuthTab(tab) {
  document.querySelectorAll(".auth-tab").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-auth-tab") === tab);
  });
  $("loginForm").hidden = tab !== "login";
  $("signupForm").hidden = tab !== "signup";
  if ($("forgotForm")) $("forgotForm").hidden = true;
  $("loginMsg").textContent = "";
  $("signupMsg").textContent = "";
}
function showForgotForm() {
  document.querySelectorAll(".auth-tab").forEach((b) => b.classList.remove("active"));
  $("loginForm").hidden = true;
  $("signupForm").hidden = true;
  $("forgotForm").hidden = false;
  $("forgotForm").reset();
  $("forgotResetFields").hidden = true;
  $("forgotMsg").textContent = "";
  $("forgotMsg").className = "auth-msg";
  const email = $("loginEmail").value.trim();
  if (email) $("forgotEmail").value = email;
}
async function doForgot(e) {
  e.preventDefault();
  const email = $("forgotEmail").value.trim();
  const msg = $("forgotMsg");
  msg.className = "auth-msg";
  msg.textContent = "Sending reset code…";
  try {
    const res = await fetch(`${API}/api/auth/forgot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not send reset code");
    $("forgotResetFields").hidden = false;
    $("forgotSendBtn").textContent = "Resend code";
    msg.className = "auth-msg ok";
    const via = (data.delivered || []).length
      ? `We sent a code by ${data.delivered.join(" & ")}.`
      : "If SMS/email isn't set up yet, ask the site admin for your code.";
    msg.textContent = `✅ ${via} Enter it below with your new password.`;
    $("resetCode").focus();
  } catch (err) {
    msg.className = "auth-msg err";
    msg.textContent = `⚠️ ${err.message}`;
  }
}
async function doReset() {
  const email = $("forgotEmail").value.trim();
  const code = $("resetCode").value.trim();
  const password = $("resetPassword").value;
  const msg = $("forgotMsg");
  msg.className = "auth-msg";
  msg.textContent = "Updating your password…";
  try {
    const res = await fetch(`${API}/api/auth/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Reset failed");
    setUser(data.user, data.token);
    $("authModal").hidden = true;
    $("forgotForm").reset();
    $("forgotResetFields").hidden = true;
    toast(`Password updated. Welcome back, ${data.user.name.split(" ")[0]}!`);
  } catch (err) {
    msg.className = "auth-msg err";
    msg.textContent = `⚠️ ${err.message}`;
  }
}
async function doLogin(e) {
  e.preventDefault();
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  const msg = $("loginMsg");
  msg.className = "auth-msg";
  msg.textContent = "Logging in…";
  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    setUser(data.user, data.token);
    $("authModal").hidden = true;
    $("loginForm").reset();
    toast(`Welcome back, ${data.user.name.split(" ")[0]}!`);
  } catch (err) {
    msg.className = "auth-msg err";
    msg.textContent = `⚠️ ${err.message}`;
  }
}
async function doRegister(e) {
  e.preventDefault();
  const name = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const phone = $("signupPhone").value.trim();
  const password = $("signupPassword").value;
  const msg = $("signupMsg");
  msg.className = "auth-msg";
  msg.textContent = "Creating your account…";
  try {
    const res = await fetch(`${API}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Sign up failed");
    setUser(data.user, data.token);
    $("authModal").hidden = true;
    $("signupForm").reset();
    toast(`Welcome to MedGuard, ${data.user.name.split(" ")[0]}!`);
  } catch (err) {
    msg.className = "auth-msg err";
    msg.textContent = `⚠️ ${err.message}`;
  }
}
async function doLogout() {
  try {
    await fetch(`${API}/api/auth/logout`, { method: "POST", headers: authHeaders() });
  } catch (_e) {
    /* ignore */
  }
  clearUser();
  toast("Logged out.");
}

/* ---------- MedGuard Plus membership ---------- */
async function loadPlan() {
  try {
    const res = await fetch(`${API}/api/plan`);
    const data = await res.json();
    state.plan = data.plan;
    if (state.plan && $("plusPrice")) $("plusPrice").textContent = inr(state.plan.price);
    renderPlus();
  } catch (_e) {
    /* ignore */
  }
}
function renderPlus() {
  const benefitsEl = $("plusBenefits");
  const ctaEl = $("plusCta");
  if (!benefitsEl || !state.plan) return;
  benefitsEl.innerHTML = state.plan.benefits
    .map(
      (b) => `
    <div class="plus-benefit">
      <span class="plus-benefit-icon">${b.icon}</span>
      <div>
        <strong>${escapeHtml(b.title)}</strong>
        <span>${escapeHtml(b.desc)}</span>
      </div>
    </div>`
    )
    .join("");
  if (!state.user) {
    ctaEl.innerHTML = `<button class="btn btn-primary btn-lg" id="plusLoginBtn">Log in to subscribe</button>`;
    $("plusLoginBtn").addEventListener("click", () => openAuthModal("signup"));
  } else if (isPlus()) {
    const until = state.user.plusExpiry ? new Date(state.user.plusExpiry).toLocaleDateString() : "";
    ctaEl.innerHTML = `<div class="plus-active-badge">⭐ You're a Plus member${until ? ` · renews ${escapeHtml(until)}` : ""}</div>`;
  } else {
    ctaEl.innerHTML = `<button class="btn btn-primary btn-lg" id="subscribeBtn">Subscribe to Plus · ${inr(state.plan.price)}/yr</button>`;
    $("subscribeBtn").addEventListener("click", subscribePlus);
  }
}
async function subscribePlus() {
  if (!state.user) return openAuthModal("signup");
  const btn = $("subscribeBtn");
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`${API}/api/plus/subscribe`, { method: "POST", headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not subscribe");
    setUser(data.user);
    toast("🎉 You're now a MedGuard Plus member!");
  } catch (err) {
    toast(`⚠️ ${err.message}`);
    if (btn) btn.disabled = false;
  }
}

/* ---------- my orders ---------- */
async function openMyOrders() {
  if (!state.user) return openAuthModal("login");
  $("ordersModal").hidden = false;
  $("ordersModalBody").innerHTML = "<p>Loading…</p>";
  try {
    const res = await fetch(`${API}/api/my/orders`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load orders");
    const orders = data.orders || [];
    if (!orders.length) {
      $("ordersModalBody").innerHTML = "<p>You have no orders yet.</p>";
      return;
    }
    $("ordersModalBody").innerHTML = orders
      .map((o) => {
        const icon = o.type === "medicine" ? "📦" : o.type === "lab" ? "🧪" : "⚕️";
        let detail = "";
        if (o.type === "medicine") detail = (o.items || []).map((i) => `${i.name} ×${i.qty}`).join(", ");
        else if (o.type === "lab") detail = (o.tests || []).map((t) => t.name).join(", ");
        else detail = `${o.provider ? o.provider.name : ""} · ${o.visitMode || ""}`;
        return `
        <div class="order-row">
          <div class="order-row-head">
            <strong>${icon} ${escapeHtml(o.id)}</strong>
            <span class="order-status">${escapeHtml(o.status)}</span>
          </div>
          <small>${escapeHtml(detail)}</small>
          <div class="order-row-foot">
            <span>${new Date(o.createdAt).toLocaleDateString()}</span>
            <strong>${inr(o.total)}</strong>
          </div>
        </div>`;
      })
      .join("");
  } catch (err) {
    $("ordersModalBody").innerHTML = `<p>⚠️ ${escapeHtml(err.message)}</p>`;
  }
}

/* ---------- geolocation + map ---------- */
let miniMap = null;
async function useMyLocation() {
  if (!navigator.geolocation) {
    // graceful fallback: default to Hyderabad center
    setLocation(17.42, 78.47, "approximate (Hyderabad)");
    return;
  }
  $("locationStatus").textContent = "Getting your location…";
  navigator.geolocation.getCurrentPosition(
    (pos) => setLocation(pos.coords.latitude, pos.coords.longitude, "your live location"),
    () => {
      $("locationStatus").textContent = "Location denied — using approximate area.";
      setLocation(17.42, 78.47, "approximate (Hyderabad)");
    },
    { timeout: 8000 }
  );
}
async function setLocation(lat, lon, label) {
  state.location = { lat, lon };
  $("locationStatus").textContent = `📍 Using ${label}.`;
  await Promise.all([updateNearestHub(), loadProviders()]);
  renderMiniMap();
}
async function updateNearestHub() {
  try {
    const res = await fetch(`${API}/api/pharmacy/nearest?lat=${state.location.lat}&lon=${state.location.lon}`);
    const data = await res.json();
    $("nearestHub").textContent = data.pharmacy.name.replace("MedGuard Hub — ", "");
    $("deliveryEta").textContent = `~${data.etaMinutes} min`;
  } catch (_e) {
    /* ignore */
  }
}
function renderMiniMap() {
  const el = $("miniMap");
  if (typeof L === "undefined" || !state.location) return;
  if (miniMap) {
    miniMap.remove();
    miniMap = null;
  }
  miniMap = L.map(el, { scrollWheelZoom: false, attributionControl: false }).setView(
    [state.location.lat, state.location.lon],
    12
  );
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(miniMap);
  L.marker([state.location.lat, state.location.lon]).addTo(miniMap).bindPopup("You are here").openPopup();
  setTimeout(() => miniMap && miniMap.invalidateSize(), 200);
}

/* ---------- track ---------- */
async function trackOrder() {
  const id = $("trackInput").value.trim();
  if (!id) return;
  $("trackOutput").textContent = "Checking…";
  try {
    const res = await fetch(`${API}/api/orders/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("Order not found");
    const o = await res.json();
    if (o.type === "medicine") {
      $("trackOutput").textContent =
        `📦 Medicine order ${o.id}\nStatus: ${o.status}\nTotal: ${inr(o.total)}\n` +
        `From: ${o.fulfilledBy ? o.fulfilledBy.name : "—"}\nETA: ~${o.etaMinutes || "—"} min\n` +
        `Items: ${(o.items || []).map((i) => `${i.name} ×${i.qty}`).join(", ")}`;
    } else if (o.type === "lab") {
      $("trackOutput").textContent =
        `🧪 Lab booking ${o.id}\nStatus: ${o.status}\nTests: ${(o.tests || []).map((t) => t.name).join(", ")}\n` +
        `Slot: ${o.slot || "—"}\nTotal: ${inr(o.total)}\nReport in ~${o.reportHours || "—"}h`;
    } else {
      $("trackOutput").textContent =
        `⚕️ Care booking ${o.id}\nStatus: ${o.status}\n${o.provider ? o.provider.name : ""} · ${o.visitMode}\n` +
        `Slot: ${o.slot || "—"}\nFee: ${inr(o.fee || o.total)}`;
    }
  } catch (err) {
    $("trackOutput").textContent = `⚠️ ${err.message}`;
  }
}

/* ---------- chatbot ---------- */
const CHAT_INTENTS = [
  { keys: ["hi", "hello", "hey", "namaste"], reply: "Hello! 👋 I'm the MedGuard Care assistant. I can help with medicines, delivery, booking a doctor/nurse/caretaker, and online consults.", chips: ["Order medicines", "Book a doctor", "Delivery time"] },
  { keys: ["order", "medicine", "buy", "cart"], reply: "To order medicines: search in the Medicines section, tap Add +, open your cart 🛒, fill delivery details and place the order. Delivery is FREE over ₹500.", chips: ["Delivery time", "Prescription", "Track order"] },
  { keys: ["deliver", "eta", "time", "how long"], reply: "Delivery time depends on your nearest hub. Tap “Use my location” 📍 and we’ll show your ETA — usually 30–45 minutes.", chips: ["Order medicines", "Book a doctor"] },
  { keys: ["prescription", "rx"], reply: "Some medicines need a prescription (marked Rx). At checkout, tick the box to confirm you have a valid prescription. Our pharmacist verifies before dispatch.", chips: ["Order medicines"] },
  { keys: ["doctor", "book", "consult", "appointment"], reply: "Go to Doctors & Care. Choose a doctor, then pick 🏠 Home visit or 💻 Online, select a slot and confirm. With your location on, providers are sorted by distance.", chips: ["Online consult", "Nurse", "Caretaker"] },
  { keys: ["online", "video", "tele"], reply: "Online consults let a doctor advise you by video/phone at a lower fee. Pick a doctor → 💻 Online → choose a slot → confirm.", chips: ["Book a doctor"] },
  { keys: ["nurse", "injection", "wound"], reply: "Nurses handle injections, wound care, post-surgery care and vitals monitoring at home. Filter by 💉 Nurses in Doctors & Care.", chips: ["Book a doctor", "Caretaker"] },
  { keys: ["caretaker", "attendant", "elderly", "servant"], reply: "Caretakers provide full-day attendance, elderly companionship and physio assistance at home. Filter by 🤝 Caretakers.", chips: ["Book a doctor", "Nurse"] },
  { keys: ["track", "status", "where"], reply: "Enter your order reference (MED-… or CARE-…) in Track your order to see live status.", chips: ["Order medicines"] },
  { keys: ["emergency", "help", "urgent"], reply: "For emergencies call 1800-555-000 (24/7). This app is a demo and not a substitute for emergency services.", chips: [] },
  { keys: ["thanks", "thank"], reply: "You’re welcome! Stay healthy. 💙", chips: ["Order medicines", "Book a doctor"] },
];
const DEFAULT_CHIPS = ["Order medicines", "Book a doctor", "Delivery time", "Track order"];

function chatReply(text) {
  const t = text.toLowerCase();
  for (const intent of CHAT_INTENTS) {
    if (intent.keys.some((k) => t.includes(k))) return intent;
  }
  return { reply: "I can help with medicines, delivery, and booking doctors, nurses or caretakers. Try one of these:", chips: DEFAULT_CHIPS };
}
function appendChat(text, sender) {
  const log = $("chatLog");
  const el = document.createElement("div");
  el.className = `chat-msg ${sender}`;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}
function renderChips(chips) {
  const host = $("chatChips");
  host.innerHTML = "";
  (chips || DEFAULT_CHIPS).forEach((c) => {
    const b = document.createElement("button");
    b.className = "chat-chip";
    b.type = "button";
    b.textContent = c;
    b.addEventListener("click", () => handleChat(c));
    host.appendChild(b);
  });
}
function handleChat(text) {
  if (!text.trim()) return;
  appendChat(text, "user");
  const intent = chatReply(text);
  setTimeout(() => {
    appendChat(intent.reply, "bot");
    renderChips(intent.chips);
  }, 350);
}
function initChat() {
  appendChat("Hi! 👋 How can I help you today?", "bot");
  renderChips(DEFAULT_CHIPS);
}

/* ---------- view router + condition search ---------- */
function showView(name) {
  if (!VIEWS.includes(name)) name = "medicines";
  state.view = name;
  document.querySelectorAll(".view").forEach((v) => {
    v.classList.toggle("active", v.getAttribute("data-view-panel") === name);
  });
  document.querySelectorAll(".view-tab").forEach((t) => {
    t.classList.toggle("active", t.getAttribute("data-view") === name);
  });
  const tabs = document.querySelector(".view-tabs");
  if (tabs) tabs.scrollIntoView({ behavior: "smooth", block: "start" });
  if (miniMap) setTimeout(() => miniMap.invalidateSize(), 150);
}

function renderConditionChips() {
  const host = $("conditionChips");
  if (!host) return;
  host.innerHTML = CONDITIONS.map(
    (c) => `<button class="condition-chip" type="button" data-term="${c.term}">
      <span>${c.emoji}</span> ${escapeHtml(c.label)}
    </button>`
  ).join("");
}

function countMedMatches(q) {
  const t = q.toLowerCase();
  return state.medicines.filter(
    (m) =>
      !DEVICE_CATEGORIES.includes(m.category) &&
      (m.name.toLowerCase().includes(t) ||
        m.category.toLowerCase().includes(t) ||
        (m.tags || []).some((x) => x.includes(t)))
  ).length;
}
function countLabMatches(q) {
  const t = q.toLowerCase();
  return state.labTests.filter(
    (l) =>
      l.name.toLowerCase().includes(t) ||
      l.category.toLowerCase().includes(t) ||
      (l.tags || []).some((x) => x.includes(t))
  ).length;
}

/** Search by condition/symptom: filter medicines + lab tests, land on the best match. */
function globalSearch(term) {
  const q = String(term || "").trim();
  if (!q) {
    showView("medicines");
    return;
  }
  $("medSearch").value = q;
  if ($("medCategory")) $("medCategory").value = "all";
  renderMedicines();
  state.labQuery = q;
  if ($("labCategory")) $("labCategory").value = "all";
  renderLabTests();

  const medN = countMedMatches(q);
  const labN = countLabMatches(q);
  if (medN === 0 && labN > 0) {
    showView("labs");
    toast(`No medicines for “${q}” — showing ${labN} matching lab test${labN > 1 ? "s" : ""}.`);
  } else {
    showView("medicines");
    const extra = labN > 0 ? ` · ${labN} lab test${labN > 1 ? "s" : ""} in 🧪 tab` : "";
    toast(`${medN} result${medN === 1 ? "" : "s"} for “${q}”${extra}`);
  }
}

/* ---------- theme ---------- */
function initTheme() {
  const saved = localStorage.getItem("mg_theme");
  if (saved === "dark") document.documentElement.setAttribute("data-theme", "dark");
  updateThemeIcon();
}
function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  if (isDark) document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", "dark");
  localStorage.setItem("mg_theme", isDark ? "light" : "dark");
  updateThemeIcon();
  if (miniMap) setTimeout(() => miniMap.invalidateSize(), 100);
}
function updateThemeIcon() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  $("themeToggle").textContent = isDark ? "☀️" : "🌙";
}

/* ---------- events ---------- */
function bindEvents() {
  // view router: any element with data-view switches section
  document.querySelectorAll("[data-view]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      showView(el.getAttribute("data-view"));
    });
  });

  // global condition search
  if ($("globalSearchBtn")) $("globalSearchBtn").addEventListener("click", () => globalSearch($("globalSearch").value));
  if ($("globalSearch")) {
    $("globalSearch").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        globalSearch($("globalSearch").value);
      }
    });
  }
  if ($("conditionChips")) {
    $("conditionChips").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-term]");
      if (chip) globalSearch(chip.getAttribute("data-term"));
    });
  }

  $("medSearch").addEventListener("input", renderMedicines);
  $("medCategory").addEventListener("change", renderMedicines);
  $("medGrid").addEventListener("click", (e) => {
    const id = e.target.getAttribute("data-add");
    if (id) addToCart(id);
  });
  const deviceGrid = $("deviceGrid");
  if (deviceGrid) {
    deviceGrid.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-add");
      if (id) addToCart(id);
    });
  }

  // lab tests
  if ($("labCategory")) $("labCategory").addEventListener("change", renderLabTests);
  if ($("labGrid")) {
    $("labGrid").addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-lab");
      if (id) openLabModal(id);
    });
  }
  if ($("labModalClose")) $("labModalClose").addEventListener("click", () => ($("labModal").hidden = true));
  if ($("labModal")) {
    $("labModal").addEventListener("click", (e) => {
      if (e.target.id === "labModal") $("labModal").hidden = true;
    });
  }
  if ($("labModalBody")) {
    $("labModalBody").addEventListener("click", (e) => {
      const slot = e.target.getAttribute("data-lab-slot");
      if (slot) {
        state.labSelection.slot = slot;
        renderLabModal();
      }
      if (e.target.id === "confirmLabBtn") confirmLab();
    });
    $("labModalBody").addEventListener("change", (e) => {
      const toggle = e.target.getAttribute("data-lab-toggle");
      if (toggle) {
        if (e.target.checked) state.labSelection.tests.add(toggle);
        else state.labSelection.tests.delete(toggle);
        renderLabModal();
      }
    });
  }

  // coupon + support
  if ($("applyCouponBtn")) $("applyCouponBtn").addEventListener("click", applyCoupon);
  if ($("supportForm")) $("supportForm").addEventListener("submit", submitTicket);
  if ($("ticketBtn")) $("ticketBtn").addEventListener("click", lookupTicket);

  $("cartToggle").addEventListener("click", openCart);
  $("cartClose").addEventListener("click", closeCart);
  $("cartBackdrop").addEventListener("click", closeCart);
  $("cartItems").addEventListener("click", (e) => {
    const inc = e.target.getAttribute("data-inc");
    const dec = e.target.getAttribute("data-dec");
    const rem = e.target.getAttribute("data-remove");
    if (inc) setQty(inc, cartQty(inc) + 1);
    if (dec) setQty(dec, cartQty(dec) - 1);
    if (rem) setQty(rem, 0);
  });
  $("checkoutForm").addEventListener("submit", placeOrder);

  // Rx safety checker
  if ($("safetyCheckBtn")) $("safetyCheckBtn").addEventListener("click", openSafetyModal);
  if ($("safetyModalClose")) $("safetyModalClose").addEventListener("click", () => ($("safetyModal").hidden = true));
  if ($("safetyModal"))
    $("safetyModal").addEventListener("click", (e) => {
      if (e.target.id === "safetyModal") $("safetyModal").hidden = true;
    });
  if ($("safetySelect"))
    $("safetySelect").addEventListener("change", (e) => {
      const id = e.target.value;
      if (id && !state.safetyPicks.includes(id)) state.safetyPicks.push(id);
      e.target.value = "";
      renderSafetyModal();
    });
  if ($("safetyChips"))
    $("safetyChips").addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-remove-pick");
      if (id) {
        state.safetyPicks = state.safetyPicks.filter((p) => p !== id);
        renderSafetyModal();
      }
    });

  // In-app doctor consultation
  if ($("talkDoctorBtn")) $("talkDoctorBtn").addEventListener("click", () => openConsult(null));
  if ($("consultModalClose")) $("consultModalClose").addEventListener("click", () => ($("consultModal").hidden = true));
  if ($("consultModal"))
    $("consultModal").addEventListener("click", (e) => {
      if (e.target.id === "consultModal") $("consultModal").hidden = true;
    });
  if ($("consultForm")) $("consultForm").addEventListener("submit", sendConsultMessage);
  if ($("consultMessages"))
    $("consultMessages").addEventListener("click", (e) => {
      const addId = e.target.getAttribute("data-consult-add");
      const labId = e.target.getAttribute("data-consult-lab");
      if (addId) {
        addToCart(addId);
        toast("Added to cart 🛒");
      }
      if (labId) {
        $("consultModal").hidden = true;
        showView("labs");
        openLabModal(labId);
      }
    });

  document.querySelectorAll(".care-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".care-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      state.role = tab.getAttribute("data-role");
      loadProviders();
    });
  });
  $("providerGrid").addEventListener("click", (e) => {
    const consultId = e.target.getAttribute("data-consult");
    if (consultId) return openConsult(consultId);
    const id = e.target.getAttribute("data-book");
    const mode = e.target.getAttribute("data-mode");
    if (id) openCareModal(id, mode);
  });

  $("careModalClose").addEventListener("click", () => ($("careModal").hidden = true));
  $("careModal").addEventListener("click", (e) => {
    if (e.target.id === "careModal") $("careModal").hidden = true;
  });
  $("careModalBody").addEventListener("click", (e) => {
    const m = e.target.closest("[data-set-mode]");
    const slot = e.target.getAttribute("data-slot");
    if (m) {
      state.careSelection.mode = m.getAttribute("data-set-mode");
      renderCareModal();
    }
    if (slot) {
      state.careSelection.slot = slot;
      renderCareModal();
    }
    if (e.target.id === "confirmCareBtn") confirmCare();
  });

  $("useLocationBtn").addEventListener("click", useMyLocation);
  $("trackBtn").addEventListener("click", trackOrder);
  $("themeToggle").addEventListener("click", toggleTheme);

  // account / auth
  $("loginBtn").addEventListener("click", () => openAuthModal("login"));
  $("authModalClose").addEventListener("click", () => ($("authModal").hidden = true));
  $("authModal").addEventListener("click", (e) => {
    if (e.target.id === "authModal") $("authModal").hidden = true;
  });
  document.querySelectorAll(".auth-tab").forEach((b) => {
    b.addEventListener("click", () => switchAuthTab(b.getAttribute("data-auth-tab")));
  });
  $("loginForm").addEventListener("submit", doLogin);
  $("signupForm").addEventListener("submit", doRegister);
  $("forgotLink").addEventListener("click", showForgotForm);
  $("backToLogin").addEventListener("click", () => switchAuthTab("login"));
  $("forgotForm").addEventListener("submit", doForgot);
  $("resetConfirmBtn").addEventListener("click", doReset);
  // Pressing Enter in the code / new-password fields should verify the code,
  // not resubmit the form (which would resend a new code and invalidate this one).
  ["resetCode", "resetPassword"].forEach((id) => {
    $(id).addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doReset();
      }
    });
  });
  $("userMenuBtn").addEventListener("click", () => {
    $("userDropdown").hidden = !$("userDropdown").hidden;
  });
  document.addEventListener("click", (e) => {
    if (!$("userMenu").hidden && !$("userMenu").contains(e.target)) {
      $("userDropdown").hidden = true;
    }
  });
  $("logoutBtn").addEventListener("click", () => {
    $("userDropdown").hidden = true;
    doLogout();
  });
  $("ddMyOrders").addEventListener("click", () => {
    $("userDropdown").hidden = true;
    openMyOrders();
  });
  $("ddPlusLink").addEventListener("click", () => ($("userDropdown").hidden = true));
  $("ordersModalClose").addEventListener("click", () => ($("ordersModal").hidden = true));
  $("ordersModal").addEventListener("click", (e) => {
    if (e.target.id === "ordersModal") $("ordersModal").hidden = true;
  });

  // My Health dashboard
  if ($("ddMyHealth"))
    $("ddMyHealth").addEventListener("click", () => {
      $("userDropdown").hidden = true;
      openMyHealth();
    });
  if ($("healthModalClose")) $("healthModalClose").addEventListener("click", () => ($("healthModal").hidden = true));
  if ($("healthModal"))
    $("healthModal").addEventListener("click", (e) => {
      if (e.target.id === "healthModal") $("healthModal").hidden = true;
    });
  document.querySelectorAll(".health-tab").forEach((t) =>
    t.addEventListener("click", () => {
      document.querySelectorAll(".health-tab").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      renderHealthTab(t.getAttribute("data-htab"));
    })
  );
  if ($("healthBody"))
    $("healthBody").addEventListener("click", (e) => {
      const rxNo = e.target.getAttribute("data-rx");
      if (rxNo) {
        const rx = findPrescriptionByRxNo(rxNo);
        if (rx) openRx(rx);
        return;
      }
      const reorderId = e.target.getAttribute("data-reorder");
      if (reorderId) return reorderFromOrder(reorderId);
      const remindId = e.target.getAttribute("data-remind");
      if (remindId) return openRemindModal(remindId);
      const rReorder = e.target.getAttribute("data-remind-reorder");
      if (rReorder) return reorderFromReminder(rReorder);
      const rSnooze = e.target.getAttribute("data-remind-snooze");
      if (rSnooze) return reminderAction(rSnooze, "snooze");
      const rDone = e.target.getAttribute("data-remind-done");
      if (rDone) return reminderAction(rDone, "done");
    });

  // Refill reminder modal
  if ($("remindModalClose")) $("remindModalClose").addEventListener("click", () => ($("remindModal").hidden = true));
  if ($("remindModal"))
    $("remindModal").addEventListener("click", (e) => {
      if (e.target.id === "remindModal") $("remindModal").hidden = true;
    });
  if ($("remindOptions"))
    $("remindOptions").addEventListener("click", (e) => {
      const days = e.target.getAttribute("data-days");
      if (!days) return;
      document.querySelectorAll(".remind-opt").forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      if (pendingReminder) pendingReminder.days = parseInt(days, 10);
    });
  if ($("remindConfirmBtn")) $("remindConfirmBtn").addEventListener("click", confirmReminder);

  // Prescription (from consult chat + rx modal)
  if ($("consultRxBtn")) $("consultRxBtn").addEventListener("click", getPrescription);
  if ($("rxModalClose")) $("rxModalClose").addEventListener("click", () => ($("rxModal").hidden = true));
  if ($("rxModal"))
    $("rxModal").addEventListener("click", (e) => {
      if (e.target.id === "rxModal") $("rxModal").hidden = true;
    });
  if ($("rxPrintBtn")) $("rxPrintBtn").addEventListener("click", printRx);

  $("chatForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const val = $("chatInput").value;
    $("chatInput").value = "";
    handleChat(val);
  });
}

/* ---------- init ---------- */
function init() {
  initTheme();
  bindEvents();
  loadCatalog();
  loadLabTests();
  loadProviders();
  loadPlan();
  restoreSession();
  renderCart();
  initChat();
  renderConditionChips();
  showView("medicines");
}
init();
