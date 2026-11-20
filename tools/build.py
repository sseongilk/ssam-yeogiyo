"""나이트 생존기 빌드: 글꼴을 필요한 글자만 잘라 넣고 한 파일 HTML로 묶음.

결과
  dist/index.html : Artifact 게시용 (doctype/head 없이 본문만)
  dist/play.html  : PC에서 바로 여는 확인용
  docs/index.html : GitHub Pages 공개용 (supabase.json이 있으면 공용 랭킹 사용)
"""
import json
import base64
import io
import os
import re

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
FONTS = os.path.join(ROOT, "fonts")
DIST = os.path.join(ROOT, "dist")


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def ksx1001_hangul():
    """자주 쓰는 한글 2,350자 (이름 입력용)"""
    out = []
    for b1 in range(0xB0, 0xC9):
        for b2 in range(0xA1, 0xFF):
            try:
                out.append(bytes([b1, b2]).decode("euc-kr"))
            except UnicodeDecodeError:
                pass
    return "".join(out)


def subset_woff(path, text):
    font = TTFont(path)
    opts = subset.Options()
    opts.flavor = "woff"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    buf = io.BytesIO()
    font.flavor = "woff"
    font.save(buf)
    return buf.getvalue()


def main():
    game = read(os.path.join(SRC, "game.js"))
    net_path = os.path.join(ROOT, "supabase.json")
    net = None
    if os.path.exists(net_path):
        cfg = json.loads(read(net_path))
        if cfg.get("url") and cfg.get("key"):
            net = {"url": cfg["url"], "key": cfg["key"]}
    web_game = game.replace("/*NET*/null", json.dumps(net) if net else "null")
    print("공용 랭킹(Supabase):", "사용" if net else "없음 (이 기기 랭킹)")
    page = read(os.path.join(SRC, "page.html"))

    ascii_chars = "".join(chr(c) for c in range(32, 127))
    used = "".join(sorted(set(re.sub(r"[\x00-\x7f]", "", game + page))))
    base = ascii_chars + used + "…·◀▶"

    plan = [
        ("Galmuri11B", "Galmuri11-Bold.ttf", base),
        ("Galmuri9", "Galmuri9.ttf", base + ksx1001_hangul()),
        ("Galmuri7", "Galmuri7.ttf", base + ksx1001_hangul()),
    ]
    faces = []
    for family, file, text in plan:
        data = subset_woff(os.path.join(FONTS, file), text)
        b64 = base64.b64encode(data).decode("ascii")
        faces.append(
            f"@font-face{{font-family:'{family}';src:url(data:font/woff;base64,{b64}) format('woff');"
            f"font-display:block;}}"
        )
        print(f"{family}: {len(data) / 1024:.0f} KB")

    fonts_css = "\n".join(faces)
    html = page.replace("/*FONTS*/", fonts_css).replace("/*GAME*/", game)
    web_html = page.replace("/*FONTS*/", fonts_css).replace("/*GAME*/", web_game)
    os.makedirs(DIST, exist_ok=True)
    with open(os.path.join(DIST, "index.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(html)

    def wrap(body):
        return (
            "<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\">"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">"
            "</head><body>" + body + "</body></html>"
        )

    with open(os.path.join(DIST, "play.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(wrap(web_html))
    docs = os.path.join(ROOT, "docs")
    os.makedirs(docs, exist_ok=True)
    with open(os.path.join(docs, "index.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(wrap(web_html))
    print(f"index.html: {len(html.encode('utf-8')) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
