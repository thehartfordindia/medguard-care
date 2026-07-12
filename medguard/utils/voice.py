"""
Multilingual voice helper for JARVIS.

Pipeline:
    English text  ──►  (optional) deep-translator  ──►  gTTS  ──►  MP3 bytes

Both libraries are free and require no API keys (they use Google's public
web endpoints, so an internet connection is required at demo time).

Corporate networks (e.g. Hartford's Zscaler) may block direct calls to
translate.google.com. Set the env vars HTTPS_PROXY / HTTP_PROXY before
launching Streamlit, or run the demo from a personal hotspot.
"""
from __future__ import annotations

import io
import os
import re
import socket
import ssl
from functools import lru_cache
from typing import Tuple


# Give network calls a sane timeout so the UI never hangs forever behind a proxy.
socket.setdefaulttimeout(10)


# ───────────────────────────────────────────────────────────
# Corporate SSL fix
# ───────────────────────────────────────────────────────────
# On Hartford (and most enterprise networks), Zscaler does SSL inspection and
# presents its own CA-signed cert. Python's bundled `certifi` root store doesn't
# know about it → "CERTIFICATE_VERIFY_FAILED". Solution: ask Python to use the
# OS certificate store (Windows Schannel), which HAS the corporate root because
# IT installed it. `truststore` does exactly that.
try:
    import truststore
    truststore.inject_into_ssl()
    _TRUSTSTORE_ACTIVE = True
except Exception:
    _TRUSTSTORE_ACTIVE = False


def _disable_ssl_verification() -> None:
    """Last-resort escape hatch when truststore isn't enough.
    Safe for public endpoints (translate.google.com) — NOT for PHI traffic.
    """
    try:
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    except Exception:
        pass
    # Patch the default SSL context so gTTS/requests skip cert verification.
    ssl._create_default_https_context = ssl._create_unverified_context  # type: ignore[attr-defined]
    os.environ["PYTHONHTTPSVERIFY"] = "0"
    os.environ["CURL_CA_BUNDLE"] = ""
    os.environ["REQUESTS_CA_BUNDLE"] = ""


# Display name -> (gTTS lang code, deep-translator lang code)
# deep-translator's GoogleTranslator uses ISO-639-1 codes; gTTS accepts the same
# for most languages. We keep them paired so we only expose validated choices.
SUPPORTED_LANGUAGES: dict[str, Tuple[str, str]] = {
    "🇺🇸 English":            ("en",     "en"),
    "🇮🇳 Hindi":              ("hi",     "hi"),
    "🇮🇳 Tamil":              ("ta",     "ta"),
    "🇮🇳 Telugu":             ("te",     "te"),
    "🇮🇳 Kannada":            ("kn",     "kn"),
    "🇮🇳 Malayalam":          ("ml",     "ml"),
    "🇮🇳 Bengali":            ("bn",     "bn"),
    "🇮🇳 Marathi":            ("mr",     "mr"),
    "🇮🇳 Gujarati":           ("gu",     "gu"),
    "🇪🇸 Spanish":            ("es",     "es"),
    "🇫🇷 French":             ("fr",     "fr"),
    "🇩🇪 German":             ("de",     "de"),
    "🇮🇹 Italian":            ("it",     "it"),
    "🇵🇹 Portuguese":         ("pt",     "pt"),
    "🇯🇵 Japanese":           ("ja",     "ja"),
    "🇨🇳 Chinese (Mandarin)": ("zh-CN",  "zh-CN"),
    "🇰🇷 Korean":             ("ko",     "ko"),
    "🇸🇦 Arabic":             ("ar",     "ar"),
    "🇷🇺 Russian":            ("ru",     "ru"),
}


# ───────────────────────────────────────────────────────────
# Text clean-up — strip emoji / markdown so TTS doesn't read "asterisk asterisk"
# ───────────────────────────────────────────────────────────
_EMOJI_RE = re.compile(
    "["                                   # noqa: E501
    "\U0001F300-\U0001FAFF"
    "\U0001F600-\U0001F64F"
    "\U0001F680-\U0001F6FF"
    "\u2600-\u27BF"
    "\u2B00-\u2BFF"
    "]+",
    flags=re.UNICODE,
)


def clean_for_speech(text: str, max_chars: int = 500) -> str:
    """Strip emoji / markdown / box-drawing / URLs so the TTS voice sounds
    natural AND the request URL stays small enough for corporate proxies.

    Default max_chars is now 500 (was 1200) because gTTS sends text as a
    URL-encoded GET parameter — box-drawing and emoji blow up to 9+ chars each
    after UTF-8 + %XX encoding, which corporate proxies often rate-limit.
    """
    t = _EMOJI_RE.sub("", text)
    # strip markdown bullets, bold/italic, headers, code fences
    t = re.sub(r"[`*_#>]+", "", t)
    # drop ALL box-drawing / horizontal-rule characters outright (they blow up URLs)
    t = re.sub(r"[─═━╌╍╎╏┄┅┈┉│║\|]+", " ", t)
    # collapse runs of dashes / equals into a sentence break
    t = re.sub(r"[-=]{3,}", ". ", t)
    # strip URLs (don't make TTS read raw links)
    t = re.sub(r"https?://\S+", "", t)
    # collapse blank lines / whitespace
    t = re.sub(r"\n{2,}", ". ", t)
    t = re.sub(r"[ \t]+", " ", t)
    t = t.strip()
    if len(t) > max_chars:
        t = t[:max_chars].rsplit(" ", 1)[0] + "…"
    return t


def summarize_for_speech(text: str, max_lines: int = 4, max_chars: int = 400) -> str:
    """Take just the headline lines of a long JARVIS response so the voice
    summary stays under ~3 seconds. Keeps the first non-empty content lines,
    skipping separators and decorative headers.
    """
    lines = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        # Skip decorative separator lines
        if re.fullmatch(r"[─═━\-=_\s.]+", line):
            continue
        lines.append(line)
        if len(lines) >= max_lines:
            break
    summary = ". ".join(lines)
    return clean_for_speech(summary, max_chars=max_chars)


# ───────────────────────────────────────────────────────────
# Translation
# ───────────────────────────────────────────────────────────
@lru_cache(maxsize=256)
def translate_text(text: str, target_lang: str, source_lang: str = "en") -> str:
    """Translate text using deep-translator (free, no API key)."""
    if target_lang == source_lang or not text.strip():
        return text
    try:
        from deep_translator import GoogleTranslator

        # deep-translator has a ~5000-char limit per call — chunk if needed
        chunks = [text[i:i + 4500] for i in range(0, len(text), 4500)]
        translator = GoogleTranslator(source=source_lang, target=target_lang)
        return " ".join(translator.translate(c) for c in chunks if c.strip())
    except Exception as e:  # pragma: no cover - network failure path
        raise RuntimeError(
            f"Translation failed ({e}). "
            "Likely corporate SSL inspection. "
            "Enable the '🔓 Trust corporate network' toggle, or use 📴 Offline mode."
        ) from e


# ───────────────────────────────────────────────────────────
# Text-to-speech (online: gTTS + retries)
# ───────────────────────────────────────────────────────────
def _synthesize_gtts(text: str, lang_code: str, slow: bool, retries: int = 2) -> bytes:
    """Online TTS with simple retry/backoff."""
    from gtts import gTTS
    import time as _time

    last_err: Exception | None = None
    for attempt in range(retries + 1):
        try:
            tts = gTTS(text=text, lang=lang_code, slow=slow)
            buf = io.BytesIO()
            tts.write_to_fp(buf)
            return buf.getvalue()
        except Exception as e:
            last_err = e
            if attempt < retries:
                _time.sleep(0.8 * (attempt + 1))
    raise RuntimeError(
        f"Google TTS unreachable after {retries + 1} attempts ({last_err}). "
        "Most likely corporate proxy/firewall blocking translate.google.com."
    )


# ───────────────────────────────────────────────────────────
# Text-to-speech (offline fallback: Windows SAPI via pyttsx3)
# ───────────────────────────────────────────────────────────
def _synthesize_offline(text: str, slow: bool = False) -> bytes:
    """Offline English-only fallback using Windows SAPI. Works behind any firewall."""
    try:
        import pyttsx3
        import tempfile
    except ImportError as e:
        raise RuntimeError(
            "Offline voice requires pyttsx3. Run: pip install pyttsx3"
        ) from e

    engine = pyttsx3.init()
    engine.setProperty("rate", 140 if slow else 180)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        wav_path = f.name
    try:
        engine.save_to_file(text, wav_path)
        engine.runAndWait()
        with open(wav_path, "rb") as f:
            return f.read()
    finally:
        try:
            os.remove(wav_path)
        except Exception:
            pass


def synthesize_speech(text: str, lang_code: str = "en", slow: bool = False,
                       offline: bool = False) -> bytes:
    """Return MP3/WAV bytes for the given text in the given language."""
    cleaned = clean_for_speech(text)
    if not cleaned:
        cleaned = "No response available."
    if offline:
        return _synthesize_offline(cleaned, slow=slow)
    return _synthesize_gtts(cleaned, lang_code=lang_code, slow=slow)


def speak(text: str, language_display_name: str = "🇺🇸 English",
          slow: bool = False, offline: bool = False,
          trust_corporate: bool = False) -> Tuple[bytes, str, str]:
    """
    High-level helper: translate (if needed) and synthesize.

    Parameters
    ----------
    trust_corporate : bool
        If True, disables SSL certificate verification to work behind
        Zscaler-style HTTPS inspection. Only safe for public endpoints.

    Returns
    -------
    (audio_bytes, translated_text, audio_mime)
        audio_mime is "audio/wav" for offline, "audio/mp3" for online.
    """
    if language_display_name not in SUPPORTED_LANGUAGES:
        language_display_name = "🇺🇸 English"
    tts_lang, tr_lang = SUPPORTED_LANGUAGES[language_display_name]

    if offline:
        # Offline SAPI is English-only — warn if user picked another language
        audio = synthesize_speech(text, lang_code="en", slow=slow, offline=True)
        return audio, text, "audio/wav"

    if trust_corporate:
        _disable_ssl_verification()
        # bust the translation cache so we retry with new SSL context
        translate_text.cache_clear()

    translated = translate_text(text, target_lang=tr_lang, source_lang="en")
    audio = synthesize_speech(translated, lang_code=tts_lang, slow=slow, offline=False)
    return audio, translated, "audio/mp3"
