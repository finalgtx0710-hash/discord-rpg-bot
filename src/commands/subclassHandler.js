import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { dbUnlockPlayerSkill, getPlayer, updatePlayer } from '../database/db.js';
import { getSubclassChoices, getSubclassSkills } from '../game/builds.js';

export async function sendSubclassPrompt(user) {
  const player = getPlayer(user.id);
  if (!player || player.level < 10 || player.subclass) return false;

  const choices = getSubclassChoices(player.class);
  if (!choices.length) return false;

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('⚔ クラス覚醒の時が来た')
    .setDescription('Lv10に到達しました。進むべき道を選んでください。\n選択後は新しいスキルが解放されます。')
    .setFooter({ text: '選択後の変更はできません。慎重に。' });

  const row = new ActionRowBuilder().addComponents(
    ...choices.map((choice) =>
      new ButtonBuilder()
        .setCustomId(`subclass_select:${choice.id}`)
        .setLabel(choice.name)
        .setStyle(ButtonStyle.Primary)
    )
  );

  await user.send({ embeds: [embed], components: [row] }).catch(() => null);
  return true;
}

export async function handleSubclassSelect(interaction) {
  const userId = interaction.user.id;
  const subclass = interaction.customId.split(':')[1];
  const player = getPlayer(userId);
  if (!player) return interaction.reply({ content: 'キャラクターが見つかりません。', ephemeral: true });
  if (player.subclass) return interaction.reply({ content: 'すでにサブクラスを選択済みです。', ephemeral: true });

  const choice = getSubclassChoices(player.class).find((entry) => entry.id === subclass);
  if (!choice) return interaction.reply({ content: 'このクラスでは選べないサブクラスです。', ephemeral: true });

  updatePlayer(userId, { subclass });
  const skills = getSubclassSkills(subclass);
  for (const skill of skills) dbUnlockPlayerSkill(userId, skill.id);

  return interaction.update({
    embeds: [new EmbedBuilder()
      .setColor(0x00CC44)
      .setTitle('✅ 覚醒完了')
      .setDescription(`あなたは **${choice.name}** の道を歩み始めました。\n新しいスキルが解放されました。\n\n${skills.map((skill) => `・${skill.name}`).join('\n')}`)
      .setFooter({ text: 'Etherion Chronicle' })
    ],
    components: [],
  });
}
