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

// ボタンIDとメニュー画面の対応定義
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

  // 1. 基本的なメニュー間の移動
  if (MENU_MAP[customId]) {
    const response = await MENU_MAP[customId](userId);
    await interaction.update(response);
    return true;
  }

  // 2. 探索実行
  if (customId === 'adventure_explore') {
    const { ok, remaining } = canExplore(userId);
    
    // 全画面共通の「戻るボタン」
    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('back_main').setLabel('◀ メインメニューへ').setStyle(ButtonStyle.Secondary)
    );

    if (!ok) {
      // クールダウン中の場合は、必ず戻るボタンを添えてメッセージを出す
      await interaction.update({ 
        content: `⏳ 探索クールダウン中… あと **${remaining}秒** 待ってください。`, 
        embeds: [], 
        components: [backRow] 
      });
      return true;
    }

    // 探索処理（explore関数内で戦闘やアイテム発見などの描画を行う）
    await explore(interaction);
    return true;
  }

  // 3. クエストボード表示
  if (customId === 'adventure_quest') {
    // 内部で handleQuestCommand を呼び出し（クエストなし画面も内部でボタン付きで処理されるように連携）
    await handleQuestCommand(interaction);
    return true;
  }

  // 4. マップ表示
  if (customId === 'adventure_map') {
    await handleMapCommand(interaction);
    return true;
  }

  return false; // メニュー系のIDでなかった場合はindex.jsへ返す
}