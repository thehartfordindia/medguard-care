# 🏥 MedGuard AI
### Intelligent Claim Intelligence — Powered by AI-Augmented Risk Mitigation
**The Hartford  ·  AI / ML / Data Science  ·  2026**

---

## Executive Summary

MedGuard AI is a working prototype that demonstrates how three established AI patterns — **natural-language search, explainable risk scoring, and document-grounded retrieval** — can be combined into a single decision-support cockpit for any large claim portfolio.

We have built and tested the full architecture end-to-end on synthetic medical records, because medical text is the hardest case in insurance. The same modular pattern is **directly re-applicable** to The Hartford's two largest opportunities:

- **Group Benefits** — short-term-to-long-term disability triage and absence-management
- **Middle & Large Commercial** — Workers' Compensation severity reduction and Life / Specialty underwriting acceleration

A 1 % improvement in any of these workflows is a **multi-million-dollar annual outcome**.

---

## 1 · Our Line of Business

The Hartford operates across three lines that all share one structural challenge: **the most valuable signal lives in unstructured medical text** that today is read manually.

| Line of Business | What we cover | Why this matters here |
|---|---|---|
| **Middle & Large Commercial** | Property, Liability, Workers' Comp for mid-market employers ($25 M – $1 B revenue) and Fortune-1000 risk programs | Medical evidence drives Workers' Comp severity; opioid and polypharmacy red flags are the largest controllable cost driver |
| **Group Benefits** | Disability (STD / LTD), Absence, FMLA, Group Life — #2 U.S. carrier in group disability | Nurse case managers read clinical evidence sequentially; earlier risk identification has direct dollar impact |
| **Specialty & Life** | Underwriting, specialty risk | Underwriters spend 30 – 60 minutes per APS letter; semantic retrieval can reduce cycle time meaningfully |

**Common thread:** every meaningful loss decision involves clinical evidence — and that evidence is unstructured.

---

## 2 · The Opportunity

> **A 1 % reduction in short-term-to-long-term disability conversion is worth $15 – 30 M annually** to a top-3 U.S. group disability carrier.

**Today's reality**
- Nurse case managers read records sequentially
- Drug-interaction red flags surface only after escalation
- Underwriters spend 30 – 60 minutes per Attending Physician Statement
- Multilingual members receive English-only service
- Risk indicators sit in unstructured text the system cannot query

**MedGuard AI gives every reviewer an AI co-pilot — risk surfaces in seconds, not days.**

---

## 3 · Architecture

> Four modules · one pipeline · zero proprietary APIs

