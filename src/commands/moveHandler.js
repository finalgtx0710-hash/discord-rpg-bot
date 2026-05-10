import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getPlayer, updatePlayer } from '../database/db.js';
import { AREAS } from '../data/master.js';

const AREA_LEVEL_REQ = {
  starting_village:   1,
  forest_of_whispers: 5,
  ancient_ruins:      12,
  crystal_cavern:     18,
  ether_sanctuary:    25,
};

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
    return `${canMove ? 'OK' : 'Lv.' + req + '~'} **${a.name}** (${dir})\n  ${a.description}`;
  }).join('\n\n');
  return new EmbedBuilder()
    .setColor(0x375623)
    .setTitle(`現在地：${area.name}`)
    .setDescription(area.description)
    .addFields(
      { name: '推奨レベル', value: `Lv.${AREA_LEVEL_REQ[player.current_area] || 1}～`, inline: true },
      { name: '移動できる場所', value: connectedLines || 'なし' },
    )
    .setFooter({ text: `Etherion Chronicle | 現在Lv.${player.level}` });
}

function buildMapComponents(player) {
  const area = AREAS[player.current_area];
  const nextAreas = area.next_areas || [];
  const prevAreas = Object.entries(AREAS)
    .filter(([, a]) => a.next_areas?.includes(player.current_area))
    .map(([key]) => key);
  const allConnected = [...new Set([...prevAreas, ...nextAreas])];

  const buttons = allConnected.map(key => {
    const a = AREAS[key];
    const req = AREA_LEVEL_REQ[key] || 1;
    const canMove = player.level >= req;
    const isForward = nextAreas.includes(key);
    return new ButtonBuilder()
      .setCustomId(`move_area:${key}`)
      .setLabel(`${isForward ? '→' : '←'} ${a.name}${canMove ? '' : ' (Lv.' + req + '~)'}`)
      .setStyle(isForward ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(!canMove);
  });

  const rows = buttons.length > 0
    ? [new ActionRowBuilder().addComponents(...buttons.slice(0, 5))]
    : [];

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('back_main')
      .setLabel('← メインメニューへ')
      .setStyle(ButtonStyle.Secondary)
  ));

  return rows;
}

export async function handleMapCommand(interaction) {
  const userId = interaction.user.id;
  const player = getPlayer(userId);
  if (!player) return interaction.reply({ content: 'まずは /rpg start でキャラクターを作成してください！', ephemeral: true });

  await interaction.reply({ embeds: [buildAreaEmbed(player)], components: buildMapComponents(player) });
}

export async function handleMoveButton(interaction) {
  const userId = interaction.user.id;
  const targetArea = interaction.customId.replace('move_area:', '');
  const player = getPlayer(userId);
  if (!player) return interaction.reply({ content: 'キャラクターが見つかりません。', ephemeral: true });

  const area = AREAS[targetArea];
  if (!area) return interaction.reply({ content: '存在しないエリアです。', ephemeral: true });

  const req = AREA_LEVEL_REQ[targetArea] || 1;
  if (player.level < req) {
    return interaction.reply({ content: `${area.name}に入るにはLv.${req}以上が必要です。（現在Lv.${player.level}）`, ephemeral: true });
  }

  const currentArea = AREAS[player.current_area];
  const isNext = currentArea.next_areas?.includes(targetArea);
  const isPrev = Object.entries(AREAS).filter(([, a]) => a.next_areas?.includes(player.current_area)).some(([key]) => key === targetArea);
  if (!isNext && !isPrev) return interaction.reply({ content: 'そのエリアには直接移動できません。', ephemeral: true });

  updatePlayer(userId, { current_area: targetArea });
  const updatedPlayer = getPlayer(userId);
  const newArea = AREAS[targetArea];
  const embed = buildAreaEmbed(updatedPlayer);
  embed.setTitle(`${newArea.name} に移動しました！`);
  await interaction.update({ embeds: [embed], components: buildMapComponents(updatedPlayer) });
}
