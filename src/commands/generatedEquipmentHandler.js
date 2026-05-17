import { EmbedBuilder } from 'discord.js';
import { getPlayer, updatePlayer, dbDeleteEquipment, dbEquipGeneratedItem, dbGetEquipmentById, dbGetEquipmentByOwner, dbUnequipGeneratedSlot } from '../database/db.js';
import { calculateDismantleValue, formatEquipmentName, RARITY_COLORS } from '../game/loot.js';

function optionLine(option) {
  return `${option.label || option.type} +${option.value}${option.suffix || ''}`;
}

export function buildEquipmentDropEmbed(item) {
  return new EmbedBuilder()
    .setColor(RARITY_COLORS[item.rarity] || RARITY_COLORS.Common)
    .setTitle(`⚔ ${formatEquipmentName(item)}`)
    .setDescription(`ID: \`${item.id}\``)
    .addFields(
      { name: 'スロット', value: item.slot || 'なし', inline: true },
      { name: '基礎ATK', value: `+${item.base_atk || 0}`, inline: true },
      { name: 'オプション', value: (item.options || []).map(optionLine).join('\n') || 'なし' },
    )
    .setFooter({ text: '装備するには /rpg equip item_id を使用' });
}

export async function handleGeneratedInventoryCommand(interaction) {
  const userId = interaction.user.id;
  const player = getPlayer(userId);
  if (!player) return interaction.reply({ content: 'まず `/rpg start` でキャラクターを作成してください。', ephemeral: true });

  const items = dbGetEquipmentByOwner(userId);
  const lines = items.slice(0, 15).map((item) => {
    const equipped = item.equipped ? '装備中' : '未装備';
    return `\`${item.id.slice(0, 8)}\` ${equipped} ${formatEquipmentName(item)}\n${(item.options || []).map(optionLine).join(' / ')}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`${player.name} の装備インベントリ`)
    .setDescription(lines.length ? lines.join('\n\n') : 'ランダム装備はまだありません。宝箱や戦闘勝利で入手できます。')
    .setFooter({ text: '装備: /rpg equip item_id | 分解: /rpg dismantle item_id' });

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

export async function handleGeneratedEquipCommand(interaction, itemId) {
  const userId = interaction.user.id;
  const item = dbGetEquipmentById(itemId);
  if (!item || item.owner_id !== userId) {
    return interaction.reply({ content: 'その装備IDは見つかりません。', ephemeral: true });
  }

  const equipped = dbEquipGeneratedItem(userId, itemId);
  return interaction.reply({ embeds: [buildEquipmentDropEmbed(equipped).setTitle(`✅ 装備しました: ${formatEquipmentName(equipped)}`)], ephemeral: true });
}

export async function handleGeneratedUnequipCommand(interaction, slot) {
  const userId = interaction.user.id;
  if (!['weapon', 'armor', 'accessory'].includes(slot)) {
    return interaction.reply({ content: 'slot は weapon / armor / accessory から選んでください。', ephemeral: true });
  }
  dbUnequipGeneratedSlot(userId, slot);
  return interaction.reply({ content: `${slot} のランダム装備を外しました。`, ephemeral: true });
}

export async function handleGeneratedDismantleCommand(interaction, itemId) {
  const userId = interaction.user.id;
  const player = getPlayer(userId);
  const item = dbGetEquipmentById(itemId);
  if (!player || !item || item.owner_id !== userId) {
    return interaction.reply({ content: 'その装備IDは見つかりません。', ephemeral: true });
  }
  const gold = calculateDismantleValue(item);
  dbDeleteEquipment(userId, itemId);
  updatePlayer(userId, { gold: player.gold + gold });
  return interaction.reply({ content: `${formatEquipmentName(item)} を分解して ${gold}G を獲得しました。`, ephemeral: true });
}
