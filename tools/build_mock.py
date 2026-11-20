"""시안 빌드: 글꼴을 필요한 글자만 잘라 넣고 dist/mock.html 한 파일로 묶음."""
import base64, io, os, re
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
read = lambda p: open(p, encoding="utf-8").read()

def woff(path, text):
    font = TTFont(path)
    o = subset.Options(); o.flavor = "woff"; o.layout_features = ["*"]; o.notdef_outline = True
    s = subset.Subsetter(o); s.populate(text=text); s.subset(font)
    buf = io.BytesIO(); font.flavor = "woff"; font.save(buf); return buf.getvalue()

js = read(os.path.join(ROOT, "src", "mock.js"))
page = read(os.path.join(ROOT, "src", "mock.html"))
text = "".join(chr(c) for c in range(32, 127)) + "".join(sorted(set(re.sub(r"[\x00-\x7f]", "", js + page)))) + "◀▶·"
faces = []
for fam, file in [("Galmuri11B", "Galmuri11-Bold.ttf"), ("Galmuri9", "Galmuri9.ttf"), ("Galmuri7", "Galmuri7.ttf")]:
    b64 = base64.b64encode(woff(os.path.join(ROOT, "fonts", file), text)).decode()
    faces.append(f"@font-face{{font-family:'{fam}';src:url(data:font/woff;base64,{b64}) format('woff');font-display:block;}}")
body = page.replace("/*FONTS*/", "\n".join(faces)).replace("/*GAME*/", js)
os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
html = ('<!doctype html><html lang="ko"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + body + "</body></html>")
open(os.path.join(ROOT, "dist", "mock.html"), "w", encoding="utf-8", newline="\n").write(html)
print("dist/mock.html", len(html) // 1024, "KB")
