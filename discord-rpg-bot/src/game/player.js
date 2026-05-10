import { savePlayer } from "./save.js";

/**
 * HPバーをテキストで表示
 */
export function hpBar(current, max, length = 10) {
  const filled = Math.max(0, Math.round((current / max) * length));
  const empty = length - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}

/**
 * MPバーをテキストで表示
 */
export function mpBar(current, max, length = 10) {
  const filled = Math.max(0, Math.round((current / max) * length));
  const empty = length - filled;
  return `[${"▓".repeat(filled)}${"░".repeat(empty)}]`;
}

/**
 * EXPを加算してレベルアップ処理を行う
 * @returns {{ leveledUp: boolean, oldLevel: number, newLevel: number }}
 */
export function addExp(player, exp) {
  player.exp += exp;
  const oldLevel = player.level;

  while (player.exp >= player.expToNext) {
    player.exp -= player.expToNext;
    player.level += 1;
    player.expToNext = Math.floor(30 * Math.pow(1.4, player.level - 1));

    // レベルアップ時のステータス上昇
    player.maxHp += 8;
    player.maxMp += 5;
    player.atk += 2;
    player.def += 1;
    player.spd += 1;

    // HPを全回復
    player.hp = player.maxHp;
    player.mp = player.maxMp;
  }

  savePlayer(player);

  return {
    leveledUp: player.level > oldLevel,
    oldLevel,
    newLevel: player.level,
  };
}

/**
 * ゴールドを加算して保存
 */
export function addGold(player, amount) {
  player.gold += amount;
  savePlayer(player);
}

/**
 * プレイヤーステータスのEmbed文字列を生成
 */
export function buildStatusText(player) {
  const hpB = hpBar(player.hp, player.maxHp);
  const mpB = mpBar(player.mp, player.maxMp);
  const expB = hpBar(player.exp, player.expToNext);

  return [
    `**✦ ${player.name}** — Lv.${player.level} ${player.className}`,
    `\`\`\``,
    `HP  ${hpB} ${player.hp}/${player.maxHp}`,
    `MP  ${mpB} ${player.mp}/${player.maxMp}`,
    `EXP ${expB} ${player.exp}/${player.expToNext}`,
    `\`\`\``,
    `⚔️ ATK: **${player.atk}**　🛡️ DEF: **${player.def}**　💨 SPD: **${player.spd}**`,
    `💰 Gold: **${player.gold}G**　📍 場所: **${player.location}**`,
  ].join("\n");
}
