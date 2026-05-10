import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getPlayer, savePlayer } from "../game/save.js";
import {
  getBattle,
  endBattle,
  buildBattleText,
  doAttack,
  doDefend,
  doFlee,
} from "../game/battle.js";
import { addExp, addGold } from "../game/player.js";
import { safeReply, showMainMenu } from "./menuHandler.js";

/**
 * 戦闘ボタンのハンドラ
 */
export async function handleBattle(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  const player = getPlayer(userId);
  if (!player) {
    await safeReply(interaction, {
      content: "❌ キャラクターが見つかりません。",
      components: [],
    });
    return;
  }

  const battle = getBattle(userId);
  if (!battle) {
    // 戦闘状態が消えている（再起動後など）
    await showMainMenu(interaction, "⚠️ 戦闘状態が見つかりません。メニューへ戻りました。");
    return;
  }

  let result;

  switch (customId) {
    case "battle_attack":
      result = doAttack(player, battle);
      break;
    case "battle_defend":
      result = doDefend(player, battle);
      break;
    case "battle_flee":
      result = doFlee(player, battle);
      break;
    case "battle_skill":
    case "battle_item":
      await safeReply(interaction, {
        content: [
          buildBattleText(player, battle),
          "",
          "🔧 このコマンドは現在準備中です。",
        ].join("\n"),
        components: buildBattleButtons(),
      });
      return;
    default:
      await safeReply(interaction, {
        content: "❌ 不明な戦闘コマンドです。",
        components: buildBattleButtons(),
      });
      return;
  }

  // ─── 逃走成功 ───────────────────────────────
  if (customId === "battle_flee" && result.fled) {
    endBattle(userId);
    savePlayer(player);
    await showMainMenu(interaction, result.logs.join("\n"));
    return;
  }

  // ─── 逃走失敗かつ敗北 / 攻撃・防御で敗北 ──────
  if (result.defeat) {
    endBattle(userId);
    player.hp = Math.max(1, Math.floor(player.maxHp * 0.5)); // 半回復
    savePlayer(player);

    await showMainMenu(
      interaction,
      [
        ...result.logs,
        "",
        `💔 **敗北…** HPが半分回復した状態でメインメニューへ戻ります。`,
        `❤️ HP: ${player.hp}/${player.maxHp}`,
      ].join("\n"),
    );
    return;
  }

  // ─── 勝利 ─────────────────────────────────
  if (result.victory) {
    const { enemy } = battle;
    endBattle(userId);

    const { leveledUp, newLevel } = addExp(player, enemy.exp);
    addGold(player, enemy.gold);
    savePlayer(player);

    const lines = [
      ...result.logs,
      "",
      `🏆 **勝利！**`,
      `✨ EXP +**${enemy.exp}**　💰 Gold +**${enemy.gold}G**`,
    ];
    if (leveledUp) {
      lines.push(``, `🎊 **レベルアップ！ Lv.${newLevel} になった！**`);
    }

    await showMainMenu(interaction, lines.join("\n"));
    return;
  }

  // ─── 継続 ─────────────────────────────────
  savePlayer(player);
  await safeReply(interaction, {
    content: buildBattleText(player, battle),
    components: buildBattleButtons(),
  });
}

// ─── UI ────────────────────────────────────────────────────

export function buildBattleButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    btn("battle_attack", "⚔️ 攻撃",  ButtonStyle.Danger),
    btn("battle_defend", "🛡️ 防御",  ButtonStyle.Primary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    btn("battle_skill",  "✨ スキル", ButtonStyle.Success),
    btn("battle_item",   "🎒 アイテム",ButtonStyle.Secondary),
  );
  const row3 = new ActionRowBuilder().addComponents(
    btn("battle_flee",   "💨 逃げる", ButtonStyle.Secondary),
  );
  return [row1, row2, row3];
}

function btn(customId, label, style) {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
}
