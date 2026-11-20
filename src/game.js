'use strict';
(() => {
  // ============================================================
  // 나이트 생존기 - 128x224 도트 화면. 밤 근무 동안 콜벨을 끄고 아침 7시에 퇴근
  // ============================================================
  const W = 128, H = 224;
  const cvs = document.getElementById('game');
  const ctx = cvs.getContext('2d');
  const stageEl = document.getElementById('stage');
  const wrapEl = document.getElementById('wrap');
  const nickEl = document.getElementById('nick');
  const chatEl = document.getElementById('chatin');
  ctx.imageSmoothingEnabled = false;

  // ---------- 저장 (브라우저 저장소는 실패할 수 있음) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 무시 */ } },
  };
  function cookieGet(k) {
    try { const m = document.cookie.match(new RegExp('(?:^|; )' + k + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; }
  }
  function cookieSet(k, v) {
    try { document.cookie = k + '=' + encodeURIComponent(v) + '; max-age=315360000; path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); } catch (e) { /* 무시 */ }
  }
  // IndexedDB: localStorage가 지워져도 남아 있는 경우가 있어 한 번 더 저장
  const IDB = {
    db: null,
    open() {
      return new Promise(res => {
        try {
          const rq = indexedDB.open('nurse-night', 1);
          rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
          rq.onsuccess = () => { this.db = rq.result; res(this.db); };
          rq.onerror = () => res(null);
        } catch (e) { res(null); }
      });
    },
    async get(k) {
      const db = this.db || await this.open();
      if (!db) return null;
      return new Promise(res => {
        try { const rq = db.transaction('kv').objectStore('kv').get(k); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); }
        catch (e) { res(null); }
      });
    },
    async set(k, v) {
      const db = this.db || await this.open();
      if (!db) return;
      try { db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch (e) { /* 무시 */ }
    },
  };

  // ---------- 색 ----------
  const PAL = {
    O: [62, 46, 82], o: [118, 100, 140], K: [40, 28, 48], W: [255, 255, 255],
    cream: [255, 246, 232], cream2: [250, 234, 214], cream3: [238, 222, 204],
    F: [255, 224, 204], P: [255, 156, 176], p: [226, 110, 140],
    h: [112, 74, 60], k: [80, 52, 44], H: [240, 196, 110], d: [60, 52, 70],
    q: [150, 214, 236], Q: [92, 168, 208], u: [250, 170, 196], U: [214, 120, 160],
    v: [150, 224, 196], V: [84, 176, 148],
    S: [126, 196, 240], B: [80, 140, 205], M: [130, 220, 180], m: [70, 170, 140],
    Y: [255, 222, 120], y: [236, 176, 76], L: [200, 182, 255], l: [150, 130, 210],
    R: [255, 104, 110], r: [204, 64, 80], G: [228, 232, 242], g: [186, 192, 212],
    Z: [196, 124, 84], z: [150, 90, 62], N: [40, 48, 92], n: [58, 68, 124], s: [86, 98, 160],
    e: [70, 70, 84], E: [44, 44, 56], j: [250, 250, 250],
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
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    if (shadow) rrect(x, y + 2, w, h, shadow, edge);
    rect(x + 2, y, w - 4, 1, edge); rect(x + 2, y + h - 1, w - 4, 1, edge);
    rect(x, y + 2, 1, h - 4, edge); rect(x + w - 1, y + 2, 1, h - 4, edge);
    px(x + 1, y + 1, edge); px(x + w - 2, y + 1, edge); px(x + 1, y + h - 2, edge); px(x + w - 2, y + h - 2, edge);
    rect(x + 2, y + 1, w - 4, 1, fill); rect(x + 2, y + h - 2, w - 4, 1, fill); rect(x + 1, y + 2, w - 2, h - 4, fill);
  }
  const sprCache = new Map();
  function spr(rows, map) {
    const key = rows.join('/') + (map ? JSON.stringify(map) : '');
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
    if (s === 1 && !opt.flip) { ctx.drawImage(cv, x, y); return; }
    ctx.save(); ctx.translate(x, y);
    if (opt.flip) { ctx.translate(cv.width * s, 0); ctx.scale(-s, s); } else ctx.scale(s, s);
    ctx.drawImage(cv, 0, 0); ctx.restore();
  }
  function big(fn, x, y, s = 2) { ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(s, s); fn(); ctx.restore(); }

  // ---------- 도트 글자 (4배로 그린 뒤 픽셀 가운데만 읽어 또렷하게) ----------
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
  function textW(t, f) { return textImg(String(t), f, 'O', null, 1).w; }
  function ptext(t, x, y, f, fill, opt = {}) {
    const { edge = 'O', scale = 1, align = 'l' } = opt;
    const r = textImg(String(t), f, fill, edge, scale);
    if (!r.c) return 0;
    const dx = align === 'c' ? x - Math.floor(r.w / 2) : align === 'r' ? x - r.w : x;
    ctx.drawImage(r.c, Math.round(dx), Math.round(y));
    return r.w;
  }
  function pill(t, cx, y, fill, fg, f = 's', shadow = null) {
    const w = textW(t, f) + 8, h = f === 's' ? 11 : f === 'm' ? 14 : 16;
    rrect(Math.round(cx - w / 2), y, w, h, fill, 'O', shadow);
    ptext(t, cx, y + 2, f, fg, { edge: null, align: 'c' });
  }
  function button(b, fill, dark, label, f, fg, edge = null) {
    rrect(b.x, b.y, b.w, b.h, fill, 'O', dark);
    ptext(label, b.x + b.w / 2, b.y + (b.h >= 16 ? 2 : b.h >= 13 ? 1 : 2), f, fg, { edge, align: 'c' });
  }
  function header(label, fill = 'S', dark = 'B') {
    rrect(6, 5, 116, 20, fill, 'O', dark);
    ptext(label, 64, 8, 'b', 'W', { align: 'c', edge: dark });
  }
  const fmt = n => Math.floor(n).toLocaleString('en-US');
  function fmtShort(n) {
    n = Math.floor(n);
    if (n < 10000) return fmt(n);
    if (n < 100000) return (Math.floor(n / 100) / 10).toFixed(1) + 'k';
    if (n < 1000000) return Math.floor(n / 1000) + 'k';
    return (Math.floor(n / 10000) / 100).toFixed(2) + 'M';
  }
  function fitText(t, maxW, f = 'm') {
    t = String(t);
    if (textW(t, f) <= maxW) return { t, f };
    const chars = Array.from(t);
    while (chars.length > 1 && textW(chars.join('') + '..', f) > maxW) chars.pop();
    return { t: chars.join('') + '..', f };
  }
  function wrapText(t, maxW, f) {
    const lines = []; let cur = '';
    for (const word of t.split(' ')) {
      const tryLine = cur ? cur + ' ' + word : word;
      if (textW(tryLine, f) <= maxW) { cur = tryLine; continue; }
      if (cur) lines.push(cur);
      cur = '';
      for (const ch of Array.from(word)) {
        if (textW(cur + ch, f) > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // ---------- 스프라이트 ----------
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
  const NURSE_JOY = NURSE.map((r, j) => j === 7 ? '.OhFOFFFFFFOFhO.' : j === 8 ? '.OhFFOFFFFOFFhO.' : j === 10 ? '..OFFFOWWOFFFO..' : r);
  const HEAD = ['..OOOOOO..', '.OhhhhhhO.', 'OhhhhhhhhO', 'OFFFFFFFFO', 'OFKFFFFKFO', 'OFPFFFFPFO', '.OFFOOFFO.', '..OOOOOO..'];
  const HEAD_SLEEP = HEAD.map((r, j) => j === 4 ? 'OFOOFFOOFO' : j === 6 ? '.OFFFFFFO.' : r);
  const HEAD_PAIN = HEAD.map((r, j) => j === 3 ? 'OFOFFFFOFO' : j === 6 ? '.OFOOOOFO.' : r);
  const HEAD_HAPPY = HEAD.map((r, j) => j === 4 ? 'OFOFFFFOFO' : j === 6 ? '.OFOFFOFO.' : r);
  const STAR = ['...O...', '..OYO..', 'OOOYOOO', 'OYYYYYO', '.OYYYO.', '.OYOYO.', '.OO.OO.'];
  const DROP = ['...O...', '..OSO..', '.OSSSO.', 'OSSWSSO', 'OSSSSSO', '.OSSSO.', '..OOO..'];
  const PILL = ['..OOO..', '.OPPPO.', '.OWPPO.', '.OOOOO.', '.OWWWO.', '.OWWWO.', '..OOO..'];
  const CUP = ['.OOOOO..', '.OSSSOOO', '.OWSSO.O', '.OSSSOOO', '.OSSSO..', '..OOO...'];
  const BELL = ['...O...', '..OYO..', '.OYYYO.', '.OYWYO.', 'OYYYYYO', 'OOOOOOO', '...O...'];
  const ANGRY = ['O.O.O.O', '.......', 'OOO.OOO', '.......', '.ORRRO.', 'ORRRRRO', '.OOOOO.'];
  const COFFEE = ['..O.O....', '.O.O.....', '.........', 'OOOOOOO..', 'OWWWWWOOO', 'OWzzzWO.O', 'OWzzzWOOO', 'OWWWWWO..', '.OOOOO...'];
  const DONUT = ['..OOOOO..', '.OPPPPPO.', 'OPWPOPPPO', 'OPPO.OPPO', 'OyyOOOyyO', '.OyyyyyO.', '..OOOOO..'];
  const HEART = ['.OO...OO.', 'OPPO.OPPO', 'OPWPOPPPO', 'OPPPPPPPO', '.OPPPPPO.', '..OPPPO..', '...OPO...', '....O....'];
  const HEART_EMPTY = HEART.map(r => r.replace(/[PW]/g, 'g'));
  const MOON = ['..OOOO.', '.OXXXO.', 'OXXXO..', 'OXXO...', 'OXXXO..', '.OXXXO.', '..OOOO.'];
  const SPARK = ['..Y..', '..Y..', 'YYWYY', '..Y..', '..Y..'];
  const ZZ = ['OOO', '..O', '.O.', 'OOO'];
  const PLANT = ['..O.O..', '.OMOMO.', 'OMmOmMO', '.OMMMO.', '..OmO..', '.OOOOO.', '.OZZZO.', '.OZZZO.', '..OOO..'];
  const SPEAKER = ['...O....', '..OO..O.', 'OOWO.O.O', 'OWWO...O', 'OWWO...O', 'OOWO.O.O', '..OO..O.', '...O....'];
  const SPEAKER_OFF = ['...O....', '..OO....', 'OOWO.O.O', 'OWWO..O.', 'OWWO..O.', 'OOWO.O.O', '..OO....', '...O....'];
  const ARROW_L = ['...O', '..OO', '.OWO', 'OWWO', '.OWO', '..OO', '...O'];
  const ARROW_R = ARROW_L.map(r => r.split('').reverse().join(''));
  const LOCK = ['.OOO.', 'O...O', 'OOOOO', 'OYOYO', 'OYYYO', 'OOOOO'];
  const CROWN = ['O..O..O', 'OYOYOYO', 'OYYWYYO', 'OYYYYYO', 'OOOOOOO'];
  const KAREN_A = [
    '...OOOOOOOOOO...', '..OLlLlLlLlLlO..', '.OLlLlLlLlLlLlO.', '.OlLlLlLlLlLlLO.', '.OLLFFFFFFFFLLO.',
    '.OLFOOFFFFOOFLO.', '.OLFFKFFFFKFFLO.', '.OLFRRFFFFRRFLO.', '..OFFFOOOOFFFO..', '..OFFFOrrOFFFO..',
    '...OOFOOOOFOO...', '....OZZZZZZO....', '..OOZZZYYZZZOO..', '.OZOZZZZZZZZOZO.', '.OFOZZZZZZZZOFO.',
    '..OOnnnnnnnnOO..', '...OnnnOOnnnO...', '...OOOO..OOOO...',
  ];
  const KAREN_M = [
    '....OOOOOOOO....', '...OFFFFFFFFO...', '..OFFWFFFFFFFO..', '..OhFFFFFFFFhO..', '.OhFOOFFFFOOFhO.',
    '.OhFFKFFFFKFFhO.', '.OhFRRFFFFRRFhO.', '..OFFkkkkkkFFO..', '..OFFFOrrOFFFO..', '...OOFOOOOFOO...',
    '....OWWWWWWO....', '..OOnnnWRWnnOO..', '.OnOnnnnRnnnOnO.', '.OFOnnnnnnnnOFO.', '..OOddddddddOO..',
    '...OdddOOdddO...', '...OOOO..OOOO...',
  ];
  const KAREN_Y = [
    '...OOOOOOOOOO...', '..ORRRRRRRRRRO..', '.ORRRRRRRRRRRROO', '..OhFFFFFFFFhO..', '..OFOOOOOOOOFO..',
    '..OFOKKOOKKOFO..', '..OFFFFFFFFFFO..', '..OFFFOOOOFFFO..', '...OOFFFFFFOO...', '....OggggggO....',
    '..OOggggggggOO..', '.OgOggggggggOgO.', '.OFOggggggggOFO.', '..OOddddddddOO..', '...OdddOOdddO...',
    '...OOOO..OOOO...',
  ];
  const KAREN_TYPES = [KAREN_A, KAREN_M, KAREN_Y];
  const KAREN_LINES = ['어이~ 아가씨!', '원장 불러!', '내가 누군지 알아?', 'VIP 병실 없어?', '아까 부른 게 언젠데!', '우리 애 먼저 봐줘!', '주사 안 아프게 놔!'];
  const STEAM = ['.O..O.', 'O.OO.O', '.O..O.'];

  // ---------- 꾸미기 목록 (누적 점수로 해금) ----------
  // 그림 좌표는 간호사 스프라이트(16x22) 기준. 머리 0~4줄, 눈 7~8줄(5·10칸), 몸 13~17줄
  const LOOKS = {
    scrub: [
      { name: '하늘', q: 'q', Q: 'Q', need: 0 }, { name: '분홍', q: 'u', Q: 'U', need: 5000 },
      { name: '민트', q: 'v', Q: 'V', need: 10000 }, { name: '남색', q: 's', Q: 'n', need: 20000 },
      { name: '줄무늬', q: 's', Q: 'n', pat: 'stripe', need: 28000 }, { name: '보라', q: 'L', Q: 'l', need: 35000 },
      { name: '노랑', q: 'Y', Q: 'y', need: 50000 }, { name: '하와이안', q: 'S', Q: 'B', pat: 'hawaii', need: 65000 },
      { name: '빨강', q: 'R', Q: 'r', need: 80000 }, { name: '검정', q: 'e', Q: 'E', need: 120000 },
      { name: '무지개', q: 'q', Q: 'Q', pat: 'rainbow', need: 250000 },
    ],
    hair: [
      { name: '갈색', c: 'h', need: 0 }, { name: '검정', c: 'd', need: 0 }, { name: '금발', c: 'H', need: 15000 },
      { name: '빨강', c: 'R', need: 26000 }, { name: '분홍', c: 'u', need: 40000 }, { name: '초록', c: 'M', need: 55000 },
      { name: '보라', c: 'L', need: 70000 }, { name: '파랑', c: 'S', need: 85000 }, { name: '은발', c: 'G', need: 100000 },
      { name: '대머리', c: 'F', bald: true, need: 140000 }, { name: '무지개', c: 'rb', need: 300000 },
    ],
    head: [
      { name: '없음', need: 0 }, { name: '머리띠', need: 3000 }, { name: '리본', need: 8000 }, { name: '꽃핀', need: 12000 },
      { name: '새싹', need: 18000 }, { name: '간호사 모자', need: 25000 }, { name: '바나나 핀', need: 32000 }, { name: '토끼 귀', need: 38000 },
      { name: '고양이 귀', need: 45000 }, { name: '붕대 칭칭', need: 52000 }, { name: '안테나', need: 60000 }, { name: '수술 모자', need: 68000 },
      { name: '헤드셋', need: 76000 }, { name: '아이스팩', need: 88000 }, { name: '냄비', need: 105000 }, { name: '링거팩', need: 125000 },
      { name: '산타 모자', need: 150000 }, { name: '무지개 아프로', need: 190000 }, { name: '천사 고리', need: 240000 }, { name: '왕관', need: 400000 },
    ],
    face: [
      { name: '없음', need: 0 }, { name: '볼하트', need: 4000 }, { name: '안경', need: 12000 }, { name: '반창고', need: 20000 },
      { name: '다크서클', need: 27000 }, { name: '하트 눈', need: 36000 }, { name: '선글라스', need: 46000 }, { name: '코피 휴지', need: 58000 },
      { name: '마스크', need: 72000 }, { name: '콧수염', need: 90000 }, { name: '별 볼', need: 110000 }, { name: '눈물 줄줄', need: 135000 },
      { name: '빙글 안경', need: 165000 }, { name: '피에로 코', need: 210000 }, { name: '외눈 안경', need: 280000 },
    ],
    badge: [
      { name: '이름표', need: 0 }, { name: '별 배지', need: 6000 }, { name: '하트 배지', need: 14000 }, { name: '텀블러', need: 22000 },
      { name: '청진기', need: 30000 }, { name: '펜라이트', need: 40000 }, { name: '차트판', need: 50000 }, { name: '체온계', need: 62000 },
      { name: '삼각김밥', need: 78000 }, { name: '에너지 음료', need: 95000 }, { name: '왕 주사기', need: 120000 }, { name: '장갑 풍선', need: 150000 },
      { name: '메가폰', need: 200000 }, { name: '금 배지', need: 350000 },
    ],
    pet: [
      { name: '없음', need: 0 }, { name: '병아리', need: 15000 }, { name: '알약 친구', need: 33000 }, { name: '고양이', need: 56000 },
      { name: '수액팩 친구', need: 82000 }, { name: '유령', need: 115000 }, { name: '반짝 별', need: 160000 }, { name: '미니 진상', need: 230000 },
    ],
  };
  const LOOK_KEYS = ['scrub', 'hair', 'head', 'face', 'badge', 'pet'];
  const LOOK_LABEL = { scrub: '근무복', hair: '머리색', head: '머리', face: '얼굴', badge: '소품', pet: '펫' };
  const FURN = [
    { k: 'sofa', name: '소파', need: 0 }, { k: 'plant', name: '화분', need: 5000 }, { k: 'coffee', name: '커피머신', need: 10000 },
    { k: 'frame', name: '액자', need: 16000 }, { k: 'ramen', name: '컵라면 탑', need: 21000 }, { k: 'rug', name: '러그', need: 26000 },
    { k: 'lamp', name: '조명', need: 32000 }, { k: 'bag', name: '침낭', need: 39000 }, { k: 'fridge', name: '냉장고', need: 46000 },
    { k: 'resign', name: '사직서 액자', need: 54000 }, { k: 'tv', name: 'TV', need: 62000 }, { k: 'clock', name: '퇴근 시계', need: 70000 },
    { k: 'fish', name: '어항', need: 80000 }, { k: 'drinks', name: '음료 탑', need: 92000 }, { k: 'cat', name: '고양이', need: 105000 },
    { k: 'pole', name: '링거 옷걸이', need: 120000 }, { k: 'mic', name: '노래방', need: 140000 }, { k: 'massage', name: '안마의자', need: 165000 },
    { k: 'hammock', name: '해먹', need: 200000 }, { k: 'trophy', name: '트로피', need: 300000 },
  ];
  // 해금 점수 배율: 잘하는 한 판이 5만~8만 점이라 오래 모으도록 3배
  const NEED_SCALE = 3;
  LOOK_KEYS.forEach(k => LOOKS[k].forEach(x => { x.need *= NEED_SCALE; }));
  FURN.forEach(f => { f.need *= NEED_SCALE; });
  const ITEM_COUNT = LOOK_KEYS.reduce((a, k) => a + LOOKS[k].length, 0) + FURN.length;
  function lookParse(s) {
    const a = String(s || '').split('.').map(n => parseInt(n, 10));
    const o = {};
    LOOK_KEYS.forEach((k, i) => { const v = a[i]; o[k] = Number.isInteger(v) && v >= 0 && v < LOOKS[k].length ? v : 0; });
    return o;
  }
  const lookStr = o => LOOK_KEYS.map(k => o[k] || 0).join('.');
  function unlockedCount(total) {
    return LOOK_KEYS.reduce((a, k) => a + LOOKS[k].filter(x => x.need <= total).length, 0) + FURN.filter(f => f.need <= total).length;
  }
  function unlockedNames(from, to) {
    const out = [];
    LOOK_KEYS.forEach(k => LOOKS[k].forEach(x => { if (x.need > from && x.need <= to) out.push(x.name); }));
    FURN.forEach(f => { if (f.need > from && f.need <= to) out.push(f.name); });
    return out;
  }
  const RIBBON = ['OO.OO', 'OPOPO', '.OPO.', 'OPOPO', 'OO.OO'];
  const HEAD_DRAW = [
    null,
    () => sprite(2, 3, ['OOOOOOOOOOOO', 'OPPPPPPPPPPO', 'OOOOOOOOOOOO']),
    () => sprite(10, 0, RIBBON),
    () => sprite(11, 4, ['.O.', 'OYO', '.O.']),
    () => sprite(5, -5, ['OM.MO', 'OMOMO', '.OMO.', '..O..', '..O..']),
    () => sprite(2, -3, ['...OOOOOO...', '..OWWWWWWO..', '.OWWWRWWWWO.', 'OWWWRRRWWWWO', 'OOOOOOOOOOOO']),
    () => sprite(9, -3, ['....OO', '...OYO', '..OYYO', '.OYYO.', 'OYYO..', 'OOO...']),
    () => { sprite(3, -7, ['.O.', 'OWO', 'OPO', 'OPO', 'OWO', 'OWO']); sprite(10, -7, ['.O.', 'OWO', 'OPO', 'OPO', 'OWO', 'OWO']); },
    () => { sprite(1, -1, ['O...', 'OO..', 'OPO.', 'OPPO']); sprite(11, -1, ['...O', '..OO', '.OPO', 'OPPO']); },
    () => sprite(1, 2, ['OOOOOOOOOOOOOO', 'OWWWWWWWWWWWWO', 'OWWRWWWWWWWWWO', 'OOOOOOOOOOOOOO']),
    () => sprite(6, -6 - ((G.t * 3 | 0) % 2), ['.OO.', 'ORRO', '.OO.', '..O.', '..O.', '..O.']),
    () => sprite(1, -2, ['...OOOOOOOO...', '.OOvvvvvvvvOO.', 'OvvvvvvvvvvvvO', 'OvVvVvVvVvVvvO', 'OOOOOOOOOOOOOO']),
    () => { sprite(1, 1, ['..OOOOOOOOOO..', '.O..........O.']); sprite(0, 6, ['OO', 'gO', 'gO', 'OO']); sprite(14, 6, ['OO', 'Og', 'Og', 'OO']); sprite(12, 10, ['OOO']); },
    () => sprite(3, -2, ['OOOOOOOOOO', 'OSSSSSSSSO', 'OSWSSSSSSO', 'OOOOOOOOOO']),
    () => { sprite(1, -5, ['......OO......', '.....OggO.....', '.OOOOOOOOOOOO.', 'OgWggggggggggO', 'OggggggggggggO', 'OOOOOOOOOOOOOO']); sprite(-1, -3, ['OO']); sprite(15, -3, ['OO']); },
    () => sprite(5, -10, ['OOOOOO', 'OWSSWO', 'OSSSSO', 'OSSSSO', '.OSSO.', '..OO..', '...O..', '...O..', '...O..', '...O..']),
    () => { sprite(1, -5, ['......OOOO..', '....OORRRROO', '..ORRRRRRRRO', '.ORRRRRRRRRO', 'OWWWWWWWWWWWWO', 'OOOOOOOOOOOOOO']); sprite(12, -7, ['OO', 'OWO', '.O']); },
    () => sprite(0, -6, ['....OOOOOOOO....', '..OOPPPPPPPPOO..', '.OPPYYYYYYYYPPO.', 'OPYYMMMMMMMMYYPO', 'OPYMMSSSSSSMMYPO', 'OPYMSLLLLLLSMYPO', 'OPYMSL....LSMYPO']),
    () => sprite(3, -6 - ((G.t * 2 | 0) % 2), ['.OOOOOOOO.', 'OYYYYYYYYO', '.OOOOOOOO.']),
    () => sprite(5, -4, CROWN),
  ];
  const FACE_DRAW = [
    null,
    () => { sprite(3, 9, ['P.P', '.P.']); sprite(10, 9, ['P.P', '.P.']); },
    () => sprite(3, 6, ['OOOO..OOOO', 'O..OOOO..O', 'OOOO..OOOO']),
    () => sprite(10, 9, ['yyy', 'yWy']),
    () => { sprite(4, 9, ['lll....lll'.slice(0, 3)]); sprite(9, 9, ['lll']); },
    () => { sprite(4, 6, ['P.P', 'PPP', '.P.']); sprite(9, 6, ['P.P', 'PPP', '.P.']); },
    () => sprite(3, 6, ['OOOOOOOOOO', 'OKKKOOKKKO', '.OOO..OOO.']),
    () => sprite(7, 9, ['WW', 'WW', '.R', '.R']),
    () => sprite(3, 9, ['OOOOOOOOOO', 'OWWWWWWWWO', 'OWWWWWWWWO', '.OOOOOOOO.']),
    () => sprite(3, 9, ['.OO....OO.', 'OkkO..OkkO', '.OkkOOkkO.', '..OOOOOO..']),
    () => { sprite(2, 8, ['.Y.', 'YWY', '.Y.']); sprite(11, 8, ['.Y.', 'YWY', '.Y.']); },
    () => { const k = (G.t * 6 | 0) % 3; sprite(5, 9, ['S', 'S', 'S', 'S'].slice(0, 2 + k)); sprite(10, 9, ['S', 'S', 'S', 'S'].slice(0, 2 + k)); },
    () => sprite(3, 5, ['.OOO..OOO.', 'OWOWOOWOWO', 'OOWOO.OWOO', '.OOO..OOO.']),
    () => sprite(6, 8, ['.OO.', 'ORRO', 'ORWO', '.OO.']),
    () => { sprite(9, 6, ['OOO', 'OWO', 'OOO']); sprite(11, 9, ['O.', 'O.', '.O']); },
  ];
  const BADGE_DRAW = [
    null,
    () => sprite(9, 13, ['.O.', 'OYO', '.O.']),
    () => sprite(9, 13, ['P.P', 'PPP', '.P.']),
    () => sprite(13, 13, ['OOO', 'OWO', 'OZO', 'OZO', 'OOO']),
    () => sprite(4, 12, ['O......O', 'gO....Og', '.g....g.', '.g....g.', '..gggg..', '....OO..', '....OgO.']),
    () => sprite(5, 13, ['Y', 'g', 'g']),
    () => sprite(-2, 12, ['OOOO', 'OWWO', 'OWgO', 'OWgO', 'OWWO', 'OOOO']),
    () => sprite(5, 13, ['W', 'W', 'R']),
    () => sprite(12, 13, ['..O..', '.OWO.', 'OWWWO', 'OkkkO', 'OOOOO']),
    () => sprite(13, 12, ['OOO', 'OYO', 'ORO', 'OYO', 'OOO']),
    () => sprite(11, 8, ['......O', '.....O.', '....OSO', '...OSSO', '..OSSO.', '.OSSO..', 'OOO....']),
    () => sprite(12, 2 - ((G.t * 2 | 0) % 2), ['.O.O.O.', 'OSOSOSO', 'OSSSSSO', '.OSSSO.', '..OSO..', '...O...', '...O...', '...O...', '...O...', '...O...', '...O...']),
    () => sprite(12, 11, ['....OO', '...ORO', 'OOORRO', 'OWWRRO', 'OOORRO', '...ORO', '....OO']),
    () => sprite(9, 13, ['OYO', 'YWY', 'OYO']),
  ];
  const PET_DRAW = [
    null,
    () => sprite(0, 0, ['..OOO..', '.OYYYO.', 'OYKYYYO', 'OYYYYyy', '.OYYYO.', '..O.O..']),
    () => sprite(0, 0, ['.OOO.', 'OPPPO', 'OKPKO', 'OOOOO', 'OWWWO', '.OOO.']),
    () => sprite(0, 0, ['O...O.', 'OO.OO.', 'OZZZO.', 'OKZKO.', 'OZPZO.', '.OOO..']),
    () => sprite(0, 0, ['OOOOO', 'OWSSO', 'OKSKO', 'OSSSO', '.OSO.', '..O..', '..O..']),
    () => sprite(0, 0, ['.OOO.', 'OWWWO', 'OKWKO', 'OWWWO', 'OWWWO', 'O.O.O']),
    () => sprite(0, 0, STAR),
    () => { sprite(0, 0, ['.OOOO.', 'OLlLlO', 'OFFFFO', 'OKFFKO', 'OFrrFO', '.OOOO.']); sprite(6, -3, ['O.O', '.O.']); },
  ];

  // 간호사 그리기: 근무복·머리색을 바꾸고 무늬·장식·펫을 겹쳐 그림
  function nurse(x, y, look, opt = {}) {
    const lk = typeof look === 'string' ? lookParse(look) : (look || lookParse(''));
    const sc = LOOKS.scrub[lk.scrub], hr = LOOKS.hair[lk.hair];
    const hc = hr.c === 'rb' ? rb(0) : hr.c;
    const rows = opt.mood === 'tired' ? NURSE_TIRED : opt.mood === 'joy' ? NURSE_JOY : opt.blink ? NURSE_BLINK : NURSE;
    const draw = () => {
      sprite(0, 0, rows, { map: { q: sc.q, Q: sc.Q, h: hc } });
      if (hr.bald) { px(6, 2, 'W'); px(7, 2, 'W'); px(5, 3, 'W'); }
      if (sc.pat === 'stripe') { rect(4, 14, 8, 1, 'W'); rect(4, 16, 8, 1, 'W'); rect(4, 18, 4, 1, 'W'); rect(9, 18, 3, 1, 'W'); }
      else if (sc.pat === 'hawaii') { px(5, 14, 'P'); px(8, 15, 'Y'); px(6, 16, 'Y'); px(10, 16, 'P'); px(7, 13, 'W'); px(9, 13, 'P'); }
      else if (sc.pat === 'rainbow') { for (let j = 0; j < 4; j++) rect(4, 13 + j, 8, 1, rb(j)); }
      const b = BADGE_DRAW[lk.badge]; if (b) b();
      const f = FACE_DRAW[lk.face]; if (f) f();
      const hd = HEAD_DRAW[lk.head]; if (hd) hd();
      const pt = PET_DRAW[lk.pet];
      if (pt && !opt.noPet) { ctx.save(); ctx.translate(17, 4 + ((G.t * 2 | 0) % 2)); pt(); ctx.restore(); }
    };
    const s = opt.scale || 1;
    if (opt.flip) { ctx.save(); ctx.translate(Math.round(x) + 16 * s, Math.round(y)); ctx.scale(-s, s); draw(); ctx.restore(); }
    else big(draw, x, y, s);
  }
  // 랭킹·채팅용 작은 얼굴 (머리색 + 근무복 깃 색)
  function miniHead(x, y, look) {
    const lk = typeof look === 'string' ? lookParse(look) : look;
    const hc = LOOKS.hair[lk.hair].c, sc = LOOKS.scrub[lk.scrub].q;
    sprite(x, y, ['.OOOOO.', 'OaaaaaO', 'OaFFFaO', 'OFKFKFO', '.ObbbO.'], { map: { a: hc, b: sc } });
    if (lk.head === 7) sprite(x + 1, y - 3, ['O.O.O', 'OYYYO', 'OOOOO']);
  }

  // ---------- 효과음 ----------
  let actx = null;
  let soundOn = store.get('nn_sound', '1') !== '0';
  function unlockAudio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
    if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  }
  function beep(freq, dur, type = 'square', vol = 0.05, when = 0, slide = 0) {
    if (!soundOn || !actx) return;
    const t = actx.currentTime + when;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  const SFX = {
    tap: () => beep(660, 0.05, 'square', 0.04),
    pop: () => { beep(880, 0.06); beep(1320, 0.08, 'square', 0.04, 0.05); },
    big: () => [660, 880, 1100, 1320].forEach((f, i) => beep(f, 0.08, 'square', 0.045, i * 0.045)),
    stamp: () => { beep(140, 0.12, 'square', 0.07); beep(90, 0.15, 'triangle', 0.08, 0.03); },
    miss: () => beep(240, 0.25, 'sawtooth', 0.05, 0, -130),
    gulp: () => [520, 620, 740].forEach((f, i) => beep(f, 0.07, 'triangle', 0.07, i * 0.07)),
    event: () => { beep(988, 0.08, 'square', 0.05); beep(988, 0.08, 'square', 0.05, 0.14); },
    hit: () => beep(200 + Math.random() * 120, 0.05, 'square', 0.06),
    fever: () => [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, 0.07, 'square', 0.045, i * 0.05)),
    clear: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.12, 'triangle', 0.07, i * 0.09)),
    over: () => [392, 330, 262, 196].forEach((f, i) => beep(f, 0.2, 'triangle', 0.07, i * 0.17)),
    wrong: () => beep(180, 0.1, 'square', 0.04),
  };

  // ---------- 병동·날짜 ----------
  const WARDS = ['', '내과병동', '외과병동', '중환자실', '응급실', '소아병동', '산부인과', '정형외과', '신경과', '암병동', '수술실', '외래', '간호부'];
  const wardName = w => w || '무소속';
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(a) {
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  // ---------- 아이디 (기기마다 고정, 세 군데에 저장 + 복구 코드) ----------
  const NET = /*NET*/null;
  function randHex(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); }
  function newUuid() {
    const h = randHex(16);
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-' + ((parseInt(h[16], 16) & 3) | 8).toString(16) + h.slice(17, 20) + '-' + h.slice(20, 32);
  }
  const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function newCode() { const a = new Uint8Array(8); crypto.getRandomValues(a); return Array.from(a, b => CODE_ABC[b % CODE_ABC.length]).join(''); }
  const showCode = c => c ? c.slice(0, 4) + '-' + c.slice(4) : '';
  const validId = o => o && /^[0-9a-f-]{36}$/.test(o.uid || '') && String(o.secret || '').length >= 32 && /^[A-Z2-9]{8}$/.test(o.code || '');
  const Ident = {
    uid: '', secret: '', code: '',
    fromSync() {
      const a = { uid: store.get('nn_uid', ''), secret: store.get('nn_secret', ''), code: store.get('nn_code', '') };
      if (validId(a)) return a;
      const c = cookieGet('nn_id').split('|');
      const b = { uid: c[0], secret: c[1], code: c[2] };
      return validId(b) ? b : null;
    },
    async load() {
      let id = this.fromSync();
      if (!id) {
        // localStorage·쿠키가 지워졌으면 IndexedDB에서 찾아봄 (느리면 0.8초까지만 기다림)
        const v = await Promise.race([IDB.get('id'), new Promise(r => setTimeout(() => r(null), 800))]);
        if (validId(v)) id = v;
      }
      if (!id) id = { uid: newUuid(), secret: randHex(24), code: newCode() };
      this.set(id);
      // 브라우저에 저장소를 지우지 말아 달라고 요청 (지원할 때만)
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* 무시 */ }
    },
    set(id) {
      this.uid = id.uid; this.secret = id.secret; this.code = id.code;
      store.set('nn_uid', id.uid); store.set('nn_secret', id.secret); store.set('nn_code', id.code);
      cookieSet('nn_id', [id.uid, id.secret, id.code].join('|'));
      IDB.set('id', { uid: id.uid, secret: id.secret, code: id.code });
    },
  };
  // 이름·병동·꾸미기·누적 점수도 두 군데에 저장
  function saveProfile() {
    const p = { nick: G.nick, ward: G.ward, look: lookStr(G.look), total: G.total, best: G.best };
    store.set('nn_profile', JSON.stringify(p));
    IDB.set('profile', p);
  }
  function applyProfile(p, force) {
    if (!p) return;
    if (p.nick && (force || !G.nick)) G.nick = Array.from(String(p.nick)).slice(0, 5).join('');
    if (WARDS.includes(p.ward) && (force || !G.ward)) G.ward = p.ward;
    if (p.look && (force || lookStr(G.look) === '0.0.0.0.0.0')) G.look = lookParse(p.look);
    const tot = Number(p.total) || 0;
    if (tot > G.total) G.total = Math.floor(tot);
    const b = Number(p.best) || 0;
    if (b > G.best) G.best = Math.floor(b);
  }

  // ---------- 랭킹 (Supabase 공용 → 없으면 이 기기) ----------
  async function netCall(method, path, body) {
    const res = await fetch(NET.url.replace(/\/$/, '') + path, {
      method,
      headers: { apikey: NET.key, Authorization: 'Bearer ' + NET.key, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error('http ' + res.status);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  function cleanRow(d) {
    if (!d) return null;
    const best = Number(d.best);
    if (!Number.isFinite(best) || best < 0) return null;
    const day = typeof d.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.day) ? d.day : '';
    const dayBest = Number(d.dayBest !== undefined ? d.dayBest : d.day_best);
    return {
      id: d.id ? String(d.id) : null,
      nick: String(d.nick || '익명').slice(0, 8),
      best: Math.floor(best),
      total: Math.max(0, Math.floor(Number(d.total) || 0)),
      look: lookParse(d.look),
      ward: WARDS.includes(d.ward) ? d.ward : '',
      day, dayBest: day && Number.isFinite(dayBest) && dayBest > 0 ? Math.floor(dayBest) : 0,
    };
  }
  const Rank = {
    net: false, status: 'ok', rows: [], local: [],
    init() {
      try { this.local = JSON.parse(store.get('nn_local_rank', '[]')).map(cleanRow).filter(Boolean); } catch (e) { this.local = []; }
      if (NET && NET.url && NET.key) { this.net = true; this.status = 'loading'; this.refresh(); }
    },
    async refresh() {
      if (!this.net) return;
      const timer = setTimeout(() => { if (this.status === 'loading') this.status = 'slow'; }, 10000);
      try {
        const data = await netCall('GET', '/rest/v1/nn_scores?select=id,nick,ward,look,best,total,day,dayBest:day_best&order=best.desc,at.asc&limit=300');
        this.rows = (Array.isArray(data) ? data : []).map(cleanRow).filter(Boolean);
        this.status = 'ok';
        // 내 줄이 있으면 이름·누적 점수 등을 되살림 (이 기기 저장소가 지워졌을 때)
        const mine = this.mine();
        if (mine) { applyProfile({ nick: mine.nick, ward: mine.ward, look: lookStr(mine.look), total: mine.total, best: mine.best }); saveProfile(); }
      } catch (e) { this.status = 'error'; } finally { clearTimeout(timer); }
    },
    all() { return this.net ? this.rows : this.local; },
    mine() { return this.net ? this.rows.find(r => r.id === Ident.uid) || null : this.local.find(r => r.nick === G.nick) || null; },
    list(tab) {
      const rows = this.all();
      if (tab === 'day') {
        const today = todayStr();
        return rows.filter(r => r.day === today && r.dayBest > 0).map(r => Object.assign({}, r, { score: r.dayBest })).sort((a, b) => b.score - a.score);
      }
      if (tab === 'ward') {
        const m = new Map();
        rows.forEach(r => {
          if (!r.ward || r.best <= 0) return;
          const t = m.get(r.ward) || { ward: r.ward, count: 0, score: 0 };
          t.count++; t.score += r.best; m.set(r.ward, t);
        });
        return [...m.values()].sort((a, b) => b.score - a.score);
      }
      return rows.filter(r => r.best > 0).map(r => Object.assign({}, r, { score: r.best }));
    },
    rankOf(tab, score) { return this.list(tab).filter(r => r.score > score).length + 1; },
    saveLocal(rec) {
      let ex = this.local.find(r => r.nick === G.nick);
      if (!ex) { ex = { id: null, nick: G.nick, best: 0, total: 0, look: G.look, ward: '', day: '', dayBest: 0 }; this.local.push(ex); }
      ex.look = G.look; ex.ward = G.ward; ex.total = G.total;
      if (rec && rec.mode === 'normal' && rec.score > ex.best) ex.best = rec.score;
      if (rec && rec.mode === 'daily' && (ex.day !== rec.day || rec.score > ex.dayBest)) { ex.day = rec.day; ex.dayBest = rec.score; }
      this.local.sort((a, b) => b.best - a.best);
      store.set('nn_local_rank', JSON.stringify(this.local.slice(0, 40).map(r => Object.assign({}, r, { look: lookStr(r.look) }))));
    },
    async write(rec) {
      await netCall('POST', '/rest/v1/rpc/nn_submit', {
        p_id: Ident.uid, p_secret: Ident.secret, p_code: Ident.code, p_nick: G.nick, p_ward: G.ward, p_look: lookStr(G.look),
        p_best: rec && rec.mode === 'normal' ? rec.score : 0, p_total: G.total,
        p_day: rec && rec.mode === 'daily' ? rec.day : null, p_day_best: rec && rec.mode === 'daily' ? rec.score : 0,
      });
      await this.refresh();
    },
    async submit(mode, score) {
      const rec = { mode, score, day: todayStr() };
      const tab = mode === 'daily' ? 'day' : 'me';
      if (!G.nick) return { code: 'local', rank: 0 };
      this.saveLocal(rec);
      if (!this.net) return { code: 'local', rank: this.rankOf(tab, score) };
      const mine = this.mine();
      const better = mode === 'daily' ? !(mine && mine.day === rec.day && mine.dayBest >= score) : !(mine && mine.best >= score);
      try {
        await this.write(rec);
        return better ? { code: 'saved', rank: this.rankOf(tab, score) } : { code: 'nobest', best: mode === 'daily' ? mine.dayBest : mine.best };
      } catch (e) { return { code: 'fail' }; }
    },
    // 이름·병동·꾸미기가 바뀌면 반영 (처음 이름을 정할 때 내 줄과 복구 코드가 서버에 생김)
    async updateProfile() {
      if (!G.nick) return;
      this.saveLocal(null);
      if (!this.net) return;
      try { await this.write(null); } catch (e) { /* 무시 */ }
    },
    async restore(code) {
      if (!this.net) return 'offline';
      try {
        const rows = await netCall('POST', '/rest/v1/rpc/nn_restore', { p_code: code });
        const r = Array.isArray(rows) ? rows[0] : null;
        if (!r || !validId({ uid: r.id, secret: r.secret, code: r.code })) return 'notfound';
        Ident.set({ uid: r.id, secret: r.secret, code: r.code });
        G.nick = ''; G.total = 0; G.best = 0;
        applyProfile({ nick: r.nick, ward: r.ward, look: r.look, total: r.total, best: r.best }, true);
        saveProfile();
        await this.refresh();
        return 'ok';
      } catch (e) { return 'fail'; }
    },
  };

  // ---------- 게임 상태 ----------
  const SHIFT = 135;            // 한 판 길이(초): 22시 → 07시
  const BEDS = [[8, 66], [86, 66], [8, 114], [86, 114], [8, 162], [86, 162]];
  const ROOMS = ['701', '702', '703', '704', '705', '706'];
  const HAIRS = ['h', 'g', 'k', 'H', 'd', 'h'];
  const EVENTS = [{ at: 0.28, type: 'karen' }, { at: 0.45, type: 'round' }, { at: 0.70, type: 'karen' }, { at: 0.86, type: 'round' }];
  const CARDS = [
    ['항생제 투약', '진통제 주사', '수액 교체', '혈압약 복용', '인슐린 주사'],
    ['혈액 검사', '혈당 체크', '체온 측정', 'X-ray 이송', '소변 검사'],
    ['간호 기록', '인계장 작성', '낙상 평가', '통증 기록', '섭취량 기록'],
  ];
  const BIN = [{ name: '투약', fill: 'P', dark: 'p' }, { name: '검사', fill: 'S', dark: 'B' }, { name: '기록', fill: 'M', dark: 'm' }];
  const B_BINS = [0, 1, 2].map(i => ({ x: 4 + i * 41, y: 150, w: 38, h: 34 }));
  const CALL_KINDS = ['drip', 'pain', 'water', 'call'];
  const CALL_ICON = { drip: DROP, pain: PILL, water: CUP, call: BELL, demand: ANGRY };
  const CALL_NAME = { drip: '수액 교체', pain: '진통제', water: '물 한 잔', call: '호출 응답', demand: '거절!' };

  const G = {
    state: 'title', t: 0, st: 0, mode: 'normal',
    nick: store.get('nn_nick', ''), ward: '', look: lookParse(''), total: 0, best: 0,
    rankTab: 'me', tutPage: 0, loungeSel: -1,
  };
  try { applyProfile(JSON.parse(store.get('nn_profile', 'null'))); } catch (e) { /* 무시 */ }

  function newGame(mode) {
    const seed = mode === 'daily' ? hashStr('nn-' + todayStr()) : (Math.random() * 4294967296) >>> 0;
    Object.assign(G, {
      state: 'play', st: 0, mode, rng: mulberry32(seed),
      score: 0, combo: 0, maxCombo: 0, stamina: 100, elapsed: 0,
      calls: [null, null, null, null, null, null], moodT: [0, 0, 0, 0, 0, 0], moodK: ['', '', '', '', '', ''],
      nx: 56, ny: 110, ntx: 56, nty: 110, nflip: false,
      items: [], fx: [], fever: 0, shake: 0,
      stats: { calls: 0, karens: 0, coffee: 0, missed: 0, demands: 0 },
      event: null, evIdx: 0, nextSpawn: 1.2, nextItem: 8, noteText: '', noteT: 0,
      overMsg: null, success: false, newBest: false, unlockMsg: '',
    });
    note('밤 근무 시작!', 'S');
  }
  function note(text, col) { G.noteText = text; G.noteCol = col || 'Y'; G.noteT = 1.6; }
  function fx(x, y, text, col = 'Y', f = 's') { G.fx.push({ x, y, text, col, f, t: 0 }); }
  const prog = () => G.elapsed / SHIFT;
  function clockStr() {
    const mins = Math.floor(22 * 60 + prog() * 9 * 60) % (24 * 60);
    return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  }
  // 바쁜 정도: 새벽 3~4시가 가장 바쁨
  function busy() { const d = prog(); return d < 0.62 ? d / 0.62 : 1 - (d - 0.62) * 0.7; }

  function spawnCall() {
    const free = G.calls.map((c, i) => c ? -1 : i).filter(i => i >= 0 && G.moodT[i] <= 0);
    if (!free.length) return;
    const b = free[Math.floor(G.rng() * free.length)];
    const c = busy();
    const demand = G.rng() < 0.08 + 0.12 * c;
    G.calls[b] = { kind: demand ? 'demand' : CALL_KINDS[Math.floor(G.rng() * 4)], age: 0, life: 5.4 - 2.4 * c, taps: 0 };
  }
  function tapBed(i) {
    const c = G.calls[i];
    const [bx, by] = BEDS[i];
    G.ntx = i % 2 ? 66 : 46; G.nty = by - 4; G.nflip = i % 2 === 0;
    if (!c) return;
    if (c.kind === 'demand' && c.taps < 2) {
      c.taps++;
      fx(bx + 17, by - 10, '거절!', 'R', 'm'); SFX.stamp();
      return;
    }
    const speed = Math.max(0, 1 - c.age / c.life);
    G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
    let gain = (c.kind === 'demand' ? 300 : 100) + Math.round(speed * 100);
    gain = Math.round(gain * (1 + Math.min(G.combo, 20) * 0.05) * (G.fever > 0 ? 2 : 1) / 10) * 10;
    G.score += gain;
    G.stats.calls++;
    if (c.kind === 'demand') { G.stats.demands++; fx(bx + 17, by - 12, '쾅! 거절', 'R', 'm'); SFX.stamp(); }
    else { fx(bx + 17, by - 12, '팡!', 'Y', 'b'); SFX.pop(); }
    fx(bx + 17, by + 2, '+' + gain, 'm');
    G.calls[i] = null; G.moodT[i] = 1.4; G.moodK[i] = 'happy';
    if (G.combo % 15 === 0 && G.fever <= 0) { G.fever = 8; note('집중 모드! 점수 2배', 'Y'); SFX.fever(); }
  }
  function missCall(i) {
    const [bx, by] = BEDS[i];
    G.calls[i] = null; G.moodT[i] = 1.6; G.moodK[i] = 'pain';
    G.stamina -= 12; G.combo = 0; G.fever = 0; G.stats.missed++;
    G.shake = 0.25;
    fx(bx + 17, by - 10, '놓쳤어요..', 'R');
    SFX.miss();
  }
  function startEvent(type) {
    if (type === 'karen') {
      const k = Math.floor(G.rng() * 3), line = KAREN_LINES[Math.floor(G.rng() * KAREN_LINES.length)];
      G.event = { type, k, line, taps: 0, need: 24, time: 5, fly: 0, result: '', resultT: 0, intro: 1.0 };
    } else {
      const cards = [];
      for (let i = 0; i < 6; i++) { const cat = Math.floor(G.rng() * 3); cards.push({ cat, label: CARDS[cat][Math.floor(G.rng() * CARDS[cat].length)] }); }
      G.event = { type, cards, idx: 0, ok: 0, time: 10, result: '', resultT: 0, intro: 1.0, wrongT: 0 };
    }
    SFX.event();
  }
  function endEvent() { G.event = null; }

  function update(dt) {
    G.t += dt; G.st += dt;
    if (G.state === 'play') updatePlay(dt);
  }
  function updatePlay(dt) {
    G.fx.forEach(f => f.t += dt); G.fx = G.fx.filter(f => f.t < 0.9);
    if (G.noteT > 0) G.noteT -= dt;
    if (G.shake > 0) G.shake -= dt;
    // 간호사 이동
    G.nx += (G.ntx - G.nx) * Math.min(1, dt * 10); G.ny += (G.nty - G.ny) * Math.min(1, dt * 10);
    const ev = G.event;
    if (ev) {
      if (ev.intro > 0) { ev.intro -= dt; return; }
      if (ev.resultT > 0) { ev.resultT -= dt; if (ev.type === 'karen' && ev.result === 'win') ev.fly += dt; if (ev.resultT <= 0) endEvent(); return; }
      ev.time -= dt;
      if (ev.wrongT > 0) ev.wrongT -= dt;
      if (ev.time <= 0) {
        if (ev.type === 'karen') { ev.result = 'lose'; ev.resultT = 1.4; }
        else { ev.result = 'done'; ev.resultT = 1.4; G.score += ev.ok * 0; }
      }
      return;
    }
    G.elapsed += dt;
    if (G.fever > 0) G.fever -= dt;
    G.stamina -= dt * 0.7;
    // 이벤트 시각
    if (G.evIdx < EVENTS.length && prog() >= EVENTS[G.evIdx].at) { startEvent(EVENTS[G.evIdx].type); G.evIdx++; return; }
    // 콜벨
    G.nextSpawn -= dt;
    if (G.nextSpawn <= 0) {
      spawnCall();
      const c = busy();
      G.nextSpawn = (1.7 - 0.95 * c) * (0.75 + G.rng() * 0.5);
    }
    G.calls.forEach((c, i) => { if (c) { c.age += dt; if (c.age >= c.life) missCall(i); } });
    G.moodT = G.moodT.map(v => v - dt);
    // 커피·간식
    G.nextItem -= dt;
    if (G.nextItem <= 0) {
      const donut = G.rng() < 0.3;
      G.items.push({ kind: donut ? 'donut' : 'coffee', x: 54 + G.rng() * 12, y: 60 + G.rng() * 120, age: 0, life: 5 });
      G.nextItem = 7 + G.rng() * 5;
    }
    G.items.forEach(it => it.age += dt); G.items = G.items.filter(it => it.age < it.life);
    if (G.stamina <= 0) { G.stamina = 0; endShift(false); return; }
    if (G.elapsed >= SHIFT) endShift(true);
  }
  function endShift(success) {
    G.state = 'over'; G.st = 0; G.success = success; G.event = null;
    if (success) { G.bonus = Math.round(G.stamina) * 10 + 1000; G.score += G.bonus; SFX.clear(); } else { G.bonus = 0; SFX.over(); }
    const before = G.total;
    G.total += G.score;
    const names = unlockedNames(before, G.total);
    G.unlockMsg = names.length ? (names.length <= 2 ? names.join(', ') + ' 해금!' : '꾸미기 ' + names.length + '개 해금!') : '';
    G.newBest = G.mode === 'normal' && G.score > G.best;
    if (G.mode === 'normal' && G.score > G.best) G.best = G.score;
    saveProfile();
    G.overMsg = { code: 'pending' };
    Rank.submit(G.mode, G.score).then(r => { G.overMsg = r; });
  }

  // ---------- 화면: 공통 배경 ----------
  const WALL = document.createElement('canvas');
  WALL.width = W; WALL.height = H;
  {
    const w = WALL.getContext('2d');
    for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) { w.fillStyle = ((x + y) / 8) % 2 ? CSS.cream : CSS.cream2; w.fillRect(x, y, 8, 8); }
  }
  function floor(y0, y1 = H) { for (let y = y0; y < y1; y += 8) for (let x = 0; x < W; x += 8) rect(x, y, 8, Math.min(8, y1 - y), ((x + y) / 8) % 2 ? 'fl' : 'fl2'); }
  function bar(x, y, w, ratio, col) {
    rrect(x, y, w, 7, 'cream3');
    const tw = Math.max(5, Math.round(w * Math.max(0, Math.min(1, ratio))));
    rrect(x, y, tw, 7, col);
    if (tw > 7) rect(x + 2, y + 1, tw - 5, 1, 'W');
  }
  function stars(n = 18) {
    for (let i = 0; i < n; i++) {
      const x = (i * 37) % 124 + 2, y = (i * 23) % 60 + 4;
      if ((i + (G.t * 2 | 0)) % 5) px(x, y, i % 3 ? 'W' : 'X');
    }
  }
  const RAINBOW = ['P', 'Y', 'M', 'S', 'L'];
  const rb = k => RAINBOW[(((G.t * 10) | 0) + k) % RAINBOW.length];
  const blinkNow = () => (G.t % 2.7) < 0.12;

  // ---------- 화면: 게임 ----------
  function callBubble(x, y, c) {
    const urgent = c.kind === 'demand';
    const late = c.age / c.life > 0.65;
    const blink = ((G.t * (late ? 6 : 3)) | 0) % 2 === 0;
    const fill = urgent ? (blink ? 'R' : 'P') : late && blink ? 'Y' : 'W';
    rrect(x, y, 15, 13, fill, 'O');
    sprite(x + 3, y + 12, ['OOOO', '.OO.']); rect(x + 4, y + 12, 2, 1, fill);
    sprite(x + 4, y + 3, CALL_ICON[c.kind]);
    // 남은 시간 점 (줄어듦)
    const left = Math.max(0, 1 - c.age / c.life);
    rect(x + 1, y + 13 + 2, Math.round(13 * left), 1, late ? 'R' : 'm');
    if (urgent && c.taps > 0) ptext(String(3 - c.taps), x + 13, y - 4, 's', 'R', { edge: 'W' });
  }
  function bed(i) {
    const [x, y] = BEDS[i];
    const c = G.calls[i];
    rrect(x, y, 34, 9, 'g', 'O');
    rrect(x + 1, y + 5, 32, 24, 'W', 'O');
    rrect(x + 9, y + 6, 16, 8, 'G', 'O');
    const mood = G.moodT[i] > 0 ? G.moodK[i] : c ? 'pain' : (i + (G.elapsed / 9 | 0)) % 3 ? 'sleep' : 'calm';
    const head = mood === 'sleep' ? HEAD_SLEEP : mood === 'pain' ? HEAD_PAIN : mood === 'happy' ? HEAD_HAPPY : HEAD;
    sprite(x + 12, y + 7, head, { map: { h: HAIRS[i] } });
    rrect(x + 1, y + 15, 32, 14, 'q', 'O');
    rect(x + 2, y + 16, 30, 2, 'W');
    ptext(ROOMS[i], x + 17, y + 20, 's', 'B', { edge: null, align: 'c' });
    if (mood === 'sleep' && !c) sprite(x + 25, y - 1 - ((G.t * 2 | 0) % 2), ZZ);
    if (mood === 'happy') sprite(x + 25, y + 1, ['.O.O.', 'OPOPO', 'OPPPO', '.OPO.', '..O..']);
    if (c) callBubble(x + 18, y - 15, c);
  }
  function drawPlay() {
    const sh = G.shake > 0 ? Math.round(Math.sin(G.t * 80) * 2) : 0;
    ctx.save(); ctx.translate(sh, 0);
    rect(0, 0, W, H, 'wall');
    floor(40);
    const fever = G.fever > 0;
    // 위: 시각, 점수, 체력
    rrect(3, 3, 50, 15, 'N', 'O');
    sprite(6, 7, MOON.slice(0, 7).map(r => r.slice(0, 5)));
    ptext(clockStr(), 14, 6, 'm', 'X', { edge: null });
    rrect(56, 3, 69, 15, 'W', 'O', 'cream3');
    sprite(59, 7, STAR);
    ptext(fmt(G.score), 69, 6, 'm', 'O', { edge: null });
    sprite(3, 21, COFFEE);
    bar(14, 22, 84, G.stamina / 100, fever ? rb(0) : G.stamina < 30 ? 'P' : 'M');
    ptext(G.mode === 'daily' ? '오늘' : '체력', 112, 22, 's', 'o', { edge: null, align: 'c' });
    // 창문 + 병동 이름
    rrect(6, 32, 30, 14, 'N', 'O'); px(14, 36, 'W'); px(26, 39, 'X'); px(20, 35, 'W');
    rrect(92, 32, 30, 14, 'N', 'O'); sprite(110, 35, MOON);
    if (G.noteT > 0) pill(G.noteText, 64, 34, G.noteCol, G.noteCol === 'Y' || G.noteCol === 'G' ? 'O' : 'W');
    else pill(G.ward ? fitText(G.ward, 50, 's').t : '7병동', 64, 34, 'G', 'O');
    for (let i = 0; i < 6; i++) bed(i);
    // 커피·간식
    G.items.forEach(it => {
      const bob = (G.t * 3 | 0) % 2;
      const fade = it.life - it.age < 1.2 && ((G.t * 8) | 0) % 2;
      if (!fade) sprite(it.x, it.y + bob, it.kind === 'coffee' ? COFFEE : DONUT);
    });
    // 간호사
    nurse(G.nx, G.ny, G.look, { blink: blinkNow(), flip: G.nflip, mood: G.stamina < 25 ? 'tired' : null });
    // 효과 글자
    G.fx.forEach(f => ptext(f.text, f.x, f.y - Math.round(f.t * 10), f.f, f.col, { align: 'c' }));
    // 아래: 콤보
    if (fever) pill('집중 모드 x2', 64, 208, rb(2), 'O', 'm');
    else if (G.combo >= 2) pill('콤보 x' + G.combo, 64, 208, 'Y', 'O', 'm', 'y');
    else ptext('콜벨을 톡! 눌러요', 64, 210, 's', 'o', { edge: null, align: 'c' });
    ctx.restore();
    if (G.event) drawEvent();
  }

  // ---------- 화면: 진상 보너스 · 라운딩 ----------
  function drawEvent() {
    const ev = G.event;
    if (ev.type === 'karen') {
      const flash = ((G.t * 6) | 0) % 2;
      rect(0, 0, W, H, flash ? 'P' : 'R');
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2 + G.t * 0.5;
        ctx.save(); ctx.translate(64, 100); ctx.rotate(a); rect(30, -3, 80, 6, flash ? 'u' : 'P'); ctx.restore();
      }
      pill('진상 보너스!', 64, 8, 'Y', 'O', 'b', 'y');
      if (ev.intro > 0) ptext('마구 눌러서 날려 버려요!', 64, 30, 's', 'W', { align: 'c' });
      else ptext('남은 시간 ' + Math.max(0, ev.time).toFixed(1) + '초', 64, 30, 's', 'W', { align: 'c' });
      const shake = ev.resultT > 0 ? 0 : ((G.t * 20) | 0) % 2 ? 1 : -1;
      const fly = ev.result === 'win' ? ev.fly : 0;
      ctx.save(); ctx.translate(64, 88); ctx.rotate(fly * 8); ctx.translate(-64, -88);
      sprite(40 + shake + fly * 140, 62 - fly * 160, KAREN_TYPES[ev.k], { scale: 3 });
      ctx.restore();
      if (!fly) {
        sprite(88, 52, STEAM, { scale: 2 });
        const w = textW(ev.line, 's') + 8, x = 64 - w / 2;
        rrect(x, 42, w, 13, 'W'); sprite(x + 6, 54, ['OOOO', '.OO.']); rect(x + 7, 54, 2, 1, 'W');
        ptext(ev.line, 64, 44, 's', 'r', { edge: null, align: 'c' });
      }
      G.fx.forEach(f => ptext(f.text, f.x, f.y - Math.round(f.t * 10), f.f, f.col, { align: 'c' }));
      ptext('날아가기까지', 64, 160, 's', 'W', { align: 'c' });
      bar(10, 172, 108, ev.taps / ev.need, 'Y');
      pill('연타 ' + ev.taps, 64, 186, 'W', 'O', 'm');
      if (ev.resultT > 0) pill(ev.result === 'win' ? '퇴치! +1,000' : '다음에 또 올게!', 64, 112, ev.result === 'win' ? 'Y' : 'W', 'O', 'b', ev.result === 'win' ? 'y' : 'cream3');
      return;
    }
    // 라운딩
    rect(0, 0, W, H, 'wall');
    floor(150);
    pill('라운딩 타임!', 64, 6, 'L', 'W', 'b', 'l');
    ptext(ev.intro > 0 ? '업무 카드를 알맞은 칸으로!' : '남은 시간 ' + Math.max(0, ev.time).toFixed(1) + '초', 64, 28, 's', 'o', { edge: null, align: 'c' });
    const card = ev.cards[ev.idx];
    if (card && ev.resultT <= 0) {
      if (ev.idx + 1 < ev.cards.length) rrect(48, 46, 52, 40, 'cream3', 'O');
      const sx = ev.wrongT > 0 ? Math.round(Math.sin(G.t * 60) * 2) : 0;
      rrect(38 + sx, 50, 52, 40, 'W', 'O', 'cream3');
      rect(39 + sx, 52, 50, 9, 'g');
      ptext('업무 ' + (ev.idx + 1) + '/' + ev.cards.length, 64 + sx, 52, 's', 'W', { edge: null, align: 'c' });
      const lines = wrapText(card.label, 46, 'm');
      lines.forEach((l, j) => ptext(l, 64 + sx, 64 + j * 11 + (lines.length === 1 ? 5 : 0), 'm', 'O', { edge: null, align: 'c' }));
    }
    if (ev.resultT > 0) pill('정리 ' + ev.ok + '/' + ev.cards.length + (ev.ok === ev.cards.length ? ' 완벽!' : ''), 64, 66, 'Y', 'O', 'b', 'y');
    ptext('아래 칸을 눌러 정리', 64, 100, 's', 'o', { edge: null, align: 'c' });
    B_BINS.forEach((b, i) => {
      const bn = BIN[i];
      rrect(b.x, b.y - 30, b.w, b.h, bn.fill, 'O', bn.dark);
      ptext(bn.name, b.x + b.w / 2, b.y - 27, 'm', 'W', { edge: bn.dark, align: 'c' });
      sprite(b.x + 15, b.y - 13, [PILL, DROP, ['OOOOO', 'OWWWO', 'OWOWO', 'OWWWO', 'OOOOO']][i]);
    });
    nurse(56, 166, G.look, { blink: blinkNow() });
    G.fx.forEach(f => ptext(f.text, f.x, f.y - Math.round(f.t * 10), f.f, f.col, { align: 'c' }));
  }
  function eventTap(p) {
    const ev = G.event;
    if (ev.intro > 0 || ev.resultT > 0) return;
    if (ev.type === 'karen') {
      ev.taps++;
      G.score += 20;
      fx(20 + Math.random() * 88, 70 + Math.random() * 70, '쾅!', 'Y', Math.random() < 0.3 ? 'b' : 'm');
      SFX.hit();
      if (ev.taps >= ev.need) { ev.result = 'win'; ev.resultT = 1.4; G.score += 1000; G.stats.karens++; SFX.big(); }
      return;
    }
    const bi = B_BINS.findIndex(b => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y - 30 && p.y < b.y - 30 + b.h);
    if (bi < 0) return;
    const card = ev.cards[ev.idx];
    if (card.cat === bi) { ev.ok++; G.score += 150; fx(64, 60, '착!', 'M', 'b'); SFX.pop(); }
    else { ev.wrongT = 0.3; fx(64, 60, '앗!', 'R', 'b'); SFX.wrong(); }
    ev.idx++;
    if (ev.idx >= ev.cards.length) {
      if (ev.ok === ev.cards.length) { G.score += 500; SFX.big(); }
      ev.result = 'done'; ev.resultT = 1.4;
    }
  }

  // ---------- 화면: 타이틀 ----------
  const T_START = { x: 6, y: 170, w: 60, h: 18 };
  const T_DAILY = { x: 69, y: 170, w: 53, h: 18 };
  const T_RANK = { x: 6, y: 192, w: 37, h: 14 };
  const T_LOUNGE = { x: 45, y: 192, w: 38, h: 14 };
  const T_DRESS = { x: 85, y: 192, w: 37, h: 14 };
  const T_NAME = { x: 6, y: 209, w: 56, h: 13 };
  const T_CHAT = { x: 66, y: 209, w: 56, h: 13 };
  const T_HELP = { x: 3, y: 3, w: 44, h: 13 };
  const T_SOUND = { x: 110, y: 2, w: 16, h: 12 };
  function drawTitle() {
    rect(0, 0, W, 122, 'N');
    stars();
    sprite(96, 5, MOON);
    rrect(14, 76, 100, 46, 'wall2', 'O');
    rrect(54, 68, 20, 12, 'wall2', 'O');
    rect(61, 71, 6, 2, 'R'); rect(63, 69, 2, 6, 'R');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const lit = (r * 7 + c * 3 + (G.t * 0.5 | 0)) % 4 !== 0;
      rect(20 + c * 15, 84 + r * 12, 9, 7, lit ? 'X' : 'n');
    }
    floor(122);
    sprite(114, 4, soundOn ? SPEAKER : SPEAKER_OFF);
    rrect(T_HELP.x, T_HELP.y, T_HELP.w, T_HELP.h, 'W', 'O', 'cream3');
    ptext('튜토리얼', T_HELP.x + T_HELP.w / 2, T_HELP.y + 3, 's', 'O', { edge: null, align: 'c' });
    rrect(8, 20, 112, 46, 'W', 'O', 'l');
    ptext('나이트', 64, 23, 'b', 'N', { scale: 2, align: 'c' });
    pill('생존기', 64, 49, 'P', 'W', 'b', 'p');
    nurse(8, 122, G.look, { blink: blinkNow(), scale: 2 });
    sprite(44, 152, COFFEE);
    const hello = G.nick ? fitText('안녕, ' + G.nick + '!', 70, 's').t : '오늘 밤도 화이팅!';
    rrect(50, 128, 74, 14, 'W');
    ptext(hello, 87, 131, 's', 'O', { edge: null, align: 'c' });
    if (G.best > 0) { sprite(56, 148, STAR); ptext('BEST ' + fmtShort(G.best), 66, 148, 's', 'O', { edge: 'W' }); }
    button(T_START, 'Y', 'y', '근무 시작', 'b', 'O');
    button(T_DAILY, 'P', 'p', '오늘의 근무', 's', 'W');
    button(T_RANK, 'S', 'B', '랭킹', 'm', 'W', 'B');
    button(T_LOUNGE, 'M', 'm', '휴게실', 'm', 'W', 'm');
    button(T_DRESS, 'L', 'l', '꾸미기', 'm', 'W', 'l');
    button(T_NAME, 'W', 'cream3', '이름·병동', 's', 'O');
    if (Chat.enabled()) {
      button(T_CHAT, 'W', 'cream3', '채팅', 's', 'O');
      const n = Chat.unread();
      if (n > 0) { const l = n > 9 ? '9+' : String(n); const w = Math.max(11, textW(l, 's') + 5); rrect(124 - w, 205, w, 10, 'R', 'O'); ptext(l, 124 - w / 2, 206, 's', 'W', { edge: null, align: 'c' }); }
    }
  }

  // ---------- 화면: 이름·병동 ----------
  const NICK_BOX = { x: 16, y: 84, w: 96, h: 16 };
  const N_TL = { x: 10, y: 106, w: 13, h: 14 }, N_TR = { x: 105, y: 106, w: 13, h: 14 };
  const N_CODE = { x: 20, y: 160, w: 88, h: 13 };
  const N_OK = { x: 16, y: 180, w: 46, h: 16 }, N_CANCEL = { x: 66, y: 180, w: 46, h: 16 };
  function drawName() {
    ctx.drawImage(WALL, 0, 0);
    rrect(8, 24, 112, 178, 'W', 'O', 'cream3');
    if (G.nameMode === 'code') {
      ptext('복구 코드 입력', 64, 36, 'b', 'O', { edge: null, align: 'c' });
      ptext('전에 받은 8자리 코드를 넣으면', 64, 56, 's', 'o', { edge: null, align: 'c' });
      ptext('이름·기록·꾸미기를 되찾아요', 64, 66, 's', 'o', { edge: null, align: 'c' });
      rrect(NICK_BOX.x - 2, NICK_BOX.y - 2, NICK_BOX.w + 4, NICK_BOX.h + 4, 'cream', 'O');
      const msg = { busy: '찾는 중..', notfound: '코드를 찾을 수 없어요', fail: '연결에 실패했어요', offline: '공용 랭킹에서만 돼요', ok: '불러왔어요!' }[G.codeMsg] || '';
      if (msg) ptext(msg, 64, 110, 'm', G.codeMsg === 'ok' ? 'm' : 'p', { edge: null, align: 'c' });
      ptext('주의: 지금 기기의 기록 대신', 64, 132, 's', 'o', { edge: null, align: 'c' });
      ptext('코드의 기록으로 바뀌어요', 64, 142, 's', 'o', { edge: null, align: 'c' });
      button(N_OK, 'M', 'm', '불러오기', 'm', 'W', 'm');
      button(N_CANCEL, 'cream3', 'o', '취소', 'b', 'o');
      return;
    }
    nurse(56, 30 + (Math.sin(G.t * 3) > 0.6 ? -1 : 0), G.look, { blink: blinkNow() });
    ptext('이름을 알려 주세요! (5글자)', 64, 58, 's', 'O', { edge: null, align: 'c' });
    const v = nickEl.value.trim();
    const dup = v && Rank.rows.some(r => r.nick === v && r.id !== Ident.uid);
    ptext(dup ? '같은 이름이 이미 있어요' : '랭킹·채팅에 나와요', 64, 70, 's', dup ? 'p' : 'l', { edge: null, align: 'c' });
    rrect(NICK_BOX.x - 2, NICK_BOX.y - 2, NICK_BOX.w + 4, NICK_BOX.h + 4, 'cream', 'O');
    rrect(N_TL.x, N_TL.y, N_TL.w, N_TL.h, 'Y', 'O'); sprite(N_TL.x + 5, N_TL.y + 3, ARROW_L);
    rrect(N_TR.x, N_TR.y, N_TR.w, N_TR.h, 'Y', 'O'); sprite(N_TR.x + 4, N_TR.y + 3, ARROW_R);
    rrect(24, 106, 80, 14, 'cream2', 'O');
    ptext(fitText(wardName(G.wardSel), 76).t, 64, 108, 'm', 'O', { edge: null, align: 'c' });
    // 복구 코드
    rrect(14, 126, 100, 30, 'cream', 'O');
    ptext('내 복구 코드 (적어 두세요)', 64, 129, 's', 'o', { edge: null, align: 'c' });
    ptext(showCode(Ident.code), 64, 140, 'm', 'B', { edge: null, align: 'c' });
    button(N_CODE, 'W', 'cream3', '코드로 불러오기', 's', 'O');
    button(N_OK, 'M', 'm', '확인', 'b', 'W', 'm');
    button(N_CANCEL, 'cream3', 'o', '취소', 'b', 'o');
  }
  function openName(next) {
    G.state = 'name'; G.st = 0; G.nameNext = next; G.nameMode = 'nick'; G.codeMsg = '';
    G.wardSel = G.ward;
    nickEl.maxLength = 5; nickEl.placeholder = ''; nickEl.value = G.nick;
    nickEl.hidden = false;
    layout();
    setTimeout(() => { try { nickEl.focus(); nickEl.select(); } catch (e) { /* 무시 */ } }, 30);
  }
  function codeMode(on) {
    G.nameMode = on ? 'code' : 'nick'; G.codeMsg = '';
    nickEl.maxLength = on ? 9 : 5; nickEl.placeholder = on ? 'ABCD-EFGH' : ''; nickEl.value = on ? '' : G.nick;
    setTimeout(() => { try { nickEl.focus(); } catch (e) { /* 무시 */ } }, 30);
  }
  async function tryRestore() {
    const code = nickEl.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 8) { G.codeMsg = 'notfound'; return; }
    G.codeMsg = 'busy';
    const r = await Rank.restore(code);
    G.codeMsg = r;
    if (r === 'ok') setTimeout(() => { if (G.state === 'name') { nickEl.hidden = true; G.state = 'title'; G.st = 0; } }, 900);
  }
  function closeName(save) {
    if (G.state !== 'name') return;
    if (G.nameMode === 'code') { if (save) tryRestore(); else codeMode(false); return; }
    if (save) {
      let v = Array.from(nickEl.value.replace(/\s+/g, ' ').trim()).slice(0, 5).join('');
      if (!v) v = '간호' + (100 + Math.floor(Math.random() * 900));
      G.nick = v; G.ward = G.wardSel;
      saveProfile();
      Rank.updateProfile();
    }
    nickEl.hidden = true; nickEl.blur();
    if (save && G.nameNext === 'play') newGame(G.pendingMode);
    else if (save && G.nameNext === 'chat') openChat();
    else { G.state = 'title'; G.st = 0; }
  }
  function cycleWard(d) { const i = WARDS.indexOf(G.wardSel); G.wardSel = WARDS[(i + d + WARDS.length) % WARDS.length]; }

  // ---------- 화면: 퇴근 ----------
  const O_AGAIN = { x: 6, y: 190, w: 56, h: 16 }, O_LOUNGE = { x: 66, y: 190, w: 56, h: 16 };
  const O_RANK = { x: 6, y: 209, w: 56, h: 13 }, O_HOME = { x: 66, y: 209, w: 56, h: 13 };
  function overText() {
    const m = G.overMsg || {};
    const daily = G.mode === 'daily';
    switch (m.code) {
      case 'pending': return '랭킹 저장 중..';
      case 'saved': return (daily ? '오늘의 근무 ' : '랭킹 ') + m.rank + '위 등록!';
      case 'local': return m.rank ? '이 기기 랭킹 ' + m.rank + '위' : '';
      case 'nobest': return '내 최고 ' + fmt(m.best) + '점';
      case 'fail': return '랭킹 저장 실패';
      default: return '';
    }
  }
  function drawOver() {
    const ok = G.success;
    if (ok) {
      for (let y = 0; y < 112; y += 8) rect(0, y, W, 8, y < 40 ? 'sun2' : y < 80 ? 'sun' : 'Y');
      rrect(46, 84, 36, 36, 'X', 'Y');
    } else {
      rect(0, 0, W, 112, 'n');
      stars(10);
    }
    floor(112);
    // 도장
    const s = Math.max(1, 2.6 - G.st * 5);
    if (G.st > 0 && G.st < 0.05) SFX.stamp();
    ctx.save(); ctx.translate(64, 44); ctx.rotate(-0.15); ctx.scale(s, s); ctx.translate(-64, -44);
    const col = ok ? 'R' : 'l';
    rrect(26, 18, 76, 48, 'W', ok ? 'r' : 'o');
    rrect(29, 21, 70, 42, 'W', col);
    ptext(ok ? '퇴근' : '기절', 64, 24, 'b', col, { scale: 2, edge: null, align: 'c' });
    ptext(ok ? '성공!' : '인계 완료..', 64, 49, 'm', col, { edge: null, align: 'c' });
    ctx.restore();
    nurse(6, 112, G.look, { scale: 2, mood: ok ? 'joy' : 'tired' });
    if (ok) sprite(42, 118, HEART);
    rrect(44, 113, 80, 62, 'W', 'O', 'cream3');
    const rows = [['점수', fmt(G.score)], ['끈 콜벨', G.stats.calls + '개'], ['최대 콤보', String(G.maxCombo)], ['진상 퇴치', G.stats.karens + '명'], ['마신 커피', G.stats.coffee + '잔']];
    if (ok && G.bonus) rows.push(['보너스', '+' + fmt(G.bonus)]);
    rows.forEach(([k, v], i) => { ptext(k, 49, 116 + i * 9, 's', 'o', { edge: null }); ptext(v, 119, 116 + i * 9, 's', i === 0 ? 'p' : i === 5 ? 'm' : 'O', { edge: null, align: 'r' }); });
    if (G.newBest) pill('최고 기록!', 64, 70, 'Y', 'O', 'm', 'y');
    if (overText()) ptext(overText(), 64, 88, 's', 'O', { edge: 'W', align: 'c' });
    if (G.unlockMsg) ptext(fitText(G.unlockMsg, 120, 's').t, 64, 178, 's', 'p', { edge: 'W', align: 'c' });
    button(O_AGAIN, 'Y', 'y', '한 번 더', 'm', 'O');
    button(O_LOUNGE, 'M', 'm', '휴게실', 'm', 'W', 'm');
    button(O_RANK, 'S', 'B', '랭킹', 's', 'W');
    button(O_HOME, 'W', 'cream3', '처음으로', 's', 'O');
  }

  // ---------- 화면: 랭킹 ----------
  const R_BACK = { x: 34, y: 205, w: 60, h: 15 };
  const R_TABS = [{ k: 'me', label: '개인', x: 6 }, { k: 'ward', label: '병동', x: 46 }, { k: 'day', label: '오늘', x: 86 }].map(t => Object.assign(t, { y: 28, w: 36, h: 13 }));
  function drawRank() {
    ctx.drawImage(WALL, 0, 0);
    header(Rank.net ? '모두의 랭킹' : '이 기기 랭킹');
    R_TABS.forEach(t => {
      const on = G.rankTab === t.k;
      rrect(t.x, t.y, t.w, t.h, on ? 'Y' : 'W', 'O', on ? 'y' : 'cream3');
      ptext(t.label, t.x + t.w / 2, t.y + 2, 'm', on ? 'O' : 'o', { edge: null, align: 'c' });
    });
    const tab = G.rankTab, list = Rank.list(tab);
    const isMe = r => tab === 'ward' ? r.ward === G.ward : Rank.net ? r.id === Ident.uid : r.nick === G.nick;
    if (Rank.net && (Rank.status === 'loading' || Rank.status === 'slow') && !list.length) {
      ptext(Rank.status === 'slow' ? '연결이 느려요. 잠시만요..' : '불러오는 중..', 64, 100, 'm', 'o', { edge: null, align: 'c' });
    } else if (Rank.status === 'error' && !list.length) {
      ptext('랭킹을 불러오지 못했어요', 64, 96, 'm', 'p', { edge: null, align: 'c' });
    } else if (!list.length) {
      ptext(tab === 'ward' ? '병동 기록이 없어요' : tab === 'day' ? '오늘 기록이 없어요' : '아직 기록이 없어요', 64, 96, 'm', 'o', { edge: null, align: 'c' });
      ptext(tab === 'ward' ? '이름·병동에서 병동을 골라 보세요' : '첫 기록을 남겨 보세요!', 64, 110, 's', 'l', { edge: null, align: 'c' });
    } else {
      const row = (r, i, y) => {
        rrect(6, y, 116, 13, isMe(r) ? 'Y' : 'W');
        if (i < 3) { rrect(8, y + 2, 11, 9, ['Y', 'G', 'Z'][i]); ptext(String(i + 1), 13, y + 3, 's', 'O', { edge: null, align: 'c' }); }
        else ptext(String(i + 1), 13, y + 3, 's', 'o', { edge: null, align: 'c' });
        const sc = fmtShort(r.score), sw = textW(sc, 'm');
        ptext(sc, 118, y + 2, 'm', 'O', { edge: null, align: 'r' });
        if (tab === 'ward') {
          const room = 118 - sw - 4 - 21;
          const nm = wardName(r.ward), cnt = r.count + '명';
          const nw = ptext(fitText(nm, room).t, 21, y + 2, 'm', 'O', { edge: null });
          if (textW(nm, 'm') + 2 + textW(cnt, 's') <= room) ptext(cnt, 21 + nw + 1, y + 3, 's', 'o', { edge: null });
        } else {
          miniHead(21, y + 4, r.look);
          ptext(fitText(r.nick, 118 - sw - 4 - 30).t, 30, y + 2, 'm', 'O', { edge: null });
        }
      };
      list.slice(0, 10).forEach((r, i) => row(r, i, 45 + i * 14));
      const myIdx = list.findIndex(isMe);
      if (myIdx >= 10) row(list[myIdx], myIdx, 188);
    }
    button(R_BACK, 'P', 'p', '돌아가기', 'b', 'W', 'p');
  }
  function goRank(back, tab) { G.back = back; G.state = 'rank'; G.st = 0; G.rankTab = tab || (G.mode === 'daily' && back === 'over' ? 'day' : 'me'); Rank.refresh(); }
  function goBack() { G.state = G.back === 'over' ? 'over' : 'title'; G.st = 1; }

  // ---------- 화면: 꾸미기 ----------
  const D_ROWS = LOOK_KEYS.map((k, i) => ({ k, y: 91 + i * 18 }));
  const dArrowL = y => ({ x: 36, y, w: 14, h: 15 }), dArrowR = y => ({ x: 110, y, w: 14, h: 15 });
  const D_BACK = { x: 34, y: 209, w: 60, h: 13 };
  function drawDress() {
    ctx.drawImage(WALL, 0, 0);
    header('꾸미기', 'L', 'l');
    rrect(26, 28, 76, 50, 'W', 'O', 'cream3');
    nurse(40, 32, G.look, { blink: blinkNow(), scale: 2 });
    ptext('누적 ' + fmtShort(G.total) + '점 · 해금 ' + unlockedCount(G.total) + '/' + ITEM_COUNT, 64, 80, 's', 'O', { edge: 'W', align: 'c' });
    D_ROWS.forEach(({ k, y }) => {
      const list = LOOKS[k], cur = list[G.look[k]];
      ptext(LOOK_LABEL[k], 4, y, 's', 'O', { edge: 'W' });
      ptext(list.filter(x => x.need <= G.total).length + '/' + list.length, 4, y + 8, 's', 'o', { edge: 'W' });
      const l = dArrowL(y), r = dArrowR(y);
      rrect(l.x, l.y, l.w, l.h, 'Y', 'O', 'y'); sprite(l.x + 5, l.y + 4, ARROW_L);
      rrect(r.x, r.y, r.w, r.h, 'Y', 'O', 'y'); sprite(r.x + 5, r.y + 4, ARROW_R);
      rrect(52, y, 56, 15, 'W', 'O');
      const f = textW(cur.name, 'm') <= 52 ? 'm' : 's';
      ptext(cur.name, 80, y + (f === 'm' ? 2 : 3), f, 'O', { edge: null, align: 'c' });
    });
    const next = LOOK_KEYS.flatMap(k => LOOKS[k]).concat(FURN).filter(x => x.need > G.total).sort((a, b) => a.need - b.need)[0];
    if (next) { sprite(5, 199, LOCK); ptext(fitText('다음 해금: ' + next.name + ' (' + fmtShort(next.need) + '점)', 112, 's').t, 12, 198, 's', 'l', { edge: 'W' }); }
    button(D_BACK, 'P', 'p', '돌아가기', 'm', 'W', 'p');
  }
  function cycleLook(k, d) {
    const list = LOOKS[k];
    const open = list.map((x, i) => i).filter(i => list[i].need <= G.total);
    const pos = Math.max(0, open.indexOf(G.look[k]));
    G.look[k] = open[(pos + d + open.length) % open.length];
    saveProfile();
  }

  // ---------- 화면: 휴게실 ----------
  const CAT = ['O...O.....', 'OO.OO.....', 'OZZZO...O.', 'OZOZO...O.', 'OZZZOOOOO.', '.OZZZZZZO.', '.OZOOOOZO.'];
  const TROPHY = ['OOOOOOO', 'OYYYYYO', 'OYWYYYO', '.OYYYO.', '..OYO..', '.OOOOO.', '.OyyyO.', '.OOOOO.'];
  const RAMEN = ['.OOOOO.', 'OWRWRWO', '.OWWWO.'];
  function furnIcon(k, x, y) {
    switch (k) {
      case 'sofa': sprite(x + 1, y + 6, ['OOOOOOOOOOOOO', 'OPPPPPPPPPPPO', 'OuuuuuuuuuuuO', 'OOOOOOOOOOOOO']); break;
      case 'plant': sprite(x + 4, y + 2, PLANT); break;
      case 'coffee': sprite(x + 3, y + 3, COFFEE); break;
      case 'frame': rrect(x + 2, y + 2, 11, 10, 'W', 'O'); sprite(x + 4, y + 4, ['P.P', 'PPP', '.P.']); break;
      case 'ramen': sprite(x + 4, y + 1, RAMEN); sprite(x + 4, y + 4, RAMEN); sprite(x + 4, y + 7, RAMEN); sprite(x + 4, y + 10, RAMEN); break;
      case 'rug': rrect(x + 1, y + 8, 13, 5, 'L', 'O'); break;
      case 'lamp': sprite(x + 4, y + 2, ['.OOOOO.', 'OYYYYYO', 'OOOOOOO', '...O...', '...O...', '...O...', '..OOO..']); break;
      case 'bag': rrect(x + 1, y + 7, 13, 6, 'M', 'O'); rrect(x + 1, y + 7, 5, 6, 'W', 'O'); break;
      case 'fridge': rrect(x + 3, y + 1, 9, 13, 'G', 'O'); rect(x + 4, y + 6, 7, 1, 'O'); break;
      case 'resign': rrect(x + 2, y + 1, 11, 13, 'W', 'O'); rect(x + 4, y + 4, 7, 1, 'g'); rect(x + 4, y + 6, 7, 1, 'g'); rect(x + 4, y + 8, 5, 1, 'g'); px(x + 10, y + 10, 'R'); px(x + 9, y + 10, 'R'); break;
      case 'tv': rrect(x + 1, y + 3, 13, 9, 'N', 'O'); rect(x + 3, y + 5, 9, 5, 'S'); break;
      case 'clock': rrect(x + 2, y + 2, 11, 11, 'W', 'O'); rect(x + 7, y + 4, 1, 4, 'O'); rect(x + 7, y + 7, 3, 1, 'R'); break;
      case 'fish': rrect(x + 1, y + 3, 13, 10, 'S', 'O'); sprite(x + 5, y + 6, ['.YY.Y', 'YOYYY', '.YY.Y']); break;
      case 'drinks': for (let i = 0; i < 3; i++) sprite(x + 2 + i * 4, y + 6, ['OOO', 'OYO', 'ORO', 'OYO', 'OOO']); sprite(x + 4, y + 1, ['OOO', 'OYO', 'ORO', 'OYO', 'OOO']); sprite(x + 8, y + 1, ['OOO', 'OYO', 'ORO', 'OYO', 'OOO']); break;
      case 'cat': sprite(x + 2, y + 4, CAT); break;
      case 'pole': sprite(x + 5, y + 1, ['OOOOO', '..O..', 'OSSO.', 'OSSO.', '.OO..', '..O..', '..O..', '..O..', '..O..', '..O..', '.OOO.', 'OO.OO']); break;
      case 'mic': sprite(x + 5, y + 2, ['.OOO.', 'OgggO', 'OgggO', '.OOO.', '..O..', '..O..', '..O..', '..O..', '.OOO.']); break;
      case 'massage': rrect(x + 3, y + 1, 9, 8, 'l', 'O'); rrect(x + 2, y + 7, 11, 7, 'L', 'O'); break;
      case 'hammock': sprite(x + 1, y + 4, ['O...........O', '.O.........O.', '.OPPPPPPPPPO.', '..OPPPPPPPO..', '...OOOOOOO...']); break;
      case 'trophy': sprite(x + 4, y + 3, TROPHY); break;
    }
  }
  const L_SLOTS = FURN.map((f, i) => ({ x: 5 + (i % 7) * 17, y: 140 + Math.floor(i / 7) * 18, w: 16, h: 16 }));
  function drawLounge() {
    rect(0, 0, W, 122, 'cream');
    for (let x = 0; x < W; x += 12) rect(x, 26, 6, 92, 'cream2');
    rect(0, 116, W, 4, 'Z'); floor(120, 126);
    header('휴게실', 'M', 'm');
    const has = k => FURN.find(f => f.k === k).need <= G.total;
    // 벽
    rrect(6, 30, 30, 24, 'sun2', 'O'); rect(20, 31, 2, 22, 'O'); rect(7, 41, 28, 2, 'O');
    if (has('frame')) { rrect(40, 30, 18, 15, 'W', 'O'); sprite(45, 34, HEART.slice(0, 6).map(r => r.slice(0, 9))); }
    if (has('resign')) { rrect(62, 30, 16, 20, 'W', 'O'); rect(65, 34, 10, 1, 'g'); rect(65, 37, 10, 1, 'g'); rect(65, 40, 7, 1, 'g'); rrect(70, 43, 6, 5, 'R', 'r'); }
    if (has('clock')) { rrect(82, 30, 16, 16, 'W', 'O'); rect(89, 33, 1, 6, 'O'); rect(89, 38, 4, 1, 'R'); }
    if (has('lamp')) sprite(104, 28, ['.OOOOOOO.', 'OYYYYYYYO', 'OOOOOOOOO', '....O....', '....O....']);
    if (has('tv')) { rrect(86, 50, 32, 22, 'N', 'O'); rect(89, 53, 26, 16, ((G.t * 2) | 0) % 2 ? 'S' : 'B'); rect(98, 72, 8, 3, 'O'); }
    if (has('hammock')) sprite(6, 56, ['O..........................O', '.O........................O.', '..OPPPPPPPPPPPPPPPPPPPPPPO..', '...OPPPPPPPPPPPPPPPPPPPPO...', '....OOOOOOOOOOOOOOOOOOOO....']);
    if (has('trophy')) sprite(40, 48, TROPHY);
    if (has('fish')) { rrect(50, 52, 24, 16, 'S', 'O'); sprite(56 + Math.round(Math.sin(G.t) * 5), 57, ['.YY.Y', 'YOYYY', '.YY.Y']); }
    // 바닥 뒤쪽
    if (has('fridge')) { rrect(102, 74, 20, 42, 'G', 'O'); rect(103, 90, 18, 1, 'O'); rect(119, 78, 1, 6, 'O'); rect(119, 94, 1, 8, 'O'); }
    if (has('coffee')) { rrect(84, 90, 16, 24, 'g', 'O'); rrect(86, 92, 12, 6, 'N', 'O'); sprite(87, 104, ['OOOO', 'OzzO', '.OO.']); }
    if (has('pole')) sprite(76, 78, ['OOOOOOO', '...O...', '.OSSO..', '.OSSO..', '..OO...', '...O...', '...O...', '...O...', '...O...', '...O...', '...O...', '...O...', '...O...', '...O...', '...O...', '...O...', '...O...', '...O...', '..OOO..', '.OO.OO.']);
    if (has('massage')) { rrect(2, 74, 10, 16, 'l', 'O'); rrect(0, 88, 14, 26, 'L', 'O'); }
    if (has('rug')) { rrect(14, 108, 64, 10, 'L', 'O'); rect(18, 112, 56, 1, 'W'); }
    // 소파 + 쉬는 간호사
    rrect(16, 78, 54, 18, 'P', 'O'); rrect(14, 90, 58, 20, 'u', 'O'); rect(16, 94, 54, 2, 'W');
    nurse(34, 72, G.look, { blink: true });
    sprite(52, 66, ZZ);
    if (has('cat')) sprite(58, 84, CAT);
    if (has('plant')) sprite(74, 104, PLANT);
    if (has('ramen')) for (let i = 0; i < 4; i++) sprite(4, 104 - i * 3, RAMEN);
    if (has('drinks')) for (let i = 0; i < 3; i++) sprite(100 + i * 4, 112, ['OOO', 'OYO', 'ORO', 'OYO', 'OOO']);
    if (has('bag')) { rrect(16, 112, 30, 8, 'M', 'O'); rrect(16, 112, 9, 8, 'W', 'O'); }
    if (has('mic')) sprite(4, 82, ['.OOO.', 'OgggO', 'OgggO', '.OOO.', '..O..', '..O..', '..O..', '..O..', '..O..', '..O..', '..O..', '..O..', '..O..', '..O..', '..O..', '.OOO.']);
    // 가구 목록
    rrect(3, 126, 122, 78, 'W', 'O', 'cream3');
    ptext('가구 ' + FURN.filter(f => f.need <= G.total).length + '/' + FURN.length + ' · 눌러서 이름 보기', 64, 129, 's', 'o', { edge: null, align: 'c' });
    FURN.forEach((f, i) => {
      const b = L_SLOTS[i], ok = f.need <= G.total;
      rrect(b.x, b.y, b.w, b.h, G.loungeSel === i ? 'Y' : ok ? 'cream' : 'cream3', 'O');
      if (ok) furnIcon(f.k, b.x, b.y); else sprite(b.x + 5, b.y + 5, LOCK);
    });
    const sel = FURN[G.loungeSel];
    if (sel) ptext(sel.name + (sel.need <= G.total ? ' (해금)' : ' · ' + fmtShort(sel.need) + '점에 해금'), 64, 194, 's', 'O', { edge: null, align: 'c' });
    button(R_BACK, 'P', 'p', '돌아가기', 'b', 'W', 'p');
  }

  // ---------- 화면: 튜토리얼 ----------
  const P_PREV = { x: 5, y: 182, w: 22, h: 18 }, P_NEXT = { x: 101, y: 182, w: 22, h: 18 };
  const TUT = [
    { title: '콜벨 끄기', lines: ['콜벨이 뜬 침대를 톡!', '빨리 끌수록 고득점', '연속으로 끄면 콤보'],
      art: () => { bedAt(16, 48, { kind: 'drip', age: (G.t % 3), life: 4, taps: 0 }); ptext('팡!', 92, 50, 'b', 'Y', { align: 'c' }); sprite(80, 62, SPARK); } },
    { title: '무리한 요구', lines: ['빨간 말풍선은', '세 번 눌러 거절!', '점수가 더 커요'],
      art: () => { bedAt(16, 48, { kind: 'demand', age: 1, life: 4, taps: (G.t * 2 | 0) % 3 }); ptext('거절!', 94, 52, 'm', 'R', { align: 'c' }); } },
    { title: '체력과 커피', lines: ['체력이 조금씩 줄어요', '놓치면 체력 -12', '커피·간식을 눌러 회복'],
      art: () => { bar(14, 44, 100, 0.3 + 0.3 * ((G.t % 3) / 3), 'M'); sprite(40, 60, COFFEE, { scale: 2 }); sprite(70, 62, DONUT, { scale: 2 }); } },
    { title: '진상 보너스', lines: ['가끔 진상이 나타나요', '5초 동안 마구 연타!', '날려 버리면 +1,000'],
      art: () => { sprite(48, 36, KAREN_TYPES[(G.t / 2 | 0) % 3], { scale: 2 }); ptext('쾅!', 26, 56, 'b', 'Y', { align: 'c' }); ptext('쾅!', 100, 70, 'm', 'Y', { align: 'c' }); } },
    { title: '라운딩 타임', lines: ['업무 카드를 보고', '투약·검사·기록 칸을 눌러요', '다 맞히면 +500'],
      art: () => { BIN.forEach((b, i) => { rrect(10 + i * 38, 50, 32, 26, b.fill, 'O', b.dark); ptext(b.name, 26 + i * 38, 54, 'm', 'W', { edge: b.dark, align: 'c' }); }); } },
    { title: '집중 모드', lines: ['15콤보마다 8초 동안', '점수 2배!', '놓치면 바로 끝나요'],
      art: () => { bar(14, 46, 100, 0.8, rb(0)); pill('집중 모드 x2', 64, 62, rb(2), 'O', 'm'); } },
    { title: '퇴근하기', lines: ['아침 7시까지 버티면 퇴근!', '남은 체력만큼 보너스', '체력 0이면 기절..'],
      art: () => { rrect(34, 38, 60, 36, 'W', 'R'); ptext('퇴근', 64, 42, 'b', 'R', { scale: 2, edge: null, align: 'c' }); } },
    { title: '꾸미기·휴게실', lines: ['점수가 쌓이면', '꾸미기 ' + (ITEM_COUNT - FURN.length) + '종, 가구 ' + FURN.length + '종 해금', '병동끼리 랭킹 대결!'],
      art: () => { nurse(46, 32, { scrub: 1, hair: 2, head: (G.t | 0) % 20, face: (G.t / 2 | 0) % 15, badge: 1, pet: 1 }, { scale: 2, blink: blinkNow() }); } },
  ];
  function bedAt(x, y, c) {
    rrect(x, y + 10, 34, 9, 'g', 'O'); rrect(x + 1, y + 15, 32, 24, 'W', 'O'); rrect(x + 9, y + 16, 16, 8, 'G', 'O');
    sprite(x + 12, y + 17, HEAD_PAIN); rrect(x + 1, y + 25, 32, 14, 'q', 'O');
    callBubble(x + 18, y - 5, c);
  }
  function drawTut() {
    ctx.drawImage(WALL, 0, 0);
    header('튜토리얼');
    const pg = TUT[G.tutPage];
    rrect(4, 29, 120, 150, 'W', 'O', 'cream3');
    pg.art();
    ptext(pg.title, 64, 96, 'b', 'P', { edge: null, align: 'c' });
    let y = 115;
    for (const l of pg.lines) for (const s of wrapText(l, 110, 'm')) { ptext(s, 64, y, 'm', 'O', { edge: null, align: 'c' }); y += 13; }
    const first = G.tutPage === 0, last = G.tutPage === TUT.length - 1;
    if (!first) { rrect(P_PREV.x, P_PREV.y, P_PREV.w, P_PREV.h, 'Y', 'O', 'y'); sprite(P_PREV.x + 9, P_PREV.y + 5, ARROW_L); }
    if (!last) { rrect(P_NEXT.x, P_NEXT.y, P_NEXT.w, P_NEXT.h, 'Y', 'O', 'y'); sprite(P_NEXT.x + 9, P_NEXT.y + 5, ARROW_R); }
    const dw = TUT.length * 6;
    for (let i = 0; i < TUT.length; i++) rect(64 - dw / 2 + i * 6 + 1, 185, 4, 4, i === G.tutPage ? 'P' : 'cream3');
    ptext((G.tutPage + 1) + ' / ' + TUT.length, 64, 191, 's', 'o', { edge: null, align: 'c' });
    if (G.tutNext) button(R_BACK, last ? 'Y' : 'W', last ? 'y' : 'cream3', last ? '시작하기' : '건너뛰기', 'b', 'O');
    else button(R_BACK, 'P', 'p', '돌아가기', 'b', 'W', 'p');
  }
  function openTut(next) { G.tutNext = next || null; G.tutPage = 0; G.tutDone = true; G.state = 'tut'; store.set('nn_tut', '1'); }
  function closeTut() { const n = G.tutNext; G.tutNext = null; G.state = 'title'; G.st = 1; if (n) startGame(n); }
  function flipTut(d) { const p = Math.max(0, Math.min(TUT.length - 1, G.tutPage + d)); if (p !== G.tutPage) { G.tutPage = p; SFX.tap(); } }

  // ---------- 채팅 ----------
  const BAD_WORDS = ['씨발', '시발', '씨바', '시바', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '븅신', '개새', '새끼', '좆', '존나', '졸라', '미친놈', '미친년', '닥쳐', 'fuck', 'shit', 'bitch'];
  const BAD_RE = new RegExp(BAD_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
  const maskBad = t => t.replace(BAD_RE, w => '*'.repeat(Array.from(w).length));
  function cleanChat(d) {
    if (!d) return null;
    const id = Number(d.id);
    if (!Number.isFinite(id)) return null;
    const at = new Date(d.at);
    return {
      id, uid: String(d.uid || ''), nick: String(d.nick || '익명').slice(0, 8), look: lookParse(d.look),
      text: maskBad(String(d.text || '').slice(0, 40)),
      at: isNaN(at) ? '' : String(at.getHours()).padStart(2, '0') + ':' + String(at.getMinutes()).padStart(2, '0'),
    };
  }
  const Chat = {
    rows: [], status: 'idle', lastPoll: 0, sending: false, err: '', errUntil: 0, fake: false,
    seen: Number(store.get('nn_chat_seen', '-1')),
    enabled() { return Rank.net || this.fake; },
    async poll() {
      if (this.fake || !Rank.net) return;
      if (!this.rows.length) this.status = 'loading';
      try {
        const d = await netCall('GET', '/rest/v1/nn_chat?select=id,uid,nick,look,text,at&order=id.desc&limit=60');
        this.rows = (Array.isArray(d) ? d : []).map(cleanChat).filter(Boolean).reverse();
        this.status = 'ok';
        if (this.seen < 0) this.markSeen(true);
      } catch (e) { if (!this.rows.length) this.status = 'error'; }
    },
    unread() { return this.seen < 0 ? 0 : this.rows.filter(r => r.id > this.seen && r.uid !== Ident.uid).length; },
    markSeen(force) {
      const m = this.rows.length ? this.rows[this.rows.length - 1].id : 0;
      if (force || m > this.seen) { this.seen = m; store.set('nn_chat_seen', String(m)); }
    },
    showErr(t) { this.err = t; this.errUntil = performance.now() + 2500; },
    async send() {
      const t = chatEl.value.replace(/\s+/g, ' ').trim().slice(0, 40);
      if (!t || this.sending) return;
      if (this.fake) { this.rows.push({ id: Date.now(), uid: Ident.uid, nick: G.nick, look: G.look, text: maskBad(t), at: '지금' }); chatEl.value = ''; return; }
      this.sending = true;
      try {
        await netCall('POST', '/rest/v1/rpc/nn_post_chat', { p_id: Ident.uid, p_secret: Ident.secret, p_nick: G.nick, p_look: lookStr(G.look), p_text: t });
        chatEl.value = ''; G.chatScroll = 0;
        await this.poll(); this.markSeen();
      } catch (e) {
        this.showErr(String(e && e.message).indexOf('400') >= 0 ? '잠시 후 다시 보내 주세요' : '보내지 못했어요');
      } finally { this.sending = false; }
    },
  };
  setInterval(() => {
    if (!Chat.enabled() || document.hidden) return;
    const now = Date.now();
    if (now - Chat.lastPoll < (G.state === 'chat' ? 3000 : 30000)) return;
    Chat.lastPoll = now;
    Chat.poll().then(() => { if (G.state === 'chat') Chat.markSeen(); });
  }, 1000);
  const C_BOX = { x: 4, y: 187, w: 90, h: 16 }, C_SEND = { x: 97, y: 187, w: 27, h: 16 };
  const C_TOP = 29, C_BOTTOM = 183;
  function drawChat() {
    ctx.drawImage(WALL, 0, 0);
    header('모두의 채팅', 'Y', 'y');
    const items = Chat.rows.map(m => {
      const lines = wrapText(m.text, 104, 'm');
      const bh = lines.length * 11 + 4, bw = Math.max(...lines.map(l => textW(l, 'm'))) + 8;
      return { m, lines, bh, bw, h: bh + 13 };
    });
    const total = items.reduce((a, it) => a + it.h, 0);
    G.chatScroll = Math.max(0, Math.min(Math.max(0, total - (C_BOTTOM - C_TOP - 4)), G.chatScroll || 0));
    if (!items.length) ptext(Chat.status === 'loading' ? '불러오는 중..' : Chat.status === 'error' ? '대화를 불러오지 못했어요' : '첫 인사를 남겨 보세요!', 64, 100, 'm', 'o', { edge: null, align: 'c' });
    ctx.save(); ctx.beginPath(); ctx.rect(0, C_TOP, W, C_BOTTOM - C_TOP); ctx.clip();
    let y = C_BOTTOM - 2 + G.chatScroll;
    for (let i = items.length - 1; i >= 0; i--) {
      const { m, lines, bh, bw, h } = items[i];
      y -= h;
      if (y > C_BOTTOM) continue;
      if (y + h < C_TOP) break;
      if (m.uid && m.uid === Ident.uid) {
        ptext('나 · ' + m.at, 122, y, 's', 'o', { edge: null, align: 'r' });
        rrect(122 - bw, y + 10, bw, bh, 'Y', 'O', 'y');
        lines.forEach((l, j) => ptext(l, 126 - bw, y + 12 + j * 11, 'm', 'O', { edge: null }));
      } else {
        miniHead(6, y + 1, m.look);
        const nw = ptext(fitText(m.nick, 70).t, 15, y - 1, 'm', 'l', { edge: null });
        ptext(m.at, 15 + nw + 2, y, 's', 'o', { edge: null });
        rrect(6, y + 10, bw, bh, 'W', 'O', 'cream3');
        lines.forEach((l, j) => ptext(l, 10, y + 12 + j * 11, 'm', 'O', { edge: null }));
      }
    }
    ctx.restore();
    if (G.chatScroll > 0) { rrect(50, C_BOTTOM - 14, 28, 11, 'S', 'O'); ptext('▼', 64, C_BOTTOM - 13, 's', 'W', { edge: null, align: 'c' }); }
    rect(0, C_BOTTOM, W, 1, 'cream3');
    rrect(C_BOX.x, C_BOX.y, C_BOX.w, C_BOX.h, 'W', 'O');
    rrect(C_SEND.x, C_SEND.y, C_SEND.w, C_SEND.h, Chat.sending ? 'cream3' : 'P', 'O', 'p');
    ptext('전송', C_SEND.x + C_SEND.w / 2, C_SEND.y + 2, 'm', 'W', { edge: null, align: 'c' });
    if (Chat.err && performance.now() < Chat.errUntil) { const w = textW(Chat.err, 'm') + 10; rrect(64 - w / 2, C_BOTTOM - 16, w, 14, 'P', 'O'); ptext(Chat.err, 64, C_BOTTOM - 14, 'm', 'W', { edge: null, align: 'c' }); }
    button(R_BACK, 'S', 'B', '돌아가기', 'b', 'W', 'B');
  }
  function openChat() {
    if (!G.nick) { openName('chat'); return; }
    G.state = 'chat'; G.st = 0; G.chatScroll = 0;
    chatEl.hidden = false; layout();
    Chat.lastPoll = Date.now();
    Chat.poll().then(() => Chat.markSeen());
  }
  function closeChat() { chatEl.hidden = true; chatEl.blur(); Chat.markSeen(); G.state = 'title'; G.st = 0; }

  // ---------- 입력 ----------
  const inBox = (p, b) => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h;
  function toLogical(e) {
    const r = cvs.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * HV - OFF };
  }
  function startGame(mode) {
    G.pendingMode = mode;
    if (!G.nick && !G.tutDone && !store.get('nn_tut', '')) { openTut(mode); return; }
    if (!G.nick) openName('play'); else newGame(mode);
  }
  function playTap(p) {
    if (G.event) { eventTap(p); return; }
    // 커피·간식 먼저 (가까우면)
    const it = G.items.find(o => Math.abs(p.x - (o.x + 4)) < 10 && Math.abs(p.y - (o.y + 4)) < 10);
    if (it) {
      G.items = G.items.filter(o => o !== it);
      if (it.kind === 'coffee') { G.stamina = Math.min(100, G.stamina + 30); G.stats.coffee++; fx(it.x + 4, it.y - 4, '체력 +30', 'm'); }
      else { G.stamina = Math.min(100, G.stamina + 15); G.score += 200; fx(it.x + 4, it.y - 4, '+200', 'P'); }
      SFX.gulp();
      return;
    }
    const i = BEDS.findIndex(([x, y]) => p.x >= x - 2 && p.x < x + 36 && p.y >= y - 17 && p.y < y + 31);
    if (i >= 0) tapBed(i);
  }
  function tap(p) {
    switch (G.state) {
      case 'title':
        if (inBox(p, T_SOUND)) { soundOn = !soundOn; store.set('nn_sound', soundOn ? '1' : '0'); SFX.tap(); return; }
        if (inBox(p, T_HELP)) { SFX.tap(); openTut(null); return; }
        if (inBox(p, T_START)) { SFX.tap(); startGame('normal'); }
        else if (inBox(p, T_DAILY)) { SFX.tap(); startGame('daily'); }
        else if (inBox(p, T_RANK)) { SFX.tap(); goRank('title'); }
        else if (inBox(p, T_LOUNGE)) { SFX.tap(); G.back = 'title'; G.state = 'lounge'; }
        else if (inBox(p, T_DRESS)) { SFX.tap(); G.back = 'title'; G.state = 'dress'; }
        else if (inBox(p, T_NAME)) { SFX.tap(); openName('title'); }
        else if (Chat.enabled() && inBox(p, T_CHAT)) { SFX.tap(); openChat(); }
        break;
      case 'name':
        if (inBox(p, N_OK)) { SFX.tap(); closeName(true); }
        else if (inBox(p, N_CANCEL)) { SFX.tap(); closeName(false); }
        else if (G.nameMode !== 'code' && inBox(p, N_TL)) { SFX.tap(); cycleWard(-1); }
        else if (G.nameMode !== 'code' && inBox(p, N_TR)) { SFX.tap(); cycleWard(1); }
        else if (G.nameMode !== 'code' && inBox(p, N_CODE)) { SFX.tap(); codeMode(true); }
        break;
      case 'over':
        if (G.st < 0.6) return;
        if (inBox(p, O_AGAIN)) { SFX.tap(); newGame(G.mode); }
        else if (inBox(p, O_LOUNGE)) { SFX.tap(); G.back = 'over'; G.state = 'lounge'; }
        else if (inBox(p, O_RANK)) { SFX.tap(); goRank('over'); }
        else if (inBox(p, O_HOME)) { SFX.tap(); G.state = 'title'; G.st = 0; }
        break;
      case 'rank': {
        const t = R_TABS.find(t => inBox(p, t));
        if (t) { SFX.tap(); G.rankTab = t.k; } else if (inBox(p, R_BACK)) { SFX.tap(); goBack(); }
        break;
      }
      case 'lounge': {
        const si = L_SLOTS.findIndex(b => inBox(p, b));
        if (si >= 0) { SFX.tap(); G.loungeSel = si; } else if (inBox(p, R_BACK)) { SFX.tap(); G.loungeSel = -1; goBack(); }
        break;
      }
      case 'dress': {
        for (const { k, y } of D_ROWS) {
          if (inBox(p, dArrowL(y))) { SFX.tap(); cycleLook(k, -1); return; }
          if (inBox(p, dArrowR(y))) { SFX.tap(); cycleLook(k, 1); return; }
        }
        if (inBox(p, D_BACK)) { SFX.tap(); Rank.updateProfile(); goBack(); }
        break;
      }
      case 'tut':
        if (inBox(p, P_PREV)) flipTut(-1);
        else if (inBox(p, P_NEXT)) flipTut(1);
        else if (inBox(p, R_BACK)) { SFX.tap(); closeTut(); }
        break;
      case 'chat':
        if (inBox(p, C_SEND)) { SFX.tap(); Chat.send(); }
        else if (inBox(p, R_BACK)) { SFX.tap(); closeChat(); }
        else if (G.chatScroll > 0 && inBox(p, { x: 50, y: C_BOTTOM - 14, w: 28, h: 11 })) G.chatScroll = 0;
        break;
    }
  }
  let down = null;
  cvs.addEventListener('pointerdown', e => {
    unlockAudio();
    const p = toLogical(e);
    down = { x: p.x, y: p.y, used: false };
    // 게임 중에는 누르는 순간 바로 반응 (연타가 중요)
    if (G.state === 'play') { playTap(p); down.used = true; }
  });
  cvs.addEventListener('pointerup', e => {
    if (!down) return;
    const p = toLogical(e), d0 = down; down = null;
    if (d0.used) return;
    if (G.state === 'tut' && Math.abs(p.x - d0.x) >= 16 && Math.abs(p.x - d0.x) > Math.abs(p.y - d0.y)) { flipTut(p.x < d0.x ? 1 : -1); return; }
    if (!d0.drag && Math.abs(p.x - d0.x) < 10 && Math.abs(p.y - d0.y) < 10) tap(p);
  });
  cvs.addEventListener('pointercancel', () => { down = null; });
  cvs.addEventListener('pointermove', e => {
    if (!down || G.state !== 'chat') return;
    const p = toLogical(e);
    if (down.ly === undefined) down.ly = down.y;
    if (Math.abs(p.y - down.y) >= 6 || down.drag) { down.drag = true; G.chatScroll = (G.chatScroll || 0) + (p.y - down.ly); down.ly = p.y; }
  });
  cvs.addEventListener('wheel', e => { if (G.state !== 'chat') return; e.preventDefault(); G.chatScroll = (G.chatScroll || 0) - e.deltaY / scale; }, { passive: false });
  nickEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); closeName(true); } else if (e.key === 'Escape') closeName(false); });
  window.addEventListener('keydown', e => {
    if (G.state === 'chat') { if (e.key === 'Enter') { e.preventDefault(); Chat.send(); } else if (e.key === 'Escape') closeChat(); return; }
    if (G.state === 'name') return;
    unlockAudio();
    const k = e.key;
    if (G.state === 'tut') {
      if (k === 'ArrowLeft') flipTut(-1);
      else if (k === 'ArrowRight') flipTut(1);
      else if (k === 'Escape' || ((k === 'Enter' || k === ' ') && G.tutPage === TUT.length - 1)) closeTut();
      else if (k === 'Enter' || k === ' ') flipTut(1);
      e.preventDefault(); return;
    }
    if (G.state === 'play') {
      // PC: 1~6 숫자로 침대, 스페이스로 진상 연타
      if (G.event && (k === ' ' || k === 'Enter')) { eventTap({ x: -99, y: -99 }); e.preventDefault(); }
      else if (G.event && G.event.type === 'round' && ['1', '2', '3'].includes(k)) { const b = B_BINS[+k - 1]; eventTap({ x: b.x + 2, y: b.y - 28 }); }
      else if (!G.event && k >= '1' && k <= '6') tapBed(+k - 1);
      return;
    }
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      if (G.state === 'title') startGame('normal');
      else if (G.state === 'over' && G.st > 0.6) newGame(G.mode);
      else if (G.state === 'rank' || G.state === 'lounge') goBack();
      else if (G.state === 'dress') { Rank.updateProfile(); goBack(); }
    } else if (k === 'Escape' && ['rank', 'lounge', 'dress'].includes(G.state)) {
      if (G.state === 'dress') Rank.updateProfile();
      goBack();
    }
  });

  // ---------- 화면 크기 ----------
  let scale = 3, RES = 1, HV = H, OFF = 0;
  function layout() {
    const cs = getComputedStyle(wrapEl);
    const aw = wrapEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const ah = wrapEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const s = Math.max(0.5, Math.min(aw / W, ah / H));
    scale = s;
    HV = Math.max(H, Math.min(320, Math.floor(ah / s)));
    OFF = Math.floor((HV - H) / 2);
    stageEl.style.width = Math.floor(W * s) + 'px';
    stageEl.style.height = Math.floor(HV * s) + 'px';
    const k = Math.max(1, Math.min(8, Math.ceil(s * (window.devicePixelRatio || 1))));
    if (k !== RES) { RES = k; cvs.width = W * k; ctx.imageSmoothingEnabled = false; }
    if (cvs.height !== HV * RES) { cvs.height = HV * RES; ctx.imageSmoothingEnabled = false; }
    const b = NICK_BOX;
    Object.assign(nickEl.style, { left: b.x * s + 'px', top: (b.y + OFF) * s + 'px', width: b.w * s + 'px', height: b.h * s + 'px', fontSize: Math.round(10 * s) + 'px' });
    const c = C_BOX;
    Object.assign(chatEl.style, { left: (c.x + 2) * s + 'px', top: (c.y + 2 + OFF) * s + 'px', width: (c.w - 4) * s + 'px', height: (c.h - 4) * s + 'px', fontSize: Math.round(10 * s) + 'px', paddingLeft: Math.round(2 * s) + 'px' });
  }
  window.addEventListener('resize', layout);

  // ---------- 루프 ----------
  function bandColor() {
    if (G.state === 'title') return ['N', 'fl2'];
    if (G.state === 'play') return G.event ? (G.event.type === 'karen' ? ['R', 'R'] : ['wall', 'fl2']) : ['wall', 'fl2'];
    if (G.state === 'over') return [G.success ? 'sun2' : 'n', 'fl2'];
    if (G.state === 'lounge') return ['cream', 'fl2'];
    return [null, null];
  }
  function draw() {
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (OFF > 0 || HV > H) {
      // 위아래 늘어난 띠: 화면에 어울리는 색으로 채움
      const [top, bot] = bandColor();
      ctx.drawImage(WALL, 0, 0); ctx.drawImage(WALL, 0, HV - H);
      if (top) rect(0, 0, W, OFF, top);
      if (bot) rect(0, OFF + H, W, HV - OFF - H, bot);
    }
    ctx.translate(0, OFF);
    if (G.state === 'title') drawTitle();
    else if (G.state === 'play') drawPlay();
    else if (G.state === 'over') drawOver();
    else if (G.state === 'name') drawName();
    else if (G.state === 'rank') drawRank();
    else if (G.state === 'dress') drawDress();
    else if (G.state === 'lounge') drawLounge();
    else if (G.state === 'tut') drawTut();
    else if (G.state === 'chat') drawChat();
  }
  let last = 0;
  function frame(ts) {
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0);
    last = ts;
    requestAnimationFrame(frame);
    try { update(dt); draw(); } catch (e) { console.error(e); }
  }

  // ---------- 확인용 화면 (?shot=...) : 네트워크를 쓰지 않음 ----------
  function shotView(shot) {
    G.nick = G.nick || '테스트'; G.ward = G.ward || '내과병동'; G.total = Math.max(G.total, 70000);
    G.look = lookParse('1.0.1.1.4.1');
    const playAt = (extra) => { newGame('normal'); G.elapsed = SHIFT * 0.4; G.evIdx = 2; G.score = 8240; G.combo = 12; G.stamina = 62; G.noteT = 0;
      G.calls = [{ kind: 'pain', age: 1, life: 4, taps: 0 }, null, { kind: 'drip', age: 3, life: 4, taps: 0 }, { kind: 'demand', age: 1, life: 4, taps: 1 }, null, { kind: 'water', age: 0.5, life: 4, taps: 0 }];
      G.items = [{ kind: 'coffee', x: 58, y: 150, age: 0, life: 5 }]; G.nx = 56; G.ny = 96; G.ntx = 56; G.nty = 96; fx(25, 60, '팡!', 'Y', 'b'); G.fx[0].t = 0.2;
      if (extra) extra(); };
    if (shot === 'play') playAt();
    else if (shot === 'fever') playAt(() => { G.fever = 5; });
    else if (shot === 'karen') playAt(() => { startEvent('karen'); G.event.intro = 0; G.event.taps = 17; G.event.time = 2.4; fx(30, 118, '쾅!', 'Y', 'b'); });
    else if (shot === 'karenwin') playAt(() => { startEvent('karen'); G.event.intro = 0; G.event.taps = 24; G.event.result = 'win'; G.event.resultT = 1.2; G.event.fly = 0.1; });
    else if (shot === 'round') playAt(() => { startEvent('round'); G.event.intro = 0; G.event.idx = 2; G.event.ok = 2; G.event.time = 6.3; });
    else if (shot === 'over' || shot === 'fail') { playAt(); G.stats = { calls: 87, karens: 2, coffee: 3, missed: 4, demands: 6 }; G.maxCombo = 23; G.score = 11480; G.stamina = 40; endShift(shot === 'over'); G.st = 1; G.overMsg = { code: 'saved', rank: 2 }; }
    else if (shot === 'rank' || shot === 'ward') {
      const today = todayStr();
      Rank.net = false; Rank.local = [
        { nick: '나이트왕', best: 31800, total: 0, look: lookParse('3.2.4.2.3'), ward: '중환자실', day: today, dayBest: 9000 },
        { nick: '콜벨헌터', best: 22600, total: 0, look: lookParse('2.1.2.0.1'), ward: '내과병동', day: today, dayBest: 12000 },
        { nick: '테스트', best: 12400, total: 0, look: G.look, ward: '내과병동', day: '', dayBest: 0 },
        { nick: '신규쌤', best: 3200, total: 0, look: lookParse('0.0.0.0.0'), ward: '응급실', day: today, dayBest: 2100 },
      ].map(r => Object.assign({ id: null }, r));
      goRank('title', shot === 'ward' ? 'ward' : 'me');
    }
    else if (shot === 'name') openName('title');
    else if (shot === 'code') { openName('title'); codeMode(true); nickEl.value = 'K7QM-2XHP'; G.codeMsg = 'notfound'; }
    else if (shot === 'dress') G.state = 'dress';
    else if (shot === 'lounge') G.state = 'lounge';
    else if (/^tut\d+$/.test(shot)) { G.state = 'tut'; G.tutPage = Math.min(TUT.length, +shot.slice(3)) - 1; }
    else if (shot === 'chat' || shot === 'chattitle') {
      Chat.fake = true; Ident.uid = 'me'; Chat.seen = 1; Chat.status = 'ok';
      [['콜벨헌터', '2.1.2.0.1', '새벽 3시 콜벨 지옥 ㅠㅠ', 'x'], ['테스트', lookStr(G.look), '진상 날리기 너무 시원함', 'me'],
        ['나이트왕', '3.2.4.2.3', '중환자실 1등 가즈아', 'y'], ['신규쌤', '0.0.0.0.0', '다들 오늘도 수고하셨어요!', 'z']]
        .forEach(([nick, look, text, uid], i) => Chat.rows.push({ id: i + 1, uid, nick, look: lookParse(look), text: maskBad(text), at: '07:0' + (i + 2) }));
      if (shot === 'chat') openChat();
    }
    else if (shot === 'auto') {
      // 자동으로 한 판: 콜벨은 0.8초 뒤 끄고, 커피는 체력 70 아래에서 마시고, 이벤트는 정답·연타
      newGame('normal');
      let seen = new Set(), steps = 0;
      while (G.state === 'play' && steps < 60 * 400) {
        update(1 / 60); steps++;
        if (G.event) {
          seen.add(G.event.type);
          if (G.event.intro <= 0 && G.event.resultT <= 0 && steps % 9 === 0) {
            if (G.event.type === 'karen') eventTap({ x: 0, y: 0 });
            else { const b = B_BINS[G.event.cards[G.event.idx].cat]; eventTap({ x: b.x + 2, y: b.y - 28 }); }
          }
          continue;
        }
        G.calls.forEach((c, i) => { if (c && c.age > 0.8) tapBed(i); });
        if (G.stamina < 70 && G.items.length) { const it = G.items[0]; playTap({ x: it.x + 4, y: it.y + 4 }); }
      }
      document.title = JSON.stringify({ state: G.state, success: G.success, score: G.score, clock: clockStr(), stats: G.stats, maxCombo: G.maxCombo, events: [...seen], stamina: Math.round(G.stamina), sec: Math.round(steps / 60) });
    }
    else if (shot === 'run') { newGame('normal'); for (let i = 0; i < 60 * 40; i++) update(1 / 60); }
  }

  // ---------- 시작 ----------
  const shot = new URLSearchParams(location.search).get('shot');
  layout();
  const fontsReady = Promise.all(['12px Galmuri11B', '10px Galmuri9', '8px Galmuri7'].map(f => document.fonts.load(f))).catch(() => {});
  if (shot) {
    Ident.uid = '00000000-0000-4000-8000-000000000000'; Ident.code = 'K7QM2XHP';
    fontsReady.then(() => { shotView(shot); txtCache.clear(); layout(); requestAnimationFrame(frame); });
  } else {
    Ident.load().then(async () => {
      // 이 기기에 이름이 없으면 IndexedDB에 남은 프로필에서 되살림
      if (!G.nick) { const p = await IDB.get('profile'); applyProfile(p); }
      Rank.init();
    });
    fontsReady.then(() => { txtCache.clear(); requestAnimationFrame(frame); });
  }
})();
