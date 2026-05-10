import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function buildCharacterMenu() {
  const embed = new EmbedBuilder()
    .setColor(0x4DA6FF)
    .setTitle('👤 キャラクターメニュー')
    .setDescription('確認する項目を選んでください。')
    .setFooter({ text: 'Etherion Chronicle' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('char_status').setLabel('📊 ステータス').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('char_inventory').setLabel('🎒 所持品').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('char_equip').setLabel('⚔ 装備').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('char_skill').setLabel('✨ スキル').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('back_main').setLabel('◀ 戻る').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2] };
}