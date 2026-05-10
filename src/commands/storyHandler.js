import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getPlayer, updatePlayer } from '../database/db.js';
import { STORY_CHAPTERS, getUnlockedChapters, getNextScene } from '../game/story.js';

async function safeRespond(interaction, data) {
  try {
    await interaction.update(data);
  } catch(e) {
    try {
      await interaction.reply({ ...data, ephemeral: true });
    } catch(e2) {
      await interaction.followUp({ ...data, ephemeral: true });
    }
  }
}

export async function handleStoryCommand(interaction) {
  const userId = interaction.user.id;
  const player = getPlayer(userId);
  if (!player) return interaction.reply({ content: 'まずは /rpg start でキャラクターを作成してください！', ephemeral: true });

  const story = {
    viewed_scenes: player.story?.viewed_scenes || [],
    completed_chapters: player.story?.completed_chapters || [],
    defeated_bosses: player.story?.defeated_bosses || [],
  };
  const unlocked = getUnlockedChapters(player);
  const completedQuests = (player.quests?.completed || []).length;

  const chapterLines = Object.values(STORY_CHAPTERS).map(ch => {
    const isUnlocked = unlocked.some(u => u.id === ch.id);
    const isCompleted = story.completed_chapters.includes(ch.id);
    const status = isCompleted ? '✅' : isUnlocked ? '📖' : '🔒';
    let lockHint = '';
    if (!isUnlocked) {
      const cond = ch.unlock_condition;
      if (cond.type === 'quests_completed') lockHint = ` (クエスト${cond.value}個完了で解放 / 現在${completedQuests}個)`;
      if (cond.type === 'boss_defeated') lockHint = ` (ボス討伐で解放)`;
    }
    return `${status} **${ch.title}**${lockHint}\n${ch.description}`;
  }).join('\n\n');

  const buttons = unlocked.slice(0, 4).map(ch => {
    const isCompleted = story.completed_chapters.includes(ch.id);
    return new ButtonBuilder()
      .setCustomId(`story_read:${ch.id}`)
      .setLabel(isCompleted ? `${ch.title}（読み直す）` : ch.title)
      .setStyle(isCompleted ? ButtonStyle.Secondary : ButtonStyle.Primary);
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('ストーリー - エーテリオン・クロニクル')
    .setDescription(chapterLines)
    .setFooter({ text: `クエスト完了数: ${completedQuests} | Etherion Chronicle` });

  await interaction.reply({
    embeds: [embed],
    components: buttons.length > 0 ? [new ActionRowBuilder().addComponents(...buttons), buildBackToStoryRow()] : [buildBackToStoryRow()],
    ephemeral: true,
  });
}

export async function handleStoryRead(interaction) {
  const userId = interaction.user.id;
  const chapterId = interaction.customId.replace('story_read:', '');
  const player = getPlayer(userId);
  if (!player) return safeRespond(interaction, { content: 'キャラクターが見つかりません。', embeds: [], components: [] });

  const ch = STORY_CHAPTERS[chapterId];
  if (!ch) return safeRespond(interaction, { content: 'チャプターが見つかりません。', embeds: [], components: [] });

  const story = {
    viewed_scenes: player.story?.viewed_scenes || [],
    completed_chapters: player.story?.completed_chapters || [],
    defeated_bosses: player.story?.defeated_bosses || [],
  };

  const nextScene = getNextScene(player, chapterId);

  if (!nextScene) {
    return safeRespond(interaction, {
      embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle(ch.title).setDescription('このチャプターはすべて読みました。').setFooter({ text: 'Etherion Chronicle' })],
      components: [buildBackToStoryRow()],
    });
  }

  if (!story.viewed_scenes.includes(nextScene.id)) story.viewed_scenes.push(nextScene.id);

  const allViewed = ch.scenes.every(s => story.viewed_scenes.includes(s.id));
  let rewardText = '';

  if (allViewed && !story.completed_chapters.includes(chapterId)) {
    story.completed_chapters.push(chapterId);
    updatePlayer(userId, { story, exp: player.exp + ch.reward.exp, gold: player.gold + ch.reward.gold });
    rewardText = `\n\nチャプタークリア報酬！\nEXP +${ch.reward.exp} / GOLD +${ch.reward.gold}G`;
  } else {
    updatePlayer(userId, { story });
  }

  const updatedPlayer = getPlayer(userId);
  const hasNext = getNextScene(updatedPlayer, chapterId) !== null;
  const sceneIndex = ch.scenes.findIndex(s => s.id === nextScene.id) + 1;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(ch.title)
    .setDescription(`— ${sceneIndex} / ${ch.scenes.length} —\n\n${nextScene.text}${rewardText}`)
    .setFooter({ text: 'Etherion Chronicle' });

  const row = new ActionRowBuilder().addComponents(
    hasNext
      ? new ButtonBuilder().setCustomId(`story_read:${chapterId}`).setLabel('次へ').setStyle(ButtonStyle.Primary)
      : new ButtonBuilder().setCustomId('story_end').setLabel('読了').setStyle(ButtonStyle.Success)
  );

  await safeRespond(interaction, { embeds: [embed], components: [row, buildBackToStoryRow()] });
}

function buildBackToStoryRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('menu_story')
      .setLabel('← ストーリーメニューへ')
      .setStyle(ButtonStyle.Secondary)
  );
}

export async function handleStoryEnd(interaction) {
  await safeRespond(interaction, {
    embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('ストーリー').setDescription('お疲れ様でした！\n\n/rpg story でいつでも続きが読めます。').setFooter({ text: 'Etherion Chronicle' })],
    components: [buildBackToStoryRow()],
  });
}
