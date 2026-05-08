# ⚔️ Etherion Chronicle - Discord RPG Bot

Discordのテキストチャンネルで遊べるオリジナルRPGボットです。

## 🚀 セットアップ手順

### 1. Discord Developer Portal でBotを作成

1. https://discord.com/developers/applications にアクセス
2. 「New Application」→ 名前を入力（例: `Etherion Chronicle`）
3. 左メニュー「Bot」→「Add Bot」
4. **Token** をコピーしておく（後で使う）
5. 「Privileged Gateway Intents」で以下を有効化：
   - ✅ Presence Intent
   - ✅ Server Members Intent
   - ✅ Message Content Intent

### 2. BotをサーバーへINVITE

1. 左メニュー「OAuth2」→「URL Generator」
2. Scopes: `bot` + `applications.commands` にチェック
3. Bot Permissions: 以下だけチェック
   - ✅ Send Messages
   - ✅ Use Slash Commands
   - ✅ Read Message History
   - ✅ Embed Links
4. 生成されたURLでBotをサーバーに招待

### 3. 環境変数を設定

```bash
cp .env.example .env
```

`.env` を編集：

```
DISCORD_TOKEN=（ステップ1でコピーしたToken）
CLIENT_ID=（Developer Portal > General Information > Application ID）
GUILD_ID=（テスト用サーバーのID。右クリック→「サーバーIDをコピー」）
```

### 4. 依存関係インストール

```bash
npm install
```

### 5. スラッシュコマンドを登録

```bash
npm run deploy
```

### 6. Botを起動

```bash
npm start
```

---

## 🎮 コマンド一覧

| コマンド | 説明 |
|---|---|
| `/rpg start` | キャラクター作成（職業選択） |
| `/rpg status` | 自分のステータス表示 |
| `/rpg explore` | 現在のエリアを探索（30秒クールダウン） |
| `/rpg inventory` | 所持品確認 |
| `/rpg ranking` | サーバー内ランキング |

---

## 📁 ディレクトリ構成

```
discord-rpg-bot/
├── index.js                  # メインエントリポイント
├── .env.example              # 環境変数テンプレート
├── src/
│   ├── commands/
│   │   └── rpg.js            # コマンド定義・Embed生成
│   ├── game/
│   │   ├── battle.js         # ターン制戦闘ロジック
│   │   └── explore.js        # 探索・ランダムイベント
│   ├── data/
│   │   └── master.js         # マスターデータ（敵・アイテム等）
│   ├── database/
│   │   └── db.js             # データベース層（sql.js）
│   └── deploy-commands.js    # コマンド登録スクリプト
└── data/
    └── game.db               # SQLiteデータファイル（自動生成）
```

---

## 🛡️ 安全設計

- Botに付与する権限は**最小限**（管理系権限なし）
- コマンドに**5秒クールダウン**（スパム防止）
- 探索コマンドに**30秒クールダウン**
- 管理系API（チャンネル削除・ロール操作等）は**一切使用しない**

---

## 🔧 今後の拡張予定（Phase 2以降）

- [ ] ショップ機能（`/rpg shop`）
- [ ] クエストシステム（`/rpg quest`）
- [ ] パーティ機能（`/rpg party`）
- [ ] エリア移動（`/rpg move`）
- [ ] MongoDB対応（`src/database/db.js`を差し替えるだけ）
