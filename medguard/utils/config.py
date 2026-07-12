"""
MedGuard AI - Configuration & Utilities
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ─── Paths ──────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
VECTOR_STORE_DIR = DATA_DIR / "vector_store"

# Create directories
DATA_DIR.mkdir(parents=True, exist_ok=True)
VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)

# ─── LLM Configuration ─────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
USE_OPENAI = bool(OPENAI_API_KEY)

# Free open-source embedding model (runs locally, no API key needed)
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# HuggingFace model for text generation (free, no API key)
HF_MODEL = "google/flan-t5-base"

# ─── Medical Domain Config ──────────────────────────────
RISK_THRESHOLDS = {
    "low": 0.3,
    "medium": 0.6,
    "high": 0.8,
    "critical": 0.95
}

# Known drug interaction pairs (simplified knowledge base)
DRUG_INTERACTIONS = {
    ("warfarin", "aspirin"): {
        "severity": "HIGH",
        "description": "Increased risk of bleeding when combined",
        "recommendation": "Monitor INR closely; consider alternative antiplatelet"
    },
    ("metformin", "contrast_dye"): {
        "severity": "HIGH",
        "description": "Risk of lactic acidosis with iodinated contrast",
        "recommendation": "Hold metformin 48 hours before/after contrast procedures"
    },
    ("lisinopril", "potassium"): {
        "severity": "MEDIUM",
        "description": "ACE inhibitors can increase potassium levels",
        "recommendation": "Monitor serum potassium regularly"
    },
    ("simvastatin", "amiodarone"): {
        "severity": "HIGH",
        "description": "Increased risk of rhabdomyolysis",
        "recommendation": "Limit simvastatin to 20mg/day with amiodarone"
    },
    ("methotrexate", "nsaids"): {
        "severity": "HIGH",
        "description": "NSAIDs can decrease renal clearance of methotrexate",
        "recommendation": "Avoid NSAIDs or monitor methotrexate levels closely"
    },
    ("ssri", "maoi"): {
        "severity": "CRITICAL",
        "description": "Risk of serotonin syndrome — potentially fatal",
        "recommendation": "CONTRAINDICATED — do not combine; 14-day washout required"
    },
    ("insulin", "sulfonylurea"): {
        "severity": "MEDIUM",
        "description": "Increased risk of hypoglycemia",
        "recommendation": "Reduce sulfonylurea dose; monitor blood glucose frequently"
    },
    ("opioids", "benzodiazepines"): {
        "severity": "CRITICAL",
        "description": "Risk of fatal respiratory depression",
        "recommendation": "FDA Black Box Warning — avoid combination when possible"
    },
}

# Compliance rules
COMPLIANCE_RULES = [
    {
        "id": "COMP-001",
        "rule": "Allergy documentation required",
        "description": "Every patient record must have an allergy section, even if 'No Known Allergies'",
        "check_field": "allergies"
    },
    {
        "id": "COMP-002",
        "rule": "Medication dosage must be specified",
        "description": "All prescribed medications must include dosage information",
        "check_field": "medications"
    },
    {
        "id": "COMP-003",
        "rule": "Diagnosis code required",
        "description": "Each diagnosis must have an associated ICD-10 code",
        "check_field": "diagnoses"
    },
    {
        "id": "COMP-004",
        "rule": "Provider signature required",
        "description": "Records must have an assigned provider",
        "check_field": "provider"
    },
    {
        "id": "COMP-005",
        "rule": "Date of birth verification",
        "description": "Patient must have a valid date of birth",
        "check_field": "date_of_birth"
    },
]

# ─── Risk Scoring Weights ───────────────────────────────
RISK_WEIGHTS = {
    "age_over_65": 0.15,
    "multiple_conditions": 0.20,
    "drug_interactions": 0.25,
    "recent_hospitalization": 0.15,
    "missing_followup": 0.10,
    "abnormal_vitals": 0.15,
}
