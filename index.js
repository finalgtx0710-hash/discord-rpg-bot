// index.js
import 'dotenv/config';
import {
  Client, GatewayIntentBits, Events,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, EmbedBuilder
} from 'discord.js';
import { initDatabase, getPlayer, createPlayer, updatePlayer, getRanking } from './src/database/db.js';
import { CLASSES, AREAS, ITEMS } from './src/data/master.js';
import { buildStatusEmbed } from './src/commands/rpg.js';
import { startBattle, isInBattle, processBattleAction, getBattleStatus } from './src/game/battle.js';
import { explore, canExplore } from './src/game/explore.js';
import { handlePartyCommand, handlePartyButton } from './src/commands/partyHandler.js';
import { handleShopCommand, handleShopBuy, handleShopSell, handleInnCommand, handleInnButton } from './src/commands/shopHandler.js';
import { handleEquipCommand, handleEquipSelect } from './src/commands/equipHandler.js';
import { handleMapCommand, handleMoveButton } from './src/commands/moveHandler.js';
import { handleQuestCommand, handleQuestAccept, buildQuestCompleteMessage } from './src/commands/questHandler.js';
import { handleClassChangeCommand, handleClassChangeButton } from './src/commands/classChangeHandler.js';
import { handleSkillCommand } from './src/commands/skillHandler.js';
import { handleStoryCommand, handleStoryRead, handleStoryEnd } from './src/commands/storyHandler.js';
import { handleAchievementCommand } from './src/commands/achievementHandler.js';
import { handleBossCommand, handleBossChallenge, handleBossAction } from './src/commands/bossHandler.js';
import {
  startPartyBattle, isInPartyBattle, getPartyBattle,
  registerAction, allActionsReady, processPartyTurn
} from './src/game/partyBattle.js';
import { getParty, getPartyById } from './src/game/party.js';
import { IMAGES } from './src/data/images.js';
import { buildMainMenu } from './src/ui/menus/mainMenu.js';
import { handleMenuInteraction } from './src/ui/handlers/menuHandler.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const cooldowns = new Map();
function checkCooldown(userId, cmd, ms = 5000) {
  const key = `${userId}:${cmd}`;
  const last = cooldowns.get(key);
  if (last && Date.now() - last < ms) return Math.ceil((ms - (Date.now() - last)) / 1000);
  cooldowns.set(key, Date.now());
  return 0;
}

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ ログイン成功: ${c.user.tag}`);
  await initDatabase();
  console.log('🎮 エーテリオン・クロニクル 起動完了！');
});

client.on(Events.InteractionCreate, async (interaction) => {
  // 1. スラッシュコマンド処理
  if (interaction.isChatInputCommand() && interaction.commandName === 'rpg') {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (sub === 'start') {
      const wait = checkCooldown(userId, 'start');
      if (wait) return interaction.reply({ content: `⏳ ${wait}秒後に再試行してください。`, ephemeral: true });

      if (!getPlayer(userId)) {
        const select = new StringSelectMenuBuilder()
          .setCustomId('select_class').setPlaceholder('職業を選んでください')
          .addOptions(Object.entries(CLASSES).map(([key, cls]) => ({
            label: cls.name, value: key, description: cls.description.substring(0, 50), emoji: cls.emoji,
          })));
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x1F3864).setTitle('⚔️ エーテリオン・クロニクルへようこそ！')
            .setDescription('あなたは謎を解くべく旅立つ冒険者。まず**職業**を選んでください。')
            .setFooter({ text: 'Etherion Chronicle' })],
          components: [new ActionRowBuilder().addComponents(select)],
          ephemeral: true,
        });
      } else {
        await interaction.reply({ ...buildMainMenu(userId), ephemeral: false });
      }
      return;
    }
  }

  // 2. ボタン操作の処理
  if (interaction.isButton()) {
    // UIメニューハンドラーを優先
    const handled = await handleMenuInteraction(interaction).catch(err => {
      console.error("Menu Interaction Error:", err);
      return false;
    });
    if (handled) return;

    // 以下、menuHandler 以外の個別ボタン処理
    const userId = interaction.user.id;
    const customId = interaction.customId;

    // --- ソロ戦闘アクション ---
    if (customId.startsWith('battle_')) {
      const [actionFull, enemyKey] = customId.split(':');
      const action = actionFull.replace('battle_', '');

      if (!isInBattle(userId)) return interaction.reply({ content: '⚠️ 戦闘状態ではありません。', ephemeral: true });

      const wait = checkCooldown(userId, 'battle', 1500);
      if (wait) return interaction.reply({ content: '⏳ 少し待ってください。', ephemeral: true });

      const result = await processBattleAction(userId, action);
      if (!result) return;

      const player = getPlayer(userId);
      let description = `${result.playerAction}\n${result.enemyAction || ''}`;

      // 戦闘終了判定
      if (result.battleEnd) {
        const backRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('back_main').setLabel('◀ メインメニューへ').setStyle(ButtonStyle.Primary)
        );

        if (result.victory) {
          const { exp, gold, items, levelUpMessages } = result.rewards;
          description += `\n\n🎉 勝利！\n✨ EXP +**${exp}** | 💰 GOLD +**${gold}**`;
          if (result.rewards.completedQuests?.length) description += buildQuestCompleteMessage(result.rewards.completedQuests);
          if (items.length > 0) description += `\n📦 ドロップ: ${items.map(k => ITEMS[k]?.name || k).join(', ')}`;
          if (levelUpMessages.length > 0) description += '\n\n' + levelUpMessages.join('\n');

          return interaction.update({
            embeds: [new EmbedBuilder().setColor(0x00CC44).setTitle('⚔️ 戦闘勝利！').setDescription(description)],
            components: [backRow]
          });
        } else if (result.playerDied) {
          description += `\n\n💀 倒れた…所持金が半分になり村に戻りました。`;
          return interaction.update({
            embeds: [new EmbedBuilder().setColor(0x333333).setTitle('💀 敗北').setDescription(description)],
            components: [backRow]
          });
        } else {
          return interaction.update({
            embeds: [new EmbedBuilder().setColor(0x666666).setTitle('💨 逃走成功').setDescription(description)],
            components: [backRow]
          });
        }
      }

      // 戦闘継続
      const battle = getBattleStatus(userId);
      await interaction.update({
        embeds: [new EmbedBuilder().setColor(0xC00000).setTitle('⚔️ 戦闘中').setDescription(description)
          .addFields(
            { name: '自分のHP', value: `${player.hp}/${player.max_hp}`, inline: true },
            { name: '敵のHP', value: `${battle.enemy.currentHp}/${battle.enemy.hp}`, inline: true }
          )],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`battle_attack:${enemyKey}`).setLabel('⚔️ 攻撃').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`battle_skillmenu:${enemyKey}`).setLabel('✨ スキル').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`battle_item:${enemyKey}`).setLabel('🧪 アイテム').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`battle_escape:${enemyKey}`).setLabel('💨 逃走').setStyle(ButtonStyle.Secondary),
        )]
      });
      return;
    }

    // パーティ、宿屋、クラスチェンジ等のその他ボタン
    if (customId.startsWith('pbattle_')) { await handlePartyButton(interaction); return; }
    if (customId.startsWith('party_')) { await handlePartyButton(interaction); return; }
    if (customId === 'inn_rest' || customId === 'inn_cancel') { await handleInnButton(interaction); return; }
    if (customId.startsWith('classchange_')) { await handleClassChangeButton(interaction); return; }
    if (customId.startsWith('story_')) { await handleStoryRead(interaction); return; }
    if (customId.startsWith('boss_')) { await handleBossAction(interaction); return; }
  }

  // 3. セレクトメニュー操作の処理
  if (interaction.isStringSelectMenu()) {
    const customId = interaction.customId;
    if (customId === 'select_class') {
      const userId = interaction.user.id;
      const selectedClass = interaction.values[0];
      if (getPlayer(userId)) return interaction.update({ content: '⚠️ すでにキャラクターが存在します。', components: [], embeds: [] });
      const player = createPlayer(userId, interaction.user.username, selectedClass);
      const embed = buildStatusEmbed(player);
      await interaction.update({ embeds: [embed], components: [] });
    }
    if (customId === 'quest_accept') { await handleQuestAccept(interaction); return; }
    if (customId === 'equip_select') { await handleEquipSelect(interaction); return; }
    if (customId === 'shop_buy') { await handleShopBuy(interaction); return; }
    if (customId === 'shop_sell') { await handleShopSell(interaction); return; }
  }
});

client.login(process.env.DISCORD_TOKEN);