"""쌤! 여기요! 빌드: 글꼴을 필요한 글자만 잘라 넣고 한 파일 HTML로 묶음.

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

# 공개 주소 (링크 미리보기 그림은 절대 주소여야 함). 저장소 이름을 바꾸면 여기도 바꿈
SITE = "https://sseongilk.github.io/ssam-yeogiyo/"
DESC = "콜벨 울리는 밤 근무, 원하는 걸 골라 가져다주고 진상은 연타로 날려 버리기! 아침 7시 퇴근까지 버텨요."
HEAD = (
    '<meta name="description" content="' + DESC + '">'
    '<meta property="og:type" content="website">'
    '<meta property="og:title" content="쌤! 여기요! - 콜벨 팡팡">'
    '<meta property="og:description" content="' + DESC + '">'
    '<meta property="og:image" content="' + SITE + 'og.png">'
    '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
    '<meta property="og:url" content="' + SITE + '">'
    '<meta name="twitter:card" content="summary_large_image">'
    '<meta name="theme-color" content="#28305a">'
    '<link rel="manifest" href="manifest.webmanifest">'
    '<link rel="icon" type="image/png" href="icon-192.png">'
    '<link rel="apple-touch-icon" href="apple-touch-icon.png">'
    '<meta name="mobile-web-app-capable" content="yes">'
    '<meta name="apple-mobile-web-app-capable" content="yes">'
    '<meta name="apple-mobile-web-app-title" content="쌤! 여기요!">'
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
)

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
            + HEAD +
            "</head><body>" + body + "</body></html>"
        )

    with open(os.path.join(DIST, "play.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(wrap(web_html))
    docs = os.path.join(ROOT, "docs")
    os.makedirs(docs, exist_ok=True)
    with open(os.path.join(docs, "index.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(wrap(web_html))
    print(f"index.html: {len(html.encode('utf-8')) / 1024:.0f} KB")
    # 아이콘·링크 미리보기 그림·manifest를 게시 폴더에 복사
    import shutil
    assets = os.path.join(ROOT, "assets")
    if os.path.isdir(assets):
        for name in os.listdir(assets):
            for dst in (DIST, docs):
                shutil.copyfile(os.path.join(assets, name), os.path.join(dst, name))


if __name__ == "__main__":
    main()
