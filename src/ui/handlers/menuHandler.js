// src/ui/handlers/menuHandler.js
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import { existsSync } from 'fs';
import path from 'path';
import { createBattleImage, createExploreImage } from '../../utils/battleCanvas.js';
import { buildMainMenu } from '../menus/mainMenu.js';
import { buildAdventureMenu } from '../menus/adventureMenu.js';
import { buildTownMenu } from '../menus/townMenu.js';
import { buildCharacterMenu } from '../menus/characterMenu.js';
import { buildStoryMenu } from '../menus/storyMenu.js';
import { buildRecordsMenu } from '../menus/recordsMenu.js';
import { handleQuestCommand } from '../../commands/questHandler.js';
import { handleMapCommand } from '../../commands/moveHandler.js';
import { handleShopCommand, handleInnCommand } from '../../commands/shopHandler.js';
import { handleBossCommand } from '../../commands/bossHandler.js';
import { handleEquipCommand } from '../../commands/equipHandler.js';
import { handleSkillCommand } from '../../commands/skillHandler.js';
import { handleClassChangeCommand } from '../../commands/classChangeHandler.js';
import { handleAchievementCommand } from '../../commands/achievementHandler.js';
import { buildPartyMenu } from '../../commands/partyHandler.js';
import { buildStatusEmbed } from '../../commands/rpg.js';
import { explore, canExplore } from '../../game/explore.js';
import { getPlayer, updatePlayer, getRanking } from '../../database/db.js';
import { AREAS, ITEMS } from '../../data/master.js';
import { IMAGES } from '../../data/images.js';

const MENU_MAP = {
  back_main:      (userId) => buildMainMenu(userId),
  menu_character: ()       => buildCharacterMenu(),
  menu_story:     (userId) => buildStoryMenu(userId),
  menu_records:   ()       => buildRecordsMenu(),
};

const backToAdventureRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('menu_adventure')
    .setLabel('◀ 戻る')
    .setStyle(ButtonStyle.Secondary)
);

const backToMainRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('back_main')
    .setLabel('◀ メインメニューへ')
    .setStyle(ButtonStyle.Primary)
);

const backToCharacterRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('menu_character')
    .setLabel('← キャラクターメニューへ')
    .setStyle(ButtonStyle.Secondary)
);

function buildBackToRecordsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('menu_records')
      .setLabel('記録メニューへ')
      .setStyle(ButtonStyle.Secondary)
  );
}

function attachStartingVillageBackground(response) {
  const backgroundPath = path.join(process.cwd(), 'assets', 'backgrounds', 'starting_village.png');
  if (!existsSync(backgroundPath)) return { ...response, attachments: [] };

  const attachmentName = `starting-village-${Date.now()}.png`;
  const attachment = new AttachmentBuilder(backgroundPath, { name: attachmentName });
  response.embeds[0].setImage(`attachment://${attachmentName}`);
  return { ...response, attachments: [], files: [attachment] };
}

async function runCommandFromButton(interaction, handler) {
  const originalReply = interaction.reply.bind(interaction);
  interaction.reply = (payload) => interaction.update(payload);
  try {
    return await handler(interaction);
  } finally {
    interaction.reply = originalReply;
  }
}

export async function handleMenuInteraction(interaction) {
  const { customId, user } = interaction;
  const userId = user.id;

  // 1. メニュー遷移
  if (MENU_MAP[customId]) {
    const response = MENU_MAP[customId](userId);
    await interaction.update({ ...response, attachments: [] });
    return true;
  }

  if (customId === 'menu_adventure') {
    const response = buildAdventureMenu();
    const player = getPlayer(userId);
    const area = player && AREAS[player.current_area];

    if (area) {
      const attachment = await createExploreImage(player.current_area, area.name);
      response.embeds[0].setImage(`attachment://${attachment.name}`);
      await interaction.update({ ...response, attachments: [], files: [attachment] });
      return true;
    }

    await interaction.update({ ...response, attachments: [] });
    return true;
  }

  if (customId === 'menu_town') {
    const player = getPlayer(userId);
    if (player) {
      updatePlayer(userId, { current_area: 'starting_village' });
    }
    await interaction.update(attachStartingVillageBackground(buildTownMenu()));
    return true;
  }

  // 2. 探索ボタン
  if (customId === 'char_status') {
    const player = getPlayer(userId);
    if (!player) {
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(0xFF4444)
          .setTitle('キャラクターが見つかりません')
          .setDescription('先に `/rpg start` でキャラクターを作成してください。')
        ],
        components: [backToMainRow],
      });
      return true;
    }

    await interaction.update({
      embeds: [buildStatusEmbed(player)],
      components: [backToCharacterRow],
    });
    return true;
  }

  if (customId === 'char_inventory') {
    const player = getPlayer(userId);
    if (!player) {
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(0xFF4444)
          .setTitle('キャラクターが見つかりません')
          .setDescription('先に `/rpg start` でキャラクターを作成してください。')
        ],
        components: [backToMainRow],
      });
      return true;
    }

    const counts = {};
    for (const key of player.inventory || []) counts[key] = (counts[key] || 0) + 1;
    const lines = Object.entries(counts).map(([key, count]) => {
      const item = ITEMS[key];
      return item ? `**${item.name}** x${count}\n${item.description}` : `**${key}** x${count}`;
    });

    await interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(0x2E75B6)
        .setTitle(`${player.name} の所持品`)
        .setDescription(lines.length ? lines.join('\n\n') : '所持品はありません。')
        .setFooter({ text: `Gold: ${player.gold} G | Etherion Chronicle` })
      ],
      components: [backToCharacterRow],
    });
    return true;
  }

  if (customId === 'char_equip') {
    await handleEquipCommand(interaction);
    return true;
  }

  if (customId === 'char_skill') {
    await handleSkillCommand(interaction);
    return true;
  }

  if (customId === 'adventure_explore') {
    const { ok, remaining } = canExplore(userId);
    if (!ok) {
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(0x4DA6FF)
          .setTitle('⏳ クールダウン中')
          .setDescription(`あと **${remaining}秒** 待ってください。`)
          .setFooter({ text: 'Etherion Chronicle' })
        ],
        components: [backToAdventureRow],
      });
      return true;
    }

    const player = getPlayer(userId);
    if (!player) {
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(0xFF4444)
          .setTitle('⚠ キャラクターが見つかりません')
          .setDescription('先に `/rpg start` でキャラクターを作成してください。')
        ],
        components: [backToMainRow],
      });
      return true;
    }

    const event = explore(userId, player.current_area);
    const area = AREAS[player.current_area];
    const party = null;

    const updateExploreResult = async ({ color, title, description }) => {
      await interaction.deferUpdate();
      const attachment = await createExploreImage(player.current_area, area.name, event);
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setImage(`attachment://${attachment.name}`)
        .setFooter({ text: 'Etherion Chronicle' });

      await interaction.editReply({
        embeds: [embed],
        components: [backToAdventureRow],
        attachments: [],
        files: [attachment],
      });
      return true;
    };

    if (event.type === 'battle') {
        await interaction.deferUpdate();
        if (party && party.members.length > 1) {
          const enemy = startPartyBattle(party.party_id, event.enemyKey, party.members.length);
          const attachment = await createBattleImage(player.current_area, event.enemyKey, enemy.name, enemy.currentHp, enemy.hp);
          const memberLines = party.members.map(uid => {
            const p = getPlayer(uid);
            return p ? `⏳ **${p.name}** HP:${p.hp}/${p.max_hp}` : `<@${uid}>`;
          }).join('\n');
          const embed = new EmbedBuilder().setColor(0xC00000).setTitle('⚔️ パーティエンカウント！')
            .setDescription(`**${area.name}**を探索中…\n\n${memberLines}\n\n⏳ 全員が行動を選択すると一斉に処理されます！`)
            .setImage(`attachment://${attachment.name}`)
            .setFooter({ text: 'Etherion Chronicle' });
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`pbattle_attack:${party.party_id}:${event.enemyKey}`).setLabel('⚔️ 攻撃').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`pbattle_skill:${party.party_id}:${event.enemyKey}`).setLabel('✨ スキル').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`pbattle_item:${party.party_id}:${event.enemyKey}`).setLabel('🧪 アイテム').setStyle(ButtonStyle.Success),
          );
          await interaction.editReply({ embeds: [embed], components: [row], attachments: [], files: [attachment] });
        } else {
          const attachment = await createBattleImage(player.current_area, event.enemyKey, event.enemy.name, event.enemy.hp, event.enemy.hp);
          const embed = new EmbedBuilder().setColor(0xC00000).setTitle('⚔️ エンカウント！')
            .setDescription(`**${area.name}**を探索中…\n**${event.enemy.name}** が現れた！`)
            .setImage(`attachment://${attachment.name}`)
            .setFooter({ text: 'Etherion Chronicle' });
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`battle_attack:${event.enemyKey}`).setLabel('⚔️ 攻撃').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`battle_skillmenu:${event.enemyKey}`).setLabel('✨ スキル').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`battle_item:${event.enemyKey}`).setLabel('🧪 アイテム').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`battle_escape:${event.enemyKey}`).setLabel('💨 逃走').setStyle(ButtonStyle.Secondary),
          );
          await interaction.editReply({ embeds: [embed], components: [row], attachments: [], files: [attachment] });
        }
        return true;

    }

    if (event.type === 'treasure') {
      const updatedPlayer = getPlayer(userId);
      return updateExploreResult({
        color: 0xFFD700,
        title: '💰 宝箱発見！',
        description: `**${area.name}** を探索中…\n**${event.gold}G** を手に入れた！\n所持金: ${updatedPlayer.gold}G`,
      });
    }

    if (event.type === 'heal') {
      const updatedPlayer = getPlayer(userId);
      return updateExploreResult({
        color: 0x00CC44,
        title: '✨ 回復の泉',
        description: `**${area.name}** を探索中…\nHPが **${event.heal}** 回復した！\nHP: ${updatedPlayer.hp}/${updatedPlayer.max_hp}`,
      });
    }

    if (event.type === 'npc') {
      return updateExploreResult({
        color: 0x7289DA,
        title: `👤 ${event.npc.name} と出会った`,
        description: `**${area.name}** を探索中…\n${event.npc.message}`,
      });
    }

    // 何もなし
    return updateExploreResult({
      color: 0x666666,
      title: '🌲 探索',
      description: `**${area.name}** を探索した…\n${event.message}`,
    });
  }

  // 3. クエストボード
  if (customId === 'town_quest') {
    await handleQuestCommand(interaction, 'board');
    return true;
  }

  // 4. マップ
  if (customId === 'adventure_boss') {
    await handleBossCommand(interaction);
    return true;
  }

  if (customId === 'adventure_map') {
    await handleMapCommand(interaction);
    return true;
  }

  // 5. ショップ
  if (customId === 'adventure_party') {
    await interaction.update(buildPartyMenu(userId));
    return true;
  }

  if (customId === 'records_achievement') {
    await handleAchievementCommand(interaction);
    return true;
  }

  if (customId === 'records_ranking') {
    const ranking = getRanking(10);
    const lines = ranking.map((player, index) => {
      return `**${index + 1}.** ${player.name} - Lv.${player.level} / EXP ${player.exp}`;
    });

    await interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('ランキング')
        .setDescription(lines.length ? lines.join('\n') : 'まだランキングに表示できるキャラクターがいません。')
        .setFooter({ text: 'Etherion Chronicle' })
      ],
      components: [buildBackToRecordsRow()],
      attachments: [],
    });
    return true;
  }

  if (customId === 'town_shop') {
    await handleShopCommand(interaction);
    return true;
  }

  // 6. 宿屋
  if (customId === 'town_inn') {
    await handleInnCommand(interaction);
    return true;
  }

  if (customId === 'town_class') {
    await runCommandFromButton(interaction, (i) => handleClassChangeCommand(i, 'town'));
    return true;
  }

  return false;
}
