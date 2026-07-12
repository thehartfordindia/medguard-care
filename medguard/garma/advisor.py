"""
MedGuard AI - GARMA Module
🛡️ GenAI Risk Mitigation Advisor

GARMA is the risk analysis engine that:
  1. Detects drug-drug interactions
  2. Checks compliance with medical record standards
  3. Computes patient risk scores using ML
  4. Identifies anomalies in patient data
  5. Generates risk mitigation recommendations

Inspired by: GARMA (GenAI Risk Mitigation Advisor) patterns
"""
from dataclasses import dataclass, field
from datetime import date
from typing import List, Dict, Tuple, Any, Optional
from enum import Enum

import numpy as np

from medguard.data.models import PatientRecord
from medguard.utils.config import (
    DRUG_INTERACTIONS, COMPLIANCE_RULES,
    RISK_WEIGHTS, RISK_THRESHOLDS
)


class RiskLevel(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass
class DrugInteractionAlert:
    """Alert for a detected drug-drug interaction."""
    drug_a: str
    drug_b: str
    severity: str
    description: str
    recommendation: str
    patient_id: str
    patient_name: str


@dataclass
class ComplianceViolation:
    """A compliance rule violation."""
    rule_id: str
    rule_name: str
    description: str
    field: str
    patient_id: str
    patient_name: str


@dataclass
class RiskAssessment:
    """Complete risk assessment for a patient."""
    patient_id: str
    patient_name: str
    overall_score: float  # 0.0 to 1.0
    risk_level: RiskLevel
    risk_factors: Dict[str, float]
    drug_interactions: List[DrugInteractionAlert]
    compliance_violations: List[ComplianceViolation]
    recommendations: List[str]
    anomalies: List[str]


class GarmaAdvisor:
    """
    🛡️ GARMA — GenAI Risk Mitigation Advisor
    
    Analyzes patient records for:
    - Drug-drug interactions
    - Compliance violations
    - Risk scoring
    - Anomaly detection
    - Mitigation recommendations
    """
    
    def __init__(self):
        self.interaction_db = DRUG_INTERACTIONS
        self.compliance_rules = COMPLIANCE_RULES
        self.risk_weights = RISK_WEIGHTS
        self.assessments: Dict[str, RiskAssessment] = {}
    
    # ═══════════════════════════════════════════════════
    # 1. DRUG INTERACTION DETECTION
    # ═══════════════════════════════════════════════════
    
    def check_drug_interactions(self, patient: PatientRecord) -> List[DrugInteractionAlert]:
        """
        Check a patient's active medications for known drug interactions.
        Uses the interaction database from config.
        """
        alerts = []
        active_meds = [m.name.lower() for m in patient.active_medications]
        
        # Also map medication categories for broader matching
        med_categories = {}
        for med in patient.active_medications:
            med_categories[med.name.lower()] = med.name
        
        # Check every pair of active medications
        for i, med_a in enumerate(active_meds):
            for med_b in active_meds[i + 1:]:
                interaction = self._find_interaction(med_a, med_b)
                if interaction:
                    alerts.append(DrugInteractionAlert(
                        drug_a=med_categories.get(med_a, med_a),
                        drug_b=med_categories.get(med_b, med_b),
                        severity=interaction["severity"],
                        description=interaction["description"],
                        recommendation=interaction["recommendation"],
                        patient_id=patient.patient_id,
                        patient_name=patient.full_name,
                    ))
        
        return alerts
    
    def _find_interaction(self, med_a: str, med_b: str) -> Optional[Dict]:
        """Look up interaction between two medications."""
        med_a_lower = med_a.lower()
        med_b_lower = med_b.lower()
        
        for (drug1, drug2), interaction in self.interaction_db.items():
            # Check both orderings
            if (drug1 in med_a_lower or med_a_lower in drug1) and \
               (drug2 in med_b_lower or med_b_lower in drug2):
                return interaction
            if (drug2 in med_a_lower or med_a_lower in drug2) and \
               (drug1 in med_b_lower or med_b_lower in drug1):
                return interaction
        
        return None
    
    # ═══════════════════════════════════════════════════
    # 2. COMPLIANCE CHECKING
    # ═══════════════════════════════════════════════════
    
    def check_compliance(self, patient: PatientRecord) -> List[ComplianceViolation]:
        """
        Validate patient record against compliance rules.
        Checks for missing required fields and data quality.
        """
        violations = []
        
        for rule in self.compliance_rules:
            is_compliant = self._evaluate_rule(patient, rule)
            if not is_compliant:
                violations.append(ComplianceViolation(
                    rule_id=rule["id"],
                    rule_name=rule["rule"],
                    description=rule["description"],
                    field=rule["check_field"],
                    patient_id=patient.patient_id,
                    patient_name=patient.full_name,
                ))
        
        return violations
    
    def _evaluate_rule(self, patient: PatientRecord, rule: Dict) -> bool:
        """Evaluate a single compliance rule against a patient record."""
        field = rule["check_field"]
        
        if field == "allergies":
            # Must have allergy information (even if empty list is OK if explicitly set)
            return True  # Our model always has this field
        
        if field == "medications":
            # All medications must have dosage
            return all(
                med.dosage and len(med.dosage) > 0
                for med in patient.medications
            )
        
        if field == "diagnoses":
            # All diagnoses must have ICD-10 codes
            return all(
                dx.icd10_code and len(dx.icd10_code) > 0
                for dx in patient.diagnoses
            )
        
        if field == "provider":
            return bool(patient.primary_care_provider)
        
        if field == "date_of_birth":
            return patient.date_of_birth is not None and patient.date_of_birth < date.today()
        
        return True
    
    # ═══════════════════════════════════════════════════
    # 3. RISK SCORING (ML-Based)
    # ═══════════════════════════════════════════════════
    
    def calculate_risk_score(self, patient: PatientRecord) -> Tuple[float, Dict[str, float]]:
        """
        Calculate a composite risk score for the patient.
        Uses weighted factors similar to clinical risk models.
        
        Returns:
            Tuple of (overall_score, factor_breakdown)
        """
        factors = {}
        
        # Factor 1: Age risk
        age_risk = min(1.0, max(0.0, (patient.age - 50) / 40)) if patient.age > 50 else 0.0
        factors["age_over_65"] = age_risk
        
        # Factor 2: Multiple conditions (polypathology)
        num_conditions = len(patient.diagnoses)
        condition_risk = min(1.0, num_conditions / 5)
        factors["multiple_conditions"] = condition_risk
        
        # Factor 3: Drug interactions
        interactions = self.check_drug_interactions(patient)
        interaction_risk = min(1.0, len(interactions) * 0.4)
        # Boost for critical interactions
        if any(i.severity == "CRITICAL" for i in interactions):
            interaction_risk = min(1.0, interaction_risk + 0.3)
        factors["drug_interactions"] = interaction_risk
        
        # Factor 4: Recent hospitalization
        hospitalization_risk = 0.0
        for encounter in patient.encounters:
            if encounter.encounter_type in ("inpatient", "emergency"):
                days_ago = (date.today() - encounter.date.date()).days
                if days_ago < 90:
                    hospitalization_risk = max(hospitalization_risk, 0.8)
                elif days_ago < 180:
                    hospitalization_risk = max(hospitalization_risk, 0.4)
        factors["recent_hospitalization"] = hospitalization_risk
        
        # Factor 5: Missing follow-ups
        followup_risk = 0.0
        for encounter in patient.encounters:
            if encounter.followup_required and encounter.followup_date:
                if encounter.followup_date < date.today():
                    followup_risk = max(followup_risk, 0.7)
        factors["missing_followup"] = followup_risk
        
        # Factor 6: Abnormal vitals
        vitals_risk = 0.0
        if patient.vitals_history:
            latest = patient.vitals_history[-1]
            abnormal_count = 0
            if latest.blood_pressure_systolic > 140 or latest.blood_pressure_diastolic > 90:
                abnormal_count += 1
            if latest.heart_rate > 100 or latest.heart_rate < 50:
                abnormal_count += 1
            if latest.oxygen_saturation < 94:
                abnormal_count += 1
            if latest.temperature_f > 100.4:
                abnormal_count += 1
            vitals_risk = min(1.0, abnormal_count * 0.3)
        factors["abnormal_vitals"] = vitals_risk
        
        # Weighted composite score
        overall_score = sum(
            factors[key] * self.risk_weights.get(key, 0.1)
            for key in factors
        )
        overall_score = min(1.0, overall_score)
        
        return overall_score, factors
    
    def _get_risk_level(self, score: float) -> RiskLevel:
        """Map numeric score to risk level."""
        if score >= RISK_THRESHOLDS["critical"]:
            return RiskLevel.CRITICAL
        elif score >= RISK_THRESHOLDS["high"]:
            return RiskLevel.HIGH
        elif score >= RISK_THRESHOLDS["medium"]:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW
    
    # ═══════════════════════════════════════════════════
    # 4. ANOMALY DETECTION
    # ═══════════════════════════════════════════════════
    
    def detect_anomalies(self, patient: PatientRecord) -> List[str]:
        """
        Detect clinical anomalies in patient data.
        Uses rule-based heuristics + statistical checks.
        """
        anomalies = []
        
        # Anomaly: Very high number of medications (polypharmacy)
        if len(patient.active_medications) >= 6:
            anomalies.append(
                f"⚠️ POLYPHARMACY: Patient is on {len(patient.active_medications)} active medications. "
                f"Review for medication reconciliation."
            )
        
        # Anomaly: Conflicting medications and allergies
        allergy_lower = [a.lower() for a in patient.allergies]
        for med in patient.active_medications:
            if med.name.lower() in allergy_lower:
                anomalies.append(
                    f"🚨 ALLERGY CONFLICT: Patient is prescribed {med.name} but has "
                    f"documented allergy to {med.name}!"
                )
        
        # Anomaly: Rapid vital sign changes
        if len(patient.vitals_history) >= 2:
            recent = patient.vitals_history[-1]
            previous = patient.vitals_history[-2]
            
            bp_change = abs(recent.blood_pressure_systolic - previous.blood_pressure_systolic)
            if bp_change > 30:
                anomalies.append(
                    f"⚠️ BP CHANGE: Systolic BP changed by {bp_change} mmHg between last two readings "
                    f"({previous.blood_pressure_systolic} → {recent.blood_pressure_systolic})"
                )
            
            hr_change = abs(recent.heart_rate - previous.heart_rate)
            if hr_change > 25:
                anomalies.append(
                    f"⚠️ HR CHANGE: Heart rate changed by {hr_change} bpm between readings"
                )
        
        # Anomaly: Multiple abnormal labs
        abnormal_labs = [lr for lr in patient.lab_results if lr.is_abnormal]
        if len(abnormal_labs) >= 3:
            lab_names = ", ".join(lr.test_name for lr in abnormal_labs)
            anomalies.append(
                f"⚠️ MULTIPLE ABNORMAL LABS: {len(abnormal_labs)} abnormal results ({lab_names})"
            )
        
        # Anomaly: Elderly patient on high-risk medications
        high_risk_meds = ["warfarin", "opioid", "hydrocodone", "oxycodone", "benzodiazepine", "alprazolam", "insulin"]
        if patient.age >= 65:
            risky_meds = [
                m.name for m in patient.active_medications
                if any(hrm in m.name.lower() for hrm in high_risk_meds)
            ]
            if risky_meds:
                anomalies.append(
                    f"⚠️ BEERS CRITERIA: Elderly patient (age {patient.age}) on potentially "
                    f"inappropriate medications: {', '.join(risky_meds)}"
                )
        
        # Anomaly: Missing follow-up past due
        for enc in patient.encounters:
            if enc.followup_required and enc.followup_date and enc.followup_date < date.today():
                days_overdue = (date.today() - enc.followup_date).days
                anomalies.append(
                    f"⚠️ OVERDUE FOLLOW-UP: Follow-up from {enc.date.strftime('%Y-%m-%d')} "
                    f"was due {enc.followup_date} ({days_overdue} days overdue)"
                )
        
        return anomalies
    
    # ═══════════════════════════════════════════════════
    # 5. RECOMMENDATION ENGINE
    # ═══════════════════════════════════════════════════
    
    def generate_recommendations(
        self,
        patient: PatientRecord,
        interactions: List[DrugInteractionAlert],
        anomalies: List[str],
        risk_score: float,
    ) -> List[str]:
        """Generate actionable risk mitigation recommendations."""
        recommendations = []
        
        # Drug interaction recommendations
        for interaction in interactions:
            recommendations.append(
                f"💊 DRUG REVIEW: {interaction.recommendation} "
                f"({interaction.drug_a} + {interaction.drug_b})"
            )
        
        # Risk-based recommendations
        if risk_score >= RISK_THRESHOLDS["critical"]:
            recommendations.append(
                "🚨 CRITICAL: Schedule immediate clinical review. "
                "Consider care coordination meeting."
            )
        elif risk_score >= RISK_THRESHOLDS["high"]:
            recommendations.append(
                "⚠️ HIGH RISK: Schedule follow-up within 7 days. "
                "Review all active medications."
            )
        elif risk_score >= RISK_THRESHOLDS["medium"]:
            recommendations.append(
                "📋 MODERATE RISK: Ensure routine follow-up is scheduled. "
                "Monitor trending lab values."
            )
        
        # Age-specific
        if patient.age >= 75:
            recommendations.append(
                "👴 GERIATRIC: Review medications against Beers Criteria. "
                "Consider fall risk assessment."
            )
        
        # Polypharmacy
        if len(patient.active_medications) >= 5:
            recommendations.append(
                "💊 POLYPHARMACY: Consider medication reconciliation. "
                "Evaluate if all medications are still indicated."
            )
        
        # Chronic disease management
        chronic = patient.chronic_conditions
        if len(chronic) >= 3:
            recommendations.append(
                "📊 CHRONIC CARE: Patient has multiple chronic conditions. "
                "Consider enrollment in chronic care management program."
            )
        
        # Lab monitoring
        abnormal_labs = [lr for lr in patient.lab_results if lr.is_abnormal]
        if abnormal_labs:
            recommendations.append(
                f"🧪 LAB MONITORING: Repeat abnormal labs "
                f"({', '.join(lr.test_name for lr in abnormal_labs[:3])}) within 2 weeks."
            )
        
        return recommendations
    
    # ═══════════════════════════════════════════════════
    # MAIN ASSESSMENT PIPELINE
    # ═══════════════════════════════════════════════════
    
    def assess_patient(self, patient: PatientRecord) -> RiskAssessment:
        """
        Run the complete GARMA risk assessment pipeline for a patient.
        This is the main entry point.
        """
        # Step 1: Check drug interactions
        interactions = self.check_drug_interactions(patient)
        
        # Step 2: Check compliance
        violations = self.check_compliance(patient)
        
        # Step 3: Calculate risk score
        risk_score, risk_factors = self.calculate_risk_score(patient)
        risk_level = self._get_risk_level(risk_score)
        
        # Step 4: Detect anomalies
        anomalies = self.detect_anomalies(patient)
        
        # Step 5: Generate recommendations
        recommendations = self.generate_recommendations(
            patient, interactions, anomalies, risk_score
        )
        
        assessment = RiskAssessment(
            patient_id=patient.patient_id,
            patient_name=patient.full_name,
            overall_score=round(risk_score, 3),
            risk_level=risk_level,
            risk_factors=risk_factors,
            drug_interactions=interactions,
            compliance_violations=violations,
            recommendations=recommendations,
            anomalies=anomalies,
        )
        
        self.assessments[patient.patient_id] = assessment
        return assessment
    
    def assess_all(self, patients: List[PatientRecord]) -> List[RiskAssessment]:
        """Run GARMA assessment on all patients."""
        return [self.assess_patient(p) for p in patients]
    
    def format_assessment_report(self, assessment: RiskAssessment) -> str:
        """Format a risk assessment into a readable report."""
        risk_emoji = {
            RiskLevel.LOW: "🟢",
            RiskLevel.MEDIUM: "🟡",
            RiskLevel.HIGH: "🟠",
            RiskLevel.CRITICAL: "🔴",
        }
        
        lines = [
            f"{'═' * 60}",
            f"🛡️  GARMA RISK ASSESSMENT REPORT",
            f"{'═' * 60}",
            f"Patient: {assessment.patient_name} (ID: {assessment.patient_id})",
            f"",
            f"OVERALL RISK: {risk_emoji.get(assessment.risk_level, '⚪')} {assessment.risk_level.value}",
            f"Risk Score: {assessment.overall_score:.1%}",
            f"",
            f"{'─' * 40}",
            f"📊 RISK FACTOR BREAKDOWN:",
        ]
        
        for factor, score in assessment.risk_factors.items():
            bar = "█" * int(score * 20) + "░" * (20 - int(score * 20))
            lines.append(f"  {factor:25s} {bar} {score:.0%}")
        
        if assessment.drug_interactions:
            lines.extend([f"", f"{'─' * 40}", f"💊 DRUG INTERACTIONS ({len(assessment.drug_interactions)}):", ""])
            for alert in assessment.drug_interactions:
                lines.extend([
                    f"  ⚠️ {alert.drug_a} + {alert.drug_b} [{alert.severity}]",
                    f"     {alert.description}",
                    f"     → {alert.recommendation}",
                    f"",
                ])
        
        if assessment.anomalies:
            lines.extend([f"{'─' * 40}", f"🔍 ANOMALIES DETECTED ({len(assessment.anomalies)}):", ""])
            for anomaly in assessment.anomalies:
                lines.append(f"  {anomaly}")
            lines.append("")
        
        if assessment.compliance_violations:
            lines.extend([f"{'─' * 40}", f"📋 COMPLIANCE ISSUES ({len(assessment.compliance_violations)}):", ""])
            for v in assessment.compliance_violations:
                lines.append(f"  [{v.rule_id}] {v.rule_name}")
            lines.append("")
        
        if assessment.recommendations:
            lines.extend([f"{'─' * 40}", f"✅ RECOMMENDATIONS:", ""])
            for i, rec in enumerate(assessment.recommendations, 1):
                lines.append(f"  {i}. {rec}")
        
        lines.append(f"\n{'═' * 60}")
        return "\n".join(lines)
    
    def get_population_risk_summary(self) -> Dict[str, Any]:
        """Get summary statistics across all assessed patients."""
        if not self.assessments:
            return {"error": "No assessments performed yet"}
        
        assessments = list(self.assessments.values())
        scores = [a.overall_score for a in assessments]
        
        return {
            "total_assessed": len(assessments),
            "avg_risk_score": float(np.mean(scores)),
            "max_risk_score": float(np.max(scores)),
            "min_risk_score": float(np.min(scores)),
            "risk_distribution": {
                "LOW": sum(1 for a in assessments if a.risk_level == RiskLevel.LOW),
                "MEDIUM": sum(1 for a in assessments if a.risk_level == RiskLevel.MEDIUM),
                "HIGH": sum(1 for a in assessments if a.risk_level == RiskLevel.HIGH),
                "CRITICAL": sum(1 for a in assessments if a.risk_level == RiskLevel.CRITICAL),
            },
            "total_drug_interactions": sum(len(a.drug_interactions) for a in assessments),
            "total_compliance_violations": sum(len(a.compliance_violations) for a in assessments),
            "total_anomalies": sum(len(a.anomalies) for a in assessments),
            "highest_risk_patients": sorted(
                [{"name": a.patient_name, "id": a.patient_id, "score": a.overall_score, "level": a.risk_level.value}
                 for a in assessments],
                key=lambda x: x["score"],
                reverse=True
            )[:10],
        }
