import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function buildMainMenu(userId) {
  const embed = new EmbedBuilder()
    .setColor(0x4DA6FF)
    .setTitle('⚔ Etherion Chronicle')
    .setDescription('行動を選択してください。')
    .setFooter({ text: 'Etherion Chronicle' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('menu_adventure').setLabel('⚔ 冒険に出る').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('menu_town').setLabel('🏙 街へ行く').setStyle(ButtonStyle.Primary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('menu_character').setLabel('👤 メニュー').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu_story').setLabel('📖 ストーリー').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu_records').setLabel('🏆 記録').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2] };
}