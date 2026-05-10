import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getPlayer, createPlayer } from "../game/save.js";
import { CLASSES } from "../game/classes.js";
import { showMainMenu } from "./menuHandler.js";

/**
 * /start コマンドおよびクラス選択ボタンのハンドラ
 */
export async function handleStart(interaction) {
  const userId = interaction.user.id;
  const username = interaction.user.username;

  // クラス選択ボタンが押された場合
  if (interaction.isButton() && interaction.customId.startsWith("class_")) {
    const className = interaction.customId.replace("class_", "");
    if (!CLASSES[className]) {
      await interaction.reply({ content: "❌ 不正なクラスです。", ephemeral: true });
      return;
    }

    // 既に登録済みの場合はスキップ
    if (getPlayer(userId)) {
      await showMainMenu(interaction, "既に冒険者として登録されています！");
      return;
    }

    const player = createPlayer(userId, username, className, CLASSES[className]);
    const cls = CLASSES[className];

    await showMainMenu(
      interaction,
      `🎉 クロニクラー登録完了！\n**${player.name}** — ${cls.emoji} **${className}** として旅が始まった！`,
    );
    return;
  }

  // /start コマンド
  const existingPlayer = getPlayer(userId);
  if (existingPlayer) {
    await showMainMenu(interaction, `おかえり、**${existingPlayer.name}**！`);
    return;
  }

  // 新規 → クラス選択画面
  await interaction.reply({
    content: buildWelcomeText(),
    components: buildClassButtons(),
    ephemeral: false,
  });
}

function buildWelcomeText() {
  const lines = [
    "```",
    "╔══════════════════════════════╗",
    "║    ✦ ETHERION CHRONICLE ✦    ║",
    "║   Discord Persistent MMORPG  ║",
    "╚══════════════════════════════╝",
    "```",
    "**世界はエーテルの乱れとともに揺れている。**",
    "汝はクロニクラーとして、失われた文明の謎へと挑む。",
    "",
    "▼ クラスを選択してください",
    "",
    ...Object.values(CLASSES).map(
      (c) => `${c.emoji} **${c.name}** — ${c.description}`
    ),
  ];
  return lines.join("\n");
}

function buildClassButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    btn("class_Warrior", "⚔️ Warrior", ButtonStyle.Danger),
    btn("class_Mage", "🔮 Mage", ButtonStyle.Primary),
    btn("class_Cleric", "✨ Cleric", ButtonStyle.Success),
  );
  const row2 = new ActionRowBuilder().addComponents(
    btn("class_Rogue", "🗡️ Rogue", ButtonStyle.Secondary),
    btn("class_Archer", "🏹 Archer", ButtonStyle.Secondary),
  );
  return [row1, row2];
}

function btn(customId, label, style) {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
}
