"""정교한 도트 시안 (256x448, 지금의 2배 해상도). 결과: dist/mock_hd.png

왼쪽: 지금 게임 화면 / 가운데: 정교한 게임 화면 / 오른쪽: 정교한 캐릭터 모음
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 256, 448

PAL = {
    'O': (62, 46, 82), 'o': (120, 100, 140), 'K': (40, 28, 52), 'W': (255, 255, 255),
    'h': (122, 80, 62), 'k': (86, 54, 44), 'j': (168, 116, 88),
    'F': (255, 226, 206), 'f': (240, 190, 168), 'P': (255, 150, 172), 'p': (222, 100, 134),
    'E': (90, 130, 210), 'r': (206, 84, 104), 'R': (255, 104, 110),
    'q': (150, 214, 236), 'Q': (96, 170, 210), 'w': (214, 242, 252), 'n': (70, 128, 178),
    'B': (80, 140, 205), 'Y': (255, 222, 120), 'y': (236, 176, 76), 'G': (228, 232, 242), 'g': (176, 184, 206),
    'L': (196, 176, 250), 'l': (150, 128, 210), 'v': (228, 220, 255),
    'Z': (196, 124, 84), 'z': (150, 90, 62), 'd': (60, 66, 96),
    'M': (130, 220, 180), 'm': (70, 170, 140), 'S': (126, 196, 240), 'N': (40, 48, 92), 'X': (255, 240, 150),
    'c': (255, 246, 232), 'C': (238, 222, 204),
}

# 간호사 24x34 (올림머리, 분홍 머리끈, 눈 반짝임, 명찰, 펜)
NURSE = [
    "..........OOOO..........",
    ".........OjhhkO.........",
    ".........OhhhkO.........",
    "........OPPpPPO.........",
    "......OOOhhhhkOOO.......",
    ".....OjjhhhhhhhhkO......",
    "....OjhhhhhhhhhhhkO.....",
    "...OjhhhhhhhhhhhhhkO....",
    "..OjhhhhhhhhhhhhhhhkO...",
    "..OhhhhhhhhhhhhFFhhhkO..",
    "..OhhhhhhhhFFFFFFFhhkO..",
    "..OhhhhhFFFFFFFFFFFhkO..",
    "..OhhkFFFFFFFFFFFFFFhO..",
    "..OhFFFKKKFFFFKKKFFFhO..",
    "..OhFFFKWKFFFFKWKFFFhO..",
    "..OhFFFKEKFFFFKEKFFFhO..",
    "..OhFFFKKKFFFFKKKFFFhO..",
    "..OhFPPFFFFrrFFFFPPFhO..",
    "...OfFFFFFFFFFFFFFfO....",
    "....OOfFFFFFFFFFfOO.....",
    "......OOOfFFFFfOOO......",
    "....OOqqqOFFFFOqqqOO....",
    "...OwqqqqqOFFOqqqqqqO...",
    "..OqOwqqqqqOOqqqqqqOqO..",
    "..OqOwqqqqqqqqqWBWQOqO..",
    "..OqOwqqqqqqqqqWWWQOqO..",
    "..OqOqOYOOqqqqqqqqQOqO..",
    "..OqOqOqqOqqqqqqqqQOqO..",
    "..OFOQQQQQQQQQQQQQnOFO..",
    "...OOQQQQQQQOQQQQQnOO...",
    "....OQQQQQnO..OQQQQnO...",
    "....OQQQQQnO..OQQQQnO...",
    "....OWWWWWWO..OWWWWWO...",
    "....OOOOOOOO..OOOOOOO...",
]
NURSE_OLD = [
    '......OOOO......', '.....OhhhhO.....', '...OOOPPPPOOO...', '..OhhhhhhhhhhO..', '.OhhhhhhhhhhhhO.',
    '.OhhhhhhhFFhhhO.', '.OhhhhFFFFFFFhO.', '.OhhFKFFFFKFFhO.', '.OhhFKFFFFKFFhO.', '..OFPPFFFFPPFO..',
    '..OFFFFOOFFFFO..', '...OOFFFFFFOO...', '....OOqFFqOO....', '..OOqqqFFqqqOO..', '.OqOqqqqqqWWOqO.',
    '.OqOqqqqqqWBOqO.', '.OqOqqqqqqqqOqO.', '.OFOQQQQQQQQOFO.', '..OOQQQQOQQQOO..', '...OQQQO.OQQQO..',
    '...OWWWO.OWWWO..', '...OOOOO.OOOOO..',
]
# 환자 얼굴 16x12 (베개 위)
def patient(hair='h', shade='k', mood='sleep'):
    eyes = {"sleep": "OFFOOOFFFFOOOFFO", "pain": "OFFKKFFFFFFKKFFO", "happy": "OFFOKOFFFFOKOFFO"}[mood]
    mouth = {"sleep": "OFFFFFFFFFFFFFFO", "pain": "OFFFFFOOOOFFFFFO", "happy": "OFFFFFOrrOFFFFFO"}[mood]
    rows = [
        "....OOOOOOOO....", "..OOhhhhhhhhOO..", ".OjhhhhhhhhhhkO.", ".OhhhhhhhhhhhkO.",
        "OhhFFFFFFFFFFhkO", "OhFFFFFFFFFFFFhO", eyes, "OFPPFFFFFFFFPPFO", mouth,
        ".OfFFFFFFFFFFfO.", "..OOffffffffOO..", "....OOOOOOOO....",
    ]
    return [r.replace('h', hair).replace('k', shade) for r in rows]


class Grid:
    """작은 픽셀 그림: 색으로 모양을 칠한 뒤 바깥 테두리를 자동으로 그림"""
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.a = [['.'] * w for _ in range(h)]
    def px(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h: self.a[y][x] = c
    def rect(self, x, y, w, h, c):
        for j in range(y, y + h):
            for i in range(x, x + w): self.px(i, j, c)
    def ellipse(self, cx, cy, rx, ry, c, shade=None):
        for j in range(self.h):
            for i in range(self.w):
                d = ((i - cx) / rx) ** 2 + ((j - cy) / ry) ** 2
                if d <= 1.0:
                    self.px(i, j, shade if shade and (i - cx) / rx + (j - cy) / ry > 0.9 else c)
    def outline(self, c='O'):
        out = [r[:] for r in self.a]
        for j in range(self.h):
            for i in range(self.w):
                if self.a[j][i] != '.': continue
                for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ii, jj = i + a, j + b
                    if 0 <= ii < self.w and 0 <= jj < self.h and self.a[jj][ii] not in '.' + c:
                        out[j][i] = c; break
        self.a = out
    def rows(self):
        return [''.join(r) for r in self.a]


def karen():
    g = Grid(32, 40)
    # 몸 (가디건 + 블라우스), 다리
    g.rect(9, 24, 14, 10, 'Z'); g.rect(19, 24, 4, 10, 'z')
    g.rect(14, 24, 4, 6, 'W'); g.px(15, 30, 'W'); g.px(16, 30, 'W')
    g.rect(10, 34, 5, 4, 'd'); g.rect(17, 34, 5, 4, 'd')
    # 왼팔 (허리에 손), 오른팔 (삿대질)
    g.rect(6, 25, 3, 6, 'Z'); g.rect(6, 31, 3, 2, 'F')
    g.rect(23, 22, 3, 5, 'Z'); g.rect(25, 18, 3, 5, 'Z'); g.rect(26, 14, 2, 4, 'F'); g.px(27, 12, 'F'); g.px(27, 13, 'F')
    # 얼굴
    g.ellipse(15.5, 15, 7.5, 8, 'F', 'f')
    # 뽀글 파마 (작은 동그라미들)
    for cx, cy in [(9, 9), (13, 6), (18, 6), (22, 9), (7, 14), (24, 14), (8, 19), (23, 19), (11, 5), (20, 5), (15.5, 5)]:
        g.ellipse(cx, cy, 2.6, 2.6, 'L', 'l')
        g.px(int(cx) - 1, int(cy) - 1, 'v')
    g.outline()
    # 표정: 치켜뜬 눈썹, 작은 눈, 소리치는 입, 빨간 볼
    for i in range(3): g.px(10 + i, 12 + i // 2, 'K'); g.px(21 - i, 12 + i // 2, 'K')
    g.rect(11, 15, 2, 2, 'K'); g.rect(19, 15, 2, 2, 'K')
    g.rect(9, 18, 3, 1, 'R'); g.rect(20, 18, 3, 1, 'R')
    g.ellipse(15.5, 20.5, 3, 2.2, 'r'); g.rect(14, 19, 4, 1, 'W'); g.rect(13, 20, 1, 2, 'O'); g.rect(18, 20, 1, 2, 'O')
    return g.rows()


def blit(img, x, y, rows, scale=1):
    for j, r in enumerate(rows):
        for i, c in enumerate(r):
            if c != '.':
                col = PAL[c]
                for b in range(scale):
                    for a in range(scale):
                        img.putpixel((x + i * scale + a, y + j * scale + b), col)


def rrect(d, x, y, w, h, fill, edge='O', shadow=None):
    if shadow: d.rounded_rectangle([x, y + 3, x + w - 1, y + h + 2], radius=4, fill=PAL[shadow], outline=PAL[edge])
    d.rounded_rectangle([x, y, x + w - 1, y + h - 1], radius=4, fill=PAL[fill], outline=PAL[edge])


def main():
    S = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist')
    fb = ImageFont.truetype(os.path.join(ROOT, 'fonts', 'Galmuri11-Bold.ttf'), 12)
    fm = ImageFont.truetype(os.path.join(ROOT, 'fonts', 'Galmuri9.ttf'), 10)
    fs = ImageFont.truetype(os.path.join(ROOT, 'fonts', 'Galmuri7.ttf'), 8)

    # ---------- 가운데: 정교한 게임 화면 ----------
    img = Image.new('RGB', (W, H), PAL['W'])
    d = ImageDraw.Draw(img); d.fontmode = '1'
    # 벽과 바닥 (타일에 줄눈)
    d.rectangle([0, 0, W, 80], fill=(238, 246, 250))
    for y in range(80, H, 16):
        for x in range(0, W, 16):
            d.rectangle([x, y, x + 15, y + 15], fill=(222, 240, 236) if (x + y) // 16 % 2 else (210, 232, 228))
            d.line([x, y + 15, x + 15, y + 15], fill=(196, 222, 216))
    d.rectangle([0, 76, W, 80], fill=(200, 222, 230))
    # 위: 시각·점수·체력
    rrect(d, 6, 6, 92, 26, 'N'); d.text((14, 11), '☾ 02:14', font=fb, fill=PAL['X'])
    rrect(d, 104, 6, 146, 26, 'W', shadow='C'); d.text((112, 11), '★ 8,240', font=fb, fill=PAL['O'])
    rrect(d, 26, 40, 168, 12, 'C'); rrect(d, 26, 40, 110, 12, 'M'); d.line([30, 43, 130, 43], fill=PAL['W'])
    rrect(d, 204, 38, 44, 16, 'W', shadow='C'); d.rectangle([220, 42, 222, 50], fill=PAL['O']); d.rectangle([228, 42, 230, 50], fill=PAL['O'])
    # 창문 두 개 (밤하늘, 별, 달, 커튼)
    for wx in (10, 178):
        rrect(d, wx, 60, 68, 30, 'N')
        for i in range(6): d.point((wx + 8 + i * 9, 66 + (i * 7) % 18), fill=PAL['W'])
        d.rectangle([wx + 2, 61, wx + 8, 88], fill=PAL['P']); d.rectangle([wx + 60, 61, wx + 66, 88], fill=PAL['P'])
    d.ellipse([224, 66, 236, 78], fill=PAL['X']); d.ellipse([228, 64, 240, 76], fill=PAL['N'])
    rrect(d, 96, 64, 64, 20, 'Y', shadow='y'); d.text((106, 68), '콤보 x12', font=fb, fill=PAL['O'])
    # 침대 6개: 머리판, 매트리스, 베개, 이불 주름, 링거대
    beds = [(14, 128, 'pain'), (170, 128, 'sleep'), (14, 220, 'happy'), (170, 220, 'pain'), (14, 312, 'sleep'), (170, 312, 'sleep')]
    hairs = [('h', 'k'), ('g', 'o'), ('d', 'K'), ('y', 'Z'), ('h', 'k'), ('o', 'O')]
    for n, (bx, by, mood) in enumerate(beds):
        d.rectangle([bx + 66, by - 30, bx + 67, by + 30], fill=PAL['g'])           # 링거대
        rrect(d, bx + 60, by - 34, 14, 18, 'w', edge='B'); d.rectangle([bx + 63, by - 26, bx + 70, by - 19], fill=PAL['S'])
        rrect(d, bx, by, 68, 16, 'g', shadow='o')                                   # 머리판
        rrect(d, bx + 2, by + 10, 64, 46, 'W')                                      # 매트리스
        rrect(d, bx + 16, by + 12, 36, 16, 'G', edge='g')                           # 베개
        blit(img, bx + 26, by + 14, patient(*hairs[n], mood=mood))
        rrect(d, bx + 2, by + 30, 64, 26, 'q')                                      # 이불
        d.rectangle([bx + 4, by + 32, bx + 63, by + 35], fill=PAL['w'])
        for i in range(3): d.line([bx + 12 + i * 18, by + 40, bx + 18 + i * 18, by + 50], fill=PAL['Q'])
        d.text((bx + 26, by + 42), '70' + str(n + 1), font=fs, fill=PAL['B'])
        if mood == 'sleep': d.text((bx + 52, by - 6), 'z', font=fb, fill=PAL['o'])
    # 말풍선
    def bubble(x, y, icon, urgent=False):
        rrect(d, x, y, 30, 26, 'R' if urgent else 'W')
        d.polygon([(x + 6, y + 25), (x + 14, y + 25), (x + 8, y + 31)], fill=PAL['R' if urgent else 'W'], outline=PAL['O'])
        blit(img, x + 7, y + 5, icon)
    DROP = ["...OO...", "..OSSO..", ".OSSSSO.", "OSSWSSSO", "OSWSSSSO", "OSSSSSSO", ".OSSSSO.", "..OOOO.."]
    PILL = ["..OOOO..", ".OPPPPO.", ".OPWPPO.", ".OPPPPO.", ".OOOOOO.", ".OWWWWO.", ".OWWWWO.", "..OOOO.."]
    CUP = ["OOOOOOO..", "OSSSSSOOO", "OWSSSSO.O", "OSSSSSO.O", "OSSSSSOOO", ".OSSSO...", "..OOO...."]
    ANGRY = ["O..O..O..", "........", "OOOO.OOOO", "........", "..ORRRO.", ".ORRRRRO", "..OOOOO."]
    bubble(48, 92, PILL); bubble(206, 184, ANGRY, True); bubble(48, 184, DROP); bubble(206, 276, CUP)
    d.text((22, 98), '팡!', font=fb, fill=PAL['Y'], stroke_width=1, stroke_fill=PAL['O'])
    # 간호사 (가운데 복도) + 머리 위 수액
    blit(img, 116, 198, NURSE)
    blit(img, 124, 186, DROP)
    # 커피
    blit(img, 120, 300, ["..O.O....", ".O.O.....", ".........", "OOOOOOO..", "OWWWWWOOO", "OWZZZWO.O", "OWZZZWOOO", "OWWWWWO..", ".OOOOO..."])
    # 카트
    d.rectangle([0, 388, W, H], fill=PAL['g']); d.line([0, 388, W, 388], fill=PAL['O'])
    tools = [('수액', DROP), ('진통', PILL), ('물', CUP), ('담요', ["OOOOOOOO", "OLWLWLWO", "OWLWLWLO", "OLWLWLWO", "OOOOOOOO"]), ('도장', [".OOOO.", ".OZZO.", ".OZZO.", "OOOOOO", "ORRRRO", "OOOOOO"])]
    for i, (name, icon) in enumerate(tools):
        x = 8 + i * 49; on = i == 0
        rrect(d, x, 394 - (4 if on else 0), 44, 48, 'Y' if on else 'W', shadow='y' if on else 'C')
        blit(img, x + 22 - len(icon[0]), 400 - (4 if on else 0), icon, 2)
        d.text((x + 22, 428 - (4 if on else 0)), name, font=fm, fill=PAL['O'], anchor='mm')
    mid = img

    # ---------- 오른쪽: 캐릭터 모음 ----------
    img2 = Image.new('RGB', (W, H), PAL['c'])
    d2 = ImageDraw.Draw(img2); d2.fontmode = '1'
    for y in range(0, H, 16):
        for x in range(0, W, 16):
            if (x + y) // 16 % 2: d2.rectangle([x, y, x + 15, y + 15], fill=(250, 234, 214))
    def label(x, y, t, fill='S'):
        w = int(d2.textlength(t, font=fm)) + 12
        d2.rounded_rectangle([x - w // 2, y, x + w // 2, y + 15], radius=4, fill=PAL[fill], outline=PAL['O'])
        d2.text((x, y + 8), t, font=fm, fill=PAL['W'], anchor='mm')
    label(128, 8, '지금 16x22  →  정교 24x34')
    blit(img2, 30, 34, NURSE_OLD, 4)
    blit(img2, 132, 34, NURSE, 4)
    d2.text((62, 128), '지금', font=fm, fill=PAL['O'], anchor='mm'); d2.text((180, 182), '정교', font=fm, fill=PAL['O'], anchor='mm')
    label(64, 196, '환자', 'M')
    for i, (hz, mood) in enumerate([(('h', 'k'), 'sleep'), (('g', 'o'), 'pain'), (('y', 'Z'), 'happy')]):
        blit(img2, 10 + i * 40, 218, patient(*hz, mood=mood), 2)
    label(128, 262, '진상 (32x40)', 'R')
    blit(img2, 20, 282, karen(), 3)
    d2.rounded_rectangle([124, 290, 246, 314], radius=4, fill=PAL['W'], outline=PAL['O'])
    d2.text((185, 302), '어이~ 아가씨!', font=fb, fill=PAL['r'], anchor='mm')
    for i, (x, y) in enumerate([(150, 330), (170, 344), (190, 334)]):
        d2.ellipse([x, y, x + 12, y + 10], fill=PAL['W'], outline=PAL['O'])

    # ---------- 왼쪽: 지금 화면 ----------
    cur = Image.open(os.path.join(S, 'nn', 'play.png')).convert('RGB').resize((W, H), Image.NEAREST)

    # ---------- 합치기 (2배로 보기) ----------
    out = Image.new('RGB', (W * 3 * 2 + 40, H * 2 + 40), (40, 48, 92))
    for i, im in enumerate([cur, mid, img2]):
        out.paste(im.resize((W * 2, H * 2), Image.NEAREST), (10 + i * (W * 2 + 10), 30))
    od = ImageDraw.Draw(out); od.fontmode = '1'
    fl = ImageFont.truetype(os.path.join(ROOT, 'fonts', 'Galmuri11-Bold.ttf'), 24)
    for i, t in enumerate(['지금 (128x224)', '정교 (256x448)', '정교 캐릭터']):
        od.text((10 + i * (W * 2 + 10), 2), t, font=fl, fill=PAL['X'])
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    out.save(os.path.join(ROOT, 'dist', 'mock_hd.png'))
    print('dist/mock_hd.png', out.size)


if __name__ == '__main__':
    main()
