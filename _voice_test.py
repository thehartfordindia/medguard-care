import sys, time, io
sys.path.insert(0, r"c:\Users\AY11338\OneDrive - The Hartford\Desktop\Work DetailsARON\AI ML DS\MedGuard_AI")
from medguard.utils.voice import translate_text, _synthesize_gtts, _TRUSTSTORE_ACTIVE
print("truststore:", _TRUSTSTORE_ACTIVE)

t=time.time()
out = translate_text("Hello, this is JARVIS speaking.", "te", "en")
print(f"translate  {time.time()-t:.2f}s  ->  {out!r}")

t=time.time()
mp3 = _synthesize_gtts("Hello world from the test", "en", False, retries=1)
print(f"gTTS en    {time.time()-t:.2f}s  bytes={len(mp3)}")

t=time.time()
mp3 = _synthesize_gtts(out, "te", False, retries=1)
print(f"gTTS te    {time.time()-t:.2f}s  bytes={len(mp3)}")
