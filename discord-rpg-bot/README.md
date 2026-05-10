# Etherion Chronicle — セットアップガイド

## フォルダ構成

```
discord-rpg-bot/
├─ package.json
├─ .env.example
├─ index.js
├─ register-commands.js
└─ src/
   ├─ data/
   │  └─ players.json         ← 自動生成される
   ├─ game/
   │  ├─ classes.js           ← クラス定義
   │  ├─ enemies.js           ← 敵データ
   │  ├─ save.js              ← JSON保存/読み込み
   │  ├─ player.js            ← プレイヤーユーティリティ
   │  ├─ battle.js            ← 戦闘ロジック
   │  └─ explore.js           ← 探索イベント
   └─ commands/
      ├─ startHandler.js      ← /start & クラス選択
      ├─ menuHandler.js       ← メインメニュー & ステータス
      ├─ exploreHandler.js    ← 探索
      └─ battleHandler.js     ← 戦闘
```

---

## インストール手順

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、値を入力する。

```bash
cp .env.example .env
```

```env
DISCORD_TOKEN=your_bot_token_here
APPLICATION_ID=your_application_id_here
GUILD_ID=your_guild_id_here   ← テスト時のみ。本番は削除してOK
```

### 3. スラッシュコマンドの登録

```bash
node register-commands.js
```

成功メッセージが表示されたらOK。

### 4. Botの起動

```bash
node index.js
# または
npm start
```

---

## Discord Developer Portal の設定

1. https://discord.com/developers/applications にアクセス
2. 「New Application」でアプリを作成
3. **Bot** タブ → 「Add Bot」→ Token をコピー → `.env` の `DISCORD_TOKEN` に貼る
4. **Bot** タブ → **Privileged Gateway Intents** → 不要（GUILDSのみで動作）
5. **OAuth2** → URL Generator:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Read Message History`, `Use Slash Commands`
6. 生成されたURLでサーバーに招待

---

## よくあるエラーと対処法

| エラー | 原因 | 対処 |
|--------|------|------|
| `TOKEN_INVALID` | トークンが間違い | Developer Portalでトークンをリセット・再コピー |
| `Unknown interaction` | ボタン返信が遅延（3秒超え） | `safeReply` 関数で吸収済み |
| `interaction already replied` | 二重返信 | `safeReply` が自動で `editReply` にフォールバック |
| `players.json not found` | ファイルが存在しない | 起動時に `ensurePlayersFile()` で自動生成 |
| ボタンを押しても無反応 | カスタムID未対応 | `index.js` のルーティングを確認 |
| `Missing Access` | BotがサーバーにいないかGUILD_IDが違う | 招待URLを再確認。GUILD_IDはサーバー設定から確認 |
| コマンドが出てこない | コマンド未登録 | `node register-commands.js` を再実行 |
| `APPLICATION_ID` エラー | Application IDが間違い | Developer Portal > General Information でコピー |

---

## ゲームフロー

```
/start
  └─ 新規 → クラス選択 → メインメニュー
  └─ 既存 → メインメニュー

メインメニュー
  ├─ 📊 ステータス確認 → 戻る
  ├─ 🧭 探索を開始
  │   ├─ 北/南/東/西 へ進む
  │   │   ├─ 敵遭遇 → 戦闘
  │   │   │   ├─ 攻撃/防御/逃げる
  │   │   │   ├─ 勝利 → EXP & Gold 獲得 → メインメニュー
  │   │   │   └─ 敗北 → HP半回復 → メインメニュー
  │   │   ├─ ゴールド → 探索継続
  │   │   ├─ 回復の泉 → 探索継続
  │   │   └─ 何もなし → 探索継続
  │   └─ 戻る → メインメニュー
  ├─ 📦 インベントリ (準備中)
  ├─ 🏪 ショップ (準備中)
  ├─ 👥 パーティ編成 (準備中)
  └─ 🗺️ マップ表示 (準備中)
```

---

## Phase 2 以降の拡張予定

- SQLite移行（better-sqlite3）
- インベントリ & 装備システム
- スキルツリー
- ショップ
- ギルドシステム
- レイドボス
- Canvas画像UI
- AI NPC会話
