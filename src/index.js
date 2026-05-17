import 'dotenv/config';
import {
  Client, GatewayIntentBits, Events, AttachmentBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, EmbedBuilder, MessageFlags
} from 'discord.js';
import { createCanvas, loadImage } from 'canvas';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';
import { initDatabase, getPlayer, createPlayer, getRanking } from './database/db.js';
import { CLASSES, AREAS, ITEMS } from './data/master.js';
import { IMAGES } from './data/images.js';
import { buildStatusEmbed } from './commands/rpg.js';
import { isInBattle, startBattle, processBattleAction, getBattleStatus } from './game/battle.js';
import { handleShopCommand, handleShopBuy, handleShopSell, handleInnCommand, handleInnButton } from './commands/shopHandler.js';
import { handleEquipCommand, handleEquipSelect } from './commands/equipHandler.js';
import { handleQuestCommand, handleQuestAccept } from './commands/questHandler.js';
import { handleClassChangeCommand, handleClassChangeButton } from './commands/classChangeHandler.js';
import { handleStoryCommand, handleStoryRead, handleStoryEnd } from './commands/storyHandler.js';
import { handlePartyCommand, handlePartyButton, handlePartyUserSelect } from './commands/partyHandler.js';
import { handleMapCommand, handleMoveButton } from './commands/moveHandler.js';
import { handleSkillCommand } from './commands/skillHandler.js';
import { handleAchievementCommand } from './commands/achievementHandler.js';
import { handleBossChallenge, handleBossAction } from './commands/bossHandler.js';
import { explore, canExplore } from './game/explore.js';
import { getLearnedSkills } from './game/skills.js';
import { createExploreImage } from './utils/battleCanvas.js';
import { buildMainMenu } from './ui/menus/mainMenu.js';
import { handleMenuInteraction } from './ui/handlers/menuHandler.js';

const LOCK_PATH = path.join(process.cwd(), '.bot.lock');

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireProcessLock() {
  if (existsSync(LOCK_PATH)) {
    const existingPid = Number(readFileSync(LOCK_PATH, 'utf8'));
    if (Number.isInteger(existingPid) && isProcessRunning(existingPid)) {
      console.error(`Etherion Chronicle bot is already running with PID ${existingPid}.`);
      process.exit(1);
    }
  }

  writeFileSync(LOCK_PATH, String(process.pid));

  const releaseLock = () => {
    try {
      if (existsSync(LOCK_PATH) && readFileSync(LOCK_PATH, 'utf8') === String(process.pid)) {
        unlinkSync(LOCK_PATH);
      }
    } catch {}
  };

  process.once('exit', releaseLock);
  process.once('SIGINT', () => {
    releaseLock();
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    releaseLock();
    process.exit(0);
  });
}

acquireProcessLock();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const BATTLE_SCENE = {
  width: 1280,
  height: 720,
  enemy: { x: 360, y: 90, width: 700, height: 570 },
};

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in: ${c.user.tag}`);
  await initDatabase();
  console.log('Etherion Chronicle bot is ready.');
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
              label: cls.name, value: key,
              description: cls.description.substring(0, 50), emoji: cls.emoji,
            })));
          return await interaction.reply({
            embeds: [new EmbedBuilder().setColor(0x1F3864).setTitle('Etherion Chronicle')
              .setDescription('職業を選んで冒険を始めてください。')],
            components: [new ActionRowBuilder().addComponents(select)],
            flags: [MessageFlags.Ephemeral],
          });
        }
        return await interaction.reply({ ...buildMainMenu(userId) });
      }

      if (sub === 'status') return await handleStatusCommand(interaction);
      if (sub === 'inventory') return await handleInventoryCommand(interaction);
      if (sub === 'ranking') return await handleRankingCommand(interaction);
      if (sub === 'explore') return await handleExploreCommand(interaction);
      if (sub === 'shop') return await handleShopCommand(interaction);
      if (sub === 'inn') return await handleInnCommand(interaction);
      if (sub === 'story') return await handleStoryCommand(interaction);
      if (sub === 'skill') return await handleSkillCommand(interaction);
      if (sub === 'classchange') return await handleClassChangeCommand(interaction);
      if (sub === 'achievement') return await handleAchievementCommand(interaction);
      if (sub === 'equip') return await handleEquipCommand(interaction);
      if (sub === 'map') return await handleMapCommand(interaction);
      if (sub === 'quest') return await handleQuestCommand(interaction);
      if (sub === 'party') return await handlePartyCommand(interaction);
    }

    // ボタン操作
    if (interaction.isButton()) {
      const handled = await handleMenuInteraction(interaction);
      if (handled) return;

      const userId = interaction.user.id;
      const customId = interaction.customId;

      if (customId.startsWith('battle_')) {
        const parts = customId.split(':');
        const [actionFull, enemyKey] = parts;
        const action = actionFull.replace('battle_', '');
        const currentEnemyKey = action === 'cast' ? parts[2] : enemyKey;
        const activeBattle = getBattleStatus(userId);
        if (!activeBattle || activeBattle.enemy.key !== currentEnemyKey) {
          const restoredEnemy = startBattle(userId, currentEnemyKey);
          if (!restoredEnemy) {
            return await interaction.reply({
              content: '戦闘中ではありません。もう一度探索してください。',
              flags: [MessageFlags.Ephemeral]
            });
          }
        }

        if (action === 'skillmenu' || action === 'skill') {
          const player = getPlayer(userId);
          const battle = getBattleStatus(userId);
          const skills = getLearnedSkills(player);
          if (skills.length === 0) {
            return await interaction.reply({
              content: 'まだ戦闘で使えるスキルを習得していません。',
              flags: [MessageFlags.Ephemeral]
            });
          }
          return await interaction.update({
            embeds: [new EmbedBuilder()
              .setColor(0x9B59B6)
              .setTitle('スキル選択')
              .setDescription(skills.map(s => `**${s.name}** (MP ${s.mp_cost})\n${s.description}`).join('\n\n'))
              .setFooter({ text: `MP: ${player.mp}/${player.max_mp} | Etherion Chronicle` })
            ],
            components: buildBattleSkillRows(skills, battle.enemy.key),
          });
        }

        const result = await processBattleAction(userId, action === 'cast' ? `skill:${parts[1]}` : action);
        if (!result) return;

        const player = getPlayer(userId);
        let description = `${result.playerAction}\n${result.enemyAction || ''}`;

        const afterBattleRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('adventure_explore')
            .setLabel('探索を続ける')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('menu_adventure')
            .setLabel('冒険メニューへ')
            .setStyle(ButtonStyle.Secondary)
        );

        if (result.battleEnd) {
          let color = result.victory ? 0x00CC44 : 0x333333;
          const battleScene = await buildBattleSceneAttachment({
            areaKey: player.current_area,
            areaName: AREAS[player.current_area]?.name || 'Unknown Area',
            enemyKey: currentEnemyKey,
            enemyName: '',
            showEnemy: !result.victory,
          });
          const endEmbed = new EmbedBuilder()
            .setColor(color)
            .setTitle('戦闘終了')
            .setDescription(description)
            .setImage(`attachment://${battleScene.name}`);

          if (result.victory) {
            description += `\n\n勝利！ EXP+${result.rewards.exp} GOLD+${result.rewards.gold}`;
            if (result.rewards.levelUpMessages?.length) {
              description += `\n\n${result.rewards.levelUpMessages.join('\n')}`;
            }
            if (result.rewards.completedQuests?.length) {
              description += `\n\n${result.rewards.completedQuests.map(({ quest }) => `クエスト完了: ${quest.title}`).join('\n')}`;
            }
            if (result.rewards.newAchievements?.length) {
              description += `\n\n${result.rewards.newAchievements.map(a => `実績解除: ${a.name}`).join('\n')}`;
            }
          } else {
            description += `\n\n敗北...`;
          }
          endEmbed.setDescription(description);
          return await interaction.update({
            embeds: [endEmbed],
            components: [afterBattleRow],
            attachments: [],
            files: [battleScene],
          });
        }

        const battle = getBattleStatus(userId);
        const battleScene = await buildBattleSceneAttachment({
          areaKey: player.current_area,
          areaName: AREAS[player.current_area]?.name || 'Unknown Area',
          enemyKey: battle.enemy.key,
          enemyName: battle.enemy.name,
        });

        const battleEmbed = new EmbedBuilder()
          .setColor(0xC00000)
          .setTitle('戦闘中')
          .setImage(`attachment://${battleScene.name}`)
          .setDescription(description)
          .addFields(
            { name: '自分HP', value: `${player.hp}/${player.max_hp}`, inline: true },
            { name: '敵HP', value: `${battle.enemy.currentHp}/${battle.enemy.hp}`, inline: true }
          );

        return await interaction.update({
          embeds: [battleEmbed],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`battle_attack:${battle.enemy.key}`).setLabel('攻撃').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`battle_skillmenu:${battle.enemy.key}`).setLabel('スキル').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`battle_escape:${battle.enemy.key}`).setLabel('逃げる').setStyle(ButtonStyle.Secondary),
          )],
          attachments: [],
          files: [battleScene],
        });
      }

      if (customId.startsWith('move_area:')) return await handleMoveButton(interaction);
      if (customId === 'inn_rest' || customId === 'inn_cancel') return await handleInnButton(interaction);
      if (customId.startsWith('classchange_')) return await handleClassChangeButton(interaction);
      if (customId === 'story_end') return await handleStoryEnd(interaction);
      if (customId.startsWith('story_')) return await handleStoryRead(interaction);
      if (customId.startsWith('boss_start:')) return await handleBossChallenge(interaction);
      if (customId.startsWith('boss_action:')) return await handleBossAction(interaction);
      if (customId.startsWith('pbattle_') || customId.startsWith('party_')) return await handlePartyButton(interaction);
    }

    // セレクトメニュー
    if (interaction.isUserSelectMenu()) {
      if (interaction.customId === 'party_invite_select') return await handlePartyUserSelect(interaction);
    }

    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;
      if (customId === 'select_class') {
        const player = createPlayer(interaction.user.id, interaction.user.username, interaction.values[0]);
        return await interaction.update({ embeds: [buildStatusEmbed(player)], components: [] });
      }
      if (customId === 'quest_accept') return await handleQuestAccept(interaction);
      if (customId === 'shop_buy') return await handleShopBuy(interaction);
      if (customId === 'shop_sell') return await handleShopSell(interaction);
      if (customId === 'equip_select' || customId === 'equip_select:town') return await handleEquipSelect(interaction);
    }

  } catch (error) {
    console.error('Interaction Error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'エラーが発生しました。',
        flags: [MessageFlags.Ephemeral]
      }).catch(() => {});
    }
  }
});

function buildBackRow(customId, label) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildBattleSkillRows(skills, enemyKey) {
  const skillButtons = skills.slice(0, 4).map(skill =>
    new ButtonBuilder()
      .setCustomId(`battle_cast:${skill.id}:${enemyKey}`)
      .setLabel(`${skill.name} MP${skill.mp_cost}`.slice(0, 80))
      .setStyle(ButtonStyle.Primary)
  );

  const skillRow = new ActionRowBuilder().addComponents(skillButtons);
  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`battle_attack:${enemyKey}`)
      .setLabel('攻撃に戻る')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`battle_escape:${enemyKey}`)
      .setLabel('逃走')
      .setStyle(ButtonStyle.Secondary)
  );
  return [skillRow, backRow];
}

function applyEnemyImage(embed, enemyKey) {
  const monsterImagePath = path.join(process.cwd(), 'assets', 'monsters', `${enemyKey}.png`);
  if (existsSync(monsterImagePath)) {
    const attachmentName = `${enemyKey}-${Date.now()}.png`;
    return {
      embed: embed.setImage(`attachment://${attachmentName}`),
      files: [new AttachmentBuilder(monsterImagePath, { name: attachmentName })],
    };
  }

  if (IMAGES.enemies[enemyKey]) {
    embed.setImage(IMAGES.enemies[enemyKey]);
  }

  return { embed, files: [] };
}

function resolveExistingAsset(...segments) {
  const assetPath = path.join(process.cwd(), ...segments);
  return existsSync(assetPath) ? assetPath : null;
}

function resolveBattleBackgroundPath(areaKey) {
  return (
    resolveExistingAsset('assets', 'backgrounds', 'battle', `${areaKey}.png`) ||
    resolveExistingAsset('assets', 'backgrounds', `${areaKey}.png`) ||
    (areaKey === 'forest_of_whispers' ? resolveExistingAsset('assets', 'backgrounds', 'battle', 'forest.png') : null) ||
    resolveExistingAsset('assets', 'backgrounds', 'starting_village.png')
  );
}

function resolveEnemySpritePath(enemyKey) {
  return (
    resolveExistingAsset('assets', 'enemies', 'normal', `${enemyKey}.png`) ||
    resolveExistingAsset('assets', 'monsters', `${enemyKey}.png`)
  );
}

function drawBattleSceneFallback(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, BATTLE_SCENE.height);
  gradient.addColorStop(0, '#264f42');
  gradient.addColorStop(0.55, '#547052');
  gradient.addColorStop(1, '#18281f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, BATTLE_SCENE.width, BATTLE_SCENE.height);
}


function drawEnemyPlaceholder(ctx, enemyName) {
  const cx = 640;
  const cy = 285;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, 505, 210, 42, 0, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createRadialGradient(cx - 70, cy - 90, 20, cx, cy, 220);
  grad.addColorStop(0, '#9fffd0');
  grad.addColorStop(1, '#285c4f');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 155, 190, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.restore();
}

function getOpaqueBounds(image) {
  const trimCanvas = createCanvas(image.width, image.height);
  const trimCtx = trimCanvas.getContext('2d');
  trimCtx.drawImage(image, 0, 0);

  const { data } = trimCtx.getImageData(0, 0, image.width, image.height);
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = data[(y * image.width + x) * 4 + 3];
      if (alpha > 12) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    return { x: 0, y: 0, width: image.width, height: image.height };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function drawTrimmedImageContain(ctx, image, x, y, maxWidth, maxHeight) {
  const bounds = getOpaqueBounds(image);
  const scale = Math.min(maxWidth / bounds.width, maxHeight / bounds.height);
  const width = bounds.width * scale;
  const height = bounds.height * scale;
  const drawX = x + (maxWidth - width) / 2;
  const drawY = y + (maxHeight - height) / 2;
  ctx.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height, drawX, drawY, width, height);
}

function drawImageCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

async function buildBattleSceneAttachment({ areaKey, areaName, enemyKey, enemyName, showEnemy = true }) {
  const canvas = createCanvas(BATTLE_SCENE.width, BATTLE_SCENE.height);
  const ctx = canvas.getContext('2d');

  const layers = {
    background: async () => {
      const backgroundPath = resolveBattleBackgroundPath(areaKey);
      if (!backgroundPath) {
        drawBattleSceneFallback(ctx);
        return;
      }
      const background = await loadImage(backgroundPath);
      drawImageCover(ctx, background, 0, 0, BATTLE_SCENE.width, BATTLE_SCENE.height);
    },
    environmentEffects: async () => {},
    enemies: async () => {
      if (!showEnemy) {
        return;
      }
      const enemyPath = resolveEnemySpritePath(enemyKey);
      if (!enemyPath) {
        return;
      }
      const enemy = await loadImage(enemyPath);
      const { x, y, width, height } = BATTLE_SCENE.enemy;
      drawTrimmedImageContain(ctx, enemy, x, y, width, height);
    },
    enemyEffects: async () => {},
    text: async () => {},
  };

  for (const drawLayer of Object.values(layers)) {
    await drawLayer();
  }

  const sceneName = showEnemy ? `battle-scene-${enemyKey}-${Date.now()}.png` : `battle-background-${areaKey}-${Date.now()}.png`;
  return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: sceneName });
}

async function handleStatusCommand(interaction) {
  const player = getPlayer(interaction.user.id);
  if (!player) {
    return interaction.reply({ content: 'まず `/rpg start` でキャラクターを作成してください。', flags: [MessageFlags.Ephemeral] });
  }

  return interaction.reply({ embeds: [buildStatusEmbed(player)], components: [buildBackRow('menu_character', 'キャラクターメニューへ')], flags: [MessageFlags.Ephemeral] });
}

