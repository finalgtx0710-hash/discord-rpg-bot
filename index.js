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
import { handleStoryCommand, handleStoryRead, handleStoryEnd } from './src/commands/storyHandler.js';
import { handleSkillCommand } from './src/commands/skillHandler.js';
import { handleClassChangeCommand, handleClassChangeButton } from './src/commands/classChangeHandler.js';
import { handleAchievementCommand } from './src/commands/achievementHandler.js';
import {
  startPartyBattle, isInPartyBattle, getPartyBattle,
  registerAction, allActionsReady, processPartyTurn
} from './src/game/partyBattle.js';
import { getParty, getPartyById } from './src/game/party.js';
import { IMAGES } from './src/data/images.js';
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

  if (interaction.isChatInputCommand() && interaction.commandName === 'rpg') {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (sub === 'start') {
      const wait = checkCooldown(userId, 'start');
      if (wait) return interaction.reply({ content: `⏳ ${wait}秒後に再試行してください。`, ephemeral: true });
      if (getPlayer(userId)) return interaction.reply({ content: '⚠️ すでにキャラクターが存在します！', ephemeral: true });
      const select = new StringSelectMenuBuilder()
        .setCustomId('select_class').setPlaceholder('職業を選んでください')
        .addOptions(Object.entries(CLASSES).map(([key, cls]) => ({
          label: cls.name, value: key, description: cls.description.substring(0, 50), emoji: cls.emoji,
        })));
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x1F3864).setTitle('⚔️ エーテリオン・クロニクルへようこそ！')
          .setDescription('世界は「エーテル結晶」の力で維持されてきたが、各地で結晶が消え始めている…\n\nあなたは謎を解くべく旅立つ冒険者。まず**職業**を選んでください。')
          .setFooter({ text: 'Etherion Chronicle' })],
        components: [new ActionRowBuilder().addComponents(select)], ephemeral: true,
      });
    }

    else if (sub === 'status') {
      const player = getPlayer(userId);
      if (!player) return interaction.reply({ content: '⚠️ まだキャラクターがいません。', ephemeral: true });
      await interaction.reply({ embeds: [buildStatusEmbed(player)] });
    }

    else if (sub === 'explore') {
      const player = getPlayer(userId);
      if (!player) return interaction.reply({ content: '⚠️ まずは `/rpg start` でキャラクターを作成してください！', ephemeral: true });
      if (isInBattle(userId)) return interaction.reply({ content: '⚔️ ソロ戦闘中は探索できません！', ephemeral: true });
      const partyCheck = getParty(userId);
      if (partyCheck && isInPartyBattle(partyCheck.party_id)) return interaction.reply({ content: '⚔️ パーティが戦闘中です！', ephemeral: true });
      if (partyCheck && partyCheck.members.length > 1 && partyCheck.leader_id !== userId) {
        return interaction.reply({ content: '👑 パーティ探索はリーダーのみ開始できます！', ephemeral: true });
      }
      const { ok, remaining } = canExplore(userId);
      if (!ok) return interaction.reply({ content: `⏳ 探索クールダウン中… あと **${remaining}秒** 待ってください。`, ephemeral: true });

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
            .setDescription(`**${area.name}**を探索中… **${enemy.name}**が現れた！\n敵HP: **${enemy.currentHp}** （${party.members.length}人スケール）\n\n**パーティメンバー**\n${memberLines}\n\n⏳ 全員が行動を選択すると一斉に処理されます！`)
            .setFooter({ text: 'パーティ戦闘 | Etherion Chronicle' });
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`pbattle_attack:${party.party_id}:${event.enemyKey}`).setLabel('⚔️ 攻撃').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`pbattle_skill:${party.party_id}:${event.enemyKey}`).setLabel('✨ スキル').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`pbattle_item:${party.party_id}:${event.enemyKey}`).setLabel('🧪 アイテム').setStyle(ButtonStyle.Success),
          );
          await interaction.reply({ embeds: [embed], components: [row] });
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
          await interaction.reply({ embeds: [embed], components: [row] });
        }
      } else if (event.type === 'treasure') {
        if (party && party.members.length > 1) {
          const share = Math.floor(event.gold / party.members.length);
          for (const uid of party.members) { const p = getPlayer(uid); if (p) updatePlayer(uid, { gold: p.gold + share }); }
          await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('💰 宝箱発見！（パーティ山分け）').setDescription(`**${area.name}**を探索中…\n**${event.gold}G** をパーティで山分け！ 一人あたり **${share}G**`)] });
        } else {
          updatePlayer(userId, { gold: player.gold + event.gold });
          await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('💰 宝箱発見！').setThumbnail(IMAGES.events.treasure).setDescription(`**${area.name}**を探索中…\n光る箱を見つけた！ **${event.gold}G** を手に入れた！`)] });
        }
      } else if (event.type === 'heal') {
        if (party && party.members.length > 1) {
          for (const uid of party.members) { const p = getPlayer(uid); if (p) updatePlayer(uid, { hp: Math.min(p.max_hp, p.hp + event.heal) }); }
          await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00CC44).setTitle('✨ 回復の泉（パーティ全員回復）').setDescription(`**${area.name}**を探索中…\nパーティ全員のHPが **${event.heal}** 回復した！`)] });
        } else {
          const newHp = Math.min(player.max_hp, player.hp + event.heal);
          updatePlayer(userId, { hp: newHp });
          await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00CC44).setTitle('✨ 回復の泉').setThumbnail(IMAGES.events.heal).setDescription(`**${area.name}**を探索中…\nHPが **${event.heal}** 回復した！（${newHp}/${player.max_hp}）`)] });
        }
      } else if (event.type === 'npc') {
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x7289DA).setTitle(`👤 ${event.npc.name}と出会った`).setDescription(`**${area.name}**を探索中…\n${event.npc.message}`)] });
      } else {
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x666666).setTitle('🌲 探索').setDescription(`**${area.name}**を探索した…\n${event.message}`)] });
      }
    }

    else if (sub === 'inventory') {
      const player = getPlayer(userId);
      if (!player) return interaction.reply({ content: '⚠️ まずは `/rpg start` でキャラクターを作成してください！', ephemeral: true });
      const counts = {};
      for (const key of (player.inventory || [])) counts[key] = (counts[key] || 0) + 1;
      const lines = Object.entries(counts).map(([key, cnt]) => { const item = ITEMS[key]; return item ? `${item.name} x${cnt} ${item.description}` : `不明(${key}) x${cnt}`; });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2E75B6).setTitle(`🎒 ${player.name} の所持品`).setDescription(lines.length ? lines.join('\n') : '（何も持っていない）').setFooter({ text: `💰 所持金: ${player.gold} G` })], ephemeral: true });
    }

    else if (sub === 'quest')   { await handleQuestCommand(interaction); }
    else if (sub === 'inn')     { await handleInnCommand(interaction); }
    else if (sub === 'story')   { await handleStoryCommand(interaction); }
    else if (sub === 'skill')   { await handleSkillCommand(interaction); }
    else if (sub === 'classchange') { await handleClassChangeCommand(interaction); }
    else if (sub === 'achievement') { await handleAchievementCommand(interaction); }
    else if (sub === 'map')     { await handleMapCommand(interaction); }
    else if (sub === 'equip')   { await handleEquipCommand(interaction); }
    else if (sub === 'shop')    { await handleShopCommand(interaction); }
    else if (sub === 'party')   { await handlePartyCommand(interaction); }
    else if (sub === 'ranking') {
      const ranking = getRanking(10);
      const lines = ranking.map((p, i) => { const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`; return `${medal} **${p.name}** ${CLASSES[p.class].emoji} Lv.**${p.level}**`; });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('🏆 冒険者ランキング').setDescription(lines.length ? lines.join('\n') : '（まだ冒険者がいません）').setFooter({ text: 'Etherion Chronicle' })] });
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'select_class') {
    const userId = interaction.user.id;
    const selectedClass = interaction.values[0];
    const name = interaction.user.displayName || interaction.user.username;
    if (getPlayer(userId)) return interaction.update({ content: '⚠️ すでにキャラクターが存在します。', components: [], embeds: [] });
    const player = createPlayer(userId, name, selectedClass);
    const embed = buildStatusEmbed(player);
    embed.setTitle(`🎉 ${name} の冒険が始まった！`);
    embed.setDescription(`職業: **${CLASSES[selectedClass].name}**\n\n\`/rpg explore\` で探索を始めよう！`);
    await interaction.update({ embeds: [embed], components: [] });
  }
if (interaction.isStringSelectMenu() && interaction.customId.startsWith('battle_skill_select:')) {
    const userId = interaction.user.id;
    const value = interaction.values[0];
    const [skillId, enemyKey] = value.split(':');

    if (!isInBattle(userId)) return interaction.reply({ content: '⚠️ 戦闘状態ではありません。', ephemeral: true });

    const { SKILLS, useSkill } = await import('./src/game/skills.js');
    const player = getPlayer(userId);
    const battle = getBattleStatus(userId);
    const skill = SKILLS[skillId];

    if (!skill) return interaction.reply({ content: '⚠️ スキルが見つかりません。', ephemeral: true });
    if (player.mp < skill.mp_cost) return interaction.reply({ content: `⚠️ MPが足りません！（必要MP: ${skill.mp_cost} / 現在MP: ${player.mp}）`, ephemeral: true });

    // スキル使用
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
      description = hits > 1
        ? `✨ **${skill.name}**！${hits}回攻撃で合計 **${totalDamage}** ダメージ！`
        : `✨ **${skill.name}**！**${totalDamage}** ダメージ！`;
      if (skill.type === 'hybrid') { healAmount = skill.heal_amount || 0; }
    }

    const newHp = Math.min(player.max_hp, player.hp + healAmount - (skill.self_damage || 0));
    updatePlayer(userId, { mp: newMp, hp: newHp });

    // 敵撃破判定 → processBattleActionと同じ流れでresultを作る
    // 簡易版：敵が倒れたかチェックしてメッセージを返す
    if (battle.enemy.currentHp <= 0) {
      await interaction.reply({ content: `${description}\n\n敵を倒した！戦闘ボタンを押して結果を確認してください。`, ephemeral: true });
    } else {
      await interaction.reply({ content: `${description}\n残りMP: ${newMp}`, ephemeral: true });
    }
    return;
  }
  if (interaction.isStringSelectMenu() && interaction.customId === 'quest_accept') { await handleQuestAccept(interaction); return; }
  if (interaction.isStringSelectMenu() && interaction.customId === 'equip_select') { await handleEquipSelect(interaction); return; }
  if (interaction.isStringSelectMenu() && interaction.customId === 'shop_buy')     { await handleShopBuy(interaction);    return; }
  if (interaction.isStringSelectMenu() && interaction.customId === 'shop_sell')    { await handleShopSell(interaction);   return; }
  if (interaction.isButton() && (interaction.customId.startsWith('classchange_confirm:') || interaction.customId === 'classchange_cancel')) { await handleClassChangeButton(interaction); return; }
  if (interaction.isButton() && (interaction.customId === 'inn_rest' || interaction.customId === 'inn_cancel')) {
    await handleInnButton(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith('story_read:')) { console.log('story_read triggered:', interaction.customId); try { await handleStoryRead(interaction); } catch(e) { console.error('storyRead error:', e.message); await interaction.reply({ content: 'エラー: ' + e.message, ephemeral: true }).catch(()=>{}); } return; }  if (interaction.isButton() && interaction.customId === 'story_end') { await handleStoryEnd(interaction); return; }
  if (interaction.isButton() && interaction.customId.startsWith('move_area:')) { await handleMoveButton(interaction); return; }

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

  if (interaction.isButton() && (interaction.customId.startsWith('party_accept:') || interaction.customId.startsWith('party_decline:'))) { await handlePartyButton(interaction); return; }
  
  // スキルメニュー表示
  if (interaction.isButton() && interaction.customId.startsWith('battle_skillmenu:')) {
    const userId = interaction.user.id;
    const enemyKey = interaction.customId.replace('battle_skillmenu:', '');
    const player = getPlayer(userId);
    if (!player) return interaction.reply({ content: '⚠️ キャラクターが見つかりません。', ephemeral: true });

    const { getLearnedSkills } = await import('./src/game/skills.js');
    const learned = getLearnedSkills(player);

    if (learned.length === 0) {
      return interaction.reply({ content: '⚠️ 習得済みスキルがありません。', ephemeral: true });
    }

    const { StringSelectMenuBuilder: SSM, ActionRowBuilder: AR2 } = await import('discord.js');
    const select = new SSM()
      .setCustomId(`battle_skill_select:${enemyKey}`)
      .setPlaceholder('使用するスキルを選んでください')
      .addOptions(learned.map(s => ({
        label: `${s.name} (MP ${s.mp_cost})`,
        value: `${s.id}:${enemyKey}`,
        description: s.description.substring(0, 50),
      })));

    return interaction.reply({
      components: [new AR2().addComponents(select)],
      ephemeral: true,
    });
  }
  
  if (interaction.isButton() && interaction.customId.startsWith('battle_')) {
    const userId = interaction.user.id;
    const [actionFull, enemyKey] = interaction.customId.split(':');
    const action = actionFull.replace('battle_', '');
    if (!isInBattle(userId)) return interaction.reply({ content: '⚠️ 戦闘状態ではありません。`/rpg explore` で新しく探索してください。', ephemeral: true });
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
        if (result.rewards.completedQuests?.length) {
  for (const { quest } of result.rewards.completedQuests) {
    const items = quest.rewards.items.map(k => ITEMS[k]?.name || k).join(', ');
    description += `\n\n🎊 **クエスト完了！**「${quest.title}」\nEXP +${quest.rewards.exp} / GOLD +${quest.rewards.gold}G${items ? ' / ' + items : ''}`;
  }
}
        if (items.length > 0) description += `\n📦 ドロップ: ${items.map(k => ITEMS[k]?.name || k).join(', ')}`;
        if (levelUpMessages.length > 0) description += '\n\n' + levelUpMessages.join('\n');
        return interaction.update({ embeds: [new EmbedBuilder().setColor(0x00CC44).setTitle('⚔️ 戦闘終了 - 勝利！').setDescription(description)], components: [] });
      } else if (result.playerDied) {
        description += `\n\n💀 **${player?.name}**は倒れた…\n所持金が半分になり、始まりの村に戻った。`;
        return interaction.update({ embeds: [new EmbedBuilder().setColor(0x333333).setTitle('💀 戦闘終了 - 敗北').setDescription(description)], components: [] });
      } else {
        return interaction.update({ embeds: [new EmbedBuilder().setColor(0x666666).setTitle('💨 逃走成功').setDescription(description)], components: [] });
      }
    }
    const battle = getBattleStatus(userId);
    await interaction.update({
      embeds: [new EmbedBuilder().setColor(0xC00000).setTitle('⚔️ 戦闘中').setDescription(description)
        .addFields({ name: '自分のHP', value: `${player.hp}/${player.max_hp}`, inline: true }, { name: '敵のHP', value: `${battle.enemy.currentHp}/${battle.enemy.hp}`, inline: true })],
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