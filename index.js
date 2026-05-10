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

  // ===== スラッシュコマンド =====
  if (interaction.isChatInputCommand() && interaction.commandName === 'rpg') {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (sub === 'start') {
      const wait = checkCooldown(userId, 'start');
      if (wait) return interaction.reply({ content: `⏳ ${wait}秒後に再試行してください。`, ephemeral: true });

      if (!getPlayer(userId)) {
        // 新規プレイヤー：クラス選択
        const select = new StringSelectMenuBuilder()
          .setCustomId('select_class').setPlaceholder('職業を選んでください')
          .addOptions(Object.entries(CLASSES).map(([key, cls]) => ({
            label: cls.name, value: key, description: cls.description.substring(0, 50), emoji: cls.emoji,
          })));
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x1F3864).setTitle('⚔️ エーテリオン・クロニクルへようこそ！')
            .setDescription('世界は「エーテル結晶」の力で維持されてきたが、各地で結晶が消え始めている…\n\nあなたは謎を解くべく旅立つ冒険者。まず**職業**を選んでください。')
            .setFooter({ text: 'Etherion Chronicle' })],
          components: [new ActionRowBuilder().addComponents(select)],
          ephemeral: true,
        });
      } else {
        // 既存プレイヤー：メインメニュー表示
        await interaction.reply({ ...buildMainMenu(userId), ephemeral: false });
      }
    }
  }

  // ===== セレクトメニュー: クラス選択 =====
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_class') {
    const userId = interaction.user.id;
    const selectedClass = interaction.values[0];
    const name = interaction.user.displayName || interaction.user.username;
    if (getPlayer(userId)) return interaction.update({ content: '⚠️ すでにキャラクターが存在します。', components: [], embeds: [] });
    const player = createPlayer(userId, name, selectedClass);
    const embed = buildStatusEmbed(player);
    embed.setTitle(`🎉 ${name} の冒険が始まった！`);
    embed.setDescription(`職業: **${CLASSES[selectedClass].name}**\n\n\`/rpg start\` でメインメニューを開けます！`);
    await interaction.update({ embeds: [embed], components: [] });
  }

  // ===== ボタン: メニュー系 =====
  if (interaction.isButton()) {
    const handled = await handleMenuInteraction(interaction).catch(() => false);
    if (handled) return;
  }

  // ===== セレクトメニュー =====
  if (interaction.isStringSelectMenu() && interaction.customId === 'quest_accept') { await handleQuestAccept(interaction); return; }
  if (interaction.isStringSelectMenu() && interaction.customId === 'equip_select') { await handleEquipSelect(interaction); return; }
  if (interaction.isStringSelectMenu() && interaction.customId === 'shop_buy') { await handleShopBuy(interaction); return; }
  if (interaction.isStringSelectMenu() && interaction.customId === 'shop_sell') { await handleShopSell(interaction); return; }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('battle_skill_select:')) {
    const userId = interaction.user.id;
    const value = interaction.values[0];
    const [skillId, enemyKey] = value.split(':');
    if (!isInBattle(userId)) return interaction.reply({ content: '⚠️ 戦闘状態ではありません。', ephemeral: true });
    const { SKILLS } = await import('./src/game/skills.js');
    const player = getPlayer(userId);
    const battle = getBattleStatus(userId);
    const skill = SKILLS[skillId];
    if (!skill) return interaction.reply({ content: '⚠️ スキルが見つかりません。', ephemeral: true });
    if (player.mp < skill.mp_cost) return interaction.reply({ content: `⚠️ MPが足りません！（必要MP: ${skill.mp_cost} / 現在MP: ${player.mp}）`, ephemeral: true });
    const newMp = player.mp - skill.mp_cost;
    const hits = skill.hits || 1;
    let totalDamage = 0;
    const { calcEquippedStats } = await import('./src/data/master.js');
    const stats = calcEquippedStats(player);
    for (let i = 0; i < hits; i++) {
      const base = Math.max(1, Math.floor(stats.atk * skill.damage_mult) - Math.floor(battle.enemy.def * 0.5));
      const v = Math.floor(base * 0.1);
      totalDamage += base + Math.floor(Math.random() * (v * 2 + 1)) - v;
    }
    let healAmount = 0;
    let description = '';
    if (skill.type === 'heal') {
      healAmount = skill.heal_amount || 60;
      totalDamage = 0;
      description = `✨ **${skill.name}**！HPを **${healAmount}** 回復！`;
    } else {
      battle.enemy.currentHp = Math.max(0, battle.enemy.currentHp - totalDamage);
      description = hits > 1 ? `✨ **${skill.name}**！${hits}回攻撃で合計 **${totalDamage}** ダメージ！` : `✨ **${skill.name}**！**${totalDamage}** ダメージ！`;
      if (skill.type === 'hybrid') { healAmount = skill.heal_amount || 0; }
    }
    const newHp = Math.min(player.max_hp, player.hp + healAmount - (skill.self_damage || 0));
    updatePlayer(userId, { mp: newMp, hp: newHp });
    await interaction.reply({ content: `${description}\n残りMP: ${newMp}`, ephemeral: true });
    return;
  }

  // ===== ボタン: エリア移動 =====
  if (interaction.isButton() && interaction.customId.startsWith('move_area:')) { await handleMoveButton(interaction); return; }

  // ===== ボタン: パーティ戦闘 =====
  if (interaction.isButton() && interaction.customId.startsWith('pbattle_')) {
    const parts = interaction.customId.split(':');
    const action = parts[0].replace('pbattle_', '');
    const partyId = parts[1];
    const enemyKey = parts[2];
    const userId = interaction.user.id;
    const battle = getPartyBattle(partyId);
    if (!battle) return interaction.reply({ content: '⚠️ この戦闘はすでに終了しています。', ephemeral: true });
    const party = getPartyById(partyId);
    if (!party) return interaction.reply({ content: '⚠️ パーティが見つかりません。', ephemeral: true });
    if (battle.memberActions[userId]) {
      const an = { attack: '⚔️ 攻撃', skill: '✨ スキル', item: '🧪 アイテム' };
      return interaction.reply({ content: `⏳ 行動登録済み（**${an[battle.memberActions[userId]]}**）。他のメンバーを待っています…`, ephemeral: true });
    }
    registerAction(partyId, userId, action);
    const player = getPlayer(userId);
    const an = { attack: '⚔️ 攻撃', skill: '✨ スキル', item: '🧪 アイテム' };
    await interaction.reply({ content: `✅ **${player?.name}** の行動：**${an[action]}** を登録！他のメンバーを待っています…`, ephemeral: true });
    if (allActionsReady(partyId, party.members)) {
      const result = processPartyTurn(partyId);
      const logText = result.logs.join('\n');
      if (result.victory) {
        const rewardLines = result.rewards.memberRewards.map(r => { const lv = r.levelUpMessages.length > 0 ? `\n${r.levelUpMessages.join(' ')}` : ''; return `**${r.name}**：EXP +${r.exp} / GOLD +${r.gold}G${lv}`; }).join('\n');
        const itemLine = result.rewards.items.length > 0 ? `\n📦 ドロップ: ${result.rewards.items.map(k => ITEMS[k]?.name || k).join(', ')}` : '';
        await interaction.message.edit({ embeds: [new EmbedBuilder().setColor(0x00CC44).setTitle('🎉 パーティ戦闘勝利！').setDescription(`${logText}\n\n**— 報酬 —**\n${rewardLines}${itemLine}`)], components: [] });
      } else if (result.allDead) {
        await interaction.message.edit({ embeds: [new EmbedBuilder().setColor(0x333333).setTitle('💀 パーティ全滅…').setDescription(`${logText}\n\n全員の所持金が半分になり、始まりの村に戻った。`)], components: [] });
      } else {
        const enemy = result.enemy;
        const ml = party.members.map(uid => { const p = getPlayer(uid); return p ? `⏳ **${p.name}** HP:${p.hp}/${p.max_hp}` : `<@${uid}>`; }).join('\n');
        await interaction.message.edit({
          embeds: [new EmbedBuilder().setColor(0xC00000).setTitle(`⚔️ パーティ戦闘 ターン${battle.turn}`).setDescription(`${logText}\n\n**— メンバー状況 —**\n${ml}\n\n⏳ 行動を選択してください`).addFields({ name: '敵HP', value: `${enemy.currentHp} / ${enemy.hp}`, inline: true })],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`pbattle_attack:${partyId}:${enemyKey}`).setLabel('⚔️ 攻撃').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`pbattle_skill:${partyId}:${enemyKey}`).setLabel('✨ スキル').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`pbattle_item:${partyId}:${enemyKey}`).setLabel('🧪 アイテム').setStyle(ButtonStyle.Success),
          )]
        });
      }
    }
    return;
  }

  // ===== ボタン: パーティ招待 =====
  if (interaction.isButton() && (interaction.customId.startsWith('party_accept:') || interaction.customId.startsWith('party_decline:'))) { await handlePartyButton(interaction); return; }

  // ===== ボタン: 宿屋 =====
  if (interaction.isButton() && (interaction.customId === 'inn_rest' || interaction.customId === 'inn_cancel')) { await handleInnButton(interaction); return; }

  // ===== ボタン: クラスチェンジ =====
  if (interaction.isButton() && (interaction.customId.startsWith('classchange_confirm:') || interaction.customId === 'classchange_cancel')) { await handleClassChangeButton(interaction); return; }

  // ===== ボタン: ストーリー =====
  if (interaction.isButton() && interaction.customId.startsWith('story_read:')) { await handleStoryRead(interaction); return; }
  if (interaction.isButton() && interaction.customId === 'story_end') { await handleStoryEnd(interaction); return; }

  // ===== ボタン: ボス戦 =====
  if (interaction.isButton() && interaction.customId.startsWith('boss_start:')) { await handleBossChallenge(interaction); return; }
  if (interaction.isButton() && interaction.customId.startsWith('boss_action:')) { await handleBossAction(interaction); return; }

  // ===== ボタン: スキルメニュー =====
  if (interaction.isButton() && interaction.customId.startsWith('battle_skillmenu:')) {
    const userId = interaction.user.id;
    const enemyKey = interaction.customId.replace('battle_skillmenu:', '');
    const player = getPlayer(userId);
    if (!player) return interaction.reply({ content: '⚠️ キャラクターが見つかりません。', ephemeral: true });
    const { getLearnedSkills } = await import('./src/game/skills.js');
    const learned = getLearnedSkills(player);
    if (learned.length === 0) return interaction.reply({ content: '⚠️ 習得済みスキルがありません。', ephemeral: true });
    const select = new StringSelectMenuBuilder()
      .setCustomId(`battle_skill_select:${enemyKey}`)
      .setPlaceholder('使用するスキルを選んでください')
      .addOptions(learned.map(s => ({ label: `${s.name} (MP ${s.mp_cost})`, value: `${s.id}:${enemyKey}`, description: s.description.substring(0, 50) })));
    return interaction.reply({ components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
  }

  // ===== ボタン: ソロ戦闘 =====
  if (interaction.isButton() && interaction.customId.startsWith('battle_')) {
    const userId = interaction.user.id;
    const [actionFull, enemyKey] = interaction.customId.split(':');
    const action = actionFull.replace('battle_', '');
    if (!isInBattle(userId)) return interaction.reply({ content: '⚠️ 戦闘状態ではありません。`/rpg start` でメインメニューを開いて探索してください。', ephemeral: true });
    const wait = checkCooldown(userId, 'battle', 1500);
    if (wait) return interaction.reply({ content: '⏳ 少し待ってください。', ephemeral: true });
    const result = await processBattleAction(userId, action);
    if (!result) return interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
    const player = getPlayer(userId);
    let description = `${result.playerAction}\n${result.enemyAction || ''}`;
    if (result.battleEnd) {
      if (result.victory) {
        const { exp, gold, items, levelUpMessages } = result.rewards;
        description += `\n\n🎉 勝利！\n✨ EXP +**${exp}** | 💰 GOLD +**${gold}**`;
        if (result.rewards.completedQuests?.length) description += buildQuestCompleteMessage(result.rewards.completedQuests);
        if (items.length > 0) description += `\n📦 ドロップ: ${items.map(k => ITEMS[k]?.name || k).join(', ')}`;
        if (levelUpMessages.length > 0) description += '\n\n' + levelUpMessages.join('\n');
        return interaction.update({ embeds: [new EmbedBuilder().setColor(0x00CC44).setTitle('⚔️ 戦闘終了 - 勝利！').setDescription(description).setFooter({ text: 'Etherion Chronicle' })], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_adventure').setLabel('◀ 冒険メニューへ').setStyle(ButtonStyle.Secondary))] });
      } else if (result.playerDied) {
        description += `\n\n💀 **${player?.name}**は倒れた…\n所持金が半分になり、始まりの村に戻った。`;
        return interaction.update({ embeds: [new EmbedBuilder().setColor(0x333333).setTitle('💀 戦闘終了 - 敗北').setDescription(description).setFooter({ text: 'Etherion Chronicle' })], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_adventure').setLabel('◀ 冒険メニューへ').setStyle(ButtonStyle.Secondary))] });
      } else {
        return interaction.update({ embeds: [new EmbedBuilder().setColor(0x666666).setTitle('💨 逃走成功').setDescription(description).setFooter({ text: 'Etherion Chronicle' })], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_adventure').setLabel('◀ 冒険メニューへ').setStyle(ButtonStyle.Secondary))] });
      }
    }
    const battle = getBattleStatus(userId);
    await interaction.update({
      embeds: [new EmbedBuilder().setColor(0xC00000).setTitle('⚔️ 戦闘中').setDescription(description)
        .addFields({ name: '自分のHP', value: `${player.hp}/${player.max_hp}`, inline: true }, { name: '敵のHP', value: `${battle.enemy.currentHp}/${battle.enemy.hp}`, inline: true })
        .setFooter({ text: 'Etherion Chronicle' })],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`battle_attack:${enemyKey}`).setLabel('⚔️ 攻撃').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`battle_skillmenu:${enemyKey}`).setLabel('✨ スキル').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`battle_item:${enemyKey}`).setLabel('🧪 アイテム').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`battle_escape:${enemyKey}`).setLabel('💨 逃走').setStyle(ButtonStyle.Secondary),
      )]
    });
  }
});

client.login(process.env.DISCORD_TOKEN);