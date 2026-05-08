import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { getPlayer, updatePlayer } from '../database/db.js';
import { SKILLS, getLearnedSkills, getClassSkills } from '../game/skills.js';
import { CLASSES } from '../data/master.js';

export async function handleSkillCommand(interaction) {
  const userId = interaction.user.id;
  const player = getPlayer(userId);
  if (!player) return interaction.reply({ content: 'まずは /rpg start でキャラクターを作成してください！', ephemeral: true });

  const allClassSkills = getClassSkills(player.class);
  const learnedSkills = getLearnedSkills(player);
  const cls = CLASSES[player.class];

  const skillLines = allClassSkills.map(skill => {
    const learned = player.level >= skill.unlock_level;
    const status = learned ? '✅' : `🔒 Lv.${skill.unlock_level}~`;
    return `${status} **${skill.name}** (MP ${skill.mp_cost})\n${skill.description}`;
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`${cls.emoji} ${cls.name}のスキル一覧`)
    .setDescription(skillLines)
    .setFooter({ text: `現在Lv.${player.level} | 戦闘中に /rpg explore でスキルを使えます` });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}