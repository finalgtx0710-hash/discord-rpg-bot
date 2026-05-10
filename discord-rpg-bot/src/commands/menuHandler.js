import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getPlayer } from "../game/save.js";
import { buildStatusText } from "../game/player.js";

/**
 * メインメニューを表示する（reply または update）
 */
export async function showMainMenu(interaction, headerMsg = null) {
  const player = getPlayer(interaction.user.id);
  if (!player) {
    await safeReply(interaction, {
      content: "❌ キャラクターが見つかりません。`/start` から始めてください。",
      components: [],
      ephemeral: true,
    });
    return;
  }

  const content = [
    headerMsg ? `> ${headerMsg}` : null,
    "",
    "```",
    "╔══════════════════════════════╗",
    "║    ✦ ETHERION CHRONICLE ✦    ║",
    "╚══════════════════════════════╝",
    "```",
    buildStatusText(player),
    "",
    "▼ 何をしますか？",
  ].filter((l) => l !== null).join("\n");

  await safeReply(interaction, {
    content,
    components: buildMenuButtons(),
  });
}

/**
 * メインメニューボタンのハンドラ
 */
export async function handleMenu(interaction) {
  const customId = interaction.customId;

  if (customId === "back_to_menu" || customId === "menu_main") {
    await showMainMenu(interaction);
    return;
  }

  if (customId === "menu_status") {
    await handleStatus(interaction);
    return;
  }

  // 未実装メニュー
  const labels = {
    menu_inventory: "📦 インベントリ",
    menu_shop:      "🏪 ショップ",
    menu_party:     "👥 パーティ編成",
    menu_map:       "🗺️ マップ表示",
  };
  const label = labels[customId] ?? customId;

  await safeReply(interaction, {
    content: [
      `> **${label}**`,
      "",
      "🔧 この機能は現在準備中です。",
      "近日公開予定をお待ちください！",
    ].join("\n"),
    components: [backToMenuRow()],
  });
}

async function handleStatus(interaction) {
  const player = getPlayer(interaction.user.id);
  if (!player) {
    await safeReply(interaction, {
      content: "❌ データが見つかりません。",
      components: [backToMenuRow()],
    });
    return;
  }

  const content = [
    "```",
    "═══ ステータス ═══",
    "```",
    buildStatusText(player),
    "",
    `🗡️ 装備中:`,
    `　Weapon   : ${player.equipment.weapon ?? "（なし）"}`,
    `　Armor    : ${player.equipment.armor ?? "（なし）"}`,
    `　Accessory: ${player.equipment.accessory ?? "（なし）"}`,
  ].join("\n");

  await safeReply(interaction, {
    content,
    components: [backToMenuRow()],
  });
}

// ─── UI ヘルパー ────────────────────────────────────────────

function buildMenuButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    btn("menu_status",    "📊 ステータス",   ButtonStyle.Primary),
    btn("explore_menu",   "🧭 探索を開始",   ButtonStyle.Success),
  );
  const row2 = new ActionRowBuilder().addComponents(
    btn("menu_inventory", "📦 インベントリ", ButtonStyle.Secondary),
    btn("menu_shop",      "🏪 ショップ",     ButtonStyle.Secondary),
  );
  const row3 = new ActionRowBuilder().addComponents(
    btn("menu_party",     "👥 パーティ編成", ButtonStyle.Secondary),
    btn("menu_map",       "🗺️ マップ表示",   ButtonStyle.Secondary),
  );
  return [row1, row2, row3];
}

function backToMenuRow() {
  return new ActionRowBuilder().addComponents(
    btn("back_to_menu", "🏠 メインメニューへ戻る", ButtonStyle.Primary),
  );
}

function btn(customId, label, style) {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
}

/**
 * 返信済み/未返信を判別して適切なメソッドで送信
 * これが「interaction already replied」を防ぐ核心
 */
export async function safeReply(interaction, options) {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(options);
    } else {
      await interaction.update(options);
    }
  } catch {
    // update が使えない（スラッシュコマンド等）場合は reply にフォールバック
    try {
      if (interaction.replied) {
        await interaction.editReply(options);
      } else {
        await interaction.reply(options);
      }
    } catch (err) {
      console.error("safeReply 失敗:", err.message);
    }
  }
}
