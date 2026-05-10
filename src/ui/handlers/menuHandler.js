import { buildMainMenu } from '../menus/mainMenu.js';
import { buildAdventureMenu } from '../menus/adventureMenu.js';
import { buildTownMenu } from '../menus/townMenu.js';
import { buildCharacterMenu } from '../menus/characterMenu.js';
import { buildStoryMenu } from '../menus/storyMenu.js';
import { buildRecordsMenu } from '../menus/recordsMenu.js';
import { handleShopCommand, handleInnCommand } from '../../commands/shopHandler.js';
import { handleEquipCommand } from '../../commands/equipHandler.js';
import { handleClassChangeCommand } from '../../commands/classChangeHandler.js';
import { handleSkillCommand } from '../../commands/skillHandler.js';
import { handleMapCommand } from '../../commands/moveHandler.js';
import { handleQuestCommand } from '../../commands/questHandler.js';
import { handlePartyCommand } from '../../commands/partyHandler.js';
import { handleBossCommand } from '../../commands/bossHandler.js';
import { handleAchievementCommand } from '../../commands/achievementHandler.js';
import { buildStatusEmbed } from '../../commands/rpg.js';
import { getPlayer, getRanking } from '../../database/db.js';
import { CLASSES, ITEMS } from '../../data/master.js';
import { EmbedBuilder } from 'discord.js';
import { explore, canExplore } from '../../game/explore.js';
import { startBattle, isInBattle } from '../../game/battle.js';
import { getParty, getPartyById } from '../../game/party.js';
import { startPartyBattle, isInPartyBattle } from '../../game/partyBattle.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { AREAS } from '../../data/master.js';
import { IMAGES } from '../../data/images.js';

// メニューIDとハンドラのマップ
const MENU_MAP = {
  // メインメニューへ戻る
  back_main: async (interaction) => {
    await interaction.update(buildMainMenu(interaction.user.id));
  },

  // 冒険メニュー
  menu_adventure: async (interaction) => {
    await interaction.update(buildAdventureMenu());
  },

  // 街メニュー
  menu_town: async (interaction) => {
    await interaction.update(buildTownMenu());
  },

  // キャラクターメニュー
  menu_character: async (interaction) => {
    await interaction.update(buildCharacterMenu());
  },

  // ストーリーメニュー
  menu_story: async (interaction) => {
    await interaction.update(buildStoryMenu(interaction.user.id));
  },

  // 記録メニュー
  menu_records: async (interaction) => {
    await interaction.update(buildRecordsMenu());
  },

  // 冒険サブメニュー
  adventure_explore: async (interaction) => {
    const userId = interaction.user.id;
    const player = getPlayer(userId);
    if (!player) return interaction.update({ content: '⚠️ キャラクターが見つかりません。', embeds: [], components: [] });
    if (isInBattle(userId)) return interaction.update({ content: '⚔️ ソロ戦闘中は探索できません！', embeds: [], components: [] });

    const partyCheck = getParty(userId);
    if (partyCheck && isInPartyBattle(partyCheck.party_id)) return interaction.update({ content: '⚔️ パーティが戦闘中です！', embeds: [], components: [] });
    if (partyCheck && partyCheck.members.length > 1 && partyCheck.leader_id !== userId) return interaction.update({ content: '👑 パーティ探索はリーダーのみ開始できます！', embeds: [], components: [] });

    const { ok, remaining } = canExplore(userId);
    if (!ok) return interaction.update({ content: `⏳ 探索クールダウン中… あと **${remaining}秒** 待ってください。`, embeds: [], components: [] });

    const party = getParty(userId);
    const area = AREAS[player.current_area];
    const event = explore(userId, player.current_area);

    if (event.type === 'battle') {
      if (party && party.members.length > 1) {
        const enemy = startPartyBattle(party.party_id, event.enemyKey, party.members.length);
        const memberLines = party.members.map(uid => {
          const p = getPlayer(uid);
          return p ? `⏳ **${p.name}** HP:${p.hp}/${p.max_hp}` : `<@${uid}>`;
        }).join('\n');
        const embed = new EmbedBuilder().setColor(0xC00000).setTitle('⚔️ パーティエンカウント！')
          .setDescription(`**${area.name}**を探索中… **${enemy.name}**が現れた！\n敵HP: **${enemy.currentHp}**\n\n${memberLines}\n\n⏳ 全員が行動を選択すると一斉に処理されます！`)
          .setThumbnail(IMAGES.enemies[event.enemyKey] || null)
          .setFooter({ text: 'Etherion Chronicle' });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`pbattle_attack:${party.party_id}:${event.enemyKey}`).setLabel('⚔️ 攻撃').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`pbattle_skill:${party.party_id}:${event.enemyKey}`).setLabel('✨ スキル').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`pbattle_item:${party.party_id}:${event.enemyKey}`).setLabel('🧪 アイテム').setStyle(ButtonStyle.Success),
        );
        await interaction.update({ embeds: [embed], components: [row] });
      } else {
        const embed = new EmbedBuilder().setColor(0xC00000).setTitle('⚔️ エンカウント！')
          .setDescription(`**${area.name}**を探索中… **${event.enemy.name}**が現れた！\nHP: ${event.enemy.hp}`)
          .setThumbnail(IMAGES.enemies[event.enemyKey] || null)
          .setFooter({ text: '行動を選択してください' });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`battle_attack:${event.enemyKey}`).setLabel('⚔️ 攻撃').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`battle_skillmenu:${event.enemyKey}`).setLabel('✨ スキル').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`battle_item:${event.enemyKey}`).setLabel('🧪 アイテム').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`battle_escape:${event.enemyKey}`).setLabel('💨 逃走').setStyle(ButtonStyle.Secondary),
        );
        await interaction.update({ embeds: [embed], components: [row] });
      }
    } else if (event.type === 'treasure') {
      if (party && party.members.length > 1) {
        const share = Math.floor(event.gold / party.members.length);
        for (const uid of party.members) { const p = getPlayer(uid); if (p) { const { updatePlayer } = await import('../../database/db.js'); updatePlayer(uid, { gold: p.gold + share }); } }
        await interaction.update({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('💰 宝箱発見！（パーティ山分け）').setDescription(`**${event.gold}G** を山分け！一人あたり **${share}G**`).setThumbnail(IMAGES.events.treasure).setFooter({ text: 'Etherion Chronicle' })], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_adventure').setLabel('◀ 冒険メニューへ').setStyle(ButtonStyle.Secondary))] });
      } else {
        const { updatePlayer } = await import('../../database/db.js');
        updatePlayer(userId, { gold: player.gold + event.gold });
        await interaction.update({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('💰 宝箱発見！').setDescription(`**${event.gold}G** を手に入れた！`).setThumbnail(IMAGES.events.treasure).setFooter({ text: 'Etherion Chronicle' })], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_adventure').setLabel('◀ 冒険メニューへ').setStyle(ButtonStyle.Secondary))] });
      }
    } else if (event.type === 'heal') {
      const { updatePlayer } = await import('../../database/db.js');
      if (party && party.members.length > 1) {
        for (const uid of party.members) { const p = getPlayer(uid); if (p) updatePlayer(uid, { hp: Math.min(p.max_hp, p.hp + event.heal) }); }
        await interaction.update({ embeds: [new EmbedBuilder().setColor(0x00CC44).setTitle('✨ 回復の泉（全員回復）').setDescription(`パーティ全員のHPが **${event.heal}** 回復した！`).setThumbnail(IMAGES.events.heal).setFooter({ text: 'Etherion Chronicle' })], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_adventure').setLabel('◀ 冒険メニューへ').setStyle(ButtonStyle.Secondary))] });
      } else {
        const newHp = Math.min(player.max_hp, player.hp + event.heal);
        updatePlayer(userId, { hp: newHp });
        await interaction.update({ embeds: [new EmbedBuilder().setColor(0x00CC44).setTitle('✨ 回復の泉').setDescription(`HPが **${event.heal}** 回復した！（${newHp}/${player.max_hp}）`).setThumbnail(IMAGES.events.heal).setFooter({ text: 'Etherion Chronicle' })], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_adventure').setLabel('◀ 冒険メニューへ').setStyle(ButtonStyle.Secondary))] });
      }
    } else if (event.type === 'npc') {
      await interaction.update({ embeds: [new EmbedBuilder().setColor(0x7289DA).setTitle(`👤 ${event.npc.name}と出会った`).setDescription(event.npc.message).setFooter({ text: 'Etherion Chronicle' })], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_adventure').setLabel('◀ 冒険メニューへ').setStyle(ButtonStyle.Secondary))] });
    } else {
      await interaction.update({ embeds: [new EmbedBuilder().setColor(0x666666).setTitle('🌲 探索').setDescription(event.message).setFooter({ text: 'Etherion Chronicle' })], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_adventure').setLabel('◀ 冒険メニューへ').setStyle(ButtonStyle.Secondary))] });
    }
  },

  adventure_map: async (interaction) => {
    await handleMapCommand(interaction);
  },

  adventure_quest: async (interaction) => {
    // クエストボードを表示
    const { handleQuestCommand: hq } = await import('../../commands/questHandler.js');
    interaction.options = { getString: () => 'board' };
    await hq(interaction);
  },

  adventure_party: async (interaction) => {
    interaction.options = { getString: () => 'status', getUser: () => null };
    await handlePartyCommand(interaction);
  },

  adventure_boss: async (interaction) => {
    await handleBossCommand(interaction);
  },

  // 街サブメニュー
  town_shop: async (interaction) => {
    await handleShopCommand(interaction);
  },

  town_inn: async (interaction) => {
    await handleInnCommand(interaction);
  },

  town_equip: async (interaction) => {
    await handleEquipCommand(interaction);
  },

  town_class: async (interaction) => {
    await handleClassChangeCommand(interaction);
  },

  town_skill: async (interaction) => {
    await handleSkillCommand(interaction);
  },

  // キャラクターサブメニュー
  char_status: async (interaction) => {
    const player = getPlayer(interaction.user.id);
    if (!player) return interaction.reply({ content: '⚠️ キャラクターが見つかりません。', ephemeral: true });
    const embed = buildStatusEmbed(player);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },

  char_inventory: async (interaction) => {
    const player = getPlayer(interaction.user.id);
    if (!player) return interaction.reply({ content: '⚠️ キャラクターが見つかりません。', ephemeral: true });
    const counts = {};
    for (const key of (player.inventory || [])) counts[key] = (counts[key] || 0) + 1;
    const lines = Object.entries(counts).map(([key, cnt]) => { const item = ITEMS[key]; return item ? `${item.name} x${cnt} - ${item.description}` : `不明(${key}) x${cnt}`; });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2E75B6).setTitle(`🎒 ${player.name} の所持品`).setDescription(lines.length ? lines.join('\n') : '（何も持っていない）').setFooter({ text: `💰 所持金: ${player.gold}G` })], ephemeral: true });
  },

  char_equip: async (interaction) => {
    await handleEquipCommand(interaction);
  },

  char_skill: async (interaction) => {
    await handleSkillCommand(interaction);
  },

  // 記録サブメニュー
  records_achievement: async (interaction) => {
    await handleAchievementCommand(interaction);
  },

  records_ranking: async (interaction) => {
    const ranking = getRanking(10);
    const lines = ranking.map((p, i) => { const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`; return `${medal} **${p.name}** ${CLASSES[p.class].emoji} Lv.**${p.level}**`; });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('🏆 冒険者ランキング').setDescription(lines.length ? lines.join('\n') : '（まだ冒険者がいません）').setFooter({ text: 'Etherion Chronicle' })], ephemeral: true });
  },
};

export async function handleMenuInteraction(interaction) {
  const handler = MENU_MAP[interaction.customId];
  if (handler) {
    await handler(interaction);
    return true;
  }
  return false;
}