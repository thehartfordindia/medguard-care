/**
 * MedGuard — GARMA Rx Safety Engine (Node port)
 * ------------------------------------------------
 * Ported from the Python GARMA (GenAI Risk Mitigation Advisor) module so the
 * live web app can warn customers about risky drug combinations in real time.
 *
 * NOT a substitute for professional medical advice — informational only.
 */

const DISCLAIMER =
  "This is an automated, informational safety check — not medical advice. " +
  "Always confirm with your doctor or pharmacist before combining medicines.";

// Severity ranking (higher = more serious).
const SEVERITY_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

// Map each catalog medicine id -> canonical drug tokens (generic + drug class).
// Extra tokens (e.g. "nsaid", "sulfonylurea") let interaction rules match by class.
const DRUG_KEYS = {
  "para-500": ["paracetamol"],
  "ibu-400": ["ibuprofen", "nsaid"],
  "azith-500": ["azithromycin", "macrolide"],
  "amox-500": ["amoxicillin", "penicillin"],
  "metf-500": ["metformin"],
  "glime-2": ["glimepiride", "sulfonylurea"],
  "amlo-5": ["amlodipine", "ccb"],
  "telm-40": ["telmisartan", "arb"],
  "ator-10": ["atorvastatin", "statin"],
  "ceti-10": ["cetirizine", "antihistamine"],
  "montk-10": ["montelukast"],
  "pan-40": ["pantoprazole", "ppi"],
  "thyro-50": ["levothyroxine", "thyroxine"],
  "insulin-pen": ["insulin"],
  "inhaler-sal": ["salbutamol"],
  "calc-500": ["calcium", "vitamind"],
  "vitd3": ["vitamind"],
};

// Fallback: infer tokens from a free-text medicine name (for the standalone checker).
const NAME_TOKENS = [
  ["paracetamol", ["paracetamol"]],
  ["acetaminophen", ["paracetamol"]],
  ["ibuprofen", ["ibuprofen", "nsaid"]],
  ["diclofenac", ["nsaid"]],
  ["naproxen", ["nsaid"]],
  ["aspirin", ["aspirin", "nsaid"]],
  ["disprin", ["aspirin", "nsaid"]],
  ["ecosprin", ["aspirin", "nsaid"]],
  ["warfarin", ["warfarin"]],
  ["azithromycin", ["azithromycin", "macrolide"]],
  ["clarithromycin", ["macrolide"]],
  ["metformin", ["metformin"]],
  ["glimepiride", ["glimepiride", "sulfonylurea"]],
  ["gliclazide", ["sulfonylurea"]],
  ["glipizide", ["sulfonylurea"]],
  ["insulin", ["insulin"]],
  ["amlodipine", ["amlodipine", "ccb"]],
  ["telmisartan", ["telmisartan", "arb"]],
  ["losartan", ["arb"]],
  ["lisinopril", ["lisinopril", "ace"]],
  ["ramipril", ["ace"]],
  ["enalapril", ["ace"]],
  ["atorvastatin", ["atorvastatin", "statin"]],
  ["simvastatin", ["simvastatin", "statin"]],
  ["rosuvastatin", ["statin"]],
  ["amiodarone", ["amiodarone"]],
  ["methotrexate", ["methotrexate"]],
  ["levothyroxine", ["levothyroxine", "thyroxine"]],
  ["thyroxine", ["levothyroxine", "thyroxine"]],
  ["pantoprazole", ["pantoprazole", "ppi"]],
  ["omeprazole", ["ppi"]],
  ["calcium", ["calcium"]],
  ["potassium", ["potassium"]],
  ["tramadol", ["opioids"]],
  ["codeine", ["opioids"]],
  ["morphine", ["opioids"]],
  ["alprazolam", ["benzodiazepines"]],
  ["diazepam", ["benzodiazepines"]],
  ["clonazepam", ["benzodiazepines"]],
  ["fluoxetine", ["ssri"]],
  ["sertraline", ["ssri"]],
];

