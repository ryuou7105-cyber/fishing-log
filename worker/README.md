# 魚種AI判定の中継役（Cloudflare Worker）の設置手順

アプリ → この Worker → Gemini API の順に写真を渡して、魚種の候補を返します。
Gemini の APIキーは Cloudflare の中にだけ置くので、アプリ（GitHub Pages）からは見えません。
使えるのは、アプリにログインしていてメンバー登録済みの人だけです。

## 1. Gemini の APIキーを取る
1. パソコンで https://aistudio.google.com を開き、Googleアカウントでログイン
2. 左メニューの「Get API key」→「APIキーを作成」
3. 表示されたキー（AIza… で始まる）をコピー（他人に見せない）

## 2. Worker を作る
1. https://dash.cloudflare.com で無料アカウントを作成・ログイン
2. 「Workers & Pages」→「作成」→「Hello World」テンプレートを選ぶ
3. 名前を `fish-ai` などにして「デプロイ」
4. 「コードを編集」を押し、中身をすべて消して `fish-ai-worker.js` の内容を貼り付け →「デプロイ」

## 3. APIキーを登録する
1. 作った Worker の「設定」→「変数とシークレット」→「追加」
2. 種類「シークレット」、名前 `GEMINI_API_KEY`、値に 1. のキーを貼り付けて保存
3. （任意）使うモデルを固定したいときは、テキスト変数 `GEMINI_MODEL` を追加（例 `gemini-flash-latest`）

## 4. アプリに URL を設定する
Worker の URL（例 `https://fish-ai.xxxx.workers.dev`）を `firebace-config.js` の
`window.FISH_AI_URL = '';` の `''` の中に入れて保存・公開すると、
「📷 写真から魚種をAI判定」ボタンが使えるようになります。

## 注意
- Gemini の無料枠では、送った写真が Google のサービス改善に使われることがあります。気になる場合は AI Studio で課金設定（有料枠）にしてください（少人数なら費用はごくわずか）。
- 呼び出せるのは `https://ryuou7105-cyber.github.io` からのアクセスだけに制限しています。
