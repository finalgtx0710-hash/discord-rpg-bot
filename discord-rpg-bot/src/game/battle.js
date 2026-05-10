/**
 * ダメージ計算（最低1ダメージ保証）
 */
export function calcDamage(atk, def) {
  const base = Math.max(1, atk - Math.floor(def * 0.6));
  const variance = Math.floor(base * 0.2);
  return base + Math.floor(Math.random() * (variance + 1));
}

/**
 * 戦闘状態をメモリ上で管理するMap（userId → battleState）
 * 再起動すると消えるが、戦闘中の再起動は基本想定しない
 */
export const activeBattles = new Map();

/**
 * 新しい戦闘を開始する
 */
export function startBattle(userId, player, enemy) {
  const state = {
    enemy: { ...enemy },        // 深いコピー
    playerHpSnapshot: player.hp,
    playerMpSnapshot: player.mp,
    log: [`${enemy.emoji} **${enemy.name}** が現れた！`],
    turn: 1,
    defended: false,
  };
  activeBattles.set(userId, state);
  return state;
}

/**
 * 現在の戦闘状態を取得
 */
export function getBattle(userId) {
  return activeBattles.get(userId) ?? null;
}

/**
 * 戦闘を終了して状態をクリア
 */
export function endBattle(userId) {
  activeBattles.delete(userId);
}

/**
 * 「攻撃」行動の処理
 * @returns {{ log: string[], victory: boolean, defeat: boolean }}
 */
export function doAttack(player, battle) {
  const logs = [];
  battle.defended = false;

  // プレイヤー攻撃
  const playerDmg = calcDamage(player.atk, battle.enemy.def);
  battle.enemy.hp = Math.max(0, battle.enemy.hp - playerDmg);
  logs.push(`⚔️ ${player.name} の攻撃！ → **${battle.enemy.name}** に **${playerDmg}** ダメージ！`);

  if (battle.enemy.hp <= 0) {
    logs.push(`✨ **${battle.enemy.name}** を倒した！`);
    return { logs, victory: true, defeat: false };
  }

  // 敵の反撃
  const enemyDmg = calcDamage(battle.enemy.atk, player.def);
  player.hp = Math.max(0, player.hp - enemyDmg);
  logs.push(`💥 ${battle.enemy.emoji} **${battle.enemy.name}** の反撃！ → **${enemyDmg}** ダメージ！`);

  battle.turn++;
  battle.log.push(...logs);

  if (player.hp <= 0) {
    logs.push(`💀 **${player.name}** は倒れた…`);
    return { logs, victory: false, defeat: true };
  }

  return { logs, victory: false, defeat: false };
}

/**
 * 「防御」行動の処理
 */
export function doDefend(player, battle) {
  const logs = [];
  battle.defended = true;

  logs.push(`🛡️ ${player.name} は防御態勢をとった！`);

  // 敵の攻撃（防御中はダメージ半減）
  const rawDmg = calcDamage(battle.enemy.atk, player.def);
  const actualDmg = Math.max(1, Math.floor(rawDmg * 0.5));
  player.hp = Math.max(0, player.hp - actualDmg);
  logs.push(`💥 ${battle.enemy.emoji} **${battle.enemy.name}** の攻撃 → ガード！ **${actualDmg}** ダメージ（半減）`);

  battle.turn++;
  battle.log.push(...logs);

  if (player.hp <= 0) {
    return { logs, victory: false, defeat: true };
  }
  return { logs, victory: false, defeat: false };
}

/**
 * 「逃げる」行動の処理（60%成功）
 */
export function doFlee(player, battle) {
  const success = Math.random() < 0.6;
  if (success) {
    return { fled: true, logs: ["💨 うまく逃げ切った！"] };
  }
  // 失敗時は敵の攻撃を受ける
  const dmg = calcDamage(battle.enemy.atk, player.def);
  player.hp = Math.max(0, player.hp - dmg);
  const logs = [
    `❌ 逃げ失敗！ ${battle.enemy.emoji} **${battle.enemy.name}** に **${dmg}** ダメージを受けた！`,
  ];
  battle.turn++;
  battle.log.push(...logs);

  if (player.hp <= 0) {
    return { fled: false, defeat: true, logs };
  }
  return { fled: false, defeat: false, logs };
}

/**
 * 戦闘UIの本文テキストを生成
 */
export function buildBattleText(player, battle) {
  const { enemy } = battle;
  const playerHpBar = buildBar(player.hp, player.maxHp);
  const enemyHpBar = buildBar(enemy.hp, enemy.maxHp);
  const recentLogs = battle.log.slice(-3).join("\n");

  return [
    `⚔️ **戦闘中！** — ターン ${battle.turn}`,
    ``,
    `${enemy.emoji} **${enemy.name}**`,
    `HP ${enemyHpBar} ${enemy.hp}/${enemy.maxHp}`,
    ``,
    `👤 **${player.name}** Lv.${player.level}`,
    `HP ${playerHpBar} ${player.hp}/${player.maxHp}`,
    `MP ${"▓".repeat(Math.round(player.mp / player.maxMp * 8))}${"░".repeat(8 - Math.round(player.mp / player.maxMp * 8))} ${player.mp}/${player.maxMp}`,
    ``,
    `📜 ログ：`,
    recentLogs || "戦闘開始！",
  ].join("\n");
}

function buildBar(cur, max, len = 10) {
  const f = Math.max(0, Math.round((cur / max) * len));
  return `[${"█".repeat(f)}${"░".repeat(len - f)}]`;
}