// Interaction rules: unordered token pairs -> clinical guidance.
const INTERACTIONS = [
  // Serious, classic interactions (ported from GARMA config).
  { a: "warfarin", b: "aspirin", severity: "HIGH", title: "Bleeding risk", detail: "Warfarin with aspirin (or other NSAIDs) sharply increases the risk of bleeding.", advice: "Do not combine without a doctor's supervision and INR monitoring." },
  { a: "ssri", b: "maoi", severity: "CRITICAL", title: "Serotonin syndrome (potentially fatal)", detail: "Combining SSRIs and MAOIs can cause life-threatening serotonin syndrome.", advice: "Contraindicated — a 14-day gap between the two is required. Speak to your doctor." },
  { a: "opioids", b: "benzodiazepines", severity: "CRITICAL", title: "Dangerous sedation / breathing risk", detail: "Opioids plus benzodiazepines can cause fatal respiratory depression (FDA black-box warning).", advice: "Avoid this combination unless specifically directed and monitored by a doctor." },
  { a: "simvastatin", b: "amiodarone", severity: "HIGH", title: "Muscle damage risk", detail: "This combination raises the risk of severe muscle breakdown (rhabdomyolysis).", advice: "Statin dose usually must be limited — confirm with your doctor." },
  { a: "methotrexate", b: "nsaid", severity: "HIGH", title: "Methotrexate toxicity", detail: "NSAIDs can reduce clearance of methotrexate, raising toxicity.", advice: "Avoid NSAIDs while on methotrexate unless your doctor approves." },
  { a: "metformin", b: "contrast_dye", severity: "HIGH", title: "Lactic acidosis risk", detail: "Metformin with iodinated contrast dye can cause lactic acidosis.", advice: "Metformin is usually held 48 hours around contrast scans." },
  { a: "ace", b: "potassium", severity: "MEDIUM", title: "High potassium risk", detail: "ACE inhibitors with potassium supplements can raise potassium to unsafe levels.", advice: "Have your potassium levels monitored." },

  // Combinations that can actually occur in this catalog.
  { a: "insulin", b: "sulfonylurea", severity: "MEDIUM", title: "Low blood sugar risk", detail: "Insulin together with a sulfonylurea (e.g. glimepiride) raises the chance of hypoglycemia.", advice: "Monitor glucose closely; watch for shakiness, sweating or dizziness. Your doctor may adjust doses." },
  { a: "metformin", b: "sulfonylurea", severity: "LOW", title: "Combined diabetes therapy", detail: "Metformin and a sulfonylurea are often prescribed together, but the glucose-lowering effect adds up.", advice: "Usually intentional — just watch for low-sugar symptoms, especially if you skip meals." },
  { a: "nsaid", b: "arb", severity: "MEDIUM", title: "Reduced BP control + kidney strain", detail: "NSAIDs like ibuprofen can weaken blood-pressure medicines and stress the kidneys.", advice: "Prefer paracetamol for pain if you take BP medication; avoid regular NSAID use." },
  { a: "nsaid", b: "ace", severity: "MEDIUM", title: "Reduced BP control + kidney strain", detail: "NSAIDs can reduce the effect of ACE inhibitors and affect kidney function.", advice: "Prefer paracetamol for pain; check with your doctor before regular NSAID use." },
  { a: "nsaid", b: "ccb", severity: "LOW", title: "May blunt blood-pressure control", detail: "Regular NSAID use can slightly reduce the effect of calcium-channel blockers like amlodipine.", advice: "Occasional use is usually fine; avoid frequent NSAIDs." },
  { a: "levothyroxine", b: "calcium", severity: "MEDIUM", title: "Reduced thyroid medicine absorption", detail: "Calcium binds thyroid hormone and reduces how much is absorbed.", advice: "Take thyroxine on an empty stomach and separate from calcium by at least 4 hours." },
  { a: "levothyroxine", b: "ppi", severity: "LOW", title: "May lower thyroid medicine absorption", detail: "Acid-reducing medicines can slightly reduce thyroid hormone absorption.", advice: "Keep a consistent daily routine; your doctor may recheck your TSH." },
  { a: "statin", b: "macrolide", severity: "LOW", title: "Possible muscle side-effects", detail: "Some antibiotics can raise statin levels, increasing the chance of muscle aches.", advice: "Watch for muscle pain or weakness and tell your doctor; azithromycin risk is low." },
];

function tokensForItem(item) {
  // item can be a string (name) or an object { id, name }.
  const id = typeof item === "object" && item ? item.id : null;
  const name = (typeof item === "string" ? item : (item && item.name) || "").toLowerCase();
  if (id && DRUG_KEYS[id]) return DRUG_KEYS[id].slice();
  const found = new Set();
  for (const [needle, toks] of NAME_TOKENS) {
    if (name.includes(needle)) toks.forEach((t) => found.add(t));
  }
  return [...found];
}

function findRule(tokensA, tokensB) {
  for (const rule of INTERACTIONS) {
    const hit =
      (tokensA.includes(rule.a) && tokensB.includes(rule.b)) ||
      (tokensA.includes(rule.b) && tokensB.includes(rule.a));
    if (hit) return rule;
  }
  return null;
}

/**
 * Check a list of medicines for interactions.
 * @param {Array<string|{id,name}>} items
 * @returns {{alerts:Array, maxSeverity:string|null, checked:number, disclaimer:string}}
 */
function checkInteractions(items) {
  const list = Array.isArray(items) ? items : [];
  const resolved = list.map((it) => ({
    id: typeof it === "object" && it ? it.id : null,
    name: typeof it === "string" ? it : (it && it.name) || "",
    tokens: tokensForItem(it),
  }));
  const alerts = [];
  const seen = new Set();
  for (let i = 0; i < resolved.length; i++) {
    for (let j = i + 1; j < resolved.length; j++) {
      const a = resolved[i];
      const b = resolved[j];
      if (!a.tokens.length || !b.tokens.length) continue;
      const rule = findRule(a.tokens, b.tokens);
      if (!rule) continue;
      const key = [a.name, b.name, rule.title].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      alerts.push({
        drugA: a.name,
        drugB: b.name,
        severity: rule.severity,
        title: rule.title,
        detail: rule.detail,
        advice: rule.advice,
      });
    }
  }
  alerts.sort((x, y) => SEVERITY_RANK[y.severity] - SEVERITY_RANK[x.severity]);
  const maxSeverity = alerts.reduce(
    (m, al) => (SEVERITY_RANK[al.severity] > SEVERITY_RANK[m || "LOW"] ? al.severity : m),
    null
  );
  return { alerts, maxSeverity, checked: resolved.length, disclaimer: DISCLAIMER };
}

module.exports = { checkInteractions, DISCLAIMER, SEVERITY_RANK };
