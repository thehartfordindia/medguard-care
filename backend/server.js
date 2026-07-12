"use strict";

/**
 * MedGuard Care — backend server (Node.js native http, no external web framework).
 * Serves the responsive web app and a small JSON API:
 *   - Medicine catalog + pharmacy geo lookup
 *   - Care providers (doctors / nurses / caretakers) with slots
 *   - Orders (door-to-door medicine delivery + at-home care bookings)
 *   - Online consultations (doctor tele-visits)
 *   - Ops/admin endpoints (secured by ADMIN_SECRET)
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const store = require("./store");

const PORT = Number(process.env.PORT) || 8790;
const ADMIN_SECRET = process.env.ADMIN_SECRET || "change-me";
const WEBSITE_URL = process.env.WEBSITE_URL || `http://localhost:${PORT}`;
const PUBLIC_DIR = path.join(__dirname, "..", "public");

/* ============================================================
   Static seed data (medicines + care providers + pharmacies)
   ============================================================ */

const MEDICINES = [
  { id: "para-500", name: "Paracetamol 500mg", category: "Pain & Fever", form: "Tablet (10s)", price: 25, rx: false, tags: ["fever", "headache", "pain"] },
  { id: "ibu-400", name: "Ibuprofen 400mg", category: "Pain & Fever", form: "Tablet (10s)", price: 42, rx: false, tags: ["pain", "inflammation"] },
  { id: "azith-500", name: "Azithromycin 500mg", category: "Antibiotics", form: "Tablet (3s)", price: 88, rx: true, tags: ["infection", "antibiotic"] },
  { id: "amox-500", name: "Amoxicillin 500mg", category: "Antibiotics", form: "Capsule (10s)", price: 65, rx: true, tags: ["infection", "antibiotic"] },
  { id: "metf-500", name: "Metformin 500mg", category: "Diabetes Care", form: "Tablet (15s)", price: 34, rx: true, tags: ["diabetes", "sugar"] },
  { id: "glime-2", name: "Glimepiride 2mg", category: "Diabetes Care", form: "Tablet (10s)", price: 56, rx: true, tags: ["diabetes", "sugar"] },
  { id: "amlo-5", name: "Amlodipine 5mg", category: "Heart & BP", form: "Tablet (10s)", price: 30, rx: true, tags: ["bp", "hypertension", "heart"] },
  { id: "telm-40", name: "Telmisartan 40mg", category: "Heart & BP", form: "Tablet (10s)", price: 72, rx: true, tags: ["bp", "hypertension"] },
  { id: "ator-10", name: "Atorvastatin 10mg", category: "Heart & BP", form: "Tablet (10s)", price: 60, rx: true, tags: ["cholesterol", "heart"] },
  { id: "ceti-10", name: "Cetirizine 10mg", category: "Allergy & Cold", form: "Tablet (10s)", price: 20, rx: false, tags: ["allergy", "cold", "sneezing"] },
  { id: "montk-10", name: "Montelukast 10mg", category: "Allergy & Cold", form: "Tablet (10s)", price: 95, rx: true, tags: ["allergy", "asthma"] },
  { id: "pan-40", name: "Pantoprazole 40mg", category: "Digestive", form: "Tablet (15s)", price: 48, rx: false, tags: ["acidity", "gas", "gastric"] },
  { id: "ors-1", name: "ORS Rehydration Salts", category: "Digestive", form: "Sachet (5s)", price: 30, rx: false, tags: ["dehydration", "diarrhea"] },
  { id: "vitd3", name: "Vitamin D3 60k IU", category: "Vitamins & Supplements", form: "Sachet (4s)", price: 110, rx: false, tags: ["vitamin", "bones", "immunity"] },
  { id: "vitb12", name: "Vitamin B12 1500mcg", category: "Vitamins & Supplements", form: "Tablet (10s)", price: 85, rx: false, tags: ["vitamin", "energy", "nerves"] },
  { id: "calc-500", name: "Calcium + D3", category: "Vitamins & Supplements", form: "Tablet (15s)", price: 78, rx: false, tags: ["bones", "calcium"] },
  { id: "thyro-50", name: "Thyroxine 50mcg", category: "Thyroid Care", form: "Tablet (30s)", price: 96, rx: true, tags: ["thyroid", "hormone"] },
  { id: "insulin-pen", name: "Insulin Pen (Refill)", category: "Diabetes Care", form: "Cartridge", price: 320, rx: true, tags: ["diabetes", "insulin"] },
  { id: "inhaler-sal", name: "Salbutamol Inhaler", category: "Respiratory", form: "Inhaler 200 doses", price: 165, rx: true, tags: ["asthma", "breathing"] },
  { id: "bp-monitor", name: "Digital BP Monitor", category: "Devices", form: "Device", price: 1450, rx: false, tags: ["device", "bp", "monitor"] },
  { id: "glucometer", name: "Glucometer Kit", category: "Devices", form: "Device + 25 strips", price: 899, rx: false, tags: ["device", "sugar", "glucose"] },
  { id: "oximeter", name: "Pulse Oximeter", category: "Devices", form: "Device", price: 699, rx: false, tags: ["device", "oxygen", "spo2"] },
  { id: "thermo", name: "Digital Thermometer", category: "Devices", form: "Device", price: 199, rx: false, tags: ["device", "fever", "temperature"] },
  { id: "nmask", name: "N95 Mask (Pack of 5)", category: "Protection", form: "Pack", price: 149, rx: false, tags: ["mask", "protection"] },
  { id: "nebulizer", name: "Compressor Nebulizer", category: "Devices", form: "Device", price: 1650, rx: false, tags: ["device", "asthma", "breathing", "respiratory"] },
  { id: "weigh-scale", name: "Digital Weighing Scale", category: "Devices", form: "Device", price: 899, rx: false, tags: ["device", "weight", "fitness"] },
  { id: "heating-pad", name: "Electric Heating Pad", category: "Devices", form: "Device", price: 749, rx: false, tags: ["device", "pain", "muscle"] },
  { id: "firstaid", name: "Home First-Aid Kit", category: "Devices", form: "Kit (42 items)", price: 549, rx: false, tags: ["device", "firstaid", "emergency"] },
  { id: "wheelchair", name: "Foldable Wheelchair", category: "Mobility Aids", form: "Device", price: 6499, rx: false, tags: ["device", "mobility", "elderly"] },
  { id: "walk-stick", name: "Adjustable Walking Stick", category: "Mobility Aids", form: "Device", price: 649, rx: false, tags: ["device", "mobility", "elderly", "support"] },
  { id: "walker", name: "Foldable Walker", category: "Mobility Aids", form: "Device", price: 1899, rx: false, tags: ["device", "mobility", "elderly"] },
  { id: "airbed", name: "Anti-Bedsore Air Mattress", category: "Mobility Aids", form: "Device", price: 2999, rx: false, tags: ["device", "bedridden", "care"] },
  { id: "steamer", name: "Steam Vaporizer", category: "Devices", form: "Device", price: 399, rx: false, tags: ["device", "cold", "congestion"] },
  { id: "cotton-roll", name: "Sterile Cotton & Gauze Kit", category: "Protection", form: "Kit", price: 129, rx: false, tags: ["wound", "dressing", "protection"] },
  { id: "gloves", name: "Nitrile Gloves (Box of 50)", category: "Protection", form: "Box", price: 299, rx: false, tags: ["protection", "hygiene"] },
  { id: "sanitizer", name: "Hand Sanitizer 500ml", category: "Protection", form: "Bottle", price: 149, rx: false, tags: ["protection", "hygiene", "sanitizer"] },
];

const LAB_TESTS = [
  { id: "cbc", name: "Complete Blood Count (CBC)", category: "Blood", price: 299, reportHours: 12, fasting: false, tags: ["blood", "anemia", "infection"] },
  { id: "lipid", name: "Lipid Profile", category: "Heart", price: 499, reportHours: 24, fasting: true, tags: ["cholesterol", "heart"] },
  { id: "hba1c", name: "HbA1c (Diabetes)", category: "Diabetes", price: 449, reportHours: 24, fasting: false, tags: ["sugar", "diabetes"] },
  { id: "thyroid", name: "Thyroid Profile (T3 T4 TSH)", category: "Hormone", price: 549, reportHours: 24, fasting: false, tags: ["thyroid", "hormone"] },
  { id: "vitd", name: "Vitamin D Test", category: "Vitamins", price: 899, reportHours: 36, fasting: false, tags: ["vitamin", "bones"] },
  { id: "liver", name: "Liver Function Test (LFT)", category: "Organ", price: 649, reportHours: 24, fasting: true, tags: ["liver"] },
  { id: "kidney", name: "Kidney Function Test (KFT)", category: "Organ", price: 649, reportHours: 24, fasting: true, tags: ["kidney"] },
  { id: "fullbody", name: "Full Body Checkup (70+ params)", category: "Packages", price: 1499, reportHours: 36, fasting: true, tags: ["package", "checkup", "wellness"] },
  { id: "fever-panel", name: "Fever Panel", category: "Packages", price: 799, reportHours: 24, fasting: false, tags: ["fever", "dengue", "malaria", "typhoid"] },
  { id: "senior-care", name: "Senior Citizen Health Package", category: "Packages", price: 2499, reportHours: 48, fasting: true, tags: ["package", "elderly", "wellness"] },
];

