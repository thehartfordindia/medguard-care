"""
MedGuard AI — Streamlit Dashboard (Demo-Ready Edition)
🏥 Intelligent Medical Records Platform with AI-Augmented Risk Mitigation

Launch with:
    streamlit run medguard/dashboard/app.py
"""
from __future__ import annotations

import sys
import time
import io
from pathlib import Path

# ── Path setup ──────────────────────────────────────────
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd

from medguard.data.generator import load_dataset, generate_patient_dataset, save_dataset
from medguard.jarvis.agent import JarvisAgent
from medguard.garma.advisor import GarmaAdvisor, RiskLevel

# Multilingual voice (optional — gracefully degrades if libs missing)
try:
    from medguard.utils.voice import SUPPORTED_LANGUAGES, speak, summarize_for_speech
    VOICE_AVAILABLE = True
except Exception:  # pragma: no cover
    SUPPORTED_LANGUAGES = {"🇺🇸 English": ("en", "en")}
    VOICE_AVAILABLE = False


# ═══════════════════════════════════════════════════════════
# PAGE CONFIG + GLOBAL CSS
# ═══════════════════════════════════════════════════════════
st.set_page_config(
    page_title="MedGuard AI",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded",
)

RISK_COLORS = {
    "LOW":      "#22c55e",
    "MEDIUM":   "#f59e0b",
    "HIGH":     "#ef4444",
    "CRITICAL": "#a855f7",
}
RISK_EMOJI = {"LOW": "🟢", "MEDIUM": "🟡", "HIGH": "🟠", "CRITICAL": "🔴"}

st.markdown(
    """
<style>
  /* Hide default Streamlit chrome */
  #MainMenu, footer {visibility: hidden;}
  header [data-testid="stToolbar"] {visibility: hidden;}

  /* Body gradient backdrop */
  .stApp {
      background:
        radial-gradient(1200px 600px at 10% -10%, rgba(0,217,192,0.12), transparent 60%),
        radial-gradient(900px 500px at 100% 0%, rgba(99,102,241,0.12), transparent 55%),
        linear-gradient(180deg, #0b1220 0%, #0a1020 100%);
  }

  /* Hero */
  .hero {
      padding: 28px 32px;
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(0,217,192,0.15), rgba(99,102,241,0.15));
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 10px 40px rgba(0,0,0,0.35);
      margin-bottom: 18px;
  }
  .hero-title {
      font-size: 2.6rem;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(90deg, #00d9c0 0%, #7c7cff 50%, #ff7ab6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0;
      line-height: 1.1;
  }
  .hero-sub {
      color: #a9b4c7;
      font-size: 1.05rem;
      margin-top: 6px;
  }
  .hero-badges {margin-top: 14px;}
  .badge {
      display: inline-block;
      padding: 4px 10px;
      margin-right: 8px;
      border-radius: 999px;
      font-size: 0.78rem;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04);
      color: #cfd6e4;
  }

  /* Glass KPI cards */
  .kpi {
      padding: 18px 18px 16px;
      border-radius: 14px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      backdrop-filter: blur(8px);
      transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease;
      height: 100%;
  }
  .kpi:hover {
      transform: translateY(-2px);
      border-color: rgba(0,217,192,0.45);
      box-shadow: 0 8px 24px rgba(0,217,192,0.08);
  }
  .kpi-label {color:#8b95a7; font-size:.82rem; text-transform:uppercase; letter-spacing:1px;}
  .kpi-value {font-size:2.0rem; font-weight:800; margin-top:4px;}
  .kpi-hint  {color:#8b95a7; font-size:.82rem; margin-top:2px;}
  .kpi-accent-green    {border-left: 3px solid #22c55e;}
  .kpi-accent-yellow   {border-left: 3px solid #f59e0b;}
  .kpi-accent-orange   {border-left: 3px solid #ef4444;}
  .kpi-accent-purple   {border-left: 3px solid #a855f7;}
  .kpi-accent-teal     {border-left: 3px solid #00d9c0;}
  .kpi-accent-indigo   {border-left: 3px solid #6366f1;}

  /* Alert feed */
  .alert {
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 10px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
  }
  .alert-critical {border-left: 4px solid #a855f7;}
  .alert-high     {border-left: 4px solid #ef4444;}
  .alert-medium   {border-left: 4px solid #f59e0b;}
  .alert-title    {font-weight: 700; font-size: .98rem;}
  .alert-meta     {color: #8b95a7; font-size: .8rem; margin-top: 2px;}
  .alert-body     {color: #cfd6e4; font-size: .9rem; margin-top: 6px;}

  /* Section headers */
  .section-h {font-size: 1.1rem; font-weight: 700; color: #e6edf3; margin: 6px 0 10px;}
  .divider-soft {border-top: 1px solid rgba(255,255,255,0.06); margin: 18px 0;}

  /* Sidebar */
  section[data-testid="stSidebar"] {
      background: linear-gradient(180deg, #0a1020 0%, #0b1427 100%);
      border-right: 1px solid rgba(255,255,255,0.05);
  }

  /* Buttons */
  .stButton > button {
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04);
      color: #e6edf3;
      transition: all .15s ease;
  }
  .stButton > button:hover {
      border-color: #00d9c0;
      color: #00d9c0;
      background: rgba(0,217,192,0.08);
  }

  /* Tabs */
  .stTabs [data-baseweb="tab-list"] {gap: 4px;}
  .stTabs [data-baseweb="tab"] {
      background: rgba(255,255,255,0.03);
      border-radius: 10px 10px 0 0;
      padding: 8px 14px;
  }
</style>
""",
    unsafe_allow_html=True,
)


