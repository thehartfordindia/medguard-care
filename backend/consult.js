"use strict";

/**
 * MedGuard — In-app Doctor Consultation engine.
 * ------------------------------------------------
 * Powers the live text consultation room. It is a rule-based clinical triage
 * assistant that mimics a doctor's intake conversation: greets the patient,
 * asks about symptoms, gives general guidance, flags red-flag emergencies, and
 * suggests relevant medicines / lab tests available on MedGuard.
 *
 * IMPORTANT: This is an automated assistant for demo/triage purposes, NOT a
 * replacement for a real licensed doctor. Every session shows a disclaimer and
 * offers to connect the patient to a human doctor / emergency care.
 */

const DISCLAIMER =
  "I'm MedGuard's AI care assistant helping your doctor with intake. This is general guidance, " +
  "not a diagnosis. For anything serious or worsening, please see a doctor in person or call emergency services.";

// Red-flag phrases that should trigger an urgent-care response immediately.
const EMERGENCY_PATTERNS = [
  "chest pain", "chest tightness", "can't breathe", "cant breathe", "cannot breathe",
  "difficulty breathing", "shortness of breath", "unconscious", "fainted", "seizure",
  "stroke", "slurred speech", "face droop", "severe bleeding", "coughing blood",
  "suicidal", "want to die", "overdose", "poisoning", "anaphylaxis", "swelling throat",
  "severe allergic", "not breathing", "heart attack", "paralysis", "numb one side",
];

