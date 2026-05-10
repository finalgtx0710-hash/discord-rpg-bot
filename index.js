// index.js
import 'dotenv/config';
import {
  Client, GatewayIntentBits, Events,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, EmbedBuilder, MessageFlags
} from 'discord.js';
import { initDatabase, getPlayer, createPlayer, updatePlayer } from './src/database/db.js';
import { CLASSES, AREAS, ITEMS } from './src/data/master.js';
import { buildStatusEmbed } from './src/commands/rpg.js';
import { isInBattle, processBattleAction, getBattleStatus } from './src/game/battle.js';
import { handleShopBuy, handleShopSell, handleInnButton } from './src/commands/shopHandler.js';
import { handleEquipSelect } from './src/commands/equipHandler.js';
import { handleQuestAccept, buildQuestCompleteMessage } from './src/commands/questHandler.js';
import { handleClassChangeButton } from './src/commands/classChangeHandler.js';
import { handleStoryRead, handleStoryEnd } from './src/commands/storyHandler.js';
import { handleBossAction } from './src/commands/bossHandler.js';
import { handlePartyButton } from './src/commands/partyHandler.js';
import { handleMoveButton } from './src/commands/moveHandler.js';

import { buildMainMenu } from './src/ui/menus/mainMenu.js';
import { handleMenuInteraction } from './src/ui/handlers/menuHandler.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ ログイン成功: ${c.user.tag}`);
  await initDatabase();
  console.log('🎮 エーテリオン・クロニクル 起動完了！');
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // スラッシュコマンド
    if (interaction.isChatInputCommand() && interaction.commandName === 'rpg') {
      const sub = interaction.options.getSubcommand();
      const userId = interaction.user.id;
      if (sub === 'start') {
        if (!getPlayer(userId)) {
          const select = new StringSelectMenuBuilder()
            .setCustomId('select_class').setPlaceholder('職業を選んでください')
            .addOptions(Object.entries(CLASSES).map(([key, cls]) => ({
              label: cls.name, value: key, description: cls.description.substring(0, 50), emoji: cls.emoji,
            })));
          return await interaction.reply({
            embeds: [new EmbedBuilder().setColor(0x1F3864).setTitle('⚔️ エーテリオン・クロニクル')
              .setDescription('職業を選んで冒険を開始してください。')],
            components: [new ActionRowBuilder().addComponents(select)],
            flags: [MessageFlags.Ephemeral], // 修正箇所
          });
        }
        return await interaction.reply({ ...buildMainMenu(userId) });
      }
    }

    // ボタン操作
    if (interaction.isButton()) {
      const handled = await handleMenuInteraction(interaction);
      if (handled) return;

      const userId = interaction.user.id;
      const customId = interaction.customId;

      if (customId.startsWith('battle_')) {
        const [actionFull, enemyKey] = customId.split(':');
        const action = actionFull.replace('battle_', '');
        if (!isInBattle(userId)) return await interaction.reply({ content: '⚠️ 戦闘中ではありません。', flags: [MessageFlags.Ephemeral] });

        const result = await processBattleAction(userId, action);
        if (!result) return;

        const player = getPlayer(userId);
        let description = `${result.playerAction}\n${result.enemyAction || ''}`;

        if (result.battleEnd) {
          const backRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('back_main').setLabel('◀ メインメニューへ').setStyle(ButtonStyle.Primary)
          );
          let color = result.victory ? 0x00CC44 : 0x333333;
          if (result.victory) {
            description += `\n\n🎉 勝利！ EXP+${result.rewards.exp} GOLD+${result.rewards.gold}`;
          }
          return await interaction.update({
            embeds: [new EmbedBuilder().setColor(color).setTitle('⚔️ 戦闘終了').setDescription(description)],
            components: [backRow]
          });
        }

        const battle = getBattleStatus(userId);
        return await interaction.update({
          embeds: [new EmbedBuilder().setColor(0xC00000).setTitle('⚔️ 戦闘中').setDescription(description)
            .addFields(
              { name: '自分HP', value: `${player.hp}/${player.max_hp}`, inline: true },
              { name: '敵HP', value: `${battle.enemy.currentHp}/${battle.enemy.hp}`, inline: true }
            )],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`battle_attack:${enemyKey}`).setLabel('⚔️ 攻撃').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`battle_skillmenu:${enemyKey}`).setLabel('✨ スキル').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`battle_escape:${enemyKey}`).setLabel('💨 逃走').setStyle(ButtonStyle.Secondary),
          )]
        });
      }

      if (customId.startsWith('move_area:')) return await handleMoveButton(interaction);
      if (customId === 'inn_rest' || customId === 'inn_cancel') return await handleInnButton(interaction);
      if (customId.startsWith('classchange_')) return await handleClassChangeButton(interaction);
      if (customId.startsWith('story_')) return await handleStoryRead(interaction);
      if (customId.startsWith('boss_')) return await handleBossAction(interaction);
      if (customId.startsWith('pbattle_') || customId.startsWith('party_')) return await handlePartyButton(interaction);
    }

    // セレクトメニュー
    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;
      if (customId === 'select_class') {
        const player = createPlayer(interaction.user.id, interaction.user.username, interaction.values[0]);
        return await interaction.update({ embeds: [buildStatusEmbed(player)], components: [] });
      }
      if (customId === 'quest_accept') return await handleQuestAccept(interaction);
      if (customId === 'shop_buy') return await handleShopBuy(interaction);
      if (customId === 'shop_sell') return await handleShopSell(interaction);
      if (customId === 'equip_select') return await handleEquipSelect(interaction);
    }

  } catch (error) {
    console.error("Interaction Error:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ エラーが発生しました。', flags: [MessageFlags.Ephemeral] }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);