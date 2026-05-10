import {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
} from "discord.js";
import * as dotenv from "dotenv";
import { handleStart } from "./src/commands/startHandler.js";
import { handleMenu } from "./src/commands/menuHandler.js";
import { handleExplore } from "./src/commands/exploreHandler.js";
import { handleBattle } from "./src/commands/battleHandler.js";
import { ensurePlayersFile } from "./src/game/save.js";

dotenv.config();

// 起動前にplayers.jsonの存在確認・初期化
ensurePlayersFile();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ ${c.user.tag} としてログインしました！`);
  console.log(`📡 ${c.guilds.cache.size} サーバーに接続中`);
});

// スラッシュコマンドのハンドリング
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // /start コマンド
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "start") {
        await handleStart(interaction);
      }
      return;
    }

    // ボタンのハンドリング
    if (interaction.isButton()) {
      const customId = interaction.customId;

      // メニュー系ボタン
      if (customId.startsWith("menu_") || customId === "back_to_menu") {
        await handleMenu(interaction);
        return;
      }

      // クラス選択ボタン
      if (customId.startsWith("class_")) {
        await handleStart(interaction);
        return;
      }

      // 探索系ボタン
      if (customId.startsWith("explore_")) {
        await handleExplore(interaction);
        return;
      }

      // 戦闘系ボタン
      if (customId.startsWith("battle_")) {
        await handleBattle(interaction);
        return;
      }

      // 未対応ボタン
      await interaction.reply({
        content: "⚠️ このボタンは現在対応していません。",
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error("❌ インタラクションエラー:", error);

    // 既に返信済みの場合はfollowUpを使う
    try {
      const errMsg = {
        content: "⚠️ エラーが発生しました。もう一度お試しください。",
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errMsg);
      } else {
        await interaction.reply(errMsg);
      }
    } catch (e) {
      console.error("エラーメッセージ送信失敗:", e);
    }
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error(
    "❌ DISCORD_TOKENが設定されていません。.envファイルを確認してください。"
  );
  process.exit(1);
}

client.login(token).catch((err) => {
  console.error("❌ ログイン失敗:", err.message);
  if (err.message.includes("TOKEN_INVALID")) {
    console.error("→ DISCORD_TOKENが間違っています。Developer Portalで確認してください。");
  }
});
