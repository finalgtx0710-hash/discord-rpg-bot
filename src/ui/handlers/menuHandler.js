import { buildMainMenu } from '../menus/mainMenu.js';
import { buildAdventureMenu } from '../menus/adventureMenu.js';
import { buildTownMenu } from '../menus/townMenu.js';
import { buildCharacterMenu } from '../menus/characterMenu.js';
import { buildStoryMenu } from '../menus/storyMenu.js';
import { buildRecordsMenu } from '../menus/recordsMenu.js';
import { handleQuestCommand } from '../../commands/questHandler.js';
import { handleMapCommand } from '../../commands/moveHandler.js';
// 他のハンドラーも必要に応じてインポート

const MENU_MAP = {
  back_main: (interaction) => buildMainMenu(interaction.user.id),
  menu_adventure: () => buildAdventureMenu(),
  menu_town: () => buildTownMenu(),
  menu_character: () => buildCharacterMenu(),
  menu_story: (interaction) => buildStoryMenu(interaction.user.id),
  menu_records: () => buildRecordsMenu(),
};

export async function handleMenuInteraction(interaction) {
  const handler = MENU_MAP[interaction.customId];
  if (handler) {
    const response = await handler(interaction);
    await interaction.update(response);
    return true;
  }

  // クエストなどの特殊コマンド呼び出し
  if (interaction.customId === 'adventure_quest') {
    interaction.options = { getString: () => 'board' };
    await handleQuestCommand(interaction);
    return true;
  }
  
  if (interaction.customId === 'adventure_map') {
    await handleMapCommand(interaction);
    return true;
  }

  return false;
}