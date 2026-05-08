import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { getPlayer, updatePlayer } from '../database/db.js';
import { ITEMS, EQUIPMENT_SLOTS, calcEquippedStats } from '../data/master.js';

function getEquippableItems(player) {
  const inventory = player.inventory || [];
  const counts = {};
  for (const key of inventory) counts[key] = (counts[key] || 0) + 1;
  return Object.entries(counts)
    .map(([key]) => ({ key, item: ITEMS[key] }))
    .filter(({ item }) => item && (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory'));
}

function buildEquipmentLines(equipment) {
  return Object.entries(EQUIPMENT_SLOTS).map(([slot, label]) => {
    const key = equipment[slot];
    return `${label}: ${key && ITEMS[key] ? ITEMS[key].name : '*(なし)*'}`;
  }).join('\n');
}

export async function handleEquipCommand(interaction) {
  const userId = interaction.user.id;
  const player = getPlayer(userId);
  if (!player) return interaction.reply({ content: 'まずは /rpg start でキャラクターを作成してください！', ephemeral: true });

  const equipment = player.equipment || {};
  const equipped = calcEquippedStats(player);
  const equippable = getEquippableItems(player);

  const bonusLine = [
    equipped.bonus.atk ? `ATK+${equipped.bonus.atk}` : '',
    equipped.bonus.def ? `DEF+${equipped.bonus.def}` : '',
    equipped.bonus.spd ? `SPD+${equipped.bonus.spd}` : '',
    equipped.bonus.hp  ? `HP+${equipped.bonus.hp}`  : '',
    equipped.bonus.mp  ? `MP+${equipped.bonus.mp}`  : '',
  ].filter(Boolean).join(' ') || 'なし';

  const embed = new EmbedBuilder()
    .setColor(0x2E75B6)
    .setTitle('装備管理')
    .addFields(
      { name: '現在の装備', value: buildEquipmentLines(equipment) },
      { name: '装備ボーナス合計', value: bonusLine },
      { name: '実質ステータス', value: `ATK: ${equipped.atk} | DEF: ${equipped.def} | SPD: ${equipped.spd}` },
    )
    .setFooter({ text: 'Etherion Chronicle' });

  if (equippable.length === 0) {
    embed.setDescription('装備できるアイテムを持っていません。ショップで購入するか敵を倒してドロップを狙いましょう！');
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  const options = equippable.map(({ key, item }) => {
    const slotLabel = EQUIPMENT_SLOTS[item.slot] || item.slot;
    const isEquipped = equipment[item.slot] === key;
    const bonusText = Object.entries(item.equip || {}).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(' ');
    return { label: `${item.name}${isEquipped ? ' (装備中)' : ''}`, value: key, description: `${slotLabel} | ${bonusText}` };
  });

  const unequipOptions = Object.entries(equipment)
    .filter(([, v]) => v)
    .map(([slot]) => ({
      label: `${EQUIPMENT_SLOTS[slot]} を外す`,
      value: `unequip_${slot}`,
      description: `${ITEMS[equipment[slot]]?.name || ''}を外す`,
    }));

  const allOptions = [...options, ...unequipOptions].slice(0, 25);
  const select = new StringSelectMenuBuilder()
    .setCustomId('equip_select')
    .setPlaceholder('装備するアイテム、または外すスロットを選択')
    .addOptions(allOptions);

  await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
}

export async function handleEquipSelect(interaction) {
  const userId = interaction.user.id;
  const value = interaction.values[0];
  const player = getPlayer(userId);
  if (!player) return interaction.update({ content: 'キャラクターが見つかりません。', embeds: [], components: [] });

  const equipment = { ...(player.equipment || {}) };

  if (value.startsWith('unequip_')) {
    const slot = value.replace('unequip_', '');
    const removedItem = ITEMS[equipment[slot]];
    delete equipment[slot];
    updatePlayer(userId, { equipment });

    const updatedPlayer = getPlayer(userId);
    const equipped = calcEquippedStats(updatedPlayer);
    const bonusLine = [
      equipped.bonus.atk ? `ATK+${equipped.bonus.atk}` : '',
      equipped.bonus.def ? `DEF+${equipped.bonus.def}` : '',
      equipped.bonus.spd ? `SPD+${equipped.bonus.spd}` : '',
    ].filter(Boolean).join(' ') || 'なし';

    return interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(0x666666)
        .setTitle('装備を外しました')
        .setDescription(`${removedItem?.name || '装備'} を外しました。`)
        .addFields(
          { name: '現在の装備', value: buildEquipmentLines(equipment) },
          { name: '装備ボーナス合計', value: bonusLine },
        )
      ],
      components: []
    });

  } else {
    const item = ITEMS[value];
    if (!item || !item.slot) return interaction.update({ content: '装備できないアイテムです。', embeds: [], components: [] });

    const inventory = player.inventory || [];
    if (!inventory.includes(value)) return interaction.update({ content: 'そのアイテムを持っていません。', embeds: [], components: [] });

    equipment[item.slot] = value;
    updatePlayer(userId, { equipment });

    const updatedPlayer = getPlayer(userId);
    const equipped = calcEquippedStats(updatedPlayer);
    const bonusText = Object.entries(item.equip || {}).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(' ');

    return interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(0x00CC44)
        .setTitle('装備しました！')
        .setDescription(`${item.name} を装備しました！（${bonusText}）`)
        .addFields(
          { name: '現在の装備', value: buildEquipmentLines(equipment) },
          { name: '実質ステータス', value: `ATK: ${equipped.atk} | DEF: ${equipped.def} | SPD: ${equipped.spd}` },
        )
      ],
      components: []
    });
  }
}