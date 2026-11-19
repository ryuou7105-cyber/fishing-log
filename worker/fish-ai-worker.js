/* 釣果ノート Pro : 魚種AI判定の中継役（Cloudflare Worker）
   - アプリから写真を受け取り、Gemini API に問い合わせて魚種の候補を返す
   - Gemini の APIキーはここ（Cloudflare の Secret）にだけ置くので、アプリ側には出ない
   - 使えるのは「ログイン済み かつ メンバー登録済み」の人だけ（Firebase で確認）

   Cloudflare 側で設定する変数:
     GEMINI_API_KEY  … Google AI Studio で発行した APIキー（必ず「Secret」で登録）
     GEMINI_MODEL    … 任意。省略時は gemini-flash-latest（常に最新の Flash を使う別名）
*/

const ALLOWED_ORIGINS = ['https://ryuou7105-cyber.github.io'];
const DB_URL = 'https://fishing-log-3c459-default-rtdb.firebaseio.com';
const MAX_IMAGE_CHARS = 2_000_000;   // base64 で約1.5MB まで（アプリ側で縮小済みなので通常 100KB 前後）

const PROMPT = `あなたは日本の釣り魚に詳しい魚類の専門家です。
写真に写っている魚の種類を判定してください。釣り場は主に瀬戸内海（岡山県周辺）です。
- name は標準和名をカタカナで（例: マダイ、クロダイ、メバル、カサゴ、マアジ）
- 候補は確からしい順に最大3つ。confidence は 0〜100 の整数
- reason は判断の決め手を日本語で短く（30字程度。体色・ヒレ・模様など）
- 魚が写っていない、または判定できない場合は isFish を false にし、note に理由を書く`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    isFish: { type: 'BOOLEAN' },
    candidates: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          confidence: { type: 'INTEGER' },
          reason: { type: 'STRING' }
        },
        required: ['name', 'confidence']
      }
    },
    note: { type: 'STRING' }
  },
  required: ['isFish', 'candidates']
};

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) }
  });
}

// Firebase のログイン証明（IDトークン）から uid を取り出す（署名の確認は次の DB 問い合わせで行う）
function uidFromToken(token) {
  try {
    const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const body = JSON.parse(atob(p + '='.repeat((4 - p.length % 4) % 4)));
    return typeof body.user_id === 'string' ? body.user_id : (typeof body.sub === 'string' ? body.sub : null);
  } catch (e) { return null; }
}

// そのトークンで members/<uid> が読めれば「本物のログイン」かつ「メンバー」
async function isMember(token) {
  const uid = uidFromToken(token);
  if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return false;
  const r = await fetch(`${DB_URL}/members/${uid}.json?auth=${encodeURIComponent(token)}`);
  if (!r.ok) return false;
  const v = await r.json().catch(() => null);
  return v !== null && v !== false;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== 'POST') return json({ error: 'POST で送ってください' }, 405, origin);
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: '許可されていない呼び出し元です' }, 403, origin);
    if (!env.GEMINI_API_KEY) return json({ error: 'サーバーに APIキーが設定されていません' }, 500, origin);

    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token || !(await isMember(token))) return json({ error: 'メンバーとしてログインしてください' }, 401, origin);

    let body;
    try { body = await request.json(); } catch (e) { return json({ error: '送信データが読めません' }, 400, origin); }
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body && body.image || '');
    if (!m) return json({ error: '画像がありません' }, 400, origin);
    if (m[2].length > MAX_IMAGE_CHARS) return json({ error: '画像が大きすぎます' }, 413, origin);

    const model = env.GEMINI_MODEL || 'gemini-flash-latest';
    const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: m[1], data: m[2] } }, { text: PROMPT }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2 }
      })
    });
    if (!g.ok) {
      const detail = (await g.text()).slice(0, 300);
      const msg = g.status === 429 ? 'AIの利用上限に達しました。しばらくしてから試してください' : 'AIへの問い合わせに失敗しました';
      return json({ error: msg, status: g.status, detail }, 502, origin);
    }
    const out = await g.json();
    const text = out?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    let result;
    try { result = JSON.parse(text); } catch (e) { return json({ error: 'AIの答えを読めませんでした' }, 502, origin); }
    result.candidates = (Array.isArray(result.candidates) ? result.candidates : [])
      .filter(c => c && typeof c.name === 'string' && c.name.trim())
      .slice(0, 3)
      .map(c => ({ name: c.name.trim().slice(0, 30), confidence: Math.max(0, Math.min(100, Math.round(+c.confidence || 0))), reason: String(c.reason || '').slice(0, 80) }));
    return json({ isFish: !!result.isFish, candidates: result.candidates, note: String(result.note || '').slice(0, 120), model }, 200, origin);
  }
};