// Symptom knowledge base — each entry: matcher keywords + a doctor-style reply.
const SYMPTOMS = [
  {
    key: "fever",
    match: ["fever", "temperature", "chills", "shivering"],
    followups: ["How many days have you had the fever?", "Is it accompanied by body aches, cough, or a sore throat?"],
    advice:
      "For fever, stay well hydrated and rest. Paracetamol 500mg every 6 hours (max 4 a day) usually helps bring it down. " +
      "If the fever crosses 103°F, lasts more than 3 days, or comes with a rash or breathlessness, you should get tested.",
    meds: ["Paracetamol 500mg"],
    labs: ["Fever Panel", "CBC", "Dengue NS1 + Antibody"],
  },
  {
    key: "cough_cold",
    match: ["cough", "cold", "sneezing", "runny nose", "blocked nose", "sore throat", "throat pain"],
    followups: ["Is the cough dry or with phlegm?", "Any fever or breathing difficulty along with it?"],
    advice:
      "For a cough and cold, warm fluids, steam inhalation and rest help a lot. Cetirizine at night can ease a runny nose and sneezing. " +
      "If the cough lasts beyond 10 days, brings up blood, or you feel breathless, we should get a chest X-ray done.",
    meds: ["Cetirizine 10mg", "Paracetamol 500mg"],
    labs: ["X-Ray — Chest", "CBC"],
  },
  {
    key: "headache",
    match: ["headache", "migraine", "head pain", "head is paining"],
    followups: ["Where is the pain and how long has it lasted?", "Any nausea, vision changes, or is it the worst headache of your life?"],
    advice:
      "Most headaches are from stress, screen time, or dehydration. Rest in a quiet dark room, drink water, and Paracetamol can help. " +
      "If it's sudden and severe, comes with vomiting, weakness, or vision problems, that needs an urgent scan.",
    meds: ["Paracetamol 500mg"],
    labs: ["CT Scan — Brain (Plain)"],
  },
  {
    key: "diabetes",
    match: ["sugar", "diabetes", "diabetic", "glucose", "hba1c", "frequent urination", "increased thirst"],
    followups: ["Are you already diagnosed with diabetes, or checking for the first time?", "What were your last fasting and post-meal sugar readings?"],
    advice:
      "Managing blood sugar is about consistency — regular meals, exercise, and taking medicines on time. Metformin is a common first-line option, " +
      "but dosing must be set by your doctor. Let's get an HbA1c done to see your 3-month average.",
    meds: ["Metformin 500mg"],
    labs: ["HbA1c (Diabetes)", "Diabetes Care Package"],
  },
  {
    key: "bp",
    match: ["blood pressure", "bp", "hypertension", "high bp", "dizzy", "dizziness"],
    followups: ["Do you have a recent BP reading you can share?", "Any headache, chest discomfort or blurred vision?"],
    advice:
      "For blood pressure, reduce salt, stay active and take medicines regularly. Amlodipine and Telmisartan are common options your doctor may prescribe. " +
      "Please avoid regular painkillers like ibuprofen as they can raise BP. A lipid profile and ECG give a fuller picture.",
    meds: ["Amlodipine 5mg", "Telmisartan 40mg"],
    labs: ["Lipid Profile", "ECG (Heart Rhythm)", "Heart Health Package (Lipid + ECG + Echo)"],
  },
  {
    key: "acidity",
    match: ["acidity", "acid reflux", "heartburn", "gas", "bloating", "indigestion", "stomach burn"],
    followups: ["Does it get worse after meals or when lying down?", "Any difficulty swallowing or weight loss?"],
    advice:
      "Acidity usually responds to smaller meals, avoiding spicy/oily food, and not lying down right after eating. Pantoprazole before breakfast helps. " +
      "If symptoms persist for weeks or you have trouble swallowing, we should investigate further.",
    meds: ["Pantoprazole 40mg"],
    labs: ["Ultrasound — Whole Abdomen"],
  },
  {
    key: "pain_body",
    match: ["body pain", "joint pain", "back pain", "muscle pain", "knee pain", "sprain", "swelling"],
    followups: ["Which area hurts, and did it start after an injury?", "Is there swelling, redness, or difficulty moving it?"],
    advice:
      "For muscle and joint pain, rest, an ice/warm compress, and Ibuprofen for a couple of days usually help. Avoid ibuprofen if you have BP, kidney issues or ulcers. " +
      "Persistent joint pain or a possible fracture should be imaged.",
    meds: ["Ibuprofen 400mg", "Paracetamol 500mg"],
    labs: ["X-Ray — Limb / Joint", "MRI — Knee / Joint"],
  },
  {
    key: "allergy",
    match: ["allergy", "rash", "itching", "hives", "skin allergy", "allergic"],
    followups: ["When did the reaction start and what might have triggered it?", "Any swelling of lips/throat or breathing trouble?"],
    advice:
      "For mild allergies and itching, an antihistamine like Cetirizine works well and avoiding the trigger is key. " +
      "If you notice swelling of the lips or throat or any breathing difficulty, treat it as an emergency.",
    meds: ["Cetirizine 10mg"],
    labs: ["CBC"],
  },
  {
    key: "breathing",
    match: ["asthma", "wheezing", "breathless", "breathing", "inhaler"],
    followups: ["Do you have a known history of asthma?", "Are you able to speak full sentences comfortably right now?"],
    advice:
      "For asthma or wheezing, a Salbutamol inhaler gives quick relief. Avoid dust, smoke and cold air triggers. " +
      "If you're severely breathless or can't speak in full sentences, please seek emergency care now.",
    meds: ["Salbutamol Inhaler"],
    labs: ["X-Ray — Chest", "CT Scan — Chest (HRCT)"],
  },
  {
    key: "thyroid",
    match: ["thyroid", "tsh", "weight gain", "hair fall", "tiredness", "fatigue", "tired"],
    followups: ["Any recent weight change, hair fall, or feeling unusually cold/tired?", "Are you already on thyroid medication?"],
    advice:
      "These symptoms can point to a thyroid imbalance. Thyroxine is used for an underactive thyroid, taken on an empty stomach and away from calcium. " +
      "Let's confirm with a thyroid profile before anything.",
    meds: ["Thyroxine 50mcg"],
    labs: ["Thyroid Profile (T3 T4 TSH)", "Vitamin B12 Test", "CBC"],
  },
  {
    key: "stomach_infection",
    match: ["diarrhea", "loose motion", "vomiting", "food poisoning", "stomach pain", "loose motions"],
    followups: ["How many times, and are you able to keep fluids down?", "Any blood in stools or high fever?"],
    advice:
      "For loose motions and vomiting, the priority is hydration — ORS and small sips of fluid frequently. Eat light (rice, banana, curd). " +
      "If there's blood, persistent vomiting, or signs of dehydration, you need to be seen in person.",
    meds: ["Paracetamol 500mg"],
    labs: ["CBC", "Urine Routine & Microscopy"],
  },
];

const GREETINGS = ["hi", "hello", "hey", "namaste", "good morning", "good evening", "good afternoon", "doctor"];
const THANKS = ["thanks", "thank you", "thankyou", "ok thanks", "great", "helpful"];

function norm(text) {
  return String(text || "").toLowerCase().trim();
}

function isEmergency(text) {
  const t = norm(text);
  return EMERGENCY_PATTERNS.find((p) => t.includes(p)) || null;
}

function matchSymptom(text) {
  const t = norm(text);
  return SYMPTOMS.find((s) => s.match.some((m) => t.includes(m))) || null;
}

/** Build the opening messages of a consultation. */
function greeting(provider, patientName) {
  const docName = (provider && provider.name) || "Dr. MedGuard";
  const spec = (provider && provider.specialty) || "General Physician";
  const who = patientName ? ` ${patientName}` : "";
  return [
    {
      from: "doctor",
      author: docName,
      text: `Hello${who}, I'm ${docName} (${spec}). 👋 I'm here to help. What health concern would you like to discuss today?`,
      time: new Date().toISOString(),
    },
    {
      from: "system",
      text: DISCLAIMER,
      time: new Date().toISOString(),
    },
  ];
}

/**
 * Generate the doctor's reply to a patient message.
 * @param {string} text  patient message
 * @param {object} provider provider record (for the author name)
 * @returns {{text, suggestions:{meds:[],labs:[]}, emergency:boolean}}
 */
function reply(text, provider) {
  const docName = (provider && provider.name) || "Dr. MedGuard";
  const t = norm(text);

  const emergency = isEmergency(t);
  if (emergency) {
    return {
      from: "doctor",
      author: docName,
      emergency: true,
      text:
        `⚠️ What you're describing (“${emergency}”) can be serious and needs immediate medical attention. ` +
        `Please call your local emergency number or go to the nearest hospital right away. ` +
        `If you'd like, I can also help you book an urgent home doctor visit.`,
      suggestions: { meds: [], labs: [] },
      time: new Date().toISOString(),
    };
  }

  if (t.length < 2) {
    return docReply(docName, "Could you tell me a little more about how you're feeling?");
  }

  if (GREETINGS.some((g) => t === g || t.startsWith(g + " ")) && t.length < 20) {
    return docReply(docName, "Hello! 😊 Please describe your main symptom — for example fever, cough, stomach pain, or a health check you need.");
  }

  if (THANKS.some((g) => t.includes(g))) {
    return docReply(
      docName,
      "You're most welcome! 🙏 Take care of yourself. If symptoms worsen or don't improve, please book an in-person visit. Is there anything else I can help with?"
    );
  }

  const symptom = matchSymptom(t);
  if (symptom) {
    const followup = symptom.followups[Math.floor(Math.random() * symptom.followups.length)];
    return {
      from: "doctor",
      author: docName,
      emergency: false,
      text: `${symptom.advice}\n\n${followup}`,
      suggestions: {
        meds: symptom.meds || [],
        labs: symptom.labs || [],
      },
      time: new Date().toISOString(),
    };
  }

  // Fallback — empathetic, asks for clarification.
  return docReply(
    docName,
    "I understand. To guide you better, could you tell me your main symptom, how long you've had it, and how severe it feels (mild / moderate / severe)? " +
      "You can also mention any existing conditions like BP, diabetes or thyroid."
  );
}

function docReply(author, text) {
  return {
    from: "doctor",
    author,
    emergency: false,
    text,
    suggestions: { meds: [], labs: [] },
    time: new Date().toISOString(),
  };
}

module.exports = { greeting, reply, DISCLAIMER, isEmergency };
