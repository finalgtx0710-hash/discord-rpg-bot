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

// ボタンIDとメニュー画面の対応マップ
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

  // 1. 基本的なメニュー遷移 (MENU_MAPにあるIDの場合)
  if (MENU_MAP[customId]) {
    const response = await MENU_MAP[customId](userId);
    await interaction.update(response);
    return true;
  }

  // 2. 探索ボタンの処理
  if (customId === 'adventure_explore') {
    const { ok, remaining } = canExplore(userId);
    
    // 戻るボタンのActionRow（使い回し）
    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('back_main').setLabel('◀ メインメニューへ').setStyle(ButtonStyle.Secondary)
    );

    if (!ok) {
      // クールダウン中の場合は、メッセージと戻るボタンを表示
      await interaction.update({ 
        content: `⏳ 探索クールダウン中… あと **${remaining}秒** 待ってください。`, 
        embeds: [], 
        components: [backRow] 
      });
      return true;
    }

    // 探索実行
    await explore(interaction);
    return true;
  }

  // 3. クエストボードボタン
  if (customId === 'adventure_quest') {
    // クエストハンドラーを呼び出す（内部で「戻るボタン」付きの返信が行われるように設計済み）
    await handleQuestCommand(interaction);
    return true;
  }

  // 4. マップ移動ボタン
  if (customId === 'adventure_map') {
    await handleMapCommand(interaction);
    return true;
  }

  return false; // どのメニューIDにも合致しなかった場合は false を返し、index.jsの個別処理へ
}