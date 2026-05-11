// src/ui/handlers/menuHandler.js
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import { existsSync } from 'fs';
import path from 'path';
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
import { buildPartyMenu } from '../../commands/partyHandler.js';
import { buildStatusEmbed } from '../../commands/rpg.js';
import { explore, canExplore } from '../../game/explore.js';
import { getPlayer } from '../../database/db.js';
import { AREAS, ITEMS } from '../../data/master.js';
import { IMAGES } from '../../data/images.js';

const MENU_MAP = {
  back_main:      (userId) => buildMainMenu(userId),
  menu_adventure: ()       => buildAdventureMenu(),
  menu_town:      ()       => buildTownMenu(),
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
    await interaction.update(response);
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

    if (event.type === 'battle') {
      const monsterImagePath = path.join(process.cwd(), 'assets', 'monsters', `${event.enemyKey}.png`);
      const hasImage = existsSync(monsterImagePath);
      const files = hasImage ? [new AttachmentBuilder(monsterImagePath, { name: `${event.enemyKey}.png` })] : [];

      const embed = new EmbedBuilder()
        .setColor(0xC00000)
        .setTitle('⚔️ エンカウント！')
        .setDescription(`**${area.name}** を探索中… **${event.enemy.name}** が現れた！\nHP: ${event.enemy.hp}`)
        .setFooter({ text: '行動を選択してください | Etherion Chronicle' });

      if (hasImage) {
        embed.setImage(`attachment://${event.enemyKey}.png`);
      } else if (IMAGES.enemies[event.enemyKey]) {
        embed.setThumbnail(IMAGES.enemies[event.enemyKey]);
      }

      const battleRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`battle_attack:${event.enemyKey}`).setLabel('⚔️ 攻撃').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`battle_skillmenu:${event.enemyKey}`).setLabel('✨ スキル').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`battle_item:${event.enemyKey}`).setLabel('🧪 アイテム').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`battle_escape:${event.enemyKey}`).setLabel('💨 逃走').setStyle(ButtonStyle.Secondary),
      );

      await interaction.update({ embeds: [embed], components: [battleRow], files });
      return true;
    }

    if (event.type === 'treasure') {
      const updatedPlayer = getPlayer(userId);
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle('💰 宝箱発見！')
          .setDescription(`**${area.name}** を探索中…\n**${event.gold}G** を手に入れた！\n所持金: ${updatedPlayer.gold}G`)
          .setFooter({ text: 'Etherion Chronicle' })
        ],
        components: [backToAdventureRow],
      });
      return true;
    }

    if (event.type === 'heal') {
      const updatedPlayer = getPlayer(userId);
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(0x00CC44)
          .setTitle('✨ 回復の泉')
          .setDescription(`**${area.name}** を探索中…\nHPが **${event.heal}** 回復した！\nHP: ${updatedPlayer.hp}/${updatedPlayer.max_hp}`)
          .setFooter({ text: 'Etherion Chronicle' })
        ],
        components: [backToAdventureRow],
      });
      return true;
    }

    if (event.type === 'npc') {
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(0x7289DA)
          .setTitle(`👤 ${event.npc.name} と出会った`)
          .setDescription(`**${area.name}** を探索中…\n${event.npc.message}`)
          .setFooter({ text: 'Etherion Chronicle' })
        ],
        components: [backToAdventureRow],
      });
      return true;
    }

    // 何もなし
    await interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(0x666666)
        .setTitle('🌲 探索')
        .setDescription(`**${area.name}** を探索した…\n${event.message}`)
        .setFooter({ text: 'Etherion Chronicle' })
      ],
      components: [backToAdventureRow],
    });
    return true;
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
