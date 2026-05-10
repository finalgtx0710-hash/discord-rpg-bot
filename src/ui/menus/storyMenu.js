import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { STORY_CHAPTERS } from '../../game/story.js';
import { getPlayer } from '../../database/db.js';

export function buildStoryMenu(userId) {
  const player = getPlayer(userId);
  const story = {
    completed_chapters: player?.story?.completed_chapters || [],
  };

  const embed = new EmbedBuilder()
    .setColor(0x4DA6FF)
    .setTitle('📖 ストーリー')
    .setDescription('読む章を選んでください。')
    .setFooter({ text: 'Etherion Chronicle' });

  const completedQuests = (player?.quests?.completed || []).length;
  const defeatedBosses = player?.story?.defeated_bosses || [];

  const chapterButtons = Object.values(STORY_CHAPTERS).map(ch => {
    const cond = ch.unlock_condition;
    let unlocked = false;
    if (cond.type === 'start') unlocked = true;
    if (cond.type === 'quests_completed') unlocked = completedQuests >= cond.value;
    if (cond.type === 'boss_defeated') unlocked = defeatedBosses.includes(cond.value);
    const isCompleted = story.completed_chapters.includes(ch.id);
    return new ButtonBuilder()
      .setCustomId(`story_read:${ch.id}`)
      .setLabel(`${isCompleted ? '✅' : unlocked ? '📖' : '🔒'} ${ch.title}`)
      .setStyle(isCompleted ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(!unlocked);
  });

  const row1 = new ActionRowBuilder().addComponents(...chapterButtons.slice(0, 4));
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('back_main').setLabel('◀ 戻る').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2] };
}