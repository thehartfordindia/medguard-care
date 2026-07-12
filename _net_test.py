import socket, time, urllib.request, ssl
socket.setdefaulttimeout(6)

try:
    import truststore
    truststore.inject_into_ssl()
    print("truststore: ACTIVE")
except Exception as e:
    print("truststore failed:", e)

for url in ["https://translate.google.com/",
            "https://translate.googleapis.com/",
            "https://www.google.com/"]:
    t = time.time()
    try:
        r = urllib.request.urlopen(url, timeout=6)
        print(f"OK   {url}  {r.status}  {time.time()-t:.2f}s")
    except Exception as e:
        print(f"FAIL {url}  {type(e).__name__}: {str(e)[:160]}  {time.time()-t:.2f}s")
