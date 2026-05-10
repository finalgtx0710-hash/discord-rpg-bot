// src/commands/questHandler.js
import {
  EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} from 'discord.js';
import { getPlayer, updatePlayer } from '../database/db.js';
import { QUESTS, getAvailableQuests, acceptQuest } from '../game/quest.js';
import { ITEMS, AREAS } from '../data/master.js';

function buildQuestBoardEmbed(player, available) {
  const area = AREAS[player.current_area];
  const lines = available.map(q => {
    const rewardItems = q.rewards.items.map(k => ITEMS[k]?.name || k).join(', ');
    return [
      `**${q.title}**（Lv.${q.level_req}～）`,
      `${q.description}`,
      `報酬: EXP +${q.rewards.exp} / GOLD +${q.rewards.gold}G${rewardItems ? ' / ' + rewardItems : ''}`,
    ].join('\n');
  });

  return new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle(`📜 クエストボード - ${area.name}`)
    .setDescription(lines.length ? lines.join('\n\n') : '現在受注できるクエストはありません。')
    .setFooter({ text: `Etherion Chronicle | Lv.${player.level}` });
}

export async function handleQuestCommand(interaction) {
  const userId = interaction.user.id;
  const player = getPlayer(userId);
  if (!player) return;

  const available = getAvailableQuests(player);
  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('back_main').setLabel('◀ 戻る').setStyle(ButtonStyle.Secondary)
  );

  if (available.length === 0) {
    const embed = buildQuestBoardEmbed(player, []);
    const options = { embeds: [embed], components: [backRow], flags: [MessageFlags.Ephemeral] };
    return interaction.isButton() ? await interaction.update(options) : await interaction.reply(options);
  }

  const embed = buildQuestBoardEmbed(player, available);
  const select = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('quest_accept')
      .setPlaceholder('クエストを選択してください')
      .addOptions(available.map(q => ({ label: q.title, value: q.id, description: q.description.substring(0, 50) })))
  );

  const options = { embeds: [embed], components: [select, backRow], flags: [MessageFlags.Ephemeral] };
  return interaction.isButton() ? await interaction.update(options) : await interaction.reply(options);
}

export async function handleQuestAccept(interaction) {
  const userId = interaction.user.id;
  const questId = interaction.values[0];
  const player = getPlayer(userId);
  if (!player) return;

  const result = acceptQuest(player, questId);
  if (!result.ok) return await interaction.update({ content: result.message, embeds: [], components: [], flags: [MessageFlags.Ephemeral] });

  updatePlayer(userId, { quests: result.quests });

  const quest = QUESTS[questId];
  const rewardItems = quest.rewards.items.map(k => ITEMS[k]?.name || k).join(', ');

  const embed = new EmbedBuilder()
    .setColor(0x00CC44)
    .setTitle('📜 クエスト受注！')
    .setDescription(`**${quest.title}**\n${quest.description}`)
    .addFields(
      { name: '目標', value: `${quest.required}体/回`, inline: true },
      { name: '報酬', value: `EXP +${quest.rewards.exp} / GOLD +${quest.rewards.gold}G${rewardItems ? ' / ' + rewardItems : ''}`, inline: true },
    )
    .setFooter({ text: '探索で進捗が進みます | Etherion Chronicle' });

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('back_main').setLabel('◀ メニューへ').setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({ embeds: [embed], components: [backRow] });
}

export function buildQuestCompleteMessage(completed) {
  if (!completed.length) return '';
  return completed.map(({ quest }) => `\n✅ **クエスト達成：${quest.title}**`).join('');
}