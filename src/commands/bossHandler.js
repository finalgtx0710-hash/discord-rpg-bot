import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getPlayer } from '../database/db.js';
import { BOSSES, getAvailableBosses, startBossBattle, isInBossBattle, getBossBattle, processBossAction } from '../game/boss.js';
import { ITEMS } from '../data/master.js';
import { createBattleImage } from '../utils/battleCanvas.js';

function buildBar(current, max) {
  const filled = Math.min(10, Math.round((current / max) * 10));
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`;
}

function buildBossActionRow(bossId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`boss_action:attack:${bossId}`).setLabel('⚔️ 攻撃').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`boss_action:skill:${bossId}`).setLabel('✨ 必殺技 (MP15)').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`boss_action:item:${bossId}`).setLabel('🧪 アイテム').setStyle(ButtonStyle.Success),
  );
}

function buildBackToAdventureRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('menu_adventure')
      .setLabel('← 冒険メニューへ')
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildBossEmbed(session, player) {
  const { boss, currentHp, turn } = session;
  return new EmbedBuilder()
    .setColor(0x8B0000)
    .setTitle(`⚔️ ボス戦 - ${boss.name}`)
    .addFields(
      { name: `${boss.name} HP`, value: `${buildBar(currentHp, boss.hp)} ${currentHp}/${boss.hp}`, inline: false },
      { name: `${player.name} HP`, value: `${buildBar(player.hp, player.max_hp)} ${player.hp}/${player.max_hp}`, inline: false },
      { name: 'ターン', value: `${turn}`, inline: true },
      { name: 'MP', value: `${player.mp}/${player.max_mp}`, inline: true },
    )
    .setFooter({ text: '必殺技はMP15消費 | Etherion Chronicle' });
}

async function createBossBattleImage(session) {
  const { bossId, boss, currentHp } = session;
  return createBattleImage(boss.area, bossId, boss.name, currentHp, boss.hp);
}

export async function handleBossCommand(interaction) {
  const userId = interaction.user.id;
  const player = getPlayer(userId);
  if (!player) return interaction.reply({ content: '⚠️ まずは /rpg start でキャラクターを作成してください！', ephemeral: true });
  if (isInBossBattle(userId)) return interaction.reply({ content: '⚔️ すでにボス戦中です！', ephemeral: true });

  const available = getAvailableBosses(player);
  if (available.length === 0) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x8B0000).setTitle('👹 ボス戦').setDescription('現在のエリアで挑戦できるボスがいません。\nレベルを上げるか、別のエリアへ移動してください。').setFooter({ text: 'Etherion Chronicle' })],
      components: [buildBackToAdventureRow()],
      ephemeral: true,
    });
  }

  const bossLines = available.map(boss => {
    const rewardItems = boss.rewards.items.map(k => ITEMS[k]?.name || k).join(', ');
    return `**${boss.name}**（Lv.${boss.level_req}～）\n${boss.description}\n報酬: EXP +${boss.rewards.exp} / GOLD +${boss.rewards.gold}G / ${rewardItems}`;
  }).join('\n\n');

  const buttons = available.map(boss =>
    new ButtonBuilder().setCustomId(`boss_start:${boss.id}`).setLabel(`${boss.name}`).setStyle(ButtonStyle.Danger)
  );

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0x8B0000).setTitle('👹 ボス選択').setDescription(bossLines).setFooter({ text: '⚠️ ボス戦は強敵です！HPとアイテムを準備してから挑みましょう。' })],
    components: [new ActionRowBuilder().addComponents(...buttons.slice(0, 5)), buildBackToAdventureRow()],
  });
}

export async function handleBossChallenge(interaction) {
  const userId = interaction.user.id;
  const bossId = interaction.customId.replace('boss_start:', '');
  const player = getPlayer(userId);
  if (!player) return interaction.reply({ content: '⚠️ キャラクターが見つかりません。', ephemeral: true });
  if (isInBossBattle(userId)) return interaction.reply({ content: '⚔️ すでにボス戦中です！', ephemeral: true });

  const boss = BOSSES[bossId];
  if (!boss) return interaction.reply({ content: '⚠️ ボスが見つかりません。', ephemeral: true });
  if (player.level < boss.level_req) return interaction.reply({ content: `⚠️ Lv.${boss.level_req}以上が必要です。`, ephemeral: true });

  const session = startBossBattle(userId, bossId);
  const embed = buildBossEmbed(session, player);
  embed.setTitle(`⚔️ ボス戦開始！ - ${boss.name}`);
  embed.setDescription(`**${boss.name}**が現れた！\n\n${boss.description}\n\n⚠️ ボスは強力な必殺技を使います。アイテムを活用しましょう！`);

  const attachment = await createBossBattleImage(session);
  embed.setImage(`attachment://${attachment.name}`);

  await interaction.update({ embeds: [embed], components: [buildBossActionRow(bossId)], attachments: [], files: [attachment] });
}

export async function handleBossAction(interaction) {
  const userId = interaction.user.id;
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const bossId = parts[2];

  const session = getBossBattle(userId);
  if (!session) return interaction.reply({ content: '⚠️ ボス戦が見つかりません。', ephemeral: true });

  const result = await processBossAction(userId, action);
  if (!result) return interaction.reply({ content: '⚠️ エラーが発生しました。', ephemeral: true });

  const player = getPlayer(userId);
  const boss = BOSSES[bossId];
  let description = result.playerAction;
  if (result.phaseMessages.length > 0) description += `\n\n${result.phaseMessages.join('\n')}`;
  if (result.bossAction) description += `\n\n${result.bossAction}`;

  if (result.battleEnd) {
    if (result.victory) {
      const { exp, gold, items, levelUpMessages } = result.rewards;
      const itemNames = items.map(k => ITEMS[k]?.name || k).join(', ');
      description += `\n\n🎉 **${boss.name}**を討伐した！\n✨ EXP +**${exp}** | 💰 GOLD +**${gold}G**`;
      if (itemNames) description += `\n📦 ドロップ: **${itemNames}**`;
      if (levelUpMessages.length > 0) description += `\n\n${levelUpMessages.join('\n')}`;
      return interaction.update({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('🏆 ボス討伐！').setDescription(description).setFooter({ text: 'Etherion Chronicle' })], components: [buildBackToAdventureRow()] });
    } else {
      description += `\n\n💀 **${player?.name}**は倒れた…\n所持金が半分になり、始まりの村に戻った。`;
      return interaction.update({ embeds: [new EmbedBuilder().setColor(0x333333).setTitle('💀 ボス戦敗北').setDescription(description).setFooter({ text: 'Etherion Chronicle' })], components: [buildBackToAdventureRow()] });
    }
  }

  const updatedSession = getBossBattle(userId);
  const updatedPlayer = getPlayer(userId);
  const embed = buildBossEmbed(updatedSession, updatedPlayer);
  embed.setDescription(description);
  const attachment = await createBossBattleImage(updatedSession);
  embed.setImage(`attachment://${attachment.name}`);
  await interaction.update({ embeds: [embed], components: [buildBossActionRow(bossId)], attachments: [], files: [attachment] });
}
