import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function buildRecordsMenu() {
  const embed = new EmbedBuilder()
    .setColor(0x4DA6FF)
    .setTitle('🏆 記録')
    .setDescription('確認する項目を選んでください。')
    .setFooter({ text: 'Etherion Chronicle' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('records_achievement').setLabel('🏆 実績').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('records_ranking').setLabel('👑 ランキング').setStyle(ButtonStyle.Primary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('back_main').setLabel('◀ 戻る').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2] };
}