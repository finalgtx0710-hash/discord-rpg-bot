// src/commands/partyHandler.js
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
} from 'discord.js';
import {
  createParty,
  inviteToParty,
  acceptInvite,
  declineInvite,
  leaveParty,
  disbandParty,
  getParty,
} from '../game/party.js';
import { getPlayer } from '../database/db.js';
import { CLASSES } from '../data/master.js';

function backToAdventureRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('menu_adventure')
      .setLabel('← 冒険メニューへ')
      .setStyle(ButtonStyle.Secondary)
  );
}

function partyActionRow(party, userId) {
  const buttons = [];
  if (!party) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('party_create')
        .setLabel('パーティ作成')
        .setStyle(ButtonStyle.Success)
    );
  } else {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('party_status')
        .setLabel('状況確認')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('party_leave')
        .setLabel('抜ける')
        .setStyle(ButtonStyle.Secondary)
    );
    if (party.leaderId === userId) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId('party_invite')
          .setLabel('招待する')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('party_disband')
          .setLabel('解散')
          .setStyle(ButtonStyle.Danger)
      );
    }
  }
  return new ActionRowBuilder().addComponents(buttons);
}

function inviteSelectRow() {
  return new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId('party_invite_select')
      .setPlaceholder('招待するユーザーを選んでください')
      .setMinValues(1)
      .setMaxValues(1)
  );
}

export function buildPartyEmbed(party) {
  const memberLines = party.members.map((uid) => {
    const player = getPlayer(uid);
    const cls = player ? CLASSES[player.class] : null;
    const leader = uid === party.leaderId ? '👑 ' : '';
    return player
      ? `${leader}${cls?.emoji || ''} **${player.name}** Lv.${player.level} HP:${player.hp}/${player.max_hp}`
      : `${leader}<@${uid}>`;
  });

  return new EmbedBuilder()
    .setColor(0x7289DA)
    .setTitle('👥 パーティ情報')
    .setDescription(memberLines.join('\n'))
    .addFields(
      { name: 'メンバー数', value: `${party.members.length} / 4`, inline: true },
      { name: 'ステータス', value: party.status === 'waiting' ? '待機中' : '探索中', inline: true },
    )
    .setFooter({ text: '👑 = リーダー | Etherion Chronicle' });
}

export function buildPartyMenu(userId) {
  const player = getPlayer(userId);
  if (!player) {
    return {
      embeds: [new EmbedBuilder()
        .setColor(0xFF4444)
        .setTitle('キャラクターが見つかりません')
        .setDescription('先に `/rpg start` でキャラクターを作成してください。')
      ],
      components: [backToAdventureRow()],
    };
  }

  const party = getParty(userId);
  if (!party) {
    return {
      embeds: [new EmbedBuilder()
        .setColor(0x7289DA)
        .setTitle('👥 パーティ')
        .setDescription('まだパーティに参加していません。')
        .setFooter({ text: 'Etherion Chronicle' })
      ],
      components: [partyActionRow(null, userId), backToAdventureRow()],
    };
  }

  return {
    embeds: [buildPartyEmbed(party)],
    components: [partyActionRow(party, userId), backToAdventureRow()],
  };
}

async function respond(interaction, payload) {
  if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isUserSelectMenu()) {
    return interaction.update(payload);
  }
  return interaction.reply(payload);
}

async function sendPartyInvite(interaction, targetUser) {
  const userId = interaction.user.id;
  const player = getPlayer(userId);

  if (!targetUser) return interaction.reply({ content: '招待するユーザーを選んでください。', ephemeral: true });
  if (targetUser.id === userId) return interaction.reply({ content: '自分自身は招待できません。', ephemeral: true });
  if (targetUser.bot) return interaction.reply({ content: 'Botは招待できません。', ephemeral: true });

  const targetPlayer = getPlayer(targetUser.id);
  if (!targetPlayer) {
    return interaction.reply({
      content: `**${targetUser.displayName || targetUser.username}** はまだキャラクターを作成していません。`,
      ephemeral: true,
    });
  }

  const result = inviteToParty(userId, targetUser.id);
  if (!result.ok) return interaction.reply({ content: result.message, ephemeral: true });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`party_accept:${targetUser.id}`)
      .setLabel('参加する')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`party_decline:${targetUser.id}`)
      .setLabel('断る')
      .setStyle(ButtonStyle.Secondary),
  );

  const embed = new EmbedBuilder()
    .setColor(0x7289DA)
    .setTitle('👥 パーティ招待')
    .setDescription(`<@${targetUser.id}> さん\n**${player.name}** からパーティへの招待が届いています。\n\n60秒以内に返答してください。`)
    .setFooter({ text: 'Etherion Chronicle' });

  return respond(interaction, { embeds: [embed], components: [row] });
}

export async function handlePartyCommand(interaction, actionOverride = null) {
  const sub = actionOverride ?? interaction.options?.getString('action') ?? 'status';
  const userId = interaction.user.id;
  const player = getPlayer(userId);

  if (!player) {
    return interaction.reply({
      content: 'まずは `/rpg start` でキャラクターを作成してください！',
      ephemeral: true,
    });
  }

  if (sub === 'create') {
    const result = createParty(userId);
    if (!result.ok) return interaction.reply({ content: result.message, ephemeral: true });
    const party = getParty(userId);
    const embed = buildPartyEmbed(party).setTitle('👥 パーティを作成しました！');
    return respond(interaction, {
      embeds: [embed],
      components: [partyActionRow(party, userId), backToAdventureRow()],
    });
  }

  if (sub === 'status') {
    const party = getParty(userId);
    if (!party) return respond(interaction, buildPartyMenu(userId));
    return respond(interaction, {
      embeds: [buildPartyEmbed(party)],
      components: [partyActionRow(party, userId), backToAdventureRow()],
    });
  }

  if (sub === 'invite') {
    return sendPartyInvite(interaction, interaction.options?.getUser('target'));
  }

  if (sub === 'leave') {
    const result = leaveParty(userId);
    if (!result.ok) return interaction.reply({ content: result.message, ephemeral: true });
    const embed = new EmbedBuilder()
      .setColor(0x666666)
      .setTitle(result.disbanded ? '👥 パーティ解散' : '👥 パーティ離脱')
      .setDescription(result.disbanded
        ? `**${player.name}** が抜けたためパーティが解散しました。`
        : `**${player.name}** がパーティを抜けました。`);
    return respond(interaction, { embeds: [embed], components: [backToAdventureRow()] });
  }

  if (sub === 'disband') {
    const result = disbandParty(userId);
    if (!result.ok) return interaction.reply({ content: result.message, ephemeral: true });
    const mentions = result.members.filter(id => id !== userId).map(id => `<@${id}>`).join(' ');
    const embed = new EmbedBuilder()
      .setColor(0x666666)
      .setTitle('👥 パーティ解散')
      .setDescription(`**${player.name}** がパーティを解散しました。${mentions ? `\n${mentions}` : ''}`);
    return respond(interaction, { embeds: [embed], components: [backToAdventureRow()] });
  }

  return interaction.reply({ content: '不明なアクションです。', ephemeral: true });
}

export async function handlePartyButton(interaction) {
  const [action, targetId] = interaction.customId.split(':');
  const userId = interaction.user.id;

  if (action === 'party_create') return handlePartyCommand(interaction, 'create');
  if (action === 'party_status') return handlePartyCommand(interaction, 'status');
  if (action === 'party_invite') {
    const party = getParty(userId);
    if (!party) return interaction.reply({ content: '先にパーティを作成してください。', ephemeral: true });
    if (party.leaderId !== userId) return interaction.reply({ content: '招待できるのはリーダーだけです。', ephemeral: true });
    return interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(0x7289DA)
        .setTitle('👥 パーティ招待')
        .setDescription('招待するユーザーを選んでください。')
        .setFooter({ text: 'Etherion Chronicle' })
      ],
      components: [inviteSelectRow(), backToAdventureRow()],
    });
  }
  if (action === 'party_leave') return handlePartyCommand(interaction, 'leave');
  if (action === 'party_disband') return handlePartyCommand(interaction, 'disband');

  if (userId !== targetId) {
    return interaction.reply({ content: 'これはあなた宛ての招待ではありません。', ephemeral: true });
  }

  if (action === 'party_accept') {
    const result = acceptInvite(userId);
    if (!result.ok) {
      return interaction.update({ content: result.message, embeds: [], components: [] });
    }

    const party = getParty(userId);
    const embed = buildPartyEmbed(party).setTitle('🎉 パーティに参加しました！');
    return interaction.update({
      embeds: [embed],
      components: [partyActionRow(party, userId), backToAdventureRow()],
    });
  }

  if (action === 'party_decline') {
    const result = declineInvite(userId);
    const player = getPlayer(userId);
    return interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(result.ok ? 0x666666 : 0xFF4444)
        .setTitle(result.ok ? '招待を断りました' : '招待が見つかりません')
        .setDescription(result.ok ? `**${player?.name || 'ユーザー'}** は招待を断りました。` : result.message)
      ],
      components: [],
    });
  }
}

export async function handlePartyUserSelect(interaction) {
  if (interaction.customId !== 'party_invite_select') return false;
  await sendPartyInvite(interaction, interaction.users.first());
  return true;
}
