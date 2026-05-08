// src/commands/moveHandler.js
// エリア移動ハンドラ

import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} from 'discord.js';
import { getPlayer, updatePlayer } from '../database/db.js';
import { AREAS } from '../data/master.js';

// エリア移動に必要な最低レベル
const AREA_LEVEL_REQ = {
  starting_village:   1,
  forest_of_whispers: 5,
  ancient_ruins:      12,
};

// エリア情報Embed
function buildAreaEmbed(player) {
  const area = AREAS[player.current_area];
  const nextAreas = area.next_areas || [];
  const prevAreas = Object.entries(AREAS)
    .filter(([, a]) => a.next_areas?.includes(player.current_area))
    .map(([key]) => key);

  const allConnected = [...new Set([...prevAreas, ...nextAreas])];

  const connectedLines = allConnected.map(key => {
    const a = AREAS[key];
    const req = AREA_LEVEL_REQ[key] || 1;
    const canMove = player.level >= req;
    const dir = nextAreas.includes(key) ? '→ 先へ' : '← 戻る';
    return `${canMove ? '✅' : `🔒 Lv.${req}~`} **${a.name}** （${dir}）\n　*${a.description}*`;
  }).join('\n\n');

  return new EmbedBuilder()
    .setColor(0x375623)
    .setTitle(`🗺️ 現在地：${area.name}`)
    .setDescription(area.description)
    .addFields(
      { name: '推奨レベル', value: `Lv.${AREA_LEVEL_REQ[player.current_area] || 1} ～`, inline: true },
      { name: '出現する敵',  value: area.enemies.map(e => e).join('、') || 'なし', inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: '移動できる場所', value: connectedLines || '（なし）' },
    )
    .setFooter({ text: `Etherion Chronicle | 現在Lv.${player.level}` });
}

// /rpg map コマンド
export async function handleMapCommand(interaction) {
  const userId = interaction.user.id;
  const player = getPlayer(userId);

  if (!player) {
    return interaction.reply({ content: '⚠️ まずは `/rpg start` でキャラクターを作成してください！', ephemeral: true });
  }

  const area = AREAS[player.current_area];
  const nextAreas = area.next_areas || [];
  const prevAreas = Object.entries(AREAS)
    .filter(([, a]) => a.next_areas?.includes(player.current_area))
    .map(([key]) => key);

  const allConnected = [...new Set([...prevAreas, ...nextAreas])];

  // 移動ボタンを生成
  const buttons = allConnected.map(key => {
    const a = AREAS[key];
    const req = AREA_LEVEL_REQ[key] || 1;
    const canMove = player.level >= req;
    const isForward = nextAreas.includes(key);
    return new ButtonBuilder()
      .setCustomId(`move_area:${key}`)
      .setLabel(`${isForward ? '→' : '←'} ${a.name}${canMove ? '' : ` (Lv.${req}~)`}`)
      .setStyle(isForward ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(!canMove);
  });

  const components = buttons.length > 0
    ? [new ActionRowBuilder().addComponents(...buttons.slice(0, 5))]
    : [];

  await interaction.reply({
    embeds: [buildAreaEmbed(player)],
    components,
  });
}

// ボタン: エリア移動
export async function handleMoveButton(interaction) {
  const userId = interaction.user.id;
  const targetArea = interaction.customId.replace('move_area:', '');
  const player = getPlayer(userId);

  if (!player) return interaction.reply({ content: '⚠️ キャラクターが見つかりません。', ephemeral: true });

  const area = AREAS[targetArea];
  if (!area) return interaction.reply({ content: '⚠️ 存在しないエリアです。', ephemeral: true });

  // レベルチェック
  const req = AREA_LEVEL_REQ[targetArea] || 1;
  if (player.level < req) {
    return interaction.reply({
      content: `🔒 **${area.name}**に入るには Lv.**${req}** 以上が必要です。（現在 Lv.${player.level}）`,
      ephemeral: true
    });
  }

  // 隣接チェック
  const currentArea = AREAS[player.current_area];
  const isNext = currentArea.next_areas?.includes(targetArea);
  const isPrev = Object.entries(AREAS)
    .filter(([, a]) => a.next_areas?.includes(player.current_area))
    .some(([key]) => key === targetArea);

  if (!isNext && !isPrev) {
    return interaction.reply({ content: '⚠️ そのエリアには直接移動できません。', ephemeral: true });
  }

  // 移動実行
  updatePlayer(userId, { current_area: targetArea });
  const updatedPlayer = getPlayer(userId);

  const newArea = AREAS[targetArea];
  const nextAreas2 = newArea.next_areas || [];
  const prevAreas2 = Object.entries(AREAS)
    .filter(([, a]) => a.next_areas?.includes(targetArea))
    .map(([key]) => key);
  const allConnected2 = [...new Set([...prevAreas2, ...nextAreas2])];

  const buttons2 = allConnected2.map(key => {
    const a = AREAS[key];
    const req2 = AREA_LEVEL_REQ[key] || 1;
    const canMove = updatedPlayer.level >= req2;
    const isForward = nextAreas2.includes(key);
    return new ButtonBuilder()
      .setCustomId(`move_area:${key}`)
      .setLabel(`${isForward ? '→' : '←'} ${a.name}${canMove ? '' : ` (Lv.${req2}~)`}`)
      .setStyle(isForward ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(!canMove);
  });

  const components2 = buttons2.length > 0
    ? [new ActionRowBuilder().addComponents(...buttons2.slice(0, 5))]
    : [];

  const embed = buildAreaEmbed(updatedPlayer);
  embed.setTitle(`✅ ${newArea.name} に移動しました！`);
  embed.setDescription(
    `${newArea.description}\n\n` +
    `ここでは **\`/rpg explore\`** で探索できます。`
  );

  await interaction.update({ embeds: [embed], components: components2 });
}
