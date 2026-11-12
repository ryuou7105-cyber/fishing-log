(() => {
  const $ = (id) => document.getElementById(id);
  const form = $('form'), list = $('list'), empty = $('empty'), filter = $('filter');
  const MAX_MEMBERS = 60;
  const VIEWS = ['log', 'trips', 'stats'];
  const PRIVATE_FIELDS = ['spot', 'surroundings', 'reflection'];
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  const PREFS = '北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' ');

  let db = null, auth = null, myId = null;
  let canWrite = false, isOwner = false, loaded = false;
  let assets = null;
  const memberSubs = new Map();
  const tripsBy = new Map();
  const privateBy = {};
  const names = {};
  let personFilter = '', fishFilter = '', armedKey = null;
  let editing = null;
  let fishRows = [];
  let tripPhotos = [];
  let myTackle = [];
  let mtArmed = null;
  let tackleItems = [];
  let tackleItemsById = new Map();
  let yearFilter = '', showLimit = 30;
  let speciesMap = new Map();
  let speciesById = new Map();
  const A = { scope: 'all', fish: '', cond: 'tide', dim: 'lure', tideBase: 'highTide' };

  const MT_DOC = 'mytackle';
  const FISH_FIELDS = [
    ['fish', '魚種', 'text', '例: アジ', 'dl-fish'],
    ['count', '数', 'number', '1'],
    ['released', 'うちリリース', 'number', ''],
    ['length', '長さ（cm）', 'number', ''],
    ['measure', '測り方', 'select', ['', '全長', '胴長', '尾叉長']],
    ['weight', '重量（g）', 'number', ''],
    ['hitTime', 'ヒット時刻', 'time', '', null, true],
    ['range', 'レンジ', 'select', ['', '表層', '中層', 'ボトム付近', 'ボトム']],
    ['lure', '使ったルアー・エサ', 'text', '自動で入ります', 'dl-lure', true],
    ['pattern', 'ヒットパターン', 'text', '例: 2段シャクリ後のフォール', null, true],
    ['tackleId', '使ったタックル（台帳）', 'select-ledger', ''],
  ];
  const CONDS = [['tide', '潮回り'], ['clarity', '濁り'], ['current', '潮の流れ'], ['weather', '天気'], ['windDir', '風向'], ['band', '時間帯'], ['moon', '月の満ち欠け'], ['boat', '陸・船']];
  const DIMS = [['lure', 'ルアー・エサ'], ['color', 'カラー'], ['range', 'レンジ'], ['place', '釣り場'], ['tackle', 'タックル']];
  const BAND_ORDER = ['朝（4〜9時）', '日中（9〜15時）', '夕方（15〜19時）', '夜（19〜4時）'];
  const ORDERS = { tide: ['大潮', '中潮', '小潮', '長潮', '若潮'], clarity: ['澄んでいる', '笹濁り', '濁り', '泥濁り'], current: ['速い', '普通', '緩い', '止まっている'], band: BAND_ORDER, boat: ['陸から', '遊漁船', '渡船'], moon: ['新月前後', '上弦前後', '満月前後', '下弦前後'] };
  const TIDE_BY_AGE = ['大潮', '大潮', '大潮', '中潮', '中潮', '中潮', '中潮', '小潮', '小潮', '小潮', '長潮', '若潮', '中潮', '中潮', '大潮', '大潮', '大潮', '大潮', '中潮', '中潮', '中潮', '中潮', '小潮', '小潮', '小潮', '長潮', '若潮', '中潮', '中潮', '大潮'];
  const MOON_ORDER = ['新月前後', '上弦前後', '満月前後', '下弦前後'];
  const NO_ASSETS_TEXT = 'この画面では写真を追加できません。';

  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const weekday = (s) => { if (!s) return ''; const [y, m, d] = s.split('-').map(Number); return WD[new Date(y, m - 1, d).getDay()]; };
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const nameOf = (uid) => uid === myId ? 'あなた' : (names[uid] || '仲間');
  const allTrips = () => [...tripsBy.values()].flat();
  const fishCount = (t) => (t.fish || []).reduce((s, f) => s + (Number(f.count) || 1), 0);
  const getPath = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
  function setPath(o, p, v) { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach(k => { a = a[k] ??= {}; }); a[ks.at(-1)] = v; }
  const mapsUrl = (q) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  const nowHHMM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const autoTime = () => $('t-date').value === todayStr() ? nowHHMM() : '';
  const toMin = (hhmm) => hhmm ? Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) : null;
  const fromMinT = (m) => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0'); };
  const numOrNull = (v) => v === '' || v == null ? null : Number(v);
  
  function durationMin(t) { const a = toMin(t.start), b = toMin(t.end); if (a == null || b == null) return null; return b > a ? b - a : b + 1440 - a; }
  const fmtDur = (m) => m == null ? '' : `${Math.floor(m / 60)}時間${m % 60 ? (m % 60) + '分' : ''}`;

  function moonAge(ds) { if (!ds) return null; const [y, m, d] = ds.split('-').map(Number); let a = ((Date.UTC(y, m - 1, d, 3) - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % 29.530588853; if (a < 0) a += 29.530588853; return Math.round(a * 10) / 10; }
  const tideOf = (age) => age == null ? '' : TIDE_BY_AGE[Math.min(29, Math.floor(age))];
  const phaseOf = (age) => age == null ? '' : age >= 26 || age < 4 ? MOON_ORDER[0] : age < 11 ? MOON_ORDER[1] : age < 19 ? MOON_ORDER[2] : MOON_ORDER[3];
  const ageOf = (t) => t.moonAge ?? moonAge(t.date);
  const unitOf = (name) => /イカ|いか|烏賊|タコ|たこ|蛸/.test(name || '') ? '杯' : '匹';
  const measureOf = (f) => f.measure || (unitOf(f.fish) === '杯' ? '胴長' : '全長');
  const bandOf = (hhmm) => { if (!hhmm) return ''; const h = Number(hhmm.slice(0, 2)); return h >= 4 && h < 9 ? BAND_ORDER[0] : h >= 9 && h < 15 ? BAND_ORDER[1] : h >= 15 && h < 19 ? BAND_ORDER[2] : BAND_ORDER[3]; };
  const aTrips = () => allTrips().filter(t => A.scope === 'all' || t.uid === myId);
  const aFish = (t) => (t.fish || []).filter(f => !A.fish || f.fish === A.fish);
  const cnt = (fs) => fs.reduce((s, f) => s + (Number(f.count) || 1), 0);
  const svgEl = (tag, attrs) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const roundedTop = (x, y, w, h, r) => h <= 0 ? '' : (r = Math.min(r, h, w / 2), `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`);
  const roundedRight = (x, y, w, h, r) => w <= 0 ? '' : (r = Math.min(r, w, h / 2), `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`);
  const chartWidth = (host) => Math.max(280, Math.round(host.clientWidth || 640));
  function niceStep(max) { const raw = Math.max(1, max) / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p; return Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p); }
  function icon(name, cls = 'ic') { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', cls); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false'); const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', '#icon-' + name); svg.append(use); return svg; }
  const fishIcon = (name) => /イカ|いか|烏賊|タコ|たこ|蛸/.test(name || '') ? 'squid' : 'fish';

  $('t-pref').append(el('option', null, '-'), ...PREFS.map(p => el('option', null, p)));
  $('t-pref').options[0].value = '';

  function setEmpty(title, sub) { empty.replaceChildren(); if (!title) { empty.hidden = true; return; } const art = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); art.setAttribute('class', 'empty-art'); art.setAttribute('aria-hidden', 'true'); const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', '#icon-buoy'); art.append(use); empty.append(art); if (title) { const t = el('span', 'empty-title', title); empty.append(t); } if (sub) { const s = el('span', 'empty-sub', sub); empty.append(s); } empty.hidden = false; }
  function authErrorText(code) { const m = { 'auth/invalid-email': 'メールアドレスの形式が正しくありません。', 'auth/user-not-found': 'このメールアドレスのアカウントが見つかりません。新規登録してください。', 'auth/wrong-password': 'パスワードが違います。', 'auth/invalid-credential': 'メールアドレスまたはパスワードが正しくありません。', 'auth/email-already-in-use': 'このメールアドレスは既に登録されています。ログインしてください。', 'auth/weak-password': 'パスワードは6文字以上にしてください。', 'auth/too-many-requests': '試行回数が多すぎます。しばらく待ってからお試しください。', 'auth/network-request-failed': '通信エラーです。ネットワークを確認してください。', 'auth/unauthorized-domain': 'このドメインはFirebaseで承認されていません。承認済みドメインを確認してください。' }; return m[code] || `ログインできませんでした（${code}）`; }
  function normalizeTrip(t) { const v = t.schemaVersion || 1; const out = { ...t, schemaVersion: 2 }; out.windSpeed ??= null; out.waveHeight ??= null; out.pressure ??= null; out.tideCurve ??= null; out.tideStationId ??= null; out.tideSource ??= 'manual'; out.fish = (out.fish || []).map(f => ({ ...f, speciesId: f.speciesId ?? null, tideCm: f.tideCm ?? null, tidePhase: f.tidePhase ?? null, tackleId: f.tackleId ?? null, tackleSnapshot: f.tackleSnapshot ?? null })); return out; }
  const tripsOf = (uid) => window.FB.collection(db, 'catches', uid, 'trips');
  const privCol = () => window.FB.collection(db, 'data', 'users', myId);

  function startSubscriptions() { if (!db || !myId) return; const { collection, onSnapshot } = window.FB; const catchesRef = collection(db, 'catches'); onSnapshot(catchesRef, (snap) => { const ids = new Set(snap.docs.map(d => d.id)); ids.forEach(watchMember); for (const [uid, unsub] of memberSubs) { if (!ids.has(uid)) { unsub(); memberSubs.delete(uid); tripsBy.delete(uid); } } loaded = true; setWritable(canWrite); render(); }, (err) => { console.error('catches snapshot error', err); setEmpty('記録の読み込みが停止しました', 'Firestoreのルールを確認してください'); }); const privRef = collection(db, 'data', 'users', myId); onSnapshot(privRef, (snap) => { Object.keys(privateBy).forEach(k => delete privateBy[k]); myTackle = []; snap.docs.forEach(d => { if (d.id === MT_DOC) myTackle = Array.isArray(d.data().items) ? d.data().items : []; else privateBy[d.id] = d.data(); }); renderMyTackle(); render(); }, (err) => { console.warn('private snapshot error', err); }); }

  function watchMember(uid) { if (memberSubs.has(uid) || memberSubs.size >= MAX_MEMBERS) return; const { collection, onSnapshot } = window.FB; const tripsRef = collection(db, 'catches', uid, 'trips'); const unsub = onSnapshot(tripsRef, (snap) => { const first = !tripsBy.has(uid); tripsBy.set(uid, snap.docs.map(d => ({ id: d.id, uid, ...normalizeTrip(d.data()) }))); if (!(uid in names)) refreshNames(); if (first && uid === myId && !editing) applyLastTackle(false); render(); }, (err) => { console.warn('member trips error', uid, err); }); memberSubs.set(uid, unsub); }
  async function refreshNames() { for (const uid of tripsBy.keys()) { if (!names[uid]) names[uid] = uid.slice(0, 6); } render(); }

  function start() {
    if (!window.FB || !window.FIREBASE_CONFIG) {
      document.getElementById('auth-msg').textContent = '設定ファイル（firebase-config.js または firebase-sdk.js）が正しく読み込まれていません。';
      document.getElementById('auth-screen').hidden = false;
      return;
    }
    const { initializeApp, getAuth, onAuthStateChanged, getFirestore } = window.FB;
    if (!window._fbApp) { window._fbApp = initializeApp(window.FIREBASE_CONFIG); }
    auth = getAuth(window._fbApp);
    db = getFirestore(window._fbApp);
    onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        myId = fbUser.uid;
        $('auth-screen').hidden = true;
        document.getElementById('main-app').style.display = 'grid';
        isOwner = false; canWrite = true; setWritable(canWrite); renderFishRows();
        $('t-photos').disabled = true; $('trip-previews').replaceChildren(el('span', 'photo-status', '写真機能は準備中です'));
        startSubscriptions();
      } else {
        myId = null;
        $('auth-screen').hidden = false;
        document.getElementById('main-app').style.display = 'none';
        setEmpty(null);
      }
    });
  }
  function setWritable(on) { canWrite = on; form.hidden = !on; $('readonly-note').hidden = on || !loaded; $('role').innerHTML = isOwner ? '<b>オーナー</b>・記録できます' : on ? '<b>メンバー</b>・記録できます' : '<b>閲覧のみ</b>'; }

  $('auth-form').addEventListener('submit', async (e) => { e.preventDefault(); const { signInWithEmailAndPassword } = window.FB; const msg = $('auth-msg'); msg.textContent = ''; $('auth-login').disabled = true; try { await signInWithEmailAndPassword(auth, $('auth-email').value.trim(), $('auth-pass').value); } catch (err) { msg.textContent = authErrorText(err.code); } finally { $('auth-login').disabled = false; } });
  $('auth-signup').addEventListener('click', async () => { const { createUserWithEmailAndPassword } = window.FB; const msg = $('auth-msg'); msg.textContent = ''; $('auth-signup').disabled = true; try { await createUserWithEmailAndPassword(auth, $('auth-email').value.trim(), $('auth-pass').value); } catch (err) { msg.textContent = authErrorText(err.code); } finally { $('auth-signup').disabled = false; } });

  function renderFishRows() { const host = $('fish-rows'); host.replaceChildren(); if (!fishRows.length) host.append(el('p', 'boz', 'まだ魚がありません。釣れなかった日は、このまま保存すると「ボウズ」として記録されます。')); fishRows.forEach((row, i) => { const box = el('div', 'fish-row'); const head = el('div', 'fr-head', `釣果 ${i + 1}`); const acts = el('span', 'fr-acts'); const dup = el('button', 'link', '同じ条件でもう1件'); dup.type = 'button'; dup.onclick = () => { readFishRows(); const d = fishRows[i].data; fishRows.splice(i + 1, 0, { data: { fish: d.fish, count: 1, measure: d.measure, range: d.range, lure: d.lure, pattern: d.pattern, hitTime: autoTime() } }); renderFishRows(); scheduleDraft(); document.querySelector(`#fr-${i + 1}-length`)?.focus(); }; const rm = el('button', 'link', '外す'); rm.type = 'button'; rm.onclick = () => { readFishRows(); discardEntry(row.photo); fishRows.splice(i, 1); renderFishRows(); scheduleDraft(); }; acts.append(dup, rm); head.append(acts); box.append(head); FISH_FIELDS.forEach(([k, label, type, ph, dl, wide]) => { const id = `fr-${i}-${k}`; const lab = el('label', wide ? 'wide' : ''); lab.htmlFor = id; lab.append(label); let inp; if (type === 'select') { inp = el('select'); ph.forEach(o => { const op = el('option', null, o || (k === 'measure' ? '自動（イカは胴長）' : '-')); op.value = o; inp.append(op); }); } else if (type === 'select-ledger') { inp = el('select'); inp.append(el('option', null, '（台帳なし）')); [...tackleItemsById.values()].forEach(it => { const o = el('option', null, `${it.name}（${it.type}）`); o.value = it.id; inp.append(o); }); } else { inp = el('input'); inp.type = type; if (ph) inp.placeholder = ph; if (dl) inp.setAttribute('list', dl); if (type === 'number') { const whole = k === 'count' || k === 'released'; inp.step = whole ? '1' : '0.1'; inp.min = k === 'count' ? '1' : '0'; inp.inputMode = whole ? 'numeric' : 'decimal'; } } inp.id = id; inp.dataset.f = k; inp.value = row.data[k] ?? (k === 'count' ? 1 : ''); if (k === 'fish') inp.required = true; if (k === 'hitTime') { const wrap = el('span', 'time-wrap'); const now = el('button', 'ghost', '今'); now.type = 'button'; now.setAttribute('aria-label', 'ヒット時刻に今の時刻を入れる'); now.onclick = () => { inp.value = nowHHMM(); scheduleDraft(); }; wrap.append(inp, now); lab.append(wrap); } else lab.append(inp); box.append(lab); }); const ph = el('div', 'fr-photo'); const fl = el('label'); fl.htmlFor = `fr-${i}-photo`; fl.append('写真（魚とメジャーなど）'); const fi = el('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.id = `fr-${i}-photo`; fi.disabled = !assets; fl.append(fi); ph.append(fl); const pv = el('img', 'preview'); pv.alt = ''; const st = el('span', 'photo-status'); const rmP = el('button', 'link', '写真を外す'); rmP.type = 'button'; const paint = () => { const e = row.photo; const src = e ? (e.previewUrl || '') : ''; pv.hidden = !src; rmP.hidden = !e; if (src) pv.src = src; st.textContent = e ? (e.state === 'uploading' ? '保存中…' : e.state === 'error' ? e.error : '') : ''; st.className = 'photo-status' + (e?.state === 'error' ? ' err' : ''); }; fi.onchange = () => { const file = fi.files[0]; fi.value = ''; if (!file) return; discardEntry(row.photo); row.photo = { file, previewUrl: URL.createObjectURL(file), state: 'pending' }; paint(); }; rmP.onclick = () => { discardEntry(row.photo); row.photo = null; paint(); }; paint(); ph.append(pv, st, rmP); box.append(ph); host.append(box); }); $('fish-hint').textContent = fishRows.length ? `${fishRows.length}件` : '0件（ボウズ）'; }
  function readFishRows() { document.querySelectorAll('#fish-rows .fish-row').forEach((box, i) => { box.querySelectorAll('[data-f]').forEach(inp => { fishRows[i].data[inp.dataset.f] = inp.value; }); }); }
  function scheduleDraft() {}
  function discardEntry(e) {}
  function renderTripPreviews() {}
  function render() {}
  function renderMyTackle() {}
  function applyLastTackle() {}
  function resetForm() {}
  function renderStats() {}
  function updateDerived() {}
  function renderTackleLedger() {}

  renderFishRows();
  start();
})();