# ═══════════════════════════════════════════════════════════
# DATA LOADERS (cached)
# ═══════════════════════════════════════════════════════════
@st.cache_resource(show_spinner=False)
def load_data():
    try:
        patients = load_dataset()
        if not patients:
            raise FileNotFoundError
    except Exception:
        patients = generate_patient_dataset(num_patients=50)
        save_dataset(patients)
    return patients


@st.cache_resource(show_spinner=False)
def init_jarvis():
    return JarvisAgent()


@st.cache_resource(show_spinner=False)
def init_garma():
    return GarmaAdvisor()


@st.cache_resource(show_spinner=False)
def run_garma(_garma, _patients):
    return _garma.assess_all(_patients)


with st.spinner("🔄 Booting MedGuard AI…"):
    patients = load_data()
    jarvis = init_jarvis()
    garma = init_garma()
    assessments = run_garma(garma, patients)

summary = garma.get_population_risk_summary()
dist = summary.get("risk_distribution", {})


# ═══════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════
def kpi(label: str, value: str, hint: str = "", accent: str = "teal"):
    st.markdown(
        f"""
        <div class="kpi kpi-accent-{accent}">
          <div class="kpi-label">{label}</div>
          <div class="kpi-value">{value}</div>
          <div class="kpi-hint">{hint}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def get_patient(pid: str):
    return next((p for p in patients if p.patient_id == pid), None)


def patients_to_df():
    rows = []
    for a in assessments:
        p = get_patient(a.patient_id)
        if not p:
            continue
        rows.append({
            "ID": p.patient_id,
            "Name": p.full_name,
            "Age": p.age,
            "Gender": p.gender,
            "Risk Score": a.overall_score,
            "Risk Level": a.risk_level.value,
            "Active Meds": len(p.active_medications),
            "Diagnoses": len(p.diagnoses),
            "Drug Interactions": len(a.drug_interactions),
            "Anomalies": len(a.anomalies),
            "Chronic Conditions": len(p.chronic_conditions),
        })
    return pd.DataFrame(rows)


def risk_gauge(score: float, title: str = "Risk Score") -> go.Figure:
    fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=score * 100,
        number={"suffix": "%", "font": {"size": 42, "color": "#e6edf3"}},
        title={"text": title, "font": {"size": 14, "color": "#a9b4c7"}},
        gauge={
            "axis": {"range": [0, 100], "tickcolor": "#8b95a7"},
            "bar": {"color": "#00d9c0", "thickness": 0.25},
            "bgcolor": "rgba(0,0,0,0)",
            "borderwidth": 0,
            "steps": [
                {"range": [0, 40],   "color": "rgba(34,197,94,0.35)"},
                {"range": [40, 60],  "color": "rgba(245,158,11,0.35)"},
                {"range": [60, 80],  "color": "rgba(239,68,68,0.35)"},
                {"range": [80, 100], "color": "rgba(168,85,247,0.45)"},
            ],
            "threshold": {"line": {"color": "white", "width": 3}, "thickness": 0.8, "value": score * 100},
        },
    ))
    fig.update_layout(height=230, margin=dict(t=30, b=10, l=20, r=20),
                      paper_bgcolor="rgba(0,0,0,0)", font={"color": "#e6edf3"})
    return fig


def risk_radar(assessment) -> go.Figure:
    cats = [c.replace("_", " ").title() for c in assessment.risk_factors.keys()]
    vals = list(assessment.risk_factors.values())
    fig = go.Figure(data=go.Scatterpolar(
        r=vals + [vals[0]],
        theta=cats + [cats[0]],
        fill="toself",
        line_color="#00d9c0",
        fillcolor="rgba(0,217,192,0.25)",
    ))
    fig.update_layout(
        polar=dict(
            bgcolor="rgba(0,0,0,0)",
            radialaxis=dict(visible=True, range=[0, 1], gridcolor="rgba(255,255,255,0.1)", color="#8b95a7"),
            angularaxis=dict(gridcolor="rgba(255,255,255,0.1)", color="#cfd6e4"),
        ),
        showlegend=False, height=340,
        margin=dict(t=20, b=20, l=30, r=30),
        paper_bgcolor="rgba(0,0,0,0)",
    )
    return fig


def styled_plotly(fig: go.Figure, height: int | None = None) -> go.Figure:
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#cfd6e4"),
        xaxis=dict(gridcolor="rgba(255,255,255,0.06)", zerolinecolor="rgba(255,255,255,0.06)"),
        yaxis=dict(gridcolor="rgba(255,255,255,0.06)", zerolinecolor="rgba(255,255,255,0.06)"),
    )
    if height:
        fig.update_layout(height=height)
    return fig


# ═══════════════════════════════════════════════════════════
# SIDEBAR
# ═══════════════════════════════════════════════════════════
with st.sidebar:
    st.markdown("### 🏥 **MedGuard AI**")
    st.caption("AI-Augmented Clinical Risk Platform")
    st.markdown("---")

    page = st.radio(
        "Navigate",
        [
            "🏠  Command Center",
            "🤖  JARVIS — Ask AI",
            "🛡️  GARMA — Risk Advisor",
            "📊  Patient Explorer",
            "📈  Population Analytics",
            "ℹ️   About",
        ],
        index=0,
        label_visibility="collapsed",
    )

    st.markdown("---")
    st.markdown("#### 📡 Live Stats")
    st.metric("Patients Monitored", len(patients))
    st.metric("Avg Risk", f"{summary.get('avg_risk_score', 0):.0%}")
    st.metric("⚠️ Interactions", summary.get("total_drug_interactions", 0))
    st.metric("🔍 Anomalies", summary.get("total_anomalies", 0))

    st.markdown("---")
    if st.button("🔄 Re-assess population", width="stretch"):
        st.cache_resource.clear()
        st.rerun()
    st.caption("Hackathon 2026 · built with ❤️")


# ═══════════════════════════════════════════════════════════
# PAGE: COMMAND CENTER
# ═══════════════════════════════════════════════════════════
if page.startswith("🏠"):
    # HERO
    st.markdown(
        """
        <div class="hero">
          <div class="hero-title">MedGuard AI — Command Center</div>
          <div class="hero-sub">Real-time clinical risk intelligence powered by JARVIS · GARMA · NotebookLM</div>
          <div class="hero-badges">
            <span class="badge">🤖 NL Querying</span>
            <span class="badge">💊 Drug Interaction Engine</span>
            <span class="badge">📊 ML Risk Scoring</span>
            <span class="badge">🔍 Semantic Search (FAISS)</span>
            <span class="badge">⚡ Zero-API-Key</span>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Impact banner metrics
    high_crit = dist.get("HIGH", 0) + dist.get("CRITICAL", 0)
    interactions = summary.get("total_drug_interactions", 0)
    anomalies = summary.get("total_anomalies", 0)
    violations = summary.get("total_compliance_violations", 0)
    avg_risk = summary.get("avg_risk_score", 0)

    c1, c2, c3, c4, c5, c6 = st.columns(6)
    with c1: kpi("Patients", f"{len(patients)}", "active records", "teal")
    with c2: kpi("Avg Risk", f"{avg_risk:.0%}", "population-wide", "indigo")
    with c3: kpi("High / Critical", f"{high_crit}", "need escalation", "orange")
    with c4: kpi("Interactions", f"{interactions}", "⚠️ detected", "purple")
    with c5: kpi("Anomalies", f"{anomalies}", "flagged records", "yellow")
    with c6: kpi("Compliance Issues", f"{violations}", "policy gaps", "green")

    st.markdown('<div class="divider-soft"></div>', unsafe_allow_html=True)

    # Charts row
    left, right = st.columns([1.1, 1])
    with left:
        st.markdown('<div class="section-h">🩺 Risk Level Composition</div>', unsafe_allow_html=True)
        rdf = pd.DataFrame([{"Risk Level": k, "Count": v} for k, v in dist.items() if v > 0])
        if not rdf.empty:
            fig = px.pie(
                rdf, values="Count", names="Risk Level", hole=0.55,
                color="Risk Level", color_discrete_map=RISK_COLORS,
            )
            fig.update_traces(textinfo="label+percent",
                              marker=dict(line=dict(color="#0b1220", width=2)))
            fig.update_layout(legend=dict(orientation="h", yanchor="bottom", y=-0.2),
                              height=360, margin=dict(t=10, b=10))
            st.plotly_chart(styled_plotly(fig), width="stretch")

    with right:
        st.markdown('<div class="section-h">📈 Population Risk Distribution</div>', unsafe_allow_html=True)
        df = patients_to_df()
        fig = px.histogram(
            df, x="Risk Score", nbins=20, color="Risk Level",
            color_discrete_map=RISK_COLORS,
        )
        fig.update_layout(height=360, margin=dict(t=10, b=10),
                          legend=dict(orientation="h", yanchor="bottom", y=-0.25),
                          bargap=0.05)
        st.plotly_chart(styled_plotly(fig), width="stretch")

    st.markdown('<div class="divider-soft"></div>', unsafe_allow_html=True)

    # Alert feed + Patient of Concern
    feed_col, spotlight_col = st.columns([1, 1])

    with feed_col:
        st.markdown('<div class="section-h">🚨 Live Critical Alerts Feed</div>', unsafe_allow_html=True)
        all_alerts = []
        for a in assessments:
            for di in a.drug_interactions:
                all_alerts.append((di.severity, a, di))
        sev_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        all_alerts.sort(key=lambda x: (sev_order.get(x[0], 99), -x[1].overall_score))

        if not all_alerts:
            st.info("No drug interactions detected. 🎉")
        else:
            for sev, a, di in all_alerts[:7]:
                cls = {"CRITICAL": "alert-critical", "HIGH": "alert-high", "MEDIUM": "alert-medium"}.get(sev, "alert-medium")
                emoji = {"CRITICAL": "🟣", "HIGH": "🔴", "MEDIUM": "🟡"}.get(sev, "⚪")
                st.markdown(
                    f"""
                    <div class="alert {cls}">
                      <div class="alert-title">{emoji} {sev} · {di.drug_a} + {di.drug_b}</div>
                      <div class="alert-meta">Patient: <b>{a.patient_name}</b> · Score {a.overall_score:.0%} · {a.risk_level.value}</div>
                      <div class="alert-body">{di.description}<br/><i>↳ {di.recommendation}</i></div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )
            if len(all_alerts) > 7:
                st.caption(f"… and {len(all_alerts) - 7} more alerts in the queue.")

    with spotlight_col:
        st.markdown('<div class="section-h">🎯 Patient of Concern — Auto-Spotlight</div>', unsafe_allow_html=True)
        top = max(assessments, key=lambda a: a.overall_score)
        tp = get_patient(top.patient_id)

        st.markdown(
            f"""
            <div class="kpi kpi-accent-purple">
              <div class="kpi-label">{RISK_EMOJI[top.risk_level.value]} {top.risk_level.value} RISK</div>
              <div class="kpi-value">{top.patient_name}</div>
              <div class="kpi-hint">
                Age {tp.age if tp else '?'} · {tp.gender if tp else ''} ·
                {len(tp.active_medications) if tp else 0} active meds ·
                {len(tp.diagnoses) if tp else 0} diagnoses
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        st.plotly_chart(risk_gauge(top.overall_score, "Composite GARMA Risk"), width="stretch")

        if top.recommendations:
            st.markdown("**✅ Top Clinical Recommendations**")
            for i, rec in enumerate(top.recommendations[:3], 1):
                st.success(f"**{i}.** {rec}")

    st.markdown('<div class="divider-soft"></div>', unsafe_allow_html=True)

    # Top risk table + download
    st.markdown('<div class="section-h">🔝 Top 10 Highest-Risk Patients</div>', unsafe_allow_html=True)
    df = patients_to_df().sort_values("Risk Score", ascending=False).head(10)
    df_display = df.copy()
    df_display["Risk Score"] = df_display["Risk Score"].apply(lambda x: f"{x:.1%}")
    st.dataframe(df_display, width="stretch", hide_index=True)

    csv = patients_to_df().to_csv(index=False).encode("utf-8")
    st.download_button(
        "⬇️ Download full population risk report (CSV)",
        csv,
        file_name="medguard_population_report.csv",
        mime="text/csv",
    )


# ═══════════════════════════════════════════════════════════
# PAGE: JARVIS
# ═══════════════════════════════════════════════════════════
elif page.startswith("🤖"):
    st.markdown(
        """
        <div class="hero">
          <div class="hero-title">🤖 JARVIS</div>
          <div class="hero-sub">AI-Augmented Engineering — natural-language clinical querying, zero API keys required.</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Sample query chips
    st.markdown("**💡 Try a preset query:**")
    samples = [
        "Show me patients with diabetes",
        "Find high-risk elderly patients",
        "How many patients have abnormal labs?",
        "Which patients are on Warfarin?",
        "Give me an overview of the database",
        "Find patients with chronic conditions",
        "Patients on 4+ medications",
        "Female patients under 40",
    ]
    cols = st.columns(4)
    selected = st.session_state.get("jarvis_q", "")
    for i, q in enumerate(samples):
        if cols[i % 4].button(q, key=f"s_{i}", width="stretch"):
            selected = q
            st.session_state["jarvis_q"] = q

    st.markdown('<div class="divider-soft"></div>', unsafe_allow_html=True)

    query = st.text_input(
        "🔍 Ask JARVIS anything:",
        value=selected,
        placeholder="e.g., Find elderly diabetic patients with abnormal labs on multiple medications…",
    )

    if query:
        with st.spinner("🤖 JARVIS is analyzing the database…"):
            time.sleep(0.3)  # tiny theatrical pause
            response = jarvis.query(query)
            results = jarvis.search_patients(query, max_results=10)

        col_a, col_b = st.columns([1.2, 1])
        with col_a:
            st.markdown('<div class="section-h">💬 JARVIS Response</div>', unsafe_allow_html=True)
            st.code(response, language="text")

            # ── 🌍 Multilingual voice output ─────────────────────────
            if VOICE_AVAILABLE:
                st.markdown('<div class="section-h">🔊 Listen in your language</div>', unsafe_allow_html=True)
                vcol1, vcol2, vcol3, vcol4 = st.columns([2, 1, 1, 1])
                with vcol1:
                    lang_choice = st.selectbox(
                        "Language",
                        list(SUPPORTED_LANGUAGES.keys()),
                        index=0,
                        key="jarvis_lang",
                        label_visibility="collapsed",
                    )
                with vcol2:
                    slow_speech = st.toggle("🐢 Slow", value=False, key="jarvis_slow")
                with vcol3:
                    offline_mode = st.toggle("📴 Offline", value=False, key="jarvis_offline",
                                             help="Use local Windows voice (English only). Bypasses corporate proxy entirely.")
                with vcol4:
                    speak_clicked = st.button("🔊 Speak", key="jarvis_speak", width="stretch", type="primary")

                # Corporate-network escape hatch
                trust_corp = st.checkbox(
                    "🔓 Trust corporate network (skip SSL verify — fixes Zscaler cert errors)",
                    value=False,
                    key="jarvis_trust",
                    help="Disables certificate verification for the Google translate/TTS calls. "
                         "Safe here because no PHI is sent. Not for production use.",
                )

                summary_only = st.checkbox(
                    "⚡ Speak summary only (fast — first 4 lines, avoids proxy throttling)",
                    value=True,
                    key="jarvis_summary",
                    help="Voices just the top lines instead of the whole response. "
                         "Strongly recommended on corporate networks — keeps the request "
                         "URL short so Zscaler doesn't throttle it.",
                )

                if speak_clicked:
                    speak_text = summarize_for_speech(response) if summary_only else response
                    t0 = time.time()
                    try:
                        with st.spinner(
                            f"🗣️ {'Synthesizing locally' if offline_mode else 'Translating & synthesizing'} in {lang_choice}… "
                            f"(≈ {3 if offline_mode else 5}s)"
                        ):
                            audio_bytes, translated_text, mime = speak(
                                speak_text, lang_choice,
                                slow=slow_speech,
                                offline=offline_mode,
                                trust_corporate=trust_corp,
                            )
                        elapsed = time.time() - t0
                        st.audio(audio_bytes, format=mime, autoplay=True)
                        st.caption(f"✅ Generated in {elapsed:.1f}s · {len(audio_bytes)/1024:.0f} KB audio")
                        if (not offline_mode) and lang_choice != "🇺🇸 English":
                            with st.expander(f"📝 Translated text ({lang_choice})", expanded=False):
                                st.write(translated_text)
                        if offline_mode and lang_choice != "🇺🇸 English":
                            st.caption("ℹ️ Offline mode uses the local Windows voice (English). "
                                       "For true multilingual speech, turn Offline off.")
                    except Exception as e:
                        elapsed = time.time() - t0
                        msg = str(e)
                        st.error(f"⚠️ Voice generation failed after {elapsed:.1f}s: {msg[:300]}")
                        if "CERTIFICATE_VERIFY_FAILED" in msg or "SSL" in msg:
                            st.warning("🔐 SSL cert issue (typical on Hartford / Zscaler). "
                                        "Enable **🔓 Trust corporate network** above and click Speak again, "
                                        "or switch to **📴 Offline** mode.")
                        elif "timed out" in msg.lower() or "max retries" in msg.lower():
                            st.warning("⏱️ Network/proxy timeout. Enable **⚡ Speak summary only** and "
                                        "**🔓 Trust corporate network**, or switch to **📴 Offline** mode.")
                        else:
                            st.caption("💡 Tip: toggle **📴 Offline** on for a local Windows voice.")
            else:
                st.caption("🔇 Voice disabled — run `pip install gTTS deep-translator pyttsx3 truststore` to enable audio.")

        with col_b:
            st.markdown('<div class="section-h">📊 Match Insights</div>', unsafe_allow_html=True)
            kpi("Patients Matched", str(len(results)), "from full population", "teal")
            if results:
                avg_score = sum(r["score"] for r in results) / len(results)
                kpi("Avg Relevance", f"{avg_score:.2f}", "keyword + semantic", "indigo")

        if results:
            st.markdown('<div class="section-h">📋 Matched Patients</div>', unsafe_allow_html=True)
            rows = []
            for r in results:
                p = r["patient"]
                a = garma.assessments.get(p.patient_id)
                rows.append({
                    "ID": p.patient_id,
                    "Name": p.full_name,
                    "Age": p.age,
                    "Gender": p.gender,
                    "Risk": f"{RISK_EMOJI.get(a.risk_level.value, '⚪')} {a.risk_level.value}" if a else "—",
                    "Score": f"{a.overall_score:.0%}" if a else "—",
                    "Meds": len(p.active_medications),
                    "Dx": len(p.diagnoses),
                    "Relevance": round(r["score"], 2),
                    "Why": ", ".join(r["reasons"][:3]),
                })
            st.dataframe(pd.DataFrame(rows), width="stretch", hide_index=True)


# ═══════════════════════════════════════════════════════════
# PAGE: GARMA
# ═══════════════════════════════════════════════════════════
elif page.startswith("🛡️"):
    st.markdown(
        """
        <div class="hero">
          <div class="hero-title">🛡️ GARMA</div>
          <div class="hero-sub">GenAI Risk Mitigation Advisor — drug interactions, ML risk scoring, anomalies, and actionable recommendations.</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Patient selector — sorted by risk descending
    sorted_p = sorted(
        patients,
        key=lambda p: garma.assessments.get(p.patient_id).overall_score if garma.assessments.get(p.patient_id) else 0,
        reverse=True,
    )
    options = {f"{RISK_EMOJI.get(garma.assessments[p.patient_id].risk_level.value, '⚪')} "
               f"{p.full_name} — {garma.assessments[p.patient_id].overall_score:.0%} ({p.patient_id})": p.patient_id
               for p in sorted_p if p.patient_id in garma.assessments}

    label = st.selectbox("👤 Select a patient (sorted highest risk first):", list(options.keys()))
    pid = options[label]
    assessment = garma.assessments[pid]
    patient = get_patient(pid)

    # Top row: gauge + KPIs
    g1, g2 = st.columns([1, 2])
    with g1:
        st.plotly_chart(risk_gauge(assessment.overall_score, "GARMA Risk"), width="stretch")
    with g2:
        k1, k2, k3, k4 = st.columns(4)
        with k1: kpi("Risk Level", f"{RISK_EMOJI[assessment.risk_level.value]} {assessment.risk_level.value}",
                     "composite", "purple" if assessment.risk_level.value == "CRITICAL" else "orange")
        with k2: kpi("Interactions", f"{len(assessment.drug_interactions)}", "drug-drug", "yellow")
        with k3: kpi("Anomalies", f"{len(assessment.anomalies)}", "flagged", "indigo")
        with k4: kpi("Recommendations", f"{len(assessment.recommendations)}", "actionable", "teal")

        k5, k6, k7, k8 = st.columns(4)
        with k5: kpi("Age", f"{patient.age}", patient.gender, "teal")
        with k6: kpi("Active Meds", f"{len(patient.active_medications)}", f"of {len(patient.medications)} total", "indigo")
        with k7: kpi("Diagnoses", f"{len(patient.diagnoses)}", f"{len(patient.chronic_conditions)} chronic", "orange")
        with k8: kpi("Compliance", f"{len(assessment.compliance_violations)}", "violations", "green")

    st.markdown('<div class="divider-soft"></div>', unsafe_allow_html=True)

    # Radar + factor bar side-by-side
    r1, r2 = st.columns(2)
    with r1:
        st.markdown('<div class="section-h">🎯 Risk Factor Radar</div>', unsafe_allow_html=True)
        st.plotly_chart(risk_radar(assessment), width="stretch")
    with r2:
        st.markdown('<div class="section-h">📊 Risk Factor Breakdown</div>', unsafe_allow_html=True)
        factors_df = pd.DataFrame([
            {"Factor": k.replace("_", " ").title(), "Score": v}
            for k, v in assessment.risk_factors.items()
        ]).sort_values("Score")
        fig = px.bar(factors_df, x="Score", y="Factor", orientation="h",
                     color="Score", color_continuous_scale="Turbo", range_x=[0, 1])
        fig.update_layout(height=340, margin=dict(t=10, b=10), coloraxis_showscale=False)
        st.plotly_chart(styled_plotly(fig), width="stretch")

    # Alerts + anomalies + recommendations
    if assessment.drug_interactions:
        st.markdown('<div class="section-h">💊 Drug Interactions</div>', unsafe_allow_html=True)
        for di in assessment.drug_interactions:
            cls = {"CRITICAL": "alert-critical", "HIGH": "alert-high", "MEDIUM": "alert-medium"}.get(di.severity, "alert-medium")
            st.markdown(
                f"""
                <div class="alert {cls}">
                  <div class="alert-title">{RISK_EMOJI.get(di.severity, '⚪')} {di.severity} · {di.drug_a} + {di.drug_b}</div>
                  <div class="alert-body">{di.description}<br/><i>↳ {di.recommendation}</i></div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    a1, a2 = st.columns(2)
    with a1:
        if assessment.anomalies:
            st.markdown('<div class="section-h">🔍 Anomalies</div>', unsafe_allow_html=True)
            for anom in assessment.anomalies:
                st.info(anom)
    with a2:
        if assessment.recommendations:
            st.markdown('<div class="section-h">✅ Clinical Recommendations</div>', unsafe_allow_html=True)
            for i, rec in enumerate(assessment.recommendations, 1):
                st.success(f"**{i}.** {rec}")

    with st.expander("📄 View Full GARMA Clinical Report"):
        st.code(garma.format_assessment_report(assessment), language="text")

    st.download_button(
        "⬇️ Download clinical report",
        garma.format_assessment_report(assessment),
        file_name=f"garma_report_{pid}.txt",
    )


# ═══════════════════════════════════════════════════════════
# PAGE: PATIENT EXPLORER
# ═══════════════════════════════════════════════════════════
elif page.startswith("📊"):
    st.markdown(
        """
        <div class="hero">
          <div class="hero-title">📊 Patient Explorer</div>
          <div class="hero-sub">Drill into individual patient records — demographics, medications, diagnoses, vitals, and labs.</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    options = {f"{p.full_name} · Age {p.age} · {p.patient_id}": p for p in patients}
    selected = st.selectbox("Select a patient:", list(options.keys()))
    patient = options[selected]

    c1, c2, c3, c4, c5 = st.columns(5)
    with c1: kpi("Age", str(patient.age), patient.gender, "teal")
    with c2: kpi("Blood Type", patient.blood_type or "—", "", "indigo")
    with c3: kpi("Active Meds", str(len(patient.active_medications)), f"of {len(patient.medications)}", "yellow")
    with c4: kpi("Diagnoses", str(len(patient.diagnoses)), f"{len(patient.chronic_conditions)} chronic", "orange")
    with c5: kpi("Allergies", str(len(patient.allergies)), "", "purple")

    st.markdown('<div class="divider-soft"></div>', unsafe_allow_html=True)

    tabs = st.tabs(["📋 Overview", "💊 Medications", "🩺 Diagnoses", "📈 Vitals", "🧪 Labs"])

    with tabs[0]:
        st.code(patient.to_clinical_summary(), language="text")

    with tabs[1]:
        if patient.medications:
            meds = pd.DataFrame([{
                "Medication": m.name, "Dosage": m.dosage, "Frequency": m.frequency,
                "Active": "✅" if m.is_active else "❌",
                "Prescriber": m.prescribing_doctor, "Start Date": m.start_date,
            } for m in patient.medications])
            st.dataframe(meds, width="stretch", hide_index=True)
        else:
            st.info("No medications on record.")

    with tabs[2]:
        if patient.diagnoses:
            dx = pd.DataFrame([{
                "Condition": d.condition, "ICD-10": d.icd10_code, "Severity": d.severity,
                "Chronic": "🔄" if d.is_chronic else "⚡", "Diagnosed": d.diagnosed_date,
            } for d in patient.diagnoses])
            st.dataframe(dx, width="stretch", hide_index=True)
        else:
            st.info("No diagnoses on record.")

    with tabs[3]:
        if patient.vitals_history:
            vdf = pd.DataFrame([{
                "Date": v.recorded_date,
                "Systolic": v.blood_pressure_systolic, "Diastolic": v.blood_pressure_diastolic,
                "Heart Rate": v.heart_rate, "Temp (°F)": v.temperature_f,
                "SpO2 (%)": v.oxygen_saturation, "BMI": v.bmi,
            } for v in patient.vitals_history])
            fig = go.Figure()
            fig.add_trace(go.Scatter(x=vdf["Date"], y=vdf["Systolic"], name="Systolic BP",
                                     mode="lines+markers", line=dict(color="#ef4444")))
            fig.add_trace(go.Scatter(x=vdf["Date"], y=vdf["Diastolic"], name="Diastolic BP",
                                     mode="lines+markers", line=dict(color="#f59e0b")))
            fig.add_trace(go.Scatter(x=vdf["Date"], y=vdf["Heart Rate"], name="Heart Rate",
                                     mode="lines+markers", line=dict(color="#00d9c0")))
            fig.update_layout(title="Vital Signs Trend", height=380, margin=dict(t=40, b=20))
            st.plotly_chart(styled_plotly(fig), width="stretch")
            st.dataframe(vdf, width="stretch", hide_index=True)
        else:
            st.info("No vitals on record.")

    with tabs[4]:
        if patient.lab_results:
            labs = pd.DataFrame([{
                "Test": lr.test_name, "Value": lr.value, "Unit": lr.unit,
                "Reference": lr.reference_range,
                "Status": "⚠️ Abnormal" if lr.is_abnormal else "✅ Normal",
                "Date": lr.test_date,
            } for lr in patient.lab_results])
            st.dataframe(labs, width="stretch", hide_index=True)
        else:
            st.info("No lab results on record.")


# ═══════════════════════════════════════════════════════════
# PAGE: ANALYTICS
# ═══════════════════════════════════════════════════════════
elif page.startswith("📈"):
    st.markdown(
        """
        <div class="hero">
          <div class="hero-title">📈 Population Analytics</div>
          <div class="hero-sub">Cohort-level insights across demographics, conditions, medications, and risk factors.</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    df = patients_to_df()

    c1, c2 = st.columns(2)
    with c1:
        st.markdown('<div class="section-h">👥 Age Distribution</div>', unsafe_allow_html=True)
        fig = px.histogram(df, x="Age", nbins=15, color_discrete_sequence=["#00d9c0"])
        fig.update_layout(height=320, margin=dict(t=10, b=10), bargap=0.05)
        st.plotly_chart(styled_plotly(fig), width="stretch")
    with c2:
        st.markdown('<div class="section-h">⚕️ Gender Split</div>', unsafe_allow_html=True)
        fig = px.pie(df, names="Gender", hole=0.55,
                     color_discrete_sequence=["#00d9c0", "#ff7ab6", "#7c7cff"])
        fig.update_traces(marker=dict(line=dict(color="#0b1220", width=2)))
        fig.update_layout(height=320, margin=dict(t=10, b=10),
                          legend=dict(orientation="h", yanchor="bottom", y=-0.2))
        st.plotly_chart(styled_plotly(fig), width="stretch")

    # Scatter: age vs risk with bubble=meds
    st.markdown('<div class="section-h">🎯 Risk Score vs Age (bubble = # medications)</div>', unsafe_allow_html=True)
    fig = px.scatter(
        df, x="Age", y="Risk Score", color="Risk Level", size="Active Meds",
        hover_data=["Name", "Drug Interactions", "Anomalies"],
        color_discrete_map=RISK_COLORS, size_max=28,
    )
    fig.add_hline(y=0.6, line_dash="dash", line_color="#f59e0b",
                  annotation_text="Medium threshold", annotation_position="right")
    fig.add_hline(y=0.8, line_dash="dash", line_color="#ef4444",
                  annotation_text="High threshold", annotation_position="right")
    fig.update_layout(height=460, margin=dict(t=10, b=10))
    st.plotly_chart(styled_plotly(fig), width="stretch")

    # Top conditions + top meds
    c3, c4 = st.columns(2)
    with c3:
        st.markdown('<div class="section-h">🏥 Top Conditions</div>', unsafe_allow_html=True)
        cc = {}
        for p in patients:
            for d in p.diagnoses:
                cc[d.condition] = cc.get(d.condition, 0) + 1
        cdf = pd.DataFrame([{"Condition": k, "Count": v}
                            for k, v in sorted(cc.items(), key=lambda x: x[1], reverse=True)[:10]])
        if not cdf.empty:
            fig = px.bar(cdf, x="Count", y="Condition", orientation="h",
                         color="Count", color_continuous_scale="Teal")
            fig.update_layout(height=400, margin=dict(t=10, b=10),
                              yaxis=dict(autorange="reversed"), coloraxis_showscale=False)
            st.plotly_chart(styled_plotly(fig), width="stretch")
    with c4:
        st.markdown('<div class="section-h">💊 Top Medications</div>', unsafe_allow_html=True)
        mc = {}
        for p in patients:
            for m in p.active_medications:
                mc[m.name] = mc.get(m.name, 0) + 1
        mdf = pd.DataFrame([{"Medication": k, "Count": v}
                            for k, v in sorted(mc.items(), key=lambda x: x[1], reverse=True)[:10]])
        if not mdf.empty:
            fig = px.bar(mdf, x="Count", y="Medication", orientation="h",
                         color="Count", color_continuous_scale="Purp")
            fig.update_layout(height=400, margin=dict(t=10, b=10),
                              yaxis=dict(autorange="reversed"), coloraxis_showscale=False)
            st.plotly_chart(styled_plotly(fig), width="stretch")

    # Risk-factor heatmap — top 20 riskiest patients × factors
    st.markdown('<div class="section-h">🔥 Risk-Factor Heatmap (Top 20 Patients)</div>', unsafe_allow_html=True)
    top20 = sorted(assessments, key=lambda a: a.overall_score, reverse=True)[:20]
    factor_names = list(top20[0].risk_factors.keys()) if top20 else []
    heat = []
    names = []
    for a in top20:
        names.append(a.patient_name)
        heat.append([a.risk_factors.get(f, 0) for f in factor_names])
    if heat:
        fig = go.Figure(data=go.Heatmap(
            z=heat,
            x=[f.replace("_", " ").title() for f in factor_names],
            y=names,
            colorscale="Turbo", zmin=0, zmax=1,
            colorbar=dict(title="Score"),
        ))
        fig.update_layout(height=560, margin=dict(t=10, b=10, l=10, r=10))
        st.plotly_chart(styled_plotly(fig), width="stretch")


# ═══════════════════════════════════════════════════════════
# PAGE: ABOUT
# ═══════════════════════════════════════════════════════════
elif page.startswith("ℹ️"):
    st.markdown(
        """
        <div class="hero">
          <div class="hero-title">About MedGuard AI</div>
          <div class="hero-sub">
            An end-to-end, locally-run platform that combines natural-language querying,
            clinical risk scoring, drug-interaction detection, and semantic search.
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    c1, c2, c3 = st.columns(3)
    with c1:
        st.markdown(
            """
            <div class="kpi kpi-accent-teal">
              <div class="kpi-label">🤖 JARVIS</div>
              <div class="kpi-value" style="font-size:1.3rem;">AI-Augmented Querying</div>
              <div class="kpi-hint">Smart keyword + clinical-category matching with relevance scoring. No API key required.</div>
            </div>
            """, unsafe_allow_html=True)
    with c2:
        st.markdown(
            """
            <div class="kpi kpi-accent-purple">
              <div class="kpi-label">🛡️ GARMA</div>
              <div class="kpi-value" style="font-size:1.3rem;">Risk Mitigation</div>
              <div class="kpi-hint">Drug-drug interactions, compliance rules, ML-style weighted risk scoring, anomaly detection.</div>
            </div>
            """, unsafe_allow_html=True)
    with c3:
        st.markdown(
            """
            <div class="kpi kpi-accent-indigo">
              <div class="kpi-label">📊 NotebookLM</div>
              <div class="kpi-value" style="font-size:1.3rem;">Semantic Search</div>
              <div class="kpi-hint">Sentence-transformer embeddings + FAISS vector store over chunked clinical summaries.</div>
            </div>
            """, unsafe_allow_html=True)

    st.markdown('<div class="divider-soft"></div>', unsafe_allow_html=True)
    st.markdown(
        """
        ### 🧱 Architecture
        ```
        User Query ──► 🤖 JARVIS  ──► 📊 NotebookLM (RAG) ──► 🛡️ GARMA ──► 📈 Dashboard
        ```
        **Tech stack:** Python · Pydantic · Streamlit · Plotly · sentence-transformers · FAISS

        **Data:** 50 synthetic FHIR-inspired patient records with demographics, medications,
        diagnoses, vitals history, and lab results. Includes intentional dangerous drug
        combinations so GARMA has something to flag.
        """
    )
