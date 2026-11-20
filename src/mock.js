'use strict';
(() => {
  // ============================================================
  // 나이트 생존기 시안 - 128x224 도트 화면 7장
  // ============================================================
  const W = 128, H = 224;
  let ctx = null;

  // ---------- 색 ----------
  const PAL = {
    O: [62, 46, 82], o: [118, 100, 140], K: [40, 28, 48], W: [255, 255, 255],
    cream: [255, 246, 232], cream3: [238, 222, 204],
    F: [255, 224, 204], f: [240, 196, 176], P: [255, 156, 176], p: [226, 110, 140],
    h: [112, 74, 60], k: [80, 52, 44], H: [240, 190, 110], d: [60, 52, 70],
    q: [150, 214, 236], Q: [92, 168, 208], u: [250, 170, 196], U: [214, 120, 160],
    v: [150, 224, 196], V: [84, 176, 148],
    S: [126, 196, 240], B: [80, 140, 205], M: [130, 220, 180], m: [70, 170, 140],
    Y: [255, 222, 120], y: [236, 176, 76], L: [200, 182, 255], l: [150, 130, 210],
    R: [255, 104, 110], r: [204, 64, 80], G: [228, 232, 242], g: [186, 192, 212],
    Z: [196, 124, 84], z: [150, 90, 62], N: [40, 48, 92], n: [58, 68, 124], s: [86, 98, 160],
    fl: [222, 240, 236], fl2: [206, 230, 226], wall: [238, 246, 250], wall2: [214, 228, 238],
    sun: [255, 196, 140], sun2: [255, 228, 180], X: [255, 240, 150],
  };
  const CSS = {};
  for (const k in PAL) CSS[k] = `rgb(${PAL[k].join(',')})`;

  // ---------- 기본 그리기 ----------
  function rect(x, y, w, h, c) {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = CSS[c] || c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function px(x, y, c) { rect(x, y, 1, 1, c); }
  function rrect(x, y, w, h, fill, edge = 'O', shadow = null) {
    x = Math.round(x); y = Math.round(y);
    if (shadow) rrect(x, y + 2, w, h, shadow, edge);
    rect(x + 2, y, w - 4, 1, edge); rect(x + 2, y + h - 1, w - 4, 1, edge);
    rect(x, y + 2, 1, h - 4, edge); rect(x + w - 1, y + 2, 1, h - 4, edge);
    px(x + 1, y + 1, edge); px(x + w - 2, y + 1, edge); px(x + 1, y + h - 2, edge); px(x + w - 2, y + h - 2, edge);
    rect(x + 2, y + 1, w - 4, 1, fill); rect(x + 2, y + h - 2, w - 4, 1, fill); rect(x + 1, y + 2, w - 2, h - 4, fill);
  }
  const sprCache = new Map();
  function spr(rows, map) {
    const key = rows.join('/') + JSON.stringify(map || {});
    let cv = sprCache.get(key);
    if (!cv) {
      cv = document.createElement('canvas');
      cv.width = Math.max(...rows.map(r => r.length)); cv.height = rows.length;
      const c = cv.getContext('2d');
      rows.forEach((r, j) => {
        for (let i = 0; i < r.length; i++) {
          let v = r[i];
          if (map && map[v]) v = map[v];
          if (v !== '.') { c.fillStyle = CSS[v]; c.fillRect(i, j, 1, 1); }
        }
      });
      sprCache.set(key, cv);
    }
    return cv;
  }
  function sprite(x, y, rows, opt = {}) {
    const cv = spr(rows, opt.map);
    x = Math.round(x); y = Math.round(y);
    const s = opt.scale || 1;
    ctx.save(); ctx.translate(x, y);
    if (opt.flip) { ctx.translate(cv.width * s, 0); ctx.scale(-s, s); } else ctx.scale(s, s);
    ctx.drawImage(cv, 0, 0); ctx.restore();
  }

  // ---------- 도트 글자 (불량 판정소와 같은 방식) ----------
  const TK = 4;
  const FONTS_BIG = { b: `${12 * TK}px 'Galmuri11B', monospace`, m: `${10 * TK}px 'Galmuri9', monospace`, s: `${8 * TK}px 'Galmuri7', monospace` };
  const txtCache = new Map();
  function textImg(t, f, fill, edge, scale) {
    const key = `${t}|${f}|${fill}|${edge}|${scale}`;
    let r = txtCache.get(key);
    if (r) return r;
    const m = document.createElement('canvas'), mc = m.getContext('2d');
    mc.font = FONTS_BIG[f];
    const chars = Array.from(t);
    const adv = chars.map(ch => Math.round(mc.measureText(ch).width / TK));
    const tw = adv.reduce((a, b) => a + b, 0) + 8, th = 28;
    m.width = tw * TK; m.height = th * TK;
    mc.font = FONTS_BIG[f]; mc.fillStyle = '#fff';
    let cx = 4;
    chars.forEach((ch, i) => { mc.fillText(ch, cx * TK, 20 * TK); cx += adv[i]; });
    const src = mc.getImageData(0, 0, tw * TK, th * TK).data;
    const on = new Uint8Array(tw * th), half = TK >> 1, rowW = tw * TK;
    let x0 = tw, y0 = th, x1 = -1, y1 = -1;
    for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
      if (src[((j * TK + half) * rowW + i * TK + half) * 4 + 3] >= 128) {
        on[j * tw + i] = 1;
        if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j;
      }
    }
    if (x1 < 0) { r = { c: null, w: 0 }; txtCache.set(key, r); return r; }
    const bw = (x1 - x0 + 1) * scale, bh = (y1 - y0 + 1) * scale, ow = bw + 2, oh = bh + 2;
    const mask = new Uint8Array(ow * oh);
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) if (on[(y0 + ((j / scale) | 0)) * tw + x0 + ((i / scale) | 0)]) mask[(j + 1) * ow + i + 1] = 1;
    const out = new ImageData(ow, oh), d = out.data;
    const put = (i, j, c) => { const k = (j * ow + i) * 4; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255; };
    const near = (i, j) => { for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < ow && jj < oh && mask[jj * ow + ii]) return true; } return false; };
    if (edge) for (let j = 0; j < oh; j++) for (let i = 0; i < ow; i++) if (near(i, j)) put(i, j, PAL[edge]);
    for (let j = 0; j < oh; j++) for (let i = 0; i < ow; i++) if (mask[j * ow + i]) put(i, j, PAL[fill]);
    const c = document.createElement('canvas'); c.width = ow; c.height = oh;
    c.getContext('2d').putImageData(out, 0, 0);
    r = { c, w: ow }; txtCache.set(key, r); return r;
  }
  function textW(t, f) { return textImg(t, f, 'O', null, 1).w; }
  function ptext(t, x, y, f, fill, opt = {}) {
    const { edge = 'O', scale = 1, align = 'l' } = opt;
    const r = textImg(String(t), f, fill, edge, scale);
    if (!r.c) return;
    const dx = align === 'c' ? x - Math.floor(r.w / 2) : align === 'r' ? x - r.w : x;
    ctx.drawImage(r.c, Math.round(dx), Math.round(y));
  }
  function pill(t, cx, y, fill, fg, f = 's', shadow = null) {
    const w = textW(t, f) + 8, h = f === 's' ? 11 : f === 'm' ? 14 : 16;
    rrect(Math.round(cx - w / 2), y, w, h, fill, 'O', shadow);
    ptext(t, cx, y + 2, f, fg, { edge: null, align: 'c' });
  }
  function button(x, y, w, h, fill, dark, label, f, fg, edge = null) {
    rrect(x, y, w, h, fill, 'O', dark);
    ptext(label, x + w / 2, y + 2, f, fg, { edge, align: 'c' });
  }

  // ---------- 스프라이트 ----------
  // 간호사 (근무복 색은 q/Q를 바꿔 꾸미기)
  const NURSE = [
    '......OOOO......',
    '.....OhhhhO.....',
    '...OOOhhhhOOO...',
    '..OhhhhhhhhhhO..',
    '.OhhhhhhhhhhhhO.',
    '.OhhFFFFFFFFhhO.',
    '.OhFFFFFFFFFFhO.',
    '.OhFFKFFFFKFFhO.',
    '.OhFFKFFFFKFFhO.',
    '.OhFPPFFFFPPFhO.',
    '..OFFFFOOFFFFO..',
    '...OOFFFFFFOO...',
    '....OOqFFqOO....',
    '..OOqqqFFqqqOO..',
    '.OqOqqqqqqWWOqO.',
    '.OqOqqqqqqWBOqO.',
    '.OqOqqqqqqqqOqO.',
    '.OFOQQQQQQQQOFO.',
    '..OOQQQQOQQQOO..',
    '...OQQQO.OQQQO..',
    '...OWWWO.OWWWO..',
    '...OOOOO.OOOOO..',
  ];
  const NURSE_BLINK = NURSE.map((r, j) => j === 7 ? '.OhFFFFFFFFFFhO.' : j === 8 ? '.OhFOOFFFFOOFhO.' : r);
  const NURSE_TIRED = NURSE.map((r, j) => j === 7 ? '.OhFFFFFFFFFFhO.' : j === 8 ? '.OhFOOFFFFOOFhO.' : j === 10 ? '..OFFFFFFFFFFO..' : j === 11 ? '...OOFFOOFFOO...' : r);
  const SCRUBS = [
    { name: '하늘', q: 'q', Q: 'Q' }, { name: '분홍', q: 'u', Q: 'U' }, { name: '민트', q: 'v', Q: 'V' }, { name: '남색', q: 's', Q: 'n' },
  ];
  function nurse(x, y, skin = 0, opt = {}) {
    const sc = SCRUBS[skin];
    const rows = opt.tired ? NURSE_TIRED : opt.blink ? NURSE_BLINK : NURSE;
    sprite(x, y, rows, { map: { q: sc.q, Q: sc.Q }, scale: opt.scale, flip: opt.flip });
    const s = opt.scale || 1;
    if (opt.band) sprite(x + 3 * s, y + 3 * s, ['OOOOOOOOOO', 'OPPWPPPPPO', 'OOOOOOOOOO'].map(r => r), { scale: s });
    if (opt.badge) sprite(x + 11 * s, y + 12 * s, STAR, { scale: s });
  }
  // 환자 얼굴 (베개 위)
  const HEAD = [
    '..OOOOOO..',
    '.OhhhhhhO.',
    'OhhhhhhhhO',
    'OFFFFFFFFO',
    'OFKFFFFKFO',
    'OFPFFFFPFO',
    '.OFFOOFFO.',
    '..OOOOOO..',
  ];
  const HEAD_SLEEP = HEAD.map((r, j) => j === 4 ? 'OFOOFFOOFO' : j === 6 ? '.OFFFFFFO.' : r);
  const HEAD_PAIN = HEAD.map((r, j) => j === 3 ? 'OFOFFFFOFO' : j === 6 ? '.OFOOOOFO.' : r);
  const HEAD_HAPPY = HEAD.map((r, j) => j === 4 ? 'OFOFFFFOFO' : j === 6 ? '.OFOFFOFO.' : r);
  const HAIRS = ['h', 'g', 'k', 'H', 'd'];
  // 아이콘
  const STAR = ['...O...', '..OYO..', 'OOOYOOO', 'OYYYYYO', '.OYYYO.', '.OYOYO.', '.OO.OO.'];
  const DROP = ['...O...', '..OSO..', '.OSSSO.', 'OSSWSSO', 'OSSSSSO', '.OSSSO.', '..OOO..'];
  const PILL = ['..OOO..', '.OPPPO.', '.OWPPO.', '.OOOOO.', '.OWWWO.', '.OWWWO.', '..OOO..'];
  const CUP = ['.OOOOO..', '.OSSSOOO', '.OWSSO.O', '.OSSSOOO', '.OSSSO..', '..OOO...'];
  const BELL = ['...O...', '..OYO..', '.OYYYO.', '.OYWYO.', 'OYYYYYO', 'OOOOOOO', '...O...'];
  const ANGRY = ['O.O.O.O', '.......', 'OOO.OOO', '.......', '.ORRRO.', 'ORRRRRO', '.OOOOO.'];
  const COFFEE = ['..O.O....', '.O.O.....', '.........', 'OOOOOOO..', 'OWWWWWOOO', 'OWzzzWO.O', 'OWzzzWOOO', 'OWWWWWO..', '.OOOOO...'];
  const DONUT = ['..OOOOO..', '.OPPPPPO.', 'OPWPOPPPO', 'OPPO.OPPO', 'OyyOOOyyO', '.OyyyyyO.', '..OOOOO..'];
  const HEART = ['.OO...OO.', 'OPPO.OPPO', 'OPWPOPPPO', 'OPPPPPPPO', '.OPPPPPO.', '..OPPPO..', '...OPO...', '....O....'];
  const MOON = ['..OOOO.', '.OXXXO.', 'OXXXO..', 'OXXO...', 'OXXXO..', '.OXXXO.', '..OOOO.'];
  const SPARK = ['..Y..', '..Y..', 'YYWYY', '..Y..', '..Y..'];
  const ZZ = ['OOO', '..O', '.O.', 'OOO'];
  const PLANT = ['..O.O..', '.OMOMO.', 'OMmOmMO', '.OMMMO.', '..OmO..', '.OOOOO.', '.OZZZO.', '.OZZZO.', '..OOO..'];
  // 진상 보호자 (뽀글머리, 화난 얼굴)
  const KARENS = [
    '...OOOOOOOOOO...',
    '..OLlLlLlLlLlO..',
    '.OLlLlLlLlLlLlO.',
    '.OlLlLlLlLlLlLO.',
    '.OLLFFFFFFFFLLO.',
    '.OLFOOFFFFOOFLO.',
    '.OLFFKFFFFKFFLO.',
    '.OLFRRFFFFRRFLO.',
    '..OFFFOOOOFFFO..',
    '..OFFFOrrOFFFO..',
    '...OOFOOOOFOO...',
    '....OZZZZZZO....',
    '..OOZZZYYZZZOO..',
    '.OZOZZZZZZZZOZO.',
    '.OFOZZZZZZZZOFO.',
    '..OOnnnnnnnnOO..',
    '...OnnnOOnnnO...',
    '...OOOO..OOOO...',
  ];
  const STEAM = ['.O..O.', 'O.OO.O', '.O..O.'];
  // 배 나온 아저씨 (대머리, 콧수염, 정장)
  const KAREN_M = [
    '....OOOOOOOO....',
    '...OFFFFFFFFO...',
    '..OFFWFFFFFFFO..',
    '..OhFFFFFFFFhO..',
    '.OhFOOFFFFOOFhO.',
    '.OhFFKFFFFKFFhO.',
    '.OhFRRFFFFRRFhO.',
    '..OFFkkkkkkFFO..',
    '..OFFFOrrOFFFO..',
    '...OOFOOOOFOO...',
    '....OWWWWWWO....',
    '..OOnnnWRWnnOO..',
    '.OnOnnnnRnnnOnO.',
    '.OFOnnnnnnnnOFO.',
    '..OOddddddddOO..',
    '...OdddOOdddO...',
    '...OOOO..OOOO...',
  ];
  // 모자 쓴 젊은 진상 (선글라스, 후드)
  const KAREN_Y = [
    '...OOOOOOOOOO...',
    '..ORRRRRRRRRRO..',
    '.ORRRRRRRRRRRROO',
    '..OhFFFFFFFFhO..',
    '..OFOOOOOOOOFO..',
    '..OFOKKOOKKOFO..',
    '..OFFFFFFFFFFO..',
    '..OFFFOOOOFFFO..',
    '...OOFFFFFFOO...',
    '....OggggggO....',
    '..OOggggggggOO..',
    '.OgOggggggggOgO.',
    '.OFOggggggggOFO.',
    '..OOddddddddOO..',
    '...OdddOOdddO...',
    '...OOOO..OOOO...',
  ];
  const KAREN_TYPES = [KARENS, KAREN_M, KAREN_Y];
  // 진상 대사 (판마다 무작위)
  const KAREN_LINES = ['어이~ 아가씨!', '원장 불러!', '내가 누군지 알아?', 'VIP 병실 없어?', '아까 부른 게 언젠데!', '우리 애 먼저 봐줘!', '주사 안 아프게 놔!'];
  function speech(x, y, text, col = 'r') {
    const w = textW(text, 's') + 8;
    rrect(x, y, w, 13, 'W');
    sprite(x + 6, y + 12, ['OOOO', '.OO.']); rect(x + 7, y + 12, 2, 1, 'W');
    ptext(text, x + w / 2, y + 2, 's', col, { edge: null, align: 'c' });
    return w;
  }

  // ---------- 장면 조각 ----------
  function bed(x, y, mood, hair, num, bubble, t) {
    rrect(x, y, 34, 9, 'g', 'O');                 // 머리판
    rrect(x + 1, y + 5, 32, 24, 'W', 'O');        // 매트리스
    rrect(x + 9, y + 6, 16, 8, 'G', 'O');         // 베개
    const head = mood === 'sleep' ? HEAD_SLEEP : mood === 'pain' ? HEAD_PAIN : mood === 'happy' ? HEAD_HAPPY : HEAD;
    sprite(x + 12, y + 7, head, { map: { h: hair } });
    rrect(x + 1, y + 15, 32, 14, 'q', 'O');       // 이불
    rect(x + 2, y + 16, 30, 2, 'W');
    rect(x + 4, y + 20, 26, 1, 'S');
    if (mood === 'sleep') sprite(x + 25, y - 1 - ((t * 2 | 0) % 2), ZZ);
    if (mood === 'pain') sprite(x + 23, y + 5, ['.O.', 'OSO', 'OSO', '.O.']);
    ptext(num, x + 17, y + 21, 's', 'B', { edge: null, align: 'c' });
    if (bubble) callBubble(x + 18, y - 15, bubble, t);
  }
  function callBubble(x, y, kind, t) {
    const urgent = kind === 'angry';
    const blink = ((t * 3) | 0) % 2 === 0;
    const fill = urgent ? (blink ? 'R' : 'P') : 'W';
    const edge = urgent ? 'O' : blink ? 'y' : 'O';
    rrect(x, y, 15, 13, fill, edge);
    sprite(x + 3, y + 12, ['OOOO', '.OO.'].map(r => r), { map: { O: edge } });
    rect(x + 4, y + 12, 2, 1, fill);
    const icon = { drip: DROP, pain: PILL, water: CUP, call: BELL, angry: ANGRY }[kind];
    sprite(x + 4, y + 3, icon);
  }
  function burst(x, y, t) {
    const k = (t * 6 | 0) % 2;
    sprite(x - 9, y - 3, SPARK); sprite(x + 6, y - 6, SPARK); sprite(x - 3, y + 6 + k, SPARK);
    ptext('팡!', x, y - 4, 'b', 'Y', { align: 'c' });
  }
  function floor(y0) {
    for (let y = y0; y < H; y += 8) for (let x = 0; x < W; x += 8) rect(x, y, 8, 8, ((x + y) / 8) % 2 ? 'fl' : 'fl2');
  }
  function bar(x, y, w, ratio, col) {
    rrect(x, y, w, 7, 'cream3');
    rrect(x, y, Math.max(5, Math.round(w * ratio)), 7, col);
    rect(x + 2, y + 1, Math.round(w * ratio) - 5, 1, 'W');
  }
  function stars(t, n = 18) {
    for (let i = 0; i < n; i++) {
      const x = (i * 37) % 124 + 2, y = (i * 23) % 70 + 4;
      if ((i + (t * 2 | 0)) % 5) px(x, y, i % 3 ? 'W' : 'X');
    }
  }

  // ---------- 화면 0: 캐릭터 모음 ----------
  function sheet(t) {
    rect(0, 0, W, H, 'cream');
    const blink = (t % 2.6) < 0.15;
    pill('간호사 (근무복 꾸미기)', 64, 4, 'S', 'W');
    SCRUBS.forEach((s, i) => {
      nurse(6 + i * 30, 20, i, { blink, band: i === 1, badge: i === 3 });
      ptext(s.name, 14 + i * 30, 44, 's', 'o', { edge: null, align: 'c' });
    });
    pill('지친 얼굴', 30, 56, 'G', 'O');
    nurse(22, 70, 0, { tired: true });
    pill('2배 크기', 88, 56, 'G', 'O');
    nurse(72, 68, 1, { blink, scale: 2, band: true });
    pill('환자', 64, 118, 'M', 'O');
    [['sleep', '쿨쿨'], ['calm', '평온'], ['pain', '아파요'], ['happy', '고마워요']].forEach(([m, l], i) => {
      const head = m === 'sleep' ? HEAD_SLEEP : m === 'pain' ? HEAD_PAIN : m === 'happy' ? HEAD_HAPPY : HEAD;
      sprite(10 + i * 30, 133, head, { map: { h: HAIRS[i] }, scale: 2 });
      ptext(l, 20 + i * 30, 152, 's', 'o', { edge: null, align: 'c' });
    });
    pill('콜벨 · 아이템 · 진상', 64, 164, 'P', 'W');
    [['drip', '수액'], ['pain', '진통'], ['water', '물'], ['call', '호출'], ['angry', '진상']].forEach(([k, l], i) => {
      callBubble(6 + i * 24, 180, k, t);
      ptext(l, 13 + i * 24, 196, 's', 'o', { edge: null, align: 'c' });
    });
    sprite(10, 208, COFFEE); ptext('커피', 30, 208, 's', 'o', { edge: null });
    sprite(56, 209, DONUT); ptext('간식', 76, 208, 's', 'o', { edge: null });
    sprite(100, 206, HEART);
  }

  // ---------- 화면 1: 시작 ----------
  function title(t) {
    rect(0, 0, W, 120, 'N');
    stars(t);
    sprite(108, 2, MOON);
    // 병원 건물 (불 켜진 창문)
    rrect(14, 72, 100, 50, 'wall2', 'O');
    rrect(54, 64, 20, 12, 'wall2', 'O');
    rect(61, 67, 6, 2, 'R'); rect(63, 65, 2, 6, 'R');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const lit = (r * 7 + c * 3 + (t * 0.5 | 0)) % 4 !== 0;
      rect(20 + c * 15, 80 + r * 13, 9, 8, lit ? 'X' : 'n');
    }
    rect(0, 120, W, 104, 'fl2');
    floor(120);
    // 타이틀
    rrect(8, 14, 112, 46, 'W', 'O', 'l');
    ptext('나이트', 64, 17, 'b', 'N', { scale: 2, align: 'c' });
    pill('생존기', 64, 43, 'P', 'W', 'b', 'p');
    pill('콜벨 팡팡!', 30, 6, 'Y', 'O', 's');
    // 간호사 + 커피
    nurse(10, 120, 0, { blink: (t % 2.6) < 0.15, scale: 2 });
    sprite(48, 150, COFFEE);
    rrect(52, 126, 70, 14, 'W');
    ptext('오늘 밤도 화이팅!', 87, 128, 's', 'O', { edge: null, align: 'c' });
    button(6, 172, 116, 18, 'Y', 'y', '근무 시작', 'b', 'O');
    button(6, 194, 37, 14, 'S', 'B', '랭킹', 'm', 'W', 'B');
    button(45, 194, 38, 14, 'M', 'm', '휴게실', 'm', 'W', 'm');
    button(85, 194, 37, 14, 'L', 'l', '꾸미기', 'm', 'W', 'l');
    button(6, 210, 56, 12, 'W', 'cream3', '이름·병동', 's', 'O');
    button(66, 210, 56, 12, 'P', 'p', '채팅', 's', 'W');
  }

  // ---------- 화면 2: 본 게임 ----------
  function play(t) {
    rect(0, 0, W, H, 'wall');
    floor(40);
    // 위: 시각, 점수, 체력
    rrect(3, 3, 50, 15, 'N', 'O');
    sprite(6, 7, ['.OO', 'OX.', 'OX.', '.OO'].map(r => r));
    ptext('02:14', 14, 6, 'm', 'X', { edge: null });
    rrect(56, 3, 69, 15, 'W', 'O', 'cream3');
    sprite(59, 7, STAR);
    ptext('8,240', 69, 6, 'm', 'O', { edge: null });
    sprite(3, 22, COFFEE);
    bar(14, 23, 80, 0.62, 'M');
    ptext('체력', 110, 23, 's', 'o', { edge: null, align: 'c' });
    // 창문 (밤)
    rrect(6, 33, 30, 14, 'N', 'O'); px(14, 37, 'W'); px(26, 40, 'X'); px(20, 36, 'W');
    rrect(92, 33, 30, 14, 'N', 'O'); sprite(110, 36, MOON);
    pill('7병동', 64, 34, 'G', 'O');
    // 침대 6개
    const beds = [
      [8, 70, 'pain', 0, '701', 'pain'], [86, 70, 'sleep', 1, '702', null],
      [8, 118, 'calm', 2, '703', 'drip'], [86, 118, 'calm', 3, '704', 'angry'],
      [8, 166, 'sleep', 4, '705', null], [86, 166, 'calm', 0, '706', 'water'],
    ];
    for (const [x, y, m, h, n, b] of beds) bed(x, y, m, HAIRS[h], n, b, t);
    // 가운데 복도: 간호사가 오가며 처리
    const ny = 96 + Math.round(Math.sin(t * 1.5) * 30);
    nurse(56, ny, 0, { blink: (t % 2.6) < 0.15, flip: Math.cos(t * 1.5) < 0 });
    burst(25, 60, t);
    ptext('+120', 40, 50, 's', 'm', { edge: 'W' });
    // 떠다니는 커피 (누르면 체력 회복)
    sprite(60, 156 + ((t * 3 | 0) % 2), COFFEE);
    sprite(70, 152, SPARK);
    // 콤보
    pill('콤보 x12', 64, 208, 'Y', 'O', 'm', 'y');
  }

  // ---------- 화면 3: 진상 보너스 ----------
  function karen(t) {
    const flash = ((t * 6) | 0) % 2;
    rect(0, 0, W, H, flash ? 'P' : 'R');
    for (let i = 0; i < 12; i++) {             // 집중선
      const a = i / 12 * Math.PI * 2 + t * 0.5;
      ctx.save(); ctx.translate(64, 100); ctx.rotate(a);
      rect(30, -3, 80, 6, flash ? 'u' : 'P'); ctx.restore();
    }
    pill('진상 보너스!', 64, 8, 'Y', 'O', 'b', 'y');
    ptext('마구 눌러서 날려 버려요', 64, 30, 's', 'W', { align: 'c' });
    const shake = ((t * 20) | 0) % 2 ? 1 : -1;
    const ki = Math.floor(t / 2.5);
    sprite(40 + shake, 62, KAREN_TYPES[ki % 3], { scale: 3 });
    sprite(88, 52, STEAM, { scale: 2 });
    const line = KAREN_LINES[ki % KAREN_LINES.length];
    speech(64 - (textW(line, 's') + 8) / 2, 42, line);
    // 연타 효과
    ptext('쾅!', 30, 118, 'b', 'Y', { scale: 2, align: 'c' });
    ptext('쾅!', 100, 92, 'b', 'Y', { align: 'c' });
    sprite(20, 140, SPARK); sprite(110, 120, SPARK);
    // 게이지
    ptext('날아가기까지', 64, 160, 's', 'W', { align: 'c' });
    bar(10, 172, 108, 0.74, 'Y');
    pill('연타 38', 64, 186, 'W', 'O', 'm');
    ptext('남은 시간 3초', 64, 206, 's', 'W', { align: 'c' });
  }

  // ---------- 화면 4: 라운딩 타임 ----------
  function rounding(t) {
    rect(0, 0, W, H, 'wall');
    floor(150);
    pill('라운딩 타임!', 64, 6, 'L', 'W', 'b', 'l');
    ptext('업무 카드를 알맞은 칸으로', 64, 28, 's', 'o', { edge: null, align: 'c' });
    // 들어오는 카드
    const card = (x, y, col, dark, icon, label, big) => {
      rrect(x, y, 44, 30, 'W', 'O', dark);
      rect(x + 1, y + 2, 42, 7, col);
      ptext(label, x + 22, y + 1, 's', 'W', { edge: null, align: 'c' });
      sprite(x + 18, y + 13, icon);
    };
    rrect(46, 44, 44, 30, 'cream3', 'O');
    card(40, 48, 'P', 'p', PILL, '투약');
    // 밀기 안내
    ptext('◀', 26, 92, 'm', 'P', { edge: null });
    ptext('▶', 96, 92, 'm', 'P', { edge: null });
    ptext('밀어서 정리', 64, 92, 's', 'o', { edge: null, align: 'c' });
    // 정리 칸 3개
    const bin = (x, col, dark, label, n) => {
      rrect(x, 112, 38, 34, col, 'O', dark);
      ptext(label, x + 19, 115, 'm', 'W', { edge: dark, align: 'c' });
      for (let i = 0; i < n; i++) rrect(x + 5 + i * 3, 130 - i * 2, 22, 10, 'W', 'O');
    };
    bin(4, 'P', 'p', '투약', 2); bin(45, 'S', 'B', '검사', 3); bin(86, 'M', 'm', '기록', 1);
    nurse(56, 166, 2, { blink: (t % 2.6) < 0.15 });
    rrect(74, 168, 48, 14, 'W');
    ptext('착착 정리!', 98, 170, 's', 'O', { edge: null, align: 'c' });
    pill('남은 카드 3', 64, 204, 'Y', 'O', 'm', 'y');
  }

  // ---------- 화면 5: 퇴근 성공 ----------
  function offwork(t) {
    // 아침 하늘
    for (let y = 0; y < 120; y += 8) rect(0, y, W, 8, y < 40 ? 'sun2' : y < 80 ? 'sun' : 'Y');
    rrect(46, 86, 36, 36, 'X', 'Y');
    rect(0, 112, W, 112, 'fl2'); floor(112);
    // 도장
    const s = Math.max(1, 3 - (t % 4) * 4);
    ctx.save(); ctx.translate(64, 44); ctx.rotate(-0.15); ctx.scale(s > 1.2 ? s / 1 : 1, s > 1.2 ? s / 1 : 1);
    ctx.translate(-64, -44);
    rrect(26, 20, 76, 46, 'W', 'r');
    rrect(29, 23, 70, 40, 'W', 'R');
    ptext('퇴근', 64, 26, 'b', 'R', { scale: 2, edge: null, align: 'c' });
    ptext('성공!', 64, 50, 'm', 'R', { edge: null, align: 'c' });
    ctx.restore();
    nurse(8, 118, 1, { scale: 2, band: true });
    sprite(46, 128, HEART);
    rrect(56, 118, 66, 50, 'W', 'O', 'cream3');
    const row = (l, v, y) => { ptext(l, 61, y, 's', 'o', { edge: null }); ptext(v, 117, y, 's', 'O', { edge: null, align: 'r' }); };
    row('끈 콜벨', '87개', 122); row('최대 콤보', '23', 133); row('진상 퇴치', '2명', 144); row('마신 커피', '3잔', 155);
    pill('점수 12,480', 64, 172, 'Y', 'O', 'm', 'y');
    ptext('7병동 랭킹 2위!', 64, 190, 's', 'p', { edge: 'W', align: 'c' });
    button(6, 204, 56, 16, 'Y', 'y', '한 번 더', 'm', 'O');
    button(66, 204, 56, 16, 'M', 'm', '휴게실로', 'm', 'W', 'm');
  }

  // ---------- 화면 6: 휴게실 ----------
  function lounge(t) {
    rect(0, 0, W, 130, 'cream');
    for (let x = 0; x < W; x += 12) rect(x, 0, 6, 130, 'cream3');   // 벽지 줄무늬
    rect(0, 126, W, 4, 'Z'); rect(0, 130, W, 94, 'fl'); floor(130);
    pill('휴게실', 64, 6, 'M', 'W', 'b', 'm');
    // 창문 (아침)
    rrect(8, 28, 40, 32, 'sun2', 'O'); rect(27, 29, 2, 30, 'O'); rect(9, 43, 38, 2, 'O');
    // 액자
    rrect(86, 28, 30, 22, 'W', 'O'); sprite(97, 33, HEART);
    // 커피머신
    rrect(94, 76, 26, 40, 'g', 'O'); rrect(98, 80, 18, 10, 'N', 'O'); px(102, 84, 'M'); px(106, 84, 'M');
    rect(102, 98, 10, 2, 'O'); sprite(103, 104, ['OOOOOO', 'OzzzzO', 'OzzzzO', '.OOOO.']);
    rect(90, 116, 34, 10, 'Z'); rect(90, 116, 34, 2, 'z');
    // 소파 + 쉬는 간호사
    rrect(6, 92, 70, 20, 'P', 'O'); rrect(4, 104, 74, 22, 'u', 'O'); rect(6, 108, 70, 2, 'W');
    nurse(28, 84, 2, { blink: true });
    sprite(46, 78, ZZ);
    sprite(10, 112, PLANT);
    sprite(80, 114, PLANT);
    // 해금 목록
    rrect(4, 140, 120, 60, 'W', 'O', 'cream3');
    ptext('가구 해금', 64, 143, 's', 'o', { edge: null, align: 'c' });
    const slot = (x, label, done) => {
      rrect(x, 156, 26, 26, done ? 'cream' : 'cream3', 'O');
      if (!done) ptext('?', x + 13, 160, 'b', 'o', { edge: null, align: 'c' });
      ptext(label, x + 13, 186, 's', done ? 'O' : 'o', { edge: null, align: 'c' });
    };
    slot(8, '소파', true); slot(37, '화분', true); slot(66, '커피', true); slot(95, '안마의자', false);
    sprite(13, 163, ['OOOOOOOOOOOOOO', 'OPPPPPPPPPPPPO', 'OuuuuuuuuuuuuO', 'OOOOOOOOOOOOOO'], { scale: 1 });
    sprite(46, 164, PLANT);
    sprite(75, 165, COFFEE);
    pill('다음: 5만 점', 64, 206, 'Y', 'O', 'm', 'y');
  }

  // ---------- 화면 7: 진상 모음 ----------
  function karens(t) {
    rect(0, 0, W, H, 'cream');
    pill('진상 3종', 64, 4, 'R', 'W', 'm');
    const names = ['뽀글머리 보호자', '배 나온 아저씨', '모자 쓴 청년'];
    KAREN_TYPES.forEach((k, i) => {
      const x = 6 + i * 41;
      const bob = ((t * 4 + i) | 0) % 2;
      sprite(x + 2, 26 + bob, k, { scale: 2 });
      ptext(names[i].split(' ')[0], x + 18, 64, 's', 'o', { edge: null, align: 'c' });
      ptext(names[i].split(' ')[1], x + 18, 73, 's', 'o', { edge: null, align: 'c' });
    });
    pill('대사 (판마다 무작위)', 64, 88, 'P', 'W');
    KAREN_LINES.forEach((l, i) => {
      const y = 104 + i * 17;
      const w = textW(l, 's') + 8;
      speech(i % 2 ? 122 - w : 6, y, l);
    });
  }

  // ---------- 그리기 ----------
  const SCENES = [sheet, title, play, karen, rounding, offwork, lounge, karens];
  const ctxs = SCENES.map((_, i) => {
    const c = document.getElementById('c' + i).getContext('2d');
    c.imageSmoothingEnabled = false;
    return c;
  });
  const fixed = new URLSearchParams(location.search).get('t');
  function frame(ts) {
    const t = fixed !== null ? +fixed : ts / 1000;
    SCENES.forEach((f, i) => { ctx = ctxs[i]; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); f(t); });
    if (fixed === null) requestAnimationFrame(frame);
  }
  Promise.all(['12px Galmuri11B', '10px Galmuri9', '8px Galmuri7'].map(f => document.fonts.load(f)))
    .catch(() => {}).then(() => requestAnimationFrame(frame));
})();