// Promo codes (percentage or flat), applied at checkout.
const COUPONS = {
  MED10: { type: "percent", value: 10, maxDiscount: 150, minOrder: 200, label: "10% off (max ₹150)" },
  FIRST50: { type: "flat", value: 50, minOrder: 300, label: "₹50 off orders over ₹300" },
  CARE20: { type: "percent", value: 20, maxDiscount: 300, minOrder: 500, label: "20% off (max ₹300)" },
  LAB25: { type: "percent", value: 25, maxDiscount: 400, minOrder: 400, label: "25% off lab tests" },
};

// MedGuard Plus — paid membership (demo, no real payment is processed).
const PLUS_PLAN = {
  id: "plus",
  name: "MedGuard Plus",
  price: 499,
  period: "year",
  memberDiscountRate: 0.05, // 5% off medicines, devices & lab tests
  benefits: [
    { icon: "🚚", title: "Free delivery, always", desc: "No minimum order — every medicine delivery is free." },
    { icon: "🏷️", title: "Flat 5% member discount", desc: "Auto-applied on medicines, devices & lab tests." },
    { icon: "🧪", title: "Free lab sample collection", desc: "Home collection is always free for members." },
    { icon: "⚡", title: "Priority support", desc: "Your tickets and callbacks jump the queue." },
    { icon: "👨‍⚕️", title: "Member consult savings", desc: "5% off every doctor home visit and online consult." },
  ],
};

const PROVIDERS = [
  { id: "dr-anitha", role: "doctor", name: "Dr. Anitha Rao", specialty: "General Physician", exp: 12, rating: 4.9, feeHome: 800, feeOnline: 400, lat: 17.4239, lon: 78.4738, languages: ["English", "Telugu", "Hindi"], modes: ["online", "home"] },
  { id: "dr-imran", role: "doctor", name: "Dr. Imran Khan", specialty: "Cardiologist", exp: 18, rating: 4.8, feeHome: 1500, feeOnline: 700, lat: 17.4483, lon: 78.3915, languages: ["English", "Hindi", "Urdu"], modes: ["online", "home"] },
  { id: "dr-lakshmi", role: "doctor", name: "Dr. Lakshmi Menon", specialty: "Diabetologist", exp: 14, rating: 4.9, feeHome: 1200, feeOnline: 600, lat: 17.4062, lon: 78.4691, languages: ["English", "Malayalam", "Tamil"], modes: ["online", "home"] },
  { id: "dr-sameer", role: "doctor", name: "Dr. Sameer Joshi", specialty: "Pediatrician", exp: 10, rating: 4.7, feeHome: 900, feeOnline: 450, lat: 17.4948, lon: 78.3996, languages: ["English", "Hindi", "Marathi"], modes: ["online", "home"] },
  { id: "dr-fatima", role: "doctor", name: "Dr. Fatima Sheikh", specialty: "Geriatric Care", exp: 20, rating: 5.0, feeHome: 1300, feeOnline: 650, lat: 17.385, lon: 78.4867, languages: ["English", "Hindi", "Urdu"], modes: ["online", "home"] },
  { id: "nurse-ravi", role: "nurse", name: "Ravi Teja", specialty: "Injection & Wound Care", exp: 7, rating: 4.8, feeHome: 350, feeOnline: 0, lat: 17.4375, lon: 78.4483, languages: ["Telugu", "Hindi"], modes: ["home"] },
  { id: "nurse-priya", role: "nurse", name: "Priya Nair", specialty: "Post-Surgery Nursing", exp: 9, rating: 4.9, feeHome: 500, feeOnline: 0, lat: 17.4126, lon: 78.4482, languages: ["English", "Malayalam", "Hindi"], modes: ["home"] },
  { id: "nurse-arjun", role: "nurse", name: "Arjun Das", specialty: "Elderly Vitals Monitoring", exp: 6, rating: 4.7, feeHome: 400, feeOnline: 0, lat: 17.4569, lon: 78.5245, languages: ["English", "Hindi", "Bengali"], modes: ["home"] },
  { id: "care-sunita", role: "caretaker", name: "Sunita Devi", specialty: "Full-day Attendant", exp: 8, rating: 4.8, feeHome: 1200, feeOnline: 0, lat: 17.401, lon: 78.5, languages: ["Hindi", "Telugu"], modes: ["home"] },
  { id: "care-james", role: "caretaker", name: "James Peter", specialty: "Elderly Companion", exp: 5, rating: 4.6, feeHome: 1000, feeOnline: 0, lat: 17.44, lon: 78.39, languages: ["English", "Tamil"], modes: ["home"] },
  { id: "care-meena", role: "caretaker", name: "Meena Kumari", specialty: "Physio Assistant", exp: 7, rating: 4.9, feeHome: 1100, feeOnline: 0, lat: 17.49, lon: 78.41, languages: ["English", "Hindi", "Telugu"], modes: ["home"] },
];

const PHARMACIES = [
  { id: "ph-jubilee", name: "MedGuard Hub — Jubilee Hills", lat: 17.4239, lon: 78.4071, etaMinutes: 35 },
  { id: "ph-madhapur", name: "MedGuard Hub — Madhapur", lat: 17.4483, lon: 78.3915, etaMinutes: 30 },
  { id: "ph-dilsukh", name: "MedGuard Hub — Dilsukhnagar", lat: 17.3687, lon: 78.5247, etaMinutes: 40 },
  { id: "ph-kukat", name: "MedGuard Hub — Kukatpally", lat: 17.4948, lon: 78.3996, etaMinutes: 45 },
  { id: "ph-secbad", name: "MedGuard Hub — Secunderabad", lat: 17.4399, lon: 78.4983, etaMinutes: 38 },
];

/* ============================================================
   Helpers
   ============================================================ */

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function nearestPharmacy(lat, lon) {
  if (lat == null || lon == null) return { ...PHARMACIES[0], distanceKm: null };
  let best = null;
  for (const p of PHARMACIES) {
    const distanceKm = haversineKm(lat, lon, p.lat, p.lon);
    if (!best || distanceKm < best.distanceKm) best = { ...p, distanceKm };
  }
  return best;
}

function deliveryEtaMinutes(distanceKm, baseEta) {
  if (distanceKm == null) return baseEta;
  // base hub prep + ~3 min per km road time
  return Math.round(baseEta + distanceKm * 3);
}

function genId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function cleanText(value, max = 500) {
  return String(value == null ? "" : value)
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-admin-secret, x-auth-token, authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (_e) {
        resolve({});
      }
    });
  });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

function serveStatic(res, fileName) {
  const safe = path.normalize(fileName).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safe);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  });
}

/* ============================================================
   Booking / order lifecycle
   ============================================================ */

function priceCart(items) {
  const catalog = new Map(MEDICINES.map((m) => [m.id, m]));
  let subtotal = 0;
  const lines = [];
  let requiresRx = false;
  for (const item of items || []) {
    const med = catalog.get(item.id);
    if (!med) continue;
    const qty = clampNumber(item.qty, 1, 20, 1);
    const lineTotal = med.price * qty;
    subtotal += lineTotal;
    if (med.rx) requiresRx = true;
    lines.push({ id: med.id, name: med.name, price: med.price, qty, lineTotal, rx: med.rx });
  }
  const deliveryFee = subtotal >= 500 || subtotal === 0 ? 0 : 40;
  const total = subtotal + deliveryFee;
  return { lines, subtotal, deliveryFee, total, requiresRx };
}