```
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │  📄  Data    │ ▶ │  🤖  JARVIS  │ ▶ │ 📊 NotebookLM│ ▶ │  🛡️  GARMA   │ ▶ │  📈 Cockpit  │
   │  FHIR-style  │   │  NL search   │   │  Vector RAG  │   │ Risk scoring │   │  Streamlit   │
   └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

| Module | Inspired by | What it does |
|---|---|---|
| **📄 Data Engine** | FHIR / HL7 | Generates 250 synthetic patients, validated with Pydantic models — production swap point for Guidewire / claim feeds |
| **🤖 JARVIS** | AI-Augmented Engineering | Plain-English clinical querying — keyword + clinical-taxonomy match, sub-second response, zero API key required |
| **🛡️ GARMA** | GenAI Risk Mitigation Advisor | Composite 6-factor risk score, drug-interaction detection, anomaly engine, explainable recommendations |
| **📊 NotebookLM** | Google NotebookLM | Vector retrieval over clinical text using FAISS + sentence-transformers — grounds every answer in evidence |
| **📈 Cockpit** | Streamlit | KPI dashboard, critical-alert feed, clinician reports, **multilingual voice in 19 languages** |

Every component is open-source. No vendor lock-in. No API key required for the demo.

---

## 4 · What We Have Built

| Component | Status | Notes |
|---|---|---|
| Synthetic patient generator (250 records) | ✅ Complete | FHIR-style schema, intentional risk patterns embedded for GARMA to detect |
| JARVIS NL agent | ✅ Complete | Clinical taxonomy, scored relevance, 8 preset queries |
| GARMA risk engine | ✅ Complete | 6-factor weighted composite, drug-interaction matrix, anomaly rules |
| NotebookLM RAG layer | ✅ Complete | Sentence-transformer embeddings, FAISS index, semantic search |
| Streamlit cockpit | ✅ Complete | 5 pages, glassmorphism KPIs, critical-alert feed, radar charts |
| Multilingual voice (gTTS + deep-translator) | ✅ Complete | 19 languages, online + offline (Windows SAPI) modes |
| Corporate-network resilience (truststore) | ✅ Complete | Handles Hartford / Zscaler SSL inspection |
| Polished pptx deck and demo script | ✅ Complete | This document and `MedGuard_AI.pptx` |

---

## 5 · Live Demonstration Flow (5 minutes)

| Time | Slide | What happens on screen |
|---|---|---|
| 0:00 – 0:20 | Title | Set the stage |
| 0:20 – 0:50 | Line of business | Hartford context |
| 0:50 – 1:10 | Opportunity | $15 – 30 M anchor |
| 1:10 – 2:00 | Architecture | Four-module pipeline |
| **2:00 – 2:40** | **DEMO 1 — Cockpit** | KPIs, critical alerts, risk distribution |
| **2:40 – 3:30** | **DEMO 2 — JARVIS** | NL query → 10 patients → 🔊 voice reply |
| **3:30 – 4:10** | **DEMO 3 — GARMA** | Radar chart, drug interaction, recommendation |
| 4:10 – 4:40 | Hartford mapping | LTD / WC / Underwriting |
| 4:40 – 4:55 | Path to production | Azure, governance, compliance |
| 4:55 – 5:00 | Close + Q & A | "A pattern, not a prototype" |

---

## 6 · Hartford Applications

> Same architecture, three immediate Hartford use cases.

| MedGuard module | Group Benefits LTD | Workers' Comp | Life / Specialty UW |
|---|---|---|---|
| **🤖 JARVIS** | "Show LTD claimants with no RTW plan" | "Find catastrophic claims on opioids" | Underwriter NL search over APS |
| **🛡️ GARMA** | STD → LTD conversion risk score | Opioid / polypharmacy red flags | Mortality composite scoring |
| **📊 NotebookLM** | RAG over IME and APS reports | Treatment-note semantic search | MIB / APS PDF retrieval |
| **📈 Cockpit** | Nurse case-manager triage queue | Claim-handler severity dashboard | Underwriter decision support |

**Estimated value (industry benchmarks)**

| Lever | Impact |
|---|---|
| 1 % LTD-duration reduction | **$15 – 30 M annually** |
| Underwriter cycle time | **~25 % faster** APS review |
| Multilingual self-service | **5 – 10 % call deflection** |

---

## 7 · Path to Production

| # | Workstream | What changes |
|---|---|---|
| 01 | **Data sources** | Replace synthetic generator with Guidewire ClaimCenter, APS feeds, Rx data |
| 02 | **Enterprise AI** | Azure OpenAI + Azure Translator / Speech (existing Hartford licenses) |
| 03 | **Security & compliance** | Hartford SSO · PHI guardrails · audit logging · HITRUST · HIPAA |
| 04 | **Hosting** | Azure App Service / AKS behind Zscaler · zero data egress |
| 05 | **Model governance** | Register GARMA in Hartford AI Model Risk inventory · NAIC-aligned monitoring |

---

## 8 · Q & A — Anticipated Questions

| Question | One-line answer |
|---|---|
| Is the data real? | Synthetic — Faker against FHIR-style Pydantic schemas. **No PHI ever touches the demo.** |
| What LLM is used? | None in the demo, **intentionally** — JARVIS uses keyword + clinical-taxonomy matching, runs on a laptop without API keys. Azure OpenAI slots in for production. |
| How is the risk score validated? | Today it is a transparent weighted composite of six clinical factors, designed for **explainability**. Production validation against historical LTD outcomes would be required, plus registration in our AI inventory. |
| Why Streamlit? | Speed of iteration. The cockpit is a *front-end*; the modules underneath are framework-agnostic Python and can serve a React app or a Guidewire integration tomorrow. |
| Privacy / HIPAA? | Demo is synthetic. Production design assumes Azure-private LLMs, no data egress, full audit trail, and PHI tokenization at the edge. |
| Time to a real Hartford pilot? | With committed data access and Azure provisioning: **8 – 12 weeks** to a controlled LTD pilot on a single book of business. |

---

## 9 · Closing

> **MedGuard AI is a pattern, not just a prototype.**
>
> - Four modules · one architecture · zero vendor lock-in
> - End-to-end working demo in five minutes
> - Re-applicable across Disability, Workers' Compensation, and Underwriting
> - Clear path to Azure-hosted, HIPAA-compliant production

**Thank you.**

---

*Confidential — for internal demo · The Hartford · 2026*
