import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { getPlayer } from '../database/db.js';
import { getAvailableQuests } from '../game/quest.js';
import { AREAS } from '../data/master.js';

export async function handleQuestCommand(interaction) {
  const userId = interaction.user.id;
  const player = getPlayer(userId);
  const available = getAvailableQuests(player);
  const area = AREAS[player.current_area];

  // 共通の戻るボタン
  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('back_main').setLabel('◀ 戻る').setStyle(ButtonStyle.Secondary)
  );

  const embed = new EmbedBuilder()
    .setColor(0x4DA6FF)
    .setTitle(`📜 クエストボード - ${area.name}`)
    .setFooter({ text: `Etherion Chronicle | Lv.${player.level}` });

  if (available.length === 0) {
    embed.setDescription('現在受注できるクエストはありません。');
    return interaction.isButton() 
      ? interaction.update({ embeds: [embed], components: [backRow] })
      : interaction.reply({ embeds: [embed], components: [backRow], ephemeral: true });
  }

  // クエストがある場合の処理（セレクトメニューなど）
  embed.setDescription('依頼を選択してください。');
  const select = new StringSelectMenuBuilder()
    .setCustomId('quest_accept')
    .setPlaceholder('クエストを選択')
    .addOptions(available.map(q => ({ label: q.title, value: q.id, description: q.description })));

  const selectRow = new ActionRowBuilder().addComponents(select);

  return interaction.isButton()
    ? interaction.update({ embeds: [embed], components: [selectRow, backRow] })
    : interaction.reply({ embeds: [embed], components: [selectRow, backRow], ephemeral: true });
}