"""Stamp every code file with a content hash so browsers can never run a stale copy.
Run before each deploy: python bump.py"""
import hashlib, os, re
here = os.path.dirname(os.path.abspath(__file__))
read = lambda f: open(os.path.join(here, f), encoding="utf-8").read()
write = lambda f, s: open(os.path.join(here, f), "w", encoding="utf-8").write(s)
h = lambda s: hashlib.sha1(re.sub(r"\?v=[0-9a-f]+", "", s).encode()).hexdigest()[:10]

audio = read("audio.js")
main = re.sub(r'from "\./audio\.js(\?v=[0-9a-f]+)?"', f'from "./audio.js?v={h(audio)}"', read("main.js"))
write("main.js", main)
html = read("index.html")
html = re.sub(r'href="style\.css(\?v=[0-9a-f]+)?"', f'href="style.css?v={h(read("style.css"))}"', html)
html = re.sub(r'src="main\.js(\?v=[0-9a-f]+)?"', f'src="main.js?v={h(main)}"', html)
write("index.html", html)
print("stamped", h(audio), h(main))
