import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function buildAdventureMenu() {
  const embed = new EmbedBuilder()
    .setColor(0x4DA6FF)
    .setTitle('⚔ 冒険に出る')
    .setDescription('どこへ向かいますか？')
    .setFooter({ text: 'Etherion Chronicle' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('adventure_explore').setLabel('🌲 探索').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('adventure_map').setLabel('🗺 マップ').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('adventure_quest').setLabel('📜 クエスト').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('adventure_party').setLabel('👥 パーティ').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('adventure_boss').setLabel('🐉 ボス戦').setStyle(ButtonStyle.Danger),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('back_main').setLabel('◀ 戻る').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2] };
}
