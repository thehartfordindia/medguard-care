"""
MedGuard AI - Data Models
Pydantic models representing FHIR-like medical records.
These provide structured, validated data for the entire platform.
"""
from __future__ import annotations
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field
import uuid


def generate_id() -> str:
    return str(uuid.uuid4())[:8]


class Medication(BaseModel):
    """A prescribed medication with dosage info."""
    name: str
    dosage: str
    frequency: str
    start_date: date
    end_date: Optional[date] = None
    prescribing_doctor: str
    is_active: bool = True


class Diagnosis(BaseModel):
    """A medical diagnosis with ICD-10 coding."""
    condition: str
    icd10_code: str
    diagnosed_date: date
    severity: str = "moderate"  # mild, moderate, severe
    is_chronic: bool = False


class Vitals(BaseModel):
    """Patient vital signs at a point in time."""
    recorded_date: datetime
    blood_pressure_systolic: int
    blood_pressure_diastolic: int
    heart_rate: int
    temperature_f: float
    oxygen_saturation: float
    weight_lbs: float
    bmi: float


class LabResult(BaseModel):
    """Laboratory test result."""
    test_name: str
    value: float
    unit: str
    reference_range: str
    is_abnormal: bool = False
    test_date: date


class Encounter(BaseModel):
    """A patient encounter/visit."""
    encounter_id: str = Field(default_factory=generate_id)
    encounter_type: str  # emergency, inpatient, outpatient, telehealth
    date: datetime
    provider: str
    department: str
    reason: str
    notes: str
    followup_required: bool = False
    followup_date: Optional[date] = None


class PatientRecord(BaseModel):
    """
    Complete patient medical record (FHIR-inspired).
    This is the core data model for MedGuard AI.
    """
    patient_id: str = Field(default_factory=generate_id)
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    blood_type: str
    
    # Contact
    phone: str
    email: str
    address: str
    
    # Emergency Contact
    emergency_contact_name: str
    emergency_contact_phone: str
    
    # Insurance
    insurance_provider: str
    insurance_id: str
    
    # Clinical Data
    allergies: List[str] = []
    medications: List[Medication] = []
    diagnoses: List[Diagnosis] = []
    vitals_history: List[Vitals] = []
    lab_results: List[LabResult] = []
    encounters: List[Encounter] = []
    
    # Provider
    primary_care_provider: str
    
    # Metadata
    record_created: datetime = Field(default_factory=datetime.now)
    last_updated: datetime = Field(default_factory=datetime.now)
    
    @property
    def age(self) -> int:
        today = date.today()
        return today.year - self.date_of_birth.year - (
            (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
        )
    
    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
    
    @property
    def active_medications(self) -> List[Medication]:
        return [m for m in self.medications if m.is_active]
    
    @property 
    def chronic_conditions(self) -> List[Diagnosis]:
        return [d for d in self.diagnoses if d.is_chronic]
    
    def to_clinical_summary(self) -> str:
        """Generate a natural language clinical summary for AI processing."""
        lines = [
            f"PATIENT CLINICAL SUMMARY",
            f"========================",
            f"Patient: {self.full_name} (ID: {self.patient_id})",
            f"Age: {self.age} | Gender: {self.gender} | Blood Type: {self.blood_type}",
            f"PCP: {self.primary_care_provider}",
            f"",
            f"ALLERGIES: {', '.join(self.allergies) if self.allergies else 'No Known Allergies (NKA)'}",
            f"",
            f"ACTIVE MEDICATIONS:",
        ]
        for med in self.active_medications:
            lines.append(f"  - {med.name} {med.dosage} ({med.frequency})")
        
        lines.append(f"\nDIAGNOSES:")
        for dx in self.diagnoses:
            chronic_tag = " [CHRONIC]" if dx.is_chronic else ""
            lines.append(f"  - {dx.condition} ({dx.icd10_code}) — {dx.severity}{chronic_tag}")
        
        if self.vitals_history:
            latest = self.vitals_history[-1]
            lines.extend([
                f"\nLATEST VITALS ({latest.recorded_date.strftime('%Y-%m-%d')}):",
                f"  BP: {latest.blood_pressure_systolic}/{latest.blood_pressure_diastolic} mmHg",
                f"  HR: {latest.heart_rate} bpm | Temp: {latest.temperature_f}°F",
                f"  SpO2: {latest.oxygen_saturation}% | BMI: {latest.bmi:.1f}",
            ])
        
        if self.lab_results:
            abnormal = [lr for lr in self.lab_results if lr.is_abnormal]
            if abnormal:
                lines.append(f"\n⚠️ ABNORMAL LAB RESULTS:")
                for lab in abnormal:
                    lines.append(f"  - {lab.test_name}: {lab.value} {lab.unit} (Ref: {lab.reference_range})")
        
        if self.encounters:
            recent = sorted(self.encounters, key=lambda e: e.date, reverse=True)[:3]
            lines.append(f"\nRECENT ENCOUNTERS:")
            for enc in recent:
                lines.append(f"  - [{enc.encounter_type.upper()}] {enc.date.strftime('%Y-%m-%d')} — {enc.reason}")
                if enc.followup_required:
                    lines.append(f"    ⚡ Follow-up required by {enc.followup_date}")
        
        return "\n".join(lines)
