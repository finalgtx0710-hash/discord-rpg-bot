// src/commands/partyHandler.js
// /rpg party サブコマンドの処理をまとめたハンドラ

import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} from 'discord.js';
import {
  createParty, inviteToParty, acceptInvite, declineInvite,
  leaveParty, disbandParty, getParty, getPartyById, getPendingInvite
} from '../game/party.js';
import { getPlayer } from '../database/db.js';
import { CLASSES } from '../data/master.js';

// パーティ状態のEmbed生成
export function buildPartyEmbed(party, client) {
  const memberLines = party.members.map((uid, i) => {
    const player = getPlayer(uid);
    const cls = player ? CLASSES[player.class] : null;
    const leader = uid === party.leaderId ? '👑 ' : '　';
    return player
      ? `${leader}${cls.emoji} **${player.name}** Lv.${player.level} HP:${player.hp}/${player.max_hp}`
      : `${leader}<@${uid}>`;
  });

  return new EmbedBuilder()
    .setColor(0x7289DA)
    .setTitle('👥 パーティ情報')
    .setDescription(memberLines.join('\n'))
    .addFields(
      { name: 'メンバー数', value: `${party.members.length} / 4`, inline: true },
      { name: 'ステータス', value: party.status === 'waiting' ? '⏳ 待機中' : '⚔️ 探索中', inline: true },
    )
    .setFooter({ text: '👑 = リーダー　| Etherion Chronicle' });
}

// /rpg party コマンドのメインハンドラ
export async function handlePartyCommand(interaction) {
  const sub = interaction.options.getString('action');
  const userId = interaction.user.id;
  const player = getPlayer(userId);

  if (!player) {
    return interaction.reply({
      content: '⚠️ まずは `/rpg start` でキャラクターを作成してください！',
      ephemeral: true
    });
  }

  // --- create: パーティ作成 ---
  if (sub === 'create') {
    const result = createParty(userId);
    if (!result.ok) return interaction.reply({ content: result.message, ephemeral: true });

    const party = getParty(userId);
    const embed = buildPartyEmbed(party);
    embed.setTitle('👥 パーティを作成しました！');
    embed.setDescription(
      `**${player.name}** がパーティを作成しました。\n\n` +
      `フレンドに参加してもらうには：\n` +
      `\`/rpg party invite\` でメンションして招待してください。`
    );

    return interaction.reply({ embeds: [embed] });
  }

  // --- status: パーティ状況確認 ---
  if (sub === 'status') {
    const party = getParty(userId);
    if (!party) return interaction.reply({ content: '⚠️ パーティに参加していません。`/rpg party create` で作成できます。', ephemeral: true });

    return interaction.reply({ embeds: [buildPartyEmbed(party)] });
  }

  // --- invite: メンバーを招待 ---
  if (sub === 'invite') {
    const targetUser = interaction.options.getUser('target');
    if (!targetUser) return interaction.reply({ content: '⚠️ 招待するユーザーを指定してください。', ephemeral: true });
    if (targetUser.id === userId) return interaction.reply({ content: '⚠️ 自分自身は招待できません。', ephemeral: true });
    if (targetUser.bot) return interaction.reply({ content: '⚠️ Botは招待できません。', ephemeral: true });

    const targetPlayer = getPlayer(targetUser.id);
    if (!targetPlayer) return interaction.reply({ content: `⚠️ **${targetUser.displayName}** はまだキャラクターを作成していません。`, ephemeral: true });

    const result = inviteToParty(userId, targetUser.id);
    if (!result.ok) return interaction.reply({ content: result.message, ephemeral: true });

    // 招待ボタンを送る
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`party_accept:${targetUser.id}`)
        .setLabel('✅ 参加する')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`party_decline:${targetUser.id}`)
        .setLabel('❌ 断る')
        .setStyle(ButtonStyle.Secondary),
    );

    const embed = new EmbedBuilder()
      .setColor(0x7289DA)
      .setTitle('👥 パーティ招待')
      .setDescription(
        `<@${targetUser.id}> さん！\n` +
        `**${player.name}** からパーティへの招待が届いています！\n\n` +
        `⏰ 60秒以内に返答してください。`
      )
      .setFooter({ text: 'Etherion Chronicle' });

    return interaction.reply({ embeds: [embed], components: [row] });
  }

  // --- leave: パーティを抜ける ---
  if (sub === 'leave') {
    const result = leaveParty(userId);
    if (!result.ok) return interaction.reply({ content: result.message, ephemeral: true });

    if (result.disbanded) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x666666)
          .setTitle('👥 パーティ解散')
          .setDescription(`**${player.name}** が抜けたためパーティが解散しました。`)
        ]
      });
    }

    let msg = `**${player.name}** がパーティを抜けました。`;
    if (result.newLeader) {
      const newLeaderPlayer = getPlayer(result.newLeader);
      if (newLeaderPlayer) msg += `\n👑 新しいリーダー: **${newLeaderPlayer.name}**`;
    }

    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x666666).setTitle('👥 パーティ離脱').setDescription(msg)]
    });
  }

  // --- disband: パーティ解散（リーダーのみ） ---
  if (sub === 'disband') {
    const result = disbandParty(userId);
    if (!result.ok) return interaction.reply({ content: result.message, ephemeral: true });

    const mentions = result.members
      .filter(id => id !== userId)
      .map(id => `<@${id}>`)
      .join(' ');

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x666666)
        .setTitle('👥 パーティ解散')
        .setDescription(`**${player.name}** がパーティを解散しました。\n${mentions ? `${mentions} パーティが解散されました。` : ''}`)
      ]
    });
  }

  return interaction.reply({ content: '⚠️ 不明なアクションです。', ephemeral: true });
}

// ボタン操作のハンドラ（招待承諾・拒否）
export async function handlePartyButton(interaction) {
  const [action, targetId] = interaction.customId.split(':');
  const userId = interaction.user.id;

  // 招待された本人だけが操作できる
  if (userId !== targetId) {
    return interaction.reply({ content: '⚠️ これはあなた宛ての招待ではありません。', ephemeral: true });
  }

  if (action === 'party_accept') {
    const result = acceptInvite(userId);
    if (!result.ok) {
      return interaction.update({ content: result.message, embeds: [], components: [] });
    }

    const player = getPlayer(userId);
    const party = getParty(userId);
    const embed = buildPartyEmbed(party);
    embed.setTitle('🎉 パーティに参加しました！');

    // リーダーへの通知メッセージを追加
    const leaderPlayer = getPlayer(party.leaderId);
    embed.setDescription(
      `**${player.name}** がパーティに参加しました！\n\n` +
      memberList(party)
    );

    return interaction.update({ embeds: [embed], components: [] });
  }

  if (action === 'party_decline') {
    const result = declineInvite(userId);
    const player = getPlayer(userId);

    return interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(0x666666)
        .setTitle('❌ 招待を断りました')
        .setDescription(`**${player?.name || 'ユーザー'}** は招待を断りました。`)
      ],
      components: []
    });
  }
}

function memberList(party) {
  return party.members.map(uid => {
    const p = getPlayer(uid);
    const leader = uid === party.leaderId ? '👑 ' : '　';
    return p ? `${leader}${CLASSES[p.class].emoji} **${p.name}** Lv.${p.level}` : `${leader}<@${uid}>`;
  }).join('\n');
}
