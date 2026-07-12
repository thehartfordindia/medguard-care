"""
MedGuard AI - Synthetic Medical Records Generator
Generates realistic fake patient records for demonstration purposes.
Uses the Faker library + medical domain knowledge.
"""
import random
import json
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import List

from faker import Faker

from medguard.data.models import (
    PatientRecord, Medication, Diagnosis, Vitals,
    LabResult, Encounter
)

fake = Faker()
Faker.seed(42)
random.seed(42)

# ─── Medical Knowledge Base ─────────────────────────────

MEDICATIONS_DB = [
    {"name": "Metformin", "dosage": "500mg", "frequency": "twice daily", "category": "diabetes"},
    {"name": "Lisinopril", "dosage": "10mg", "frequency": "once daily", "category": "hypertension"},
    {"name": "Atorvastatin", "dosage": "20mg", "frequency": "once daily at bedtime", "category": "cholesterol"},
    {"name": "Warfarin", "dosage": "5mg", "frequency": "once daily", "category": "anticoagulant"},
    {"name": "Aspirin", "dosage": "81mg", "frequency": "once daily", "category": "antiplatelet"},
    {"name": "Omeprazole", "dosage": "20mg", "frequency": "once daily before breakfast", "category": "gastrointestinal"},
    {"name": "Amlodipine", "dosage": "5mg", "frequency": "once daily", "category": "hypertension"},
    {"name": "Insulin Glargine", "dosage": "20 units", "frequency": "once daily at bedtime", "category": "diabetes"},
    {"name": "Metoprolol", "dosage": "50mg", "frequency": "twice daily", "category": "cardiac"},
    {"name": "Sertraline", "dosage": "50mg", "frequency": "once daily", "category": "ssri"},
    {"name": "Gabapentin", "dosage": "300mg", "frequency": "three times daily", "category": "pain"},
    {"name": "Hydrocodone/APAP", "dosage": "5/325mg", "frequency": "every 6 hours as needed", "category": "opioids"},
    {"name": "Alprazolam", "dosage": "0.5mg", "frequency": "twice daily as needed", "category": "benzodiazepines"},
    {"name": "Levothyroxine", "dosage": "75mcg", "frequency": "once daily on empty stomach", "category": "thyroid"},
    {"name": "Prednisone", "dosage": "10mg", "frequency": "once daily", "category": "steroid"},
    {"name": "Simvastatin", "dosage": "40mg", "frequency": "once daily at bedtime", "category": "cholesterol"},
    {"name": "Amiodarone", "dosage": "200mg", "frequency": "once daily", "category": "cardiac"},
]

DIAGNOSES_DB = [
    {"condition": "Type 2 Diabetes Mellitus", "icd10": "E11.9", "severity": "moderate", "chronic": True},
    {"condition": "Essential Hypertension", "icd10": "I10", "severity": "moderate", "chronic": True},
    {"condition": "Hyperlipidemia", "icd10": "E78.5", "severity": "mild", "chronic": True},
    {"condition": "Atrial Fibrillation", "icd10": "I48.91", "severity": "moderate", "chronic": True},
    {"condition": "Major Depressive Disorder", "icd10": "F33.0", "severity": "moderate", "chronic": True},
    {"condition": "Chronic Kidney Disease Stage 3", "icd10": "N18.3", "severity": "severe", "chronic": True},
    {"condition": "COPD", "icd10": "J44.1", "severity": "moderate", "chronic": True},
    {"condition": "Osteoarthritis", "icd10": "M17.11", "severity": "moderate", "chronic": True},
    {"condition": "Hypothyroidism", "icd10": "E03.9", "severity": "mild", "chronic": True},
    {"condition": "Gastroesophageal Reflux Disease", "icd10": "K21.0", "severity": "mild", "chronic": True},
    {"condition": "Pneumonia", "icd10": "J18.9", "severity": "moderate", "chronic": False},
    {"condition": "Urinary Tract Infection", "icd10": "N39.0", "severity": "mild", "chronic": False},
    {"condition": "Acute Bronchitis", "icd10": "J20.9", "severity": "mild", "chronic": False},
    {"condition": "Congestive Heart Failure", "icd10": "I50.9", "severity": "severe", "chronic": True},
    {"condition": "Chronic Low Back Pain", "icd10": "M54.5", "severity": "moderate", "chronic": True},
]

