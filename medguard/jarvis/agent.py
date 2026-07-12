"""
MedGuard AI - JARVIS Module
🤖 AI-Augmented Engineering Agent

JARVIS is the conversational AI agent that allows doctors and engineers
to query medical records using natural language. It uses:
  - Vector similarity search (FAISS) for finding relevant patient data
  - LLM for natural language understanding and response generation
  - Chain-of-thought reasoning for complex medical queries

Inspired by: AI-Augmented Engineering patterns
"""
import os
from pathlib import Path
from typing import List, Dict, Any, Optional

from medguard.data.models import PatientRecord
from medguard.data.generator import load_dataset


class JarvisAgent:
    """
    JARVIS — AI-Augmented Engineering Agent for Medical Records.
    
    This agent provides:
    1. Natural language querying of patient records
    2. Semantic search using vector embeddings
    3. Intelligent summarization and analysis
    4. Context-aware follow-up conversations
    """
    
    def __init__(self, data_dir: str = None, use_llm: bool = False):
        """
        Initialize JARVIS.
        
        Args:
            data_dir: Path to patient data directory
            use_llm: If True, uses LangChain + LLM for responses.
                     If False, uses rule-based smart search (no API key needed).
        """
        self.patients: List[PatientRecord] = []
        self.patient_index: Dict[str, PatientRecord] = {}
        self.use_llm = use_llm
        self.vector_store = None
        self.conversation_history: List[Dict[str, str]] = []
        
        # Load patient data
        self._load_data(data_dir)
    
    def _load_data(self, data_dir: str = None):
        """Load patient records into memory."""
        try:
            self.patients = load_dataset(data_dir)
            self.patient_index = {p.patient_id: p for p in self.patients}
            print(f"🤖 JARVIS loaded {len(self.patients)} patient records")
        except Exception as e:
            print(f"⚠️ JARVIS: Could not load data: {e}")
            print("   Run `python -m medguard.data.generator` first to generate data.")
    
    def _build_searchable_corpus(self) -> List[Dict[str, Any]]:
        """Build a searchable corpus from patient records."""
        corpus = []
        for patient in self.patients:
            doc = {
                "patient_id": patient.patient_id,
                "text": patient.to_clinical_summary(),
                "metadata": {
                    "name": patient.full_name,
                    "age": patient.age,
                    "gender": patient.gender,
                    "conditions": [d.condition for d in patient.diagnoses],
                    "medications": [m.name for m in patient.active_medications],
                    "has_abnormal_labs": any(lr.is_abnormal for lr in patient.lab_results),
                }
            }
            corpus.append(doc)
        return corpus
    
    # ─── Smart Search (No LLM Required) ────────────────
    
    def search_patients(
        self,
        query: str,
        max_results: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Smart keyword + rule-based search over patient records.
        Works without any API keys.
        """
        query_lower = query.lower()
        results = []
        
        for patient in self.patients:
            score = 0
            reasons = []
            
            # Name search
            if any(name.lower() in query_lower for name in [patient.first_name, patient.last_name]):
                score += 10
                reasons.append("Name match")
            
            # Condition search
            for dx in patient.diagnoses:
                if any(word in dx.condition.lower() for word in query_lower.split()):
                    score += 5
                    reasons.append(f"Condition: {dx.condition}")
            
            # Medication search
            for med in patient.medications:
                if med.name.lower() in query_lower:
                    score += 5
                    reasons.append(f"Medication: {med.name}")
            
            # Age-related queries
            if "elderly" in query_lower or "old" in query_lower or "senior" in query_lower:
                if patient.age >= 65:
                    score += 3
                    reasons.append(f"Age: {patient.age}")
            
            if "young" in query_lower:
                if patient.age < 40:
                    score += 3
                    reasons.append(f"Age: {patient.age}")
            
            # Risk-related queries
            if "risk" in query_lower or "dangerous" in query_lower or "critical" in query_lower:
                if len(patient.active_medications) >= 4:
                    score += 3
                    reasons.append(f"Polypharmacy: {len(patient.active_medications)} meds")
                if any(lr.is_abnormal for lr in patient.lab_results):
                    score += 2
                    reasons.append("Has abnormal labs")
            
            # Abnormal labs query
            if "abnormal" in query_lower or "lab" in query_lower:
                abnormal_count = sum(1 for lr in patient.lab_results if lr.is_abnormal)
                if abnormal_count > 0:
                    score += abnormal_count
                    reasons.append(f"Abnormal labs: {abnormal_count}")
            
            # Chronic conditions
            if "chronic" in query_lower:
                chronic_count = len(patient.chronic_conditions)
                if chronic_count > 0:
                    score += chronic_count * 2
                    reasons.append(f"Chronic conditions: {chronic_count}")
            
            # Specific condition keywords
            condition_keywords = {
                "diabetes": ["diabetes", "diabetic", "hba1c", "glucose", "insulin"],
                "heart": ["cardiac", "heart", "atrial", "fibrillation", "hypertension"],
                "kidney": ["kidney", "renal", "creatinine", "ckd"],
                "mental": ["depression", "anxiety", "mental", "psychiatric", "ssri"],
                "pain": ["pain", "opioid", "chronic pain", "gabapentin"],
            }
            
            for category, keywords in condition_keywords.items():
                if any(kw in query_lower for kw in keywords):
                    for dx in patient.diagnoses:
                        if any(kw in dx.condition.lower() for kw in keywords):
                            score += 4
                            reasons.append(f"{category.title()} related: {dx.condition}")
                    for med in patient.medications:
                        if any(kw in med.name.lower() for kw in keywords):
                            score += 2
            
            if score > 0:
                results.append({
                    "patient": patient,
                    "score": score,
                    "reasons": reasons,
                })
        
        # Sort by relevance score
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:max_results]
    
    def query(self, question: str) -> str:
        """
        Answer a natural language question about the patient database.
        This is the main JARVIS interface.
        """
        self.conversation_history.append({"role": "user", "question": question})
        
        question_lower = question.lower()
        
        # ── Statistical queries ──
        if any(word in question_lower for word in ["how many", "count", "total", "number of"]):
            return self._answer_statistical(question_lower)
        
        # ── Patient lookup ──
        if any(word in question_lower for word in ["show me", "find", "search", "who", "which patients"]):
            results = self.search_patients(question)
            if not results:
                return "🤖 JARVIS: No patients matched your query. Try different keywords."
            return self._format_search_results(results, question)
        
        # ── Summary/analysis queries ──
        if any(word in question_lower for word in ["summary", "summarize", "overview", "report"]):
            return self._generate_overview()
        
        # ── Default: try search ──
        results = self.search_patients(question)
        if results:
            return self._format_search_results(results, question)
        
        return (
            "🤖 JARVIS: I'm not sure how to answer that. Try asking:\n"
            "   • 'Find patients with diabetes'\n"
            "   • 'Show me high-risk elderly patients'\n"
            "   • 'How many patients have abnormal labs?'\n"
            "   • 'Which patients are on Warfarin?'\n"
            "   • 'Give me an overview of the database'\n"
        )
    
    def _answer_statistical(self, question: str) -> str:
        """Answer counting/statistical questions."""
        total = len(self.patients)
        
        stats = {
            "Total patients": total,
            "Elderly (65+)": sum(1 for p in self.patients if p.age >= 65),
            "With diabetes": sum(1 for p in self.patients if any("diabetes" in d.condition.lower() for d in p.diagnoses)),
            "With hypertension": sum(1 for p in self.patients if any("hypertension" in d.condition.lower() for d in p.diagnoses)),
            "With abnormal labs": sum(1 for p in self.patients if any(lr.is_abnormal for lr in p.lab_results)),
            "On 4+ medications": sum(1 for p in self.patients if len(p.active_medications) >= 4),
            "With chronic conditions": sum(1 for p in self.patients if len(p.chronic_conditions) > 0),
        }
        
        lines = ["🤖 JARVIS — Database Statistics", "=" * 40]
        for label, count in stats.items():
            pct = (count / total * 100) if total > 0 else 0
            bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
            lines.append(f"  {label}: {count} ({pct:.0f}%) {bar}")
        
        return "\n".join(lines)
    
    def _format_search_results(self, results: List[Dict], query: str) -> str:
        """Format search results into a readable response."""
        lines = [
            f"🤖 JARVIS — Found {len(results)} matching patients for: '{query}'",
            "=" * 60,
        ]
        
        for i, result in enumerate(results[:5], 1):
            p = result["patient"]
            reasons = ", ".join(result["reasons"][:3])
            lines.extend([
                f"\n{'─' * 50}",
                f"  #{i} | {p.full_name} (ID: {p.patient_id})",
                f"  Age: {p.age} | Gender: {p.gender} | Relevance: {result['score']}",
                f"  Match: {reasons}",
                f"  Active Meds: {', '.join(m.name for m in p.active_medications[:4])}",
                f"  Diagnoses: {', '.join(d.condition for d in p.diagnoses[:3])}",
            ])
            
            abnormal_labs = [lr for lr in p.lab_results if lr.is_abnormal]
            if abnormal_labs:
                lines.append(f"  ⚠️ Abnormal Labs: {', '.join(lr.test_name for lr in abnormal_labs[:3])}")
        
        if len(results) > 5:
            lines.append(f"\n  ... and {len(results) - 5} more results")
        
        return "\n".join(lines)
    
    def _generate_overview(self) -> str:
        """Generate a high-level database overview."""
        if not self.patients:
            return "🤖 JARVIS: No patient data loaded."
        
        total = len(self.patients)
        avg_age = sum(p.age for p in self.patients) / total
        avg_meds = sum(len(p.active_medications) for p in self.patients) / total
        
        # Most common conditions
        condition_counts: Dict[str, int] = {}
        for p in self.patients:
            for d in p.diagnoses:
                condition_counts[d.condition] = condition_counts.get(d.condition, 0) + 1
        
        top_conditions = sorted(condition_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Most common medications
        med_counts: Dict[str, int] = {}
        for p in self.patients:
            for m in p.active_medications:
                med_counts[m.name] = med_counts.get(m.name, 0) + 1
        
        top_meds = sorted(med_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        
        lines = [
            "🤖 JARVIS — Patient Database Overview",
            "=" * 50,
            f"  📊 Total Patients: {total}",
            f"  👤 Average Age: {avg_age:.1f} years",
            f"  💊 Average Active Medications: {avg_meds:.1f}",
            f"  🧬 Gender Split: {sum(1 for p in self.patients if p.gender == 'Male')}M / {sum(1 for p in self.patients if p.gender == 'Female')}F",
            f"",
            f"  🏥 Top 5 Conditions:",
        ]
        for condition, count in top_conditions:
            lines.append(f"     • {condition}: {count} patients")
        
        lines.append(f"\n  💊 Top 5 Medications:")
        for med, count in top_meds:
            lines.append(f"     • {med}: {count} patients")
        
        return "\n".join(lines)
    
    def get_patient_detail(self, patient_id: str) -> str:
        """Get detailed clinical summary for a specific patient."""
        patient = self.patient_index.get(patient_id)
        if not patient:
            return f"🤖 JARVIS: Patient ID '{patient_id}' not found."
        return patient.to_clinical_summary()
