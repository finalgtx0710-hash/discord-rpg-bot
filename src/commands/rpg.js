// src/commands/start.js
import {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, EmbedBuilder
} from 'discord.js';
import { getPlayer, createPlayer } from '../database/db.js';
import { CLASSES } from '../data/master.js';

export const data = new SlashCommandBuilder()
  .setName('rpg')
  .setDescription('エーテリオン・クロニクル RPGボット')
  .addSubcommand(sub =>
    sub.setName('start').setDescription('冒険を始める（新規キャラクター作成）')
  )
  .addSubcommand(sub =>
    sub.setName('status').setDescription('自分のステータスを確認する')
  )
  .addSubcommand(sub =>
    sub.setName('explore').setDescription('現在のエリアを探索する')
  )
  .addSubcommand(sub =>
    sub.setName('inventory').setDescription('所持品を確認する')
  )
  .addSubcommand(sub =>
    sub.setName('ranking').setDescription('サーバー内のランキングを確認する')
  );

// ステータス表示用Embed
export function buildStatusEmbed(player) {
  const cls = CLASSES[player.class];
  const hpBar = buildBar(player.hp, player.max_hp, '❤️');
  const mpBar = buildBar(player.mp, player.max_mp, '💙');
  const expBar = buildBar(player.exp, player.level * 100, '⭐');

  return new EmbedBuilder()
    .setColor(0x2E75B6)
    .setTitle(`${cls.emoji} ${player.name}`)
    .setDescription(`**${cls.name}** | Lv. **${player.level}**`)
    .addFields(
      { name: 'HP', value: `${hpBar} ${player.hp}/${player.max_hp}`, inline: false },
      { name: 'MP', value: `${mpBar} ${player.mp}/${player.max_mp}`, inline: false },
      { name: 'EXP', value: `${expBar} ${player.exp}/${player.level * 100}`, inline: false },
      { name: '⚔️ 攻撃力', value: `${player.atk}`, inline: true },
      { name: '🛡️ 防御力', value: `${player.def}`, inline: true },
      { name: '💨 速度',  value: `${player.spd}`, inline: true },
      { name: '💰 ゴールド', value: `${player.gold} G`, inline: true },
    )
    .setFooter({ text: 'Etherion Chronicle' })
    .setTimestamp();
}

function buildBar(current, max, emoji) {
  const filled = Math.round((current / max) * 10);
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`;
}
