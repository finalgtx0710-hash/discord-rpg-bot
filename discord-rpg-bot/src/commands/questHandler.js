// src/commands/questHandler.js
// クエストコマンドハンドラ

import {
  EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle
} from 'discord.js';
import { getPlayer, updatePlayer } from '../database/db.js';
import { QUESTS, getAvailableQuests, acceptQuest } from '../game/quest.js';
import { ITEMS, AREAS } from '../data/master.js';

// クエスト一覧Embed（受注可能）
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

// 進行中クエスト一覧Embed
function buildActiveQuestsEmbed(player) {
  const quests = player.quests || { active: {}, completed: [] };
  const activeEntries = Object.entries(quests.active);

  const lines = activeEntries.map(([questId, progress]) => {
    const quest = QUESTS[questId];
    if (!quest) return null;
    const bar = buildProgressBar(progress.progress || 0, quest.required);
    return `**${quest.title}**\n${quest.description}\n${bar} ${progress.progress || 0}/${quest.required}`;
  }).filter(Boolean);

  const completedCount = (quests.completed || []).length;

  return new EmbedBuilder()
    .setColor(0x2E75B6)
    .setTitle('📋 進行中のクエスト')
    .setDescription(lines.length ? lines.join('\n\n') : '進行中のクエストはありません。')
    .setFooter({ text: `完了済み: ${completedCount}件 | Etherion Chronicle` });
}

function buildProgressBar(current, max) {
  const filled = Math.min(10, Math.round((current / max) * 10));
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}]`;
}

// /rpg quest コマンドメインハンドラ
export async function handleQuestCommand(interaction) {
  const userId = interaction.user.id;
  const action = interaction.options.getString('action');
  const player = getPlayer(userId);

  if (!player) {
    return interaction.reply({ content: '⚠️ まずは `/rpg start` でキャラクターを作成してください！', ephemeral: true });
  }

  // クエストボード（受注）
  if (action === 'board') {
    const available = getAvailableQuests(player);

    if (available.length === 0) {
      return interaction.reply({
        embeds: [buildQuestBoardEmbed(player, [])],
        ephemeral: true,
      });
    }

    const options = available.map(q => ({
      label: q.title,
      value: q.id,
      description: `${q.description.substring(0, 50)} | EXP+${q.rewards.exp} GOLD+${q.rewards.gold}G`,
    }));

    const select = new StringSelectMenuBuilder()
      .setCustomId('quest_accept')
      .setPlaceholder('受注するクエストを選んでください')
      .addOptions(options);

    await interaction.reply({
      embeds: [buildQuestBoardEmbed(player, available)],
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true,
    });
  }

  // 進行中クエスト確認
  else if (action === 'list') {
    await interaction.reply({
      embeds: [buildActiveQuestsEmbed(player)],
      ephemeral: true,
    });
  }
}

// クエスト受注セレクトメニュー処理
export async function handleQuestAccept(interaction) {
  const userId = interaction.user.id;
  const questId = interaction.values[0];
  const player = getPlayer(userId);
  if (!player) return interaction.update({ content: '⚠️ キャラクターが見つかりません。', embeds: [], components: [] });

  const result = acceptQuest(player, questId);
  if (!result.ok) return interaction.update({ content: result.message, embeds: [], components: [] });

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
    .setFooter({ text: '/rpg explore で進捗が進みます | Etherion Chronicle' });

  await interaction.update({ embeds: [embed], components: [] });
}

// クエスト完了通知メッセージを生成（battle.js・explore.jsから呼ぶ）
export function buildQuestCompleteMessage(completed) {
  if (!completed.length) return '';
  return completed.map(({ quest }) => {
    const rewardItems = quest.rewards.items.map(k => ITEMS[k]?.name || k).join(', ');
    return `\n\n🎊 **クエスト完了！**「${quest.title}」\n` +
      `EXP +${quest.rewards.exp} / GOLD +${quest.rewards.gold}G${rewardItems ? ' / ' + rewardItems : ''}`;
  }).join('');
}
