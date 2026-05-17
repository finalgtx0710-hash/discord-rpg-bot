import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getPlayer } from '../database/db.js';
import { ACHIEVEMENTS } from '../game/achievements.js';

function buildBackToRecordsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('menu_records')
      .setLabel('記録メニューへ')
      .setStyle(ButtonStyle.Secondary)
  );
}

function respond(interaction, payload) {
  if (interaction.isButton?.() || interaction.isStringSelectMenu?.()) {
    return interaction.update({ ...payload, attachments: [] });
  }

  return interaction.reply({ ...payload, ephemeral: true });
}

export async function handleAchievementCommand(interaction) {
  const userId = interaction.user.id;
  const player = getPlayer(userId);

  if (!player) {
    return respond(interaction, {
      content: 'まずは /rpg start でキャラクターを作成してください！',
      embeds: [],
      components: [],
    });
  }

  const achievements = player.achievements || { unlocked: [], total_battles: 0, total_gold: 0, total_bosses: 0 };
  const unlocked = achievements.unlocked || [];
  const total = Object.keys(ACHIEVEMENTS).length;

  const categories = {
    '戦闘': ['first_battle', 'battle_10', 'battle_50', 'battle_100'],
    'レベル': ['level_5', 'level_10', 'level_20', 'level_30'],
    'ゴールド': ['gold_1000', 'gold_10000'],
    'クエスト': ['quest_1', 'quest_5', 'quest_all'],
    'ボス': ['boss_1', 'boss_all'],
    'エリア': ['area_forest', 'area_ruins', 'area_cavern', 'area_sanctuary'],
    '特別': ['classchange', 'party_member', 'story_complete'],
  };

  const fields = Object.entries(categories).map(([catName, ids]) => {
    const lines = ids.map((id) => {
      const ach = ACHIEVEMENTS[id];
      const done = unlocked.includes(id);
      if (!ach) return `未定義の実績: ${id}`;
      return `${done ? ach.emoji : '🔒'} ${done ? `**${ach.name}**` : `~~${ach.name}~~`} - ${ach.description}`;
    }).join('\n');

    return { name: catName, value: lines || 'なし', inline: false };
  });

  const lastTitle = unlocked.length > 0
    ? ACHIEVEMENTS[unlocked[unlocked.length - 1]]
    : null;

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle(`🏆 ${player.name} の実績`)
    .setDescription(
      `称号: **${lastTitle ? `${lastTitle.emoji} ${lastTitle.name}` : 'なし'}**\n` +
      `達成: **${unlocked.length} / ${total}**\n` +
      `累計戦闘: ${achievements.total_battles || 0}回 | 累計獲得G: ${achievements.total_gold || 0}G | ボス討伐: ${achievements.total_bosses || 0}体`
    )
    .addFields(...fields)
    .setFooter({ text: 'Etherion Chronicle' });

  return respond(interaction, {
    embeds: [embed],
    components: [buildBackToRecordsRow()],
  });
}
