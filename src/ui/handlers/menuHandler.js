import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';
import { buildMainMenu } from '../menus/mainMenu.js';
import { buildAdventureMenu } from '../menus/adventureMenu.js';
import { buildTownMenu } from '../menus/townMenu.js';
import { buildCharacterMenu } from '../menus/characterMenu.js';
import { buildStoryMenu } from '../menus/storyMenu.js';
import { buildRecordsMenu } from '../menus/recordsMenu.js';
import { handleQuestCommand } from '../../commands/questHandler.js';
import { handleMapCommand } from '../../commands/moveHandler.js';
import { explore, canExplore } from '../../game/explore.js';
import { getPlayer } from '../../database/db.js';

// ボタンIDとメニュー生成関数のマッピング
const MENU_MAP = {
  back_main: (userId) => buildMainMenu(userId),
  menu_adventure: () => buildAdventureMenu(),
  menu_town: () => buildTownMenu(),
  menu_character: () => buildCharacterMenu(),
  menu_story: (userId) => buildStoryMenu(userId),
  menu_records: () => buildRecordsMenu(),
};

/**
 * 全てのボタン・メニュー操作を統合管理するハンドラー
 */
export async function handleMenuInteraction(interaction) {
  const { customId, user } = interaction;
  const userId = user.id;

  // 1. 基本的なメニュー遷移
  if (MENU_MAP[customId]) {
    const response = await MENU_MAP[customId](userId);
    await interaction.update(response);
    return true;
  }

  // 2. 冒険メニュー内の個別アクション
  
  // --- 探索 ---
  if (customId === 'adventure_explore') {
    const { ok, remaining } = canExplore(userId);
    
    // 戻るボタンの定義（詰み防止）
    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('back_main')
        .setLabel('◀ メインメニューへ')
        .setStyle(ButtonStyle.Secondary)
    );

    if (!ok) {
      return interaction.update({ 
        content: `⏳ 探索クールダウン中… あと **${remaining}秒** 待ってください。`, 
        embeds: [], 
        components: [backRow] 
      });
    }

    // 探索実行（結果は explore 関数内で interaction.update する想定）
    await explore(interaction);
    return true;
  }

  // --- クエストボード ---
  if (customId === 'adventure_quest') {
    // クエストハンドラーに処理を委譲（内部で戻るボタンを付与済み）
    await handleQuestCommand(interaction);
    return true;
  }

  // --- マップ移動 ---
  if (customId === 'adventure_map') {
    await handleMapCommand(interaction);
    return true;
  }

  // 3. 街メニュー内の個別アクション（必要に応じて追記）
  // if (customId === 'town_shop') { ... }

  return false;
}