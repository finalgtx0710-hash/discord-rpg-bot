import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { getPlayer, updatePlayer } from '../database/db.js';
import { QUESTS, getAvailableQuests, acceptQuest } from '../game/quest.js';
import { ITEMS, AREAS } from '../data/master.js';
import { attachBackgroundImage } from '../utils/backgroundAssets.js';

function buildProgressBar(current, max) {
  const filled = Math.min(10, Math.round((current / max) * 10));
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}]`;
}

function buildBackToTownRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('menu_town')
      .setLabel('← 街メニューへ')
      .setStyle(ButtonStyle.Secondary)
  );
}

export async function handleQuestCommand(interaction, actionOverride = null) {
  const userId = interaction.user.id;
  const action = actionOverride ?? interaction.options?.getString('action') ?? 'board';
  const player = getPlayer(userId);
  if (!player) return interaction.reply({ content: 'まずは /rpg start でキャラクターを作成してください！', ephemeral: true });

  if (action === 'board') {
    const available = getAvailableQuests(player);
    const area = AREAS[player.current_area];
    const lines = available.map(q => {
      const rewardItems = q.rewards.items.map(k => ITEMS[k]?.name || k).join(', ');
      return `**${q.title}**（Lv.${q.level_req}～）\n${q.description}\n報酬: EXP +${q.rewards.exp} / GOLD +${q.rewards.gold}G${rewardItems ? ' / ' + rewardItems : ''}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(`クエストボード - ${area.name}`)
      .setDescription(lines.length ? lines.join('\n\n') : '現在受注できるクエストはありません。')
      .setFooter({ text: `Etherion Chronicle | Lv.${player.level}` });

    if (available.length === 0) {
      return interaction.reply(attachBackgroundImage({ embeds: [embed], components: [buildBackToTownRow()], ephemeral: true }, 'quest'));
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('quest_accept')
      .setPlaceholder('受注するクエストを選んでください')
      .addOptions(available.map(q => ({
        label: q.title,
        value: q.id,
        description: `EXP+${q.rewards.exp} GOLD+${q.rewards.gold}G`,
      })));

    await interaction.reply(attachBackgroundImage({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select), buildBackToTownRow()], ephemeral: true }, 'quest'));

  } else if (action === 'list') {
    const quests = player.quests || { active: {}, completed: [] };
    const lines = Object.entries(quests.active).map(([questId, progress]) => {
      const quest = QUESTS[questId];
      if (!quest) return null;
      const bar = buildProgressBar(progress.progress || 0, quest.required);
      return `**${quest.title}**\n${quest.description}\n${bar} ${progress.progress || 0}/${quest.required}`;
    }).filter(Boolean);

    const embed = new EmbedBuilder()
      .setColor(0x2E75B6)
      .setTitle('進行中のクエスト')
      .setDescription(lines.length ? lines.join('\n\n') : '進行中のクエストはありません。')
      .setFooter({ text: `完了済み: ${(quests.completed || []).length}件 | Etherion Chronicle` });

    await interaction.reply(attachBackgroundImage({ embeds: [embed], components: [buildBackToTownRow()], ephemeral: true }, 'quest'));
  }
}

export async function handleQuestAccept(interaction) {
  const userId = interaction.user.id;
  const questId = interaction.values[0];
  const player = getPlayer(userId);
  if (!player) return interaction.update({ content: 'キャラクターが見つかりません。', embeds: [], components: [] });

  const result = acceptQuest(player, questId);
  if (!result.ok) return interaction.update({ content: result.message, embeds: [], components: [] });

  updatePlayer(userId, { quests: result.quests });

  const quest = QUESTS[questId];
  const rewardItems = quest.rewards.items.map(k => ITEMS[k]?.name || k).join(', ');

  const embed = new EmbedBuilder()
    .setColor(0x00CC44)
    .setTitle('クエスト受注！')
    .setDescription(`**${quest.title}**\n${quest.description}`)
    .addFields(
      { name: '目標', value: `${quest.required}体/回`, inline: true },
      { name: '報酬', value: `EXP +${quest.rewards.exp} / GOLD +${quest.rewards.gold}G${rewardItems ? ' / ' + rewardItems : ''}`, inline: true },
    )
    .setFooter({ text: '探索で進捗が進みます | Etherion Chronicle' });

  await interaction.update(attachBackgroundImage({ embeds: [embed], components: [buildBackToTownRow()] }, 'quest', { clearAttachments: true }));
}

export function buildQuestCompleteMessage(completed) {
  if (!completed || !completed.length) return '';
  return completed.map(({ quest }) => {
    const rewardItems = quest.rewards.items.map(k => ITEMS[k]?.name || k).join(', ');
    return `\n\nクエスト完了！「${quest.title}」\nEXP +${quest.rewards.exp} / GOLD +${quest.rewards.gold}G${rewardItems ? ' / ' + rewardItems : ''}`;
  }).join('');
}
