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
import { handleShopCommand, handleShopBuy, handleShopSell } from './src/commands/shopHandler.js';
import { handleEquipCommand, handleEquipSelect } from './src/commands/equipHandler.js';
import { handleMapCommand, handleMoveButton } from './src/commands/moveHandler.js';
import { handleQuestCommand, handleQuestAccept, buildQuestCompleteMessage } from './src/commands/questHandler.js';
import {
  startPartyBattle, isInPartyBattle, getPartyBattle,
  registerAction, allActionsReady, processPartyTurn
} from './src/game/partyBattle.js';
import { getParty, getPartyById } from './src/game/party.js';

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

    // /rpg start
    if (sub === 'start') {
      const wait = checkCooldown(userId, 'start');
      if (wait) return interaction.reply({ content: `⏳ ${wait}秒後に再試行してください。`, ephemeral: true });
      if (getPlayer(userId)) return interaction.reply({ content: '⚠️ すでにキャラクターが存在します！ `/rpg status` で確認できます。', ephemeral: true });

      const select = new StringSelectMenuBuilder()
        .setCustomId('select_class')
        .setPlaceholder('職業を選んでください')
        .addOptions(Object.entries(CLASSES).map(([key, cls]) => ({
          label: cls.name, value: key,
          description: cls.description.substring(0, 50), emoji: cls.emoji,
        })));

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x1F3864)
          .setTitle('⚔️ エーテリオン・クロニクルへようこそ！')
          .setDescription('世界は「エーテル結晶」の力で維持されてきたが、各地で結晶が消え始めている…\n\nあなたは謎を解くべく旅立つ冒険者。まず**職業**を選んでください。')
          .setFooter({ text: 'Etherion Chronicle' })
        ],
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true,
      });
    }

    // /rpg status
    else if (sub === 'status') {
      const player = getPlayer(userId);
      if (!player) return interaction.reply({ content: '⚠️ まだキャラクターがいません。`/rpg start` で始めましょう！', ephemeral: true });
      await interaction.reply({ embeds: [buildStatusEmbed(player)] });
    }

    // /rpg explore
    else if (sub === 'explore') {
      const player = getPlayer(userId);
      if (!player) return interaction.reply({ content: '⚠️ まずは `/rpg start` でキャラクターを作成してください！', ephemeral: true });
      if (isInBattle(userId)) return interaction.reply({ content: '⚔️ ソロ戦闘中は探索できません！先に戦闘を終わらせてください。', ephemeral: true });
      const partyCheck = getParty(userId);
      if (partyCheck && isInPartyBattle(partyCheck.party_id)) return interaction.reply({ content: '⚔️ パーティが戦闘中です！全員が行動を選択してターンを終わらせてください。', ephemeral: true });
      // パーティメンバーはリーダーのみ探索を開始できる
      if (partyCheck && partyCheck.members.length > 1 && partyCheck.leader_id !== userId) {
        return interaction.reply({ content: '👑 パーティ探索はリーダーのみ開始できます！リーダーに  を実行してもらってください。', ephemeral: true });
      }

      const { ok, remaining } = canExplore(userId);
      if (!ok) return interaction.reply({ content: `⏳ 探索クールダウン中… あと **${remaining}秒** 待ってください。`, ephemeral: true });

      const party = getParty(userId);
      const area = AREAS[player.current_area];
      const event = explore(userId, player.current_area);

      if (event.type === 'battle') {
        // パーティ戦闘（2人以上）
        if (party && party.members.length > 1) {
          if (isInPartyBattle(party.partyId)) {
            return interaction.reply({ content: '⚔️ パーティはすでに戦闘中です！', ephemeral: true });
          }

          const enemy = startPartyBattle(party.partyId, event.enemyKey, party.members.length);
          const memberLines = currentParty.members.map(uid => {
            const p = getPlayer(uid);
            return p ? `⏳ **${p.name}** HP:${p.hp}/${p.max_hp}` : `<@${uid}>`;
          }).join('\n');

          const embed = new EmbedBuilder()
            .setColor(0xC00000)
            .setTitle('⚔️ パーティエンカウント！')
            .setDescription(
              `**${area.name}**を探索中… **${enemy.name}**が現れた！\n` +
              `敵HP: **${enemy.currentHp}** （${party.members.length}人スケール）\n\n` +
              `**パーティメンバー**\n${memberLines}\n\n` +
              `⏳ 全員が行動を選択すると一斉に処理されます！`
            )
            .setFooter({ text: 'パーティ戦闘 | Etherion Chronicle' });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`pbattle_attack:${party.partyId}:${event.enemyKey}`).setLabel('⚔️ 攻撃').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`pbattle_skill:${party.partyId}:${event.enemyKey}`).setLabel('✨ スキル').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`pbattle_item:${party.partyId}:${event.enemyKey}`).setLabel('🧪 アイテム').setStyle(ButtonStyle.Success),
          );

          await interaction.reply({ embeds: [embed], components: [row] });

        } else {
          // ソロ戦闘
          const embed = new EmbedBuilder()
            .setColor(0xC00000)
            .setTitle('⚔️ エンカウント！')
            .setDescription(`**${area.name}**を探索中… **${event.enemy.name}**が現れた！\nHP: ${event.enemy.hp}`)
            .setFooter({ text: '行動を選択してください' });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`battle_attack:${event.enemyKey}`).setLabel('⚔️ 攻撃').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`battle_skill:${event.enemyKey}`).setLabel('✨ スキル (MP10)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`battle_item:${event.enemyKey}`).setLabel('🧪 アイテム').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`battle_escape:${event.enemyKey}`).setLabel('💨 逃走').setStyle(ButtonStyle.Secondary),
          );

          await interaction.reply({ embeds: [embed], components: [row] });
        }

      } else if (event.type === 'treasure') {
        if (party && party.members.length > 1) {
          const share = Math.floor(event.gold / party.members.length);
          for (const uid of party.members) {
            const p = getPlayer(uid);
            if (p) updatePlayer(uid, { gold: p.gold + share });
          }
          await interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xFFD700)
              .setTitle('💰 宝箱発見！（パーティ山分け）')
              .setDescription(`**${area.name}**を探索中…\n**${event.gold}G** をパーティで山分け！ 一人あたり **${share}G**`)
            ]
          });
        } else {
          updatePlayer(userId, { gold: player.gold + event.gold });
          await interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xFFD700)
              .setTitle('💰 宝箱発見！')
              .setDescription(`**${area.name}**を探索中…\n光る箱を見つけた！ **${event.gold}G** を手に入れた！`)
            ]
          });
        }

      } else if (event.type === 'heal') {
        if (party && party.members.length > 1) {
          for (const uid of party.members) {
            const p = getPlayer(uid);
            if (p) updatePlayer(uid, { hp: Math.min(p.max_hp, p.hp + event.heal) });
          }
          await interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0x00CC44)
              .setTitle('✨ 回復の泉（パーティ全員回復）')
              .setDescription(`**${area.name}**を探索中…\nパーティ全員のHPが **${event.heal}** 回復した！`)
            ]
          });
        } else {
          const newHp = Math.min(player.max_hp, player.hp + event.heal);
          updatePlayer(userId, { hp: newHp });
          await interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0x00CC44)
              .setTitle('✨ 回復の泉')
              .setDescription(`**${area.name}**を探索中…\nHPが **${event.heal}** 回復した！（${newHp}/${player.max_hp}）`)
            ]
          });
        }

      } else if (event.type === 'npc') {
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x7289DA)
            .setTitle(`👤 ${event.npc.name}と出会った`)
            .setDescription(`**${area.name}**を探索中…\n${event.npc.message}`)
          ]
        });

      } else {
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x666666)
            .setTitle('🌲 探索')
            .setDescription(`**${area.name}**を探索した…\n${event.message}`)
          ]
        });
      }
    }

    // /rpg inventory
    else if (sub === 'inventory') {
      const player = getPlayer(userId);
      if (!player) return interaction.reply({ content: '⚠️ まずは `/rpg start` でキャラクターを作成してください！', ephemeral: true });
      const inventory = player.inventory || [];
      const counts = {};
      for (const key of inventory) counts[key] = (counts[key] || 0) + 1;
      const lines = Object.entries(counts).map(([key, cnt]) => {
        const item = ITEMS[key];
        return item ? `${item.name} ×${cnt}　*${item.description}*` : `不明(${key}) ×${cnt}`;
      });
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x2E75B6)
          .setTitle(`🎒 ${player.name} の所持品`)
          .setDescription(lines.length ? lines.join('\n') : '（何も持っていない）')
          .setFooter({ text: `💰 所持金: ${player.gold} G` })
        ],
        ephemeral: true,
      });
    }

    // /rpg quest
    else if (sub === 'quest') {
      await handleQuestCommand(interaction);
    }

    // /rpg map
    else if (sub === 'map') {
      await handleMapCommand(interaction);
    }

    // /rpg equip
    else if (sub === 'equip') {
      await handleEquipCommand(interaction);
    }

    // /rpg shop
    else if (sub === 'shop') {
      await handleShopCommand(interaction);
    }

    // /rpg party
    else if (sub === 'party') {
      await handlePartyCommand(interaction);
    }

    // /rpg ranking
    else if (sub === 'ranking') {
      const ranking = getRanking(10);
      const lines = ranking.map((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        return `${medal} **${p.name}** ${CLASSES[p.class].emoji} Lv.**${p.level}**`;
      });
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle('🏆 冒険者ランキング')
          .setDescription(lines.length ? lines.join('\n') : '（まだ冒険者がいません）')
          .setFooter({ text: 'Etherion Chronicle' })
        ]
      });
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
    embed.setDescription(`職業: **${CLASSES[selectedClass].name}**\n\n\`/rpg explore\` で探索を始めよう！`);
    await interaction.update({ embeds: [embed], components: [] });
  }

  // ===== セレクトメニュー: ショップ =====
  if (interaction.isStringSelectMenu() && interaction.customId === 'quest_accept') {
    await handleQuestAccept(interaction);
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'equip_select') {
    await handleEquipSelect(interaction);
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'shop_buy') {
    await handleShopBuy(interaction);
    return;
  }
  if (interaction.isStringSelectMenu() && interaction.customId === 'shop_sell') {
    await handleShopSell(interaction);
    return;
  }

  // ===== ボタン: エリア移動 =====
  if (interaction.isButton() && interaction.customId.startsWith('move_area:')) {
    await handleMoveButton(interaction);
    return;
  }

  // ===== ボタン: パーティ戦闘 =====
  if (interaction.isButton() && interaction.customId.startsWith('pbattle_')) {
    const parts = interaction.customId.split(':');
    const action = parts[0].replace('pbattle_', '');
    const partyId = parts[1];
    const enemyKey = parts[2];
    const userId = interaction.user.id;

    const battle = getPartyBattle(partyId);
    if (!battle) return interaction.reply({ content: '⚠️ この戦闘はすでに終了しています。', ephemeral: true });

    // 同じパーティメンバーか確認
    const party = getPartyById(partyId);
    if (!party || party.party_id !== partyId) {
      return interaction.reply({ content: '⚠️ あなたはこのパーティのメンバーではありません。', ephemeral: true });
    }

    // 行動登録済みか確認
    if (battle.memberActions[userId]) {
      const actionNames = { attack: '⚔️ 攻撃', skill: '✨ スキル', item: '🧪 アイテム' };
      return interaction.reply({ content: `⏳ 行動登録済み（**${actionNames[battle.memberActions[userId]]}**）。他のメンバーを待っています…`, ephemeral: true });
    }

    // アクション登録
    registerAction(partyId, userId, action);
    const player = getPlayer(userId);
    const actionNames = { attack: '⚔️ 攻撃', skill: '✨ スキル', item: '🧪 アイテム' };
    await interaction.reply({ content: `✅ **${player?.name}** の行動：**${actionNames[action]}** を登録！他のメンバーを待っています…`, ephemeral: true });

    // 全員の行動が揃ったらターン処理
    const currentParty = getPartyById(partyId);
    if (currentParty && allActionsReady(partyId, currentParty.members)) {
      const result = processPartyTurn(partyId);
      const logText = result.logs.join('\n');

      if (result.victory) {
        const rewardLines = result.rewards.memberRewards.map(r => {
          const lvUp = r.levelUpMessages.length > 0 ? `\n${r.levelUpMessages.join(' ')}` : '';
          return `**${r.name}**：EXP +${r.exp} / GOLD +${r.gold}G${lvUp}`;
        }).join('\n');
        const itemLine = result.rewards.items.length > 0
          ? `\n📦 ドロップ: ${result.rewards.items.map(k => ITEMS[k]?.name || k).join(', ')}`
          : '';

        await interaction.message.edit({
          embeds: [new EmbedBuilder()
            .setColor(0x00CC44)
            .setTitle('🎉 パーティ戦闘勝利！')
            .setDescription(`${logText}\n\n**— 報酬 —**\n${rewardLines}${itemLine}`)
          ],
          components: []
        });

      } else if (result.allDead) {
        await interaction.message.edit({
          embeds: [new EmbedBuilder()
            .setColor(0x333333)
            .setTitle('💀 パーティ全滅…')
            .setDescription(`${logText}\n\n全員の所持金が半分になり、始まりの村に戻った。`)
          ],
          components: []
        });

      } else {
        // 戦闘継続
        const enemy = result.enemy;
        const memberLines = currentParty.members.map(uid => {
          const p = getPlayer(uid);
          return p ? `⏳ **${p.name}** HP:${p.hp}/${p.max_hp}` : `<@${uid}>`;
        }).join('\n');

        await interaction.message.edit({
          embeds: [new EmbedBuilder()
            .setColor(0xC00000)
            .setTitle(`⚔️ パーティ戦闘 ターン${battle.turn}`)
            .setDescription(`${logText}\n\n**— メンバー状況 —**\n${memberLines}\n\n⏳ 行動を選択してください`)
            .addFields({ name: '敵HP', value: `${enemy.currentHp} / ${enemy.hp}`, inline: true })
          ],
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
  if (interaction.isButton() && (interaction.customId.startsWith('party_accept:') || interaction.customId.startsWith('party_decline:'))) {
    await handlePartyButton(interaction);
    return;
  }

  // ===== ボタン: ソロ戦闘 =====
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
        if (result.rewards.completedQuests?.length) description += buildQuestCompleteMessage(result.rewards.completedQuests);
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

    // 戦闘継続
    const battle = getBattleStatus(userId);
    await interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(0xC00000)
        .setTitle('⚔️ 戦闘中')
        .setDescription(description)
        .addFields(
          { name: '自分のHP', value: `${player.hp}/${player.max_hp}`, inline: true },
          { name: '敵のHP', value: `${battle.enemy.currentHp}/${battle.enemy.hp}`, inline: true },
        )
      ],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`battle_attack:${enemyKey}`).setLabel('⚔️ 攻撃').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`battle_skill:${enemyKey}`).setLabel('✨ スキル (MP10)').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`battle_item:${enemyKey}`).setLabel('🧪 アイテム').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`battle_escape:${enemyKey}`).setLabel('💨 逃走').setStyle(ButtonStyle.Secondary),
      )]
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