async function handleInventoryCommand(interaction) {
  const player = getPlayer(interaction.user.id);
  if (!player) {
    return interaction.reply({ content: 'まず `/rpg start` でキャラクターを作成してください。', flags: [MessageFlags.Ephemeral] });
  }

  const counts = {};
  for (const key of player.inventory || []) counts[key] = (counts[key] || 0) + 1;
  const lines = Object.entries(counts).map(([key, count]) => {
    const item = ITEMS[key];
    return item ? `**${item.name}** x${count}\n${item.description}` : `**${key}** x${count}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x2E75B6)
    .setTitle(`${player.name} の所持品`)
    .setDescription(lines.length ? lines.join('\n\n') : '所持品はありません。')
    .setFooter({ text: `Gold: ${player.gold} G | Etherion Chronicle` });

  return interaction.reply({ embeds: [embed], components: [buildBackRow('menu_character', 'キャラクターメニューへ')], flags: [MessageFlags.Ephemeral] });
}

async function handleRankingCommand(interaction) {
  const ranking = getRanking(10);
  const lines = ranking.map((player, index) => {
    const cls = CLASSES[player.class];
    return `**${index + 1}.** ${cls?.emoji || ''} ${player.name} - Lv.${player.level} / EXP ${player.exp}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('ランキング')
    .setDescription(lines.length ? lines.join('\n') : 'まだランキングに表示できるキャラクターがいません。')
    .setFooter({ text: 'Etherion Chronicle' });

  return interaction.reply({ embeds: [embed], components: [buildBackRow('menu_records', '記録メニューへ')] });
}

async function handleExploreCommand(interaction) {
  const userId = interaction.user.id;
  const player = getPlayer(userId);
  if (!player) {
    return interaction.reply({ content: 'まず `/rpg start` でキャラクターを作成してください。', flags: [MessageFlags.Ephemeral] });
  }

  const { ok, remaining } = canExplore(userId);
  if (!ok) {
    return interaction.reply({ content: `あと ${remaining} 秒待ってから探索してください。`, flags: [MessageFlags.Ephemeral] });
  }

  const event = explore(userId, player.current_area);
  const area = AREAS[player.current_area];

  if (event.type === 'battle') {
    await interaction.deferReply();
    const battleScene = await buildBattleSceneAttachment({
      areaKey: player.current_area,
      areaName: area.name,
      enemyKey: event.enemyKey,
      enemyName: event.enemy.name,
    });

    const embed = new EmbedBuilder()
      .setColor(0xC00000)
      .setTitle('エンカウント')
      .setDescription(`**${area.name}** を探索中、**${event.enemy.name}** が現れた！\nHP: ${event.enemy.hp}`)
      .setImage(`attachment://${battleScene.name}`)
      .setFooter({ text: 'Etherion Chronicle' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`battle_attack:${event.enemyKey}`).setLabel('攻撃').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`battle_skillmenu:${event.enemyKey}`).setLabel('スキル').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`battle_item:${event.enemyKey}`).setLabel('アイテム').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`battle_escape:${event.enemyKey}`).setLabel('逃げる').setStyle(ButtonStyle.Secondary),
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row, buildBackRow('menu_adventure', '冒険メニューへ')],
      files: [battleScene],
    });
  }

  await interaction.deferReply();
  const updatedPlayer = getPlayer(userId);
  const exploreScene = await createExploreImage(player.current_area, area.name, event);
  const embed = new EmbedBuilder()
    .setImage(`attachment://${exploreScene.name}`)
    .setFooter({ text: 'Etherion Chronicle' });

  if (event.type === 'treasure') {
    embed
      .setColor(0xFFD700)
      .setTitle('宝箱発見')
      .setDescription(`**${area.name}** を探索中、**${event.gold}G** を手に入れた！\n所持金: ${updatedPlayer.gold}G`);
  } else if (event.type === 'heal') {
    embed
      .setColor(0x00CC44)
      .setTitle('回復の泉')
      .setDescription(`**${area.name}** を探索中、HPが **${event.heal}** 回復した。\nHP: ${updatedPlayer.hp}/${updatedPlayer.max_hp}`);
  } else if (event.type === 'npc') {
    embed
      .setColor(0x7289DA)
      .setTitle(`${event.npc.name} と出会った`)
      .setDescription(`**${area.name}** を探索中...\n${event.npc.message}`);
  } else {
    embed
      .setColor(0x666666)
      .setTitle('探索')
      .setDescription(`**${area.name}** を探索した...\n${event.message}`);
  }

  return interaction.editReply({
    embeds: [embed],
    components: [buildBackRow('menu_adventure', '冒険メニューへ')],
    files: [exploreScene],
  });
}

client.login(process.env.DISCORD_TOKEN);