ALLERGIES_DB = [
    "Penicillin", "Sulfa drugs", "Aspirin", "Ibuprofen", "Codeine",
    "Latex", "Shellfish", "Peanuts", "Morphine", "Contrast dye",
    "Amoxicillin", "Cephalosporins", "Fluoroquinolones",
]

LAB_TESTS_DB = [
    {"name": "HbA1c", "normal_range": (4.0, 5.6), "abnormal_range": (6.5, 12.0), "unit": "%", "ref": "4.0-5.6%"},
    {"name": "Creatinine", "normal_range": (0.6, 1.2), "abnormal_range": (1.5, 4.0), "unit": "mg/dL", "ref": "0.6-1.2 mg/dL"},
    {"name": "Total Cholesterol", "normal_range": (125, 200), "abnormal_range": (220, 350), "unit": "mg/dL", "ref": "<200 mg/dL"},
    {"name": "LDL Cholesterol", "normal_range": (50, 100), "abnormal_range": (130, 250), "unit": "mg/dL", "ref": "<100 mg/dL"},
    {"name": "HDL Cholesterol", "normal_range": (40, 80), "abnormal_range": (15, 35), "unit": "mg/dL", "ref": ">40 mg/dL"},
    {"name": "TSH", "normal_range": (0.4, 4.0), "abnormal_range": (5.0, 15.0), "unit": "mIU/L", "ref": "0.4-4.0 mIU/L"},
    {"name": "WBC Count", "normal_range": (4.5, 11.0), "abnormal_range": (12.0, 25.0), "unit": "K/uL", "ref": "4.5-11.0 K/uL"},
    {"name": "Hemoglobin", "normal_range": (12.0, 17.5), "abnormal_range": (7.0, 11.0), "unit": "g/dL", "ref": "12.0-17.5 g/dL"},
    {"name": "Potassium", "normal_range": (3.5, 5.0), "abnormal_range": (5.5, 7.0), "unit": "mEq/L", "ref": "3.5-5.0 mEq/L"},
    {"name": "Sodium", "normal_range": (136, 145), "abnormal_range": (125, 134), "unit": "mEq/L", "ref": "136-145 mEq/L"},
    {"name": "INR", "normal_range": (0.8, 1.2), "abnormal_range": (2.0, 5.0), "unit": "", "ref": "0.8-1.2 (2.0-3.0 on warfarin)"},
    {"name": "Fasting Glucose", "normal_range": (70, 100), "abnormal_range": (126, 300), "unit": "mg/dL", "ref": "70-100 mg/dL"},
]

BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
DEPARTMENTS = ["Internal Medicine", "Cardiology", "Endocrinology", "Pulmonology", "Neurology", "Emergency"]
ENCOUNTER_TYPES = ["outpatient", "inpatient", "emergency", "telehealth"]
INSURANCE_PROVIDERS = ["BlueCross BlueShield", "Aetna", "UnitedHealth", "Cigna", "Humana", "Medicare", "Medicaid"]


def _random_date(start_year: int = 2022, end_year: int = 2026) -> date:
    start = date(start_year, 1, 1)
    end = date(end_year, 4, 15)
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))


def _random_datetime(start_year: int = 2023, end_year: int = 2026) -> datetime:
    d = _random_date(start_year, end_year)
    return datetime(d.year, d.month, d.day, random.randint(7, 18), random.choice([0, 15, 30, 45]))


def generate_medications(count: int = 3) -> List[Medication]:
    """Generate a random list of medications, potentially including risky combos."""
    selected = random.sample(MEDICATIONS_DB, min(count, len(MEDICATIONS_DB)))
    meds = []
    for med_info in selected:
        meds.append(Medication(
            name=med_info["name"],
            dosage=med_info["dosage"],
            frequency=med_info["frequency"],
            start_date=_random_date(2023, 2025),
            prescribing_doctor=f"Dr. {fake.last_name()}",
            is_active=random.random() > 0.15,
        ))
    return meds


def generate_diagnoses(count: int = 3) -> List[Diagnosis]:
    selected = random.sample(DIAGNOSES_DB, min(count, len(DIAGNOSES_DB)))
    return [
        Diagnosis(
            condition=dx["condition"],
            icd10_code=dx["icd10"],
            diagnosed_date=_random_date(2020, 2025),
            severity=dx["severity"],
            is_chronic=dx["chronic"],
        )
        for dx in selected
    ]


def generate_vitals(count: int = 5) -> List[Vitals]:
    vitals = []
    base_date = datetime(2025, 1, 1, 9, 0)
    for i in range(count):
        is_abnormal = random.random() > 0.7
        vitals.append(Vitals(
            recorded_date=base_date + timedelta(days=i * 30, hours=random.randint(0, 8)),
            blood_pressure_systolic=random.randint(150, 180) if is_abnormal else random.randint(110, 130),
            blood_pressure_diastolic=random.randint(90, 110) if is_abnormal else random.randint(70, 85),
            heart_rate=random.randint(95, 130) if is_abnormal else random.randint(60, 90),
            temperature_f=round(random.uniform(99.5, 102.0) if is_abnormal else random.uniform(97.5, 99.0), 1),
            oxygen_saturation=round(random.uniform(88, 93) if is_abnormal else random.uniform(95, 100), 1),
            weight_lbs=round(random.uniform(140, 280), 1),
            bmi=round(random.uniform(18.5, 38.0), 1),
        ))
    return vitals


def generate_lab_results(count: int = 6) -> List[LabResult]:
    selected = random.sample(LAB_TESTS_DB, min(count, len(LAB_TESTS_DB)))
    labs = []
    for test in selected:
        is_abnormal = random.random() > 0.5  # 50% chance of abnormal for demo
        if is_abnormal:
            value = round(random.uniform(*test["abnormal_range"]), 2)
        else:
            value = round(random.uniform(*test["normal_range"]), 2)
        labs.append(LabResult(
            test_name=test["name"],
            value=value,
            unit=test["unit"],
            reference_range=test["ref"],
            is_abnormal=is_abnormal,
            test_date=_random_date(2025, 2026),
        ))
    return labs


def generate_encounters(count: int = 4) -> List[Encounter]:
    encounters = []
    for _ in range(count):
        has_followup = random.random() > 0.5
        enc_date = _random_datetime(2024, 2026)
        encounters.append(Encounter(
            encounter_type=random.choice(ENCOUNTER_TYPES),
            date=enc_date,
            provider=f"Dr. {fake.last_name()}",
            department=random.choice(DEPARTMENTS),
            reason=random.choice([
                "Routine follow-up", "Medication review", "Acute complaint",
                "Lab review", "New symptom evaluation", "Post-hospitalization check",
                "Annual physical", "Chronic disease management", "Urgent care visit",
            ]),
            notes=fake.paragraph(nb_sentences=3),
            followup_required=has_followup,
            followup_date=enc_date.date() + timedelta(days=random.randint(14, 90)) if has_followup else None,
        ))
    return sorted(encounters, key=lambda e: e.date)


def generate_patient_record(
    force_risky: bool = False,
    force_elderly: bool = False,
) -> PatientRecord:
    """
    Generate a single synthetic patient record.
    
    Args:
        force_risky: If True, ensures the patient has drug interactions and abnormal labs.
        force_elderly: If True, generates a patient aged 65+.
    """
    if force_elderly:
        dob = fake.date_of_birth(minimum_age=65, maximum_age=92)
    else:
        dob = fake.date_of_birth(minimum_age=18, maximum_age=90)
    
    gender = random.choice(["Male", "Female"])
    first_name = fake.first_name_male() if gender == "Male" else fake.first_name_female()
    
    num_meds = random.randint(2, 6) if force_risky else random.randint(1, 5)
    num_diagnoses = random.randint(2, 5) if force_risky else random.randint(1, 4)
    
    medications = generate_medications(num_meds)
    
    # Force dangerous combos for demo
    if force_risky:
        dangerous_combos = [
            (MEDICATIONS_DB[3], MEDICATIONS_DB[4]),   # Warfarin + Aspirin
            (MEDICATIONS_DB[11], MEDICATIONS_DB[12]),  # Opioids + Benzos
            (MEDICATIONS_DB[15], MEDICATIONS_DB[16]),  # Simvastatin + Amiodarone
        ]
        combo = random.choice(dangerous_combos)
        for med_info in combo:
            medications.append(Medication(
                name=med_info["name"],
                dosage=med_info["dosage"],
                frequency=med_info["frequency"],
                start_date=_random_date(2025, 2026),
                prescribing_doctor=f"Dr. {fake.last_name()}",
                is_active=True,
            ))
    
    return PatientRecord(
        first_name=first_name,
        last_name=fake.last_name(),
        date_of_birth=dob,
        gender=gender,
        blood_type=random.choice(BLOOD_TYPES),
        phone=fake.phone_number(),
        email=fake.email(),
        address=fake.address().replace("\n", ", "),
        emergency_contact_name=fake.name(),
        emergency_contact_phone=fake.phone_number(),
        insurance_provider=random.choice(INSURANCE_PROVIDERS),
        insurance_id=f"{random.choice(['BCB','AET','UHC','CIG','HUM','MCR','MCD'])}-{random.randint(100000, 999999)}",
        allergies=random.sample(ALLERGIES_DB, random.randint(0, 4)),
        medications=medications,
        diagnoses=generate_diagnoses(num_diagnoses),
        vitals_history=generate_vitals(random.randint(3, 8)),
        lab_results=generate_lab_results(random.randint(4, 8)),
        encounters=generate_encounters(random.randint(2, 6)),
        primary_care_provider=f"Dr. {fake.last_name()}, MD",
    )


def generate_patient_dataset(
    num_patients: int = 50,
    risky_fraction: float = 0.3,
    elderly_fraction: float = 0.25,
) -> List[PatientRecord]:
    """
    Generate a complete dataset of synthetic patient records.
    
    A fraction will be 'risky' patients (drug interactions, abnormal labs)
    for the GARMA module to detect.
    """
    patients = []
    num_risky = int(num_patients * risky_fraction)
    num_elderly = int(num_patients * elderly_fraction)
    
    for i in range(num_patients):
        force_risky = i < num_risky
        force_elderly = i < num_elderly
        patient = generate_patient_record(
            force_risky=force_risky,
            force_elderly=force_elderly,
        )
        patients.append(patient)
    
    return patients


def save_dataset(patients: List[PatientRecord], output_dir: str = None):
    """Save patient dataset as JSON files."""
    if output_dir is None:
        output_dir = Path(__file__).parent.parent.parent / "data" / "patients"
    else:
        output_dir = Path(output_dir)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Save individual records
    for patient in patients:
        filepath = output_dir / f"{patient.patient_id}.json"
        with open(filepath, "w") as f:
            json.dump(patient.model_dump(mode="json"), f, indent=2, default=str)
    
    # Save summary index
    index = []
    for p in patients:
        index.append({
            "patient_id": p.patient_id,
            "name": p.full_name,
            "age": p.age,
            "gender": p.gender,
            "num_medications": len(p.active_medications),
            "num_diagnoses": len(p.diagnoses),
            "num_chronic": len(p.chronic_conditions),
            "has_abnormal_labs": any(lr.is_abnormal for lr in p.lab_results),
        })
    
    index_path = output_dir / "_index.json"
    with open(index_path, "w") as f:
        json.dump(index, f, indent=2)
    
    # Save clinical summaries as text (for vector store ingestion)
    summaries_dir = output_dir.parent / "summaries"
    summaries_dir.mkdir(parents=True, exist_ok=True)
    for patient in patients:
        summary_path = summaries_dir / f"{patient.patient_id}_summary.txt"
        with open(summary_path, "w", encoding="utf-8") as f:
            f.write(patient.to_clinical_summary())
    
    print(f"✅ Generated {len(patients)} patient records in {output_dir}")
    print(f"📄 Clinical summaries saved in {summaries_dir}")
    return output_dir


def load_dataset(data_dir: str = None) -> List[PatientRecord]:
    """Load patient records from JSON files."""
    if data_dir is None:
        data_dir = Path(__file__).parent.parent.parent / "data" / "patients"
    else:
        data_dir = Path(data_dir)
    
    patients = []
    for filepath in sorted(data_dir.glob("*.json")):
        if filepath.name.startswith("_"):
            continue
        with open(filepath, "r") as f:
            data = json.load(f)
        patients.append(PatientRecord(**data))
    
    return patients


# ─── CLI Entry Point ────────────────────────────────────
if __name__ == "__main__":
    print("🏥 MedGuard AI — Synthetic Data Generator")
    print("=" * 50)
    patients = generate_patient_dataset(num_patients=50)
    save_dataset(patients)
    print(f"\n📊 Dataset Statistics:")
    print(f"   Total patients: {len(patients)}")
    print(f"   Average age: {sum(p.age for p in patients) / len(patients):.1f}")
    print(f"   Patients with abnormal labs: {sum(1 for p in patients if any(lr.is_abnormal for lr in p.lab_results))}")
    print(f"   Patients with 3+ medications: {sum(1 for p in patients if len(p.active_medications) >= 3)}")
