import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

export function buildTownMenu() {
  const embed = new EmbedBuilder()
    .setColor(0x4DA6FF)
    .setTitle('🏙 街へ行く')
    .setDescription('街に到着しました。どこへ向かいますか？')
    .setFooter({ text: 'Etherion Chronicle' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('town_shop').setLabel('🛒 ショップ').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('town_quest').setLabel('📜 クエスト').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('town_inn').setLabel('🛏 宿屋').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('town_class').setLabel('🔮 クラスチェンジ').setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('back_main').setLabel('◀ 戻る').setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row1, row2] };
}
