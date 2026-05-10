// src/ui/handlers/menuHandler.js
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { buildMainMenu } from '../menus/mainMenu.js';
import { buildAdventureMenu } from '../menus/adventureMenu.js';
import { buildTownMenu } from '../menus/townMenu.js';
import { buildCharacterMenu } from '../menus/characterMenu.js';
import { buildStoryMenu } from '../menus/storyMenu.js';
import { buildRecordsMenu } from '../menus/recordsMenu.js';
import { handleQuestCommand } from '../../commands/questHandler.js';
import { handleMapCommand } from '../../commands/moveHandler.js';
import { explore, canExplore } from '../../game/explore.js';
import { getPlayer } from '../../database/db.js'; // パスを修正

const MENU_MAP = {
  back_main: (userId) => buildMainMenu(userId),
  menu_adventure: () => buildAdventureMenu(),
  menu_town: () => buildTownMenu(),
  menu_character: () => buildCharacterMenu(),
  menu_story: (userId) => buildStoryMenu(userId),
  menu_records: () => buildRecordsMenu(),
};

export async function handleMenuInteraction(interaction) {
  const { customId, user } = interaction;
  const userId = user.id;

  // 1. メニュー遷移
  if (MENU_MAP[customId]) {
    const response = await MENU_MAP[customId](userId);
    await interaction.update(response);
    return true;
  }

  // 2. 探索ボタン
  if (customId === 'adventure_explore') {
    const { ok, remaining } = canExplore(userId);
    
    if (!ok) {
      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('back_main')
          .setLabel('◀ メインメニューへ')
          .setStyle(ButtonStyle.Secondary)
      );
      await interaction.update({ 
        content: `⏳ 探索クールダウン中… あと **${remaining}秒** 待ってください。`, 
        embeds: [], 
        components: [backRow] 
      });
      return true;
    }

    await explore(interaction);
    return true;
  }

  // 3. クエストボード
  if (customId === 'adventure_quest') {
    await handleQuestCommand(interaction);
    return true;
  }

  // 4. マップ
  if (customId === 'adventure_map') {
    await handleMapCommand(interaction);
    return true;
  }

  return false;
}