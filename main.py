"""
MedGuard AI - Main Entry Point
Run this to generate data and launch the platform.
"""
import sys
from pathlib import Path

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).parent))


def main():
    """Main entry point for MedGuard AI."""
    print("=" * 60)
    print("  🏥 MedGuard AI — Intelligent Medical Records Platform")
    print("=" * 60)
    print()
    
    # Step 1: Generate data
    print("Step 1: Generating synthetic patient data...")
    print("-" * 40)
    from medguard.data.generator import generate_patient_dataset, save_dataset
    
    patients = generate_patient_dataset(num_patients=50)
    save_dataset(patients)
    
    # Step 2: Run GARMA analysis
    print("\nStep 2: Running GARMA risk analysis...")
    print("-" * 40)
    from medguard.garma.advisor import GarmaAdvisor
    
    garma = GarmaAdvisor()
    assessments = garma.assess_all(patients)
    
    summary = garma.get_population_risk_summary()
    print(f"  Total assessed: {summary['total_assessed']}")
    print(f"  Average risk score: {summary['avg_risk_score']:.1%}")
    print(f"  Risk distribution: {summary['risk_distribution']}")
    print(f"  Drug interactions found: {summary['total_drug_interactions']}")
    print(f"  Anomalies detected: {summary['total_anomalies']}")
    
    # Step 3: Demo JARVIS
    print("\nStep 3: JARVIS AI Agent Demo")
    print("-" * 40)
    from medguard.jarvis.agent import JarvisAgent
    
    jarvis = JarvisAgent()
    
    demo_queries = [
        "How many patients have diabetes?",
        "Find high-risk elderly patients",
        "Give me an overview of the database",
    ]
    
    for query in demo_queries:
        print(f"\n📝 Query: {query}")
        response = jarvis.query(query)
        print(response)
    
    # Step 4: Show high-risk patient
    print("\nStep 4: Sample GARMA Risk Report")
    print("-" * 40)
    
    # Find highest risk patient
    highest_risk = max(assessments, key=lambda a: a.overall_score)
    report = garma.format_assessment_report(highest_risk)
    print(report)
    
    print("\n" + "=" * 60)
    print("  ✅ MedGuard AI setup complete!")
    print("  🚀 Launch dashboard: streamlit run medguard/dashboard/app.py")
    print("=" * 60)


if __name__ == "__main__":
    main()
