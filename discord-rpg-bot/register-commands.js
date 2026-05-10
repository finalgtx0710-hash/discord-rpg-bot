import { REST, Routes } from "discord.js";
import * as dotenv from "dotenv";
dotenv.config();

const commands = [
  {
    name: "start",
    description: "Etherion Chronicleを開始します",
  },
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("スラッシュコマンドを登録中...");

    const token = process.env.DISCORD_TOKEN;
    const appId = process.env.APPLICATION_ID;
    const guildId = process.env.GUILD_ID;

    if (!token || !appId) {
      console.error(
        "❌ エラー: .envファイルにDISCORD_TOKENとAPPLICATION_IDを設定してください"
      );
      process.exit(1);
    }

    if (guildId) {
      // ギルドコマンド（即時反映）
      await rest.put(Routes.applicationGuildCommands(appId, guildId), {
        body: commands,
      });
      console.log(`✅ ギルドコマンドを登録しました (Guild: ${guildId})`);
    } else {
      // グローバルコマンド（反映に最大1時間かかる）
      await rest.put(Routes.applicationCommands(appId), { body: commands });
      console.log("✅ グローバルコマンドを登録しました（反映まで最大1時間）");
    }
  } catch (error) {
    console.error("❌ コマンド登録エラー:", error);
    if (error.code === 50001) {
      console.error("→ BOTがサーバーに参加しているか確認してください");
    }
    if (error.status === 401) {
      console.error("→ DISCORD_TOKENが間違っています");
    }
  }
})();
