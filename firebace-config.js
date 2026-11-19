window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDfLGdkZAgQyW1Wg3B9jJ4T0k8hRXyp0Eo",
  authDomain: "fishing-log-3c459.firebaseapp.com",
  databaseURL: "https://fishing-log-3c459-default-rtdb.firebaseio.com",
  projectId: "fishing-log-3c459",
  storageBucket: "fishing-log-3c459.firebasestorage.app",
  messagingSenderId: "422541686306",
  appId: "1:422541686306:web:9e977a0bae4764c5fdfc7b"
};

/* 魚種AI判定の中継役（Cloudflare Worker）のURL。設定したら「📷 写真から魚種をAI判定」が使えます
   例: 'https://fish-ai.xxxx.workers.dev' （空のままだとボタンは「準備がまだです」と表示） */
window.FISH_AI_URL = 'https://fish-ai.ryuou7105.workers.dev';
