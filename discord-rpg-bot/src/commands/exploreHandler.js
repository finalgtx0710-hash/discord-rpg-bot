import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getPlayer, savePlayer } from "../game/save.js";
import { runExplore } from "../game/explore.js";
import { startBattle, buildBattleText } from "../game/battle.js";
import { safeReply } from "./menuHandler.js";
import { buildBattleButtons } from "./battleHandler.js";

/**
 * 探索関連ボタンのハンドラ
 */
export async function handleExplore(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  const player = getPlayer(userId);
  if (!player) {
    await safeReply(interaction, {
      content: "❌ キャラクターが見つかりません。`/start` から始めてください。",
      components: [],
    });
    return;
  }

  // 探索メニューを表示
  if (customId === "explore_menu") {
    await safeReply(interaction, {
      content: buildExploreText(player),
      components: buildExploreButtons(),
    });
    return;
  }

  // 方向選択
  const dirMap = {
    explore_north: "north",
    explore_south: "south",
    explore_east:  "east",
    explore_west:  "west",
  };

  const direction = dirMap[customId];
  if (!direction) {
    await safeReply(interaction, {
      content: "❌ 不明な探索コマンドです。",
      components: [backRow()],
    });
    return;
  }

  // 探索実行
  const result = runExplore(player, direction);
  savePlayer(player);

  if (result.eventType === "enemy") {
    // 戦闘開始
    const battle = startBattle(userId, player, result.enemy);
    const battleText = [
      `📍 **${player.location}**`,
      "",
      result.message,
      "",
      buildBattleText(player, battle),
    ].join("\n");

    await safeReply(interaction, {
      content: battleText,
      components: buildBattleButtons(),
    });
    return;
  }

  // 戦闘以外のイベント
  await safeReply(interaction, {
    content: [
      `📍 **${player.location}**`,
      "",
      result.message,
      "",
      `💰 所持金: **${player.gold}G** | ❤️ HP: **${player.hp}/${player.maxHp}**`,
    ].join("\n"),
    components: buildExploreButtons(),
  });
}

// ─── UI ────────────────────────────────────────────────────

function buildExploreText(player) {
  return [
    "```",
    "═══ 探索モード ═══",
    "```",
    `📍 現在地: **${player.location}**`,
    `❤️ HP: ${player.hp}/${player.maxHp}　💰 Gold: ${player.gold}G`,
    "",
    "どの方向へ進みますか？",
  ].join("\n");
}

function buildExploreButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    btn("explore_north", "⬆️ 北へ進む", ButtonStyle.Primary),
    btn("explore_south", "⬇️ 南へ進む", ButtonStyle.Primary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    btn("explore_east", "➡️ 東へ進む", ButtonStyle.Primary),
    btn("explore_west", "⬅️ 西へ進む", ButtonStyle.Primary),
  );
  const row3 = new ActionRowBuilder().addComponents(
    btn("back_to_menu", "🏠 メインメニューへ戻る", ButtonStyle.Secondary),
  );
  return [row1, row2, row3];
}

function backRow() {
  return new ActionRowBuilder().addComponents(
    btn("back_to_menu", "🏠 メインメニューへ戻る", ButtonStyle.Secondary),
  );
}

function btn(customId, label, style) {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
}