/** Validate and compute a coupon discount against an amount (subtotal). */
function applyCoupon(code, amount) {
  const c = COUPONS[String(code || "").toUpperCase().trim()];
  if (!c) return { valid: false, discount: 0, reason: "Invalid coupon code." };
  if (amount < c.minOrder) {
    return { valid: false, discount: 0, reason: `Minimum order ₹${c.minOrder} required for this coupon.` };
  }
  let discount = c.type === "percent" ? Math.round((amount * c.value) / 100) : c.value;
  if (c.maxDiscount) discount = Math.min(discount, c.maxDiscount);
  discount = Math.min(discount, amount);
  return { valid: true, discount, label: c.label, code: String(code).toUpperCase() };
}

/* ============================================================
   Accounts / authentication
   ============================================================ */

function hashPassword(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), useSalt, 64).toString("hex");
  return { salt: useSalt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(expectedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Is the user's MedGuard Plus membership currently active? */
function plusActive(user) {
  if (!user || !user.plusMember) return false;
  if (!user.plusExpiry) return true;
  return new Date(user.plusExpiry).getTime() > Date.now();
}

/** Strip sensitive fields before returning a user to the client. */
function publicUser(user) {
  if (!user) return null;
  const { passwordHash, passwordSalt, ...safe } = user;
  return { ...safe, plusActive: plusActive(user) };
}

function readAuthToken(req) {
  const header = req.headers["x-auth-token"];
  if (header) return String(header);
  const auth = req.headers["authorization"] || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return "";
}

/** Resolve the logged-in user from the request token, or null. */
async function getSessionUser(req) {
  const token = readAuthToken(req);
  if (!token) return null;
  const sessions = await store.getSessions();
  const session = sessions.find((s) => s.token === token);
  if (!session) return null;
  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) return null;
  const users = await store.getUsers();
  return users.find((u) => u.id === session.userId) || null;
}

/* ============================================================
   Request router
   ============================================================ */

const server = http.createServer(async (req, res) => {
  const pathname = (req.url || "/").split("?")[0];
  const query = new URLSearchParams((req.url || "").split("?")[1] || "");

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-secret, x-auth-token, authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    res.end();
    return;
  }

  try {
    // ---- API ----
    if (pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, storage: store.mode(), time: new Date().toISOString() });
    }

    if (pathname === "/api/catalog") {
      return sendJson(res, 200, {
        medicines: MEDICINES,
        categories: [...new Set(MEDICINES.map((m) => m.category))],
      });
    }

    if (pathname === "/api/lab-tests") {
      return sendJson(res, 200, {
        tests: LAB_TESTS,
        categories: [...new Set(LAB_TESTS.map((t) => t.category))],
      });
    }

    if (pathname === "/api/coupon" && req.method === "POST") {
      const body = await readBody(req);
      const amount = clampNumber(body.amount, 0, 1000000, 0);
      const result = applyCoupon(body.code, amount);
      return sendJson(res, result.valid ? 200 : 400, result);
    }

    // ---- Membership plan (public info) ----
    if (pathname === "/api/plan") {
      return sendJson(res, 200, { plan: PLUS_PLAN });
    }

    // ---- Accounts / authentication ----
    if (pathname === "/api/auth/register" && req.method === "POST") {
      const body = await readBody(req);
      const name = cleanText(body.name, 80);
      const email = cleanText(body.email, 120).toLowerCase();
      const phone = cleanText(body.phone, 20);
      const password = String(body.password || "");
      if (!name || !email || !password) {
        return sendJson(res, 400, { error: "Name, email and password are required." });
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return sendJson(res, 400, { error: "Please enter a valid email address." });
      }
      if (password.length < 6) {
        return sendJson(res, 400, { error: "Password must be at least 6 characters." });
      }
      const users = await store.getUsers();
      if (users.some((u) => u.email === email)) {
        return sendJson(res, 409, { error: "An account with this email already exists." });
      }
      const { salt, hash } = hashPassword(password);
      const user = {
        id: genId("USR"),
        name,
        email,
        phone,
        passwordSalt: salt,
        passwordHash: hash,
        plusMember: false,
        plusSince: null,
        plusExpiry: null,
        createdAt: new Date().toISOString(),
      };
      await store.saveUsers([user]);
      const token = crypto.randomBytes(32).toString("hex");
      const now = Date.now();
      await store.saveSessions([
        {
          token,
          userId: user.id,
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ]);
      return sendJson(res, 201, { token, user: publicUser(user) });
    }

    if (pathname === "/api/auth/login" && req.method === "POST") {
      const body = await readBody(req);
      const email = cleanText(body.email, 120).toLowerCase();
      const password = String(body.password || "");
      if (!email || !password) {
        return sendJson(res, 400, { error: "Email and password are required." });
      }
      const users = await store.getUsers();
      const user = users.find((u) => u.email === email);
      if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
        return sendJson(res, 401, { error: "Invalid email or password." });
      }
      const token = crypto.randomBytes(32).toString("hex");
      const now = Date.now();
      await store.saveSessions([
        {
          token,
          userId: user.id,
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ]);
      return sendJson(res, 200, { token, user: publicUser(user) });
    }

    if (pathname === "/api/auth/logout" && req.method === "POST") {
      const token = readAuthToken(req);
      if (token) await store.deleteSession(token);
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === "/api/auth/me" && req.method === "GET") {
      const user = await getSessionUser(req);
      if (!user) return sendJson(res, 401, { error: "Not logged in." });
      return sendJson(res, 200, { user: publicUser(user) });
    }

    // ---- MedGuard Plus subscription (demo, no real payment) ----
    if (pathname === "/api/plus/subscribe" && req.method === "POST") {
      const user = await getSessionUser(req);
      if (!user) return sendJson(res, 401, { error: "Please log in to subscribe." });
      const now = new Date();
      const expiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      user.plusMember = true;
      user.plusSince = user.plusSince || now.toISOString();
      user.plusExpiry = expiry.toISOString();
      await store.saveUsers([user]);
      return sendJson(res, 200, {
        ok: true,
        user: publicUser(user),
        message: "Welcome to MedGuard Plus! Your benefits are active.",
      });
    }

    if (pathname === "/api/plus/cancel" && req.method === "POST") {
      const user = await getSessionUser(req);
      if (!user) return sendJson(res, 401, { error: "Please log in first." });
      user.plusMember = false;
      user.plusExpiry = null;
      await store.saveUsers([user]);
      return sendJson(res, 200, { ok: true, user: publicUser(user) });
    }

    // ---- My orders (logged-in user's history) ----
    if (pathname === "/api/my/orders" && req.method === "GET") {
      const user = await getSessionUser(req);
      if (!user) return sendJson(res, 401, { error: "Please log in to view your orders." });
      const orders = await store.getOrders();
      const mine = orders.filter((o) => o.userId === user.id).reverse();
      return sendJson(res, 200, { orders: mine });
    }

    if (pathname === "/api/providers") {
      const role = query.get("role");
      let list = PROVIDERS;
      if (role && role !== "all") list = list.filter((p) => p.role === role);
      const lat = Number(query.get("lat"));
      const lon = Number(query.get("lon"));
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        list = list
          .map((p) => ({ ...p, distanceKm: Math.round(haversineKm(lat, lon, p.lat, p.lon) * 10) / 10 }))
          .sort((a, b) => a.distanceKm - b.distanceKm);
      }
      return sendJson(res, 200, { providers: list });
    }

    if (pathname === "/api/pharmacy/nearest") {
      const lat = Number(query.get("lat"));
      const lon = Number(query.get("lon"));
      const near = nearestPharmacy(
        Number.isNaN(lat) ? null : lat,
        Number.isNaN(lon) ? null : lon
      );
      const eta = deliveryEtaMinutes(near.distanceKm, near.etaMinutes);
      return sendJson(res, 200, {
        pharmacy: near,
        etaMinutes: eta,
        distanceKm: near.distanceKm == null ? null : Math.round(near.distanceKm * 10) / 10,
      });
    }

    if (pathname === "/api/quote" && req.method === "POST") {
      const body = await readBody(req);
      const quote = priceCart(body.items);
      return sendJson(res, 200, quote);
    }

    // Create a medicine delivery order OR a care booking
    if (pathname === "/api/orders" && req.method === "POST") {
      const body = await readBody(req);
      const type = body.type === "care" ? "care" : body.type === "lab" ? "lab" : "medicine";
      const customer = body.customer || {};
      const name = cleanText(customer.name, 80);
      const phone = cleanText(customer.phone, 20);
      const address = cleanText(customer.address, 240);
      if (!name || !phone) {
        return sendJson(res, 400, { error: "Name and phone are required." });
      }

      const sessionUser = await getSessionUser(req);
      const isPlus = plusActive(sessionUser);

      const geo =
        customer.lat != null && customer.lon != null
          ? { lat: Number(customer.lat), lon: Number(customer.lon) }
          : null;

      let order = {
        id: genId(type === "care" ? "CARE" : type === "lab" ? "LAB" : "MED"),
        type,
        status: "PLACED",
        userId: sessionUser ? sessionUser.id : null,
        plusMember: isPlus,
        customer: { name, phone, address, ...(geo || {}) },
        notes: cleanText(body.notes, 300),
        createdAt: new Date().toISOString(),
      };

      if (type === "medicine") {
        const quote = priceCart(body.items);
        if (!quote.lines.length) {
          return sendJson(res, 400, { error: "Your cart is empty." });
        }
        const near = nearestPharmacy(geo ? geo.lat : null, geo ? geo.lon : null);
        const eta = deliveryEtaMinutes(near.distanceKm, near.etaMinutes);
        let discount = 0;
        let couponCode = null;
        if (body.coupon) {
          const applied = applyCoupon(body.coupon, quote.subtotal);
          if (applied.valid) {
            discount = applied.discount;
            couponCode = applied.code;
          }
        }
        const memberDiscount = isPlus ? Math.round(quote.subtotal * PLUS_PLAN.memberDiscountRate) : 0;
        const deliveryFee = isPlus ? 0 : quote.deliveryFee;
        order = {
          ...order,
          items: quote.lines,
          subtotal: quote.subtotal,
          deliveryFee,
          discount,
          memberDiscount,
          coupon: couponCode,
          total: Math.max(0, quote.subtotal + deliveryFee - discount - memberDiscount),
          requiresRx: quote.requiresRx,
          rxUploaded: Boolean(body.rxUploaded),
          fulfilledBy: { id: near.id, name: near.name },
          etaMinutes: eta,
          paymentStatus: "COD_PENDING",
        };
      } else if (type === "lab") {
        const tests = (body.tests || [])
          .map((id) => LAB_TESTS.find((t) => t.id === id))
          .filter(Boolean);
        if (!tests.length) return sendJson(res, 400, { error: "Select at least one lab test." });
        const subtotal = tests.reduce((s, t) => s + t.price, 0);
        const collectionFee = isPlus ? 0 : subtotal >= 500 ? 0 : 50;
        let discount = 0;
        let couponCode = null;
        if (body.coupon) {
          const applied = applyCoupon(body.coupon, subtotal);
          if (applied.valid) {
            discount = applied.discount;
            couponCode = applied.code;
          }
        }
        const memberDiscount = isPlus ? Math.round(subtotal * PLUS_PLAN.memberDiscountRate) : 0;
        const maxReport = Math.max(...tests.map((t) => t.reportHours));
        const anyFasting = tests.some((t) => t.fasting);
        order = {
          ...order,
          tests: tests.map((t) => ({ id: t.id, name: t.name, price: t.price })),
          subtotal,
          collectionFee,
          discount,
          memberDiscount,
          coupon: couponCode,
          total: Math.max(0, subtotal + collectionFee - discount - memberDiscount),
          slot: cleanText(body.slot, 40),
          fasting: anyFasting,
          reportHours: maxReport,
          paymentStatus: "PAY_AT_COLLECTION",
        };
      } else {
        const provider = PROVIDERS.find((p) => p.id === body.providerId);
        if (!provider) return sendJson(res, 400, { error: "Select a valid care provider." });
        const visitMode = body.visitMode === "online" ? "online" : "home";
        if (!provider.modes.includes(visitMode)) {
          return sendJson(res, 400, { error: `${provider.name} does not offer ${visitMode} visits.` });
        }
        const fee = visitMode === "online" ? provider.feeOnline : provider.feeHome;
        let discount = 0;
        let couponCode = null;
        if (body.coupon) {
          const applied = applyCoupon(body.coupon, fee);
          if (applied.valid) {
            discount = applied.discount;
            couponCode = applied.code;
          }
        }
        const memberDiscount = isPlus ? Math.round(fee * PLUS_PLAN.memberDiscountRate) : 0;
        order = {
          ...order,
          provider: { id: provider.id, name: provider.name, role: provider.role, specialty: provider.specialty },
          visitMode,
          slot: cleanText(body.slot, 40),
          fee,
          discount,
          memberDiscount,
          coupon: couponCode,
          total: Math.max(0, fee - discount - memberDiscount),
          paymentStatus: "PAY_AT_VISIT",
        };
      }

      const orders = await store.getOrders();
      orders.push(order);
      await store.saveOrders([order]);
      return sendJson(res, 201, order);
    }

    // Get a single order
    if (pathname.startsWith("/api/orders/") && req.method === "GET") {
      const id = decodeURIComponent(pathname.split("/")[3] || "");
      const orders = await store.getOrders();
      const found = orders.find((o) => o.id === id);
      if (!found) return sendJson(res, 404, { error: "Order not found." });
      return sendJson(res, 200, found);
    }

    // ---- Customer support ----
    if (pathname === "/api/support" && req.method === "POST") {
      const body = await readBody(req);
      const name = cleanText(body.name, 80);
      const contact = cleanText(body.contact, 60);
      const category = cleanText(body.category, 40) || "General";
      const message = cleanText(body.message, 800);
      if (!name || !contact || !message) {
        return sendJson(res, 400, { error: "Name, contact and message are required." });
      }
      const ticket = {
        id: genId("TKT"),
        name,
        contact,
        category,
        message,
        orderRef: cleanText(body.orderRef, 40),
        callbackRequested: Boolean(body.callbackRequested),
        status: "OPEN",
        createdAt: new Date().toISOString(),
      };
      await store.saveTickets([ticket]);
      return sendJson(res, 201, {
        ok: true,
        ticket,
        eta: ticket.callbackRequested ? "We'll call you back within 30 minutes." : "We'll reply within 2 hours.",
      });
    }

    if (pathname.startsWith("/api/support/") && req.method === "GET") {
      const id = decodeURIComponent(pathname.split("/")[3] || "");
      const tickets = await store.getTickets();
      const found = tickets.find((t) => t.id === id);
      if (!found) return sendJson(res, 404, { error: "Ticket not found." });
      return sendJson(res, 200, found);
    }

    // ---- Admin (secured) ----
    if (pathname.startsWith("/api/admin/")) {
      const secret = req.headers["x-admin-secret"] || query.get("secret");
      if (secret !== ADMIN_SECRET) {
        return sendJson(res, 401, { error: "Unauthorized" });
      }
      if (pathname === "/api/admin/orders") {
        const orders = await store.getOrders();
        return sendJson(res, 200, { orders: orders.slice().reverse() });
      }
      if (pathname === "/api/admin/tickets") {
        const tickets = await store.getTickets();
        return sendJson(res, 200, { tickets: tickets.slice().reverse() });
      }
      if (pathname === "/api/admin/status" && req.method === "POST") {
        const body = await readBody(req);
        const orders = await store.getOrders();
        const target = orders.find((o) => o.id === body.orderId);
        if (!target) return sendJson(res, 404, { error: "Order not found." });
        target.status = cleanText(body.status, 40) || target.status;
        target.updatedAt = new Date().toISOString();
        await store.saveOrders([target]);
        return sendJson(res, 200, target);
      }
    }

    // ---- Static ----
    if (pathname === "/" || pathname === "/index.html") {
      return serveStatic(res, "index.html");
    }
    if (pathname === "/styles.css") return serveStatic(res, "styles.css");
    if (pathname === "/app.js") return serveStatic(res, "app.js");
    if (pathname === "/admin") return serveStatic(res, "admin.html");

    // Fallback: any other static asset by name
    if (pathname !== "/" && !pathname.startsWith("/api/")) {
      return serveStatic(res, pathname.slice(1));
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    return sendJson(res, 500, { error: "Server error", detail: String(err && err.message) });
  }
});

server.listen(PORT, async () => {
  await store.ensureReady();
  // eslint-disable-next-line no-console
  console.log(`MedGuard Care running on http://localhost:${PORT} (storage: ${store.mode()})`);
});
