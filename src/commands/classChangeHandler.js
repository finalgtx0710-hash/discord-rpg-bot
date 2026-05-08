import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getPlayer, updatePlayer } from '../database/db.js';
import { CLASSES } from '../data/master.js';

// 第二職業定義
const ADVANCED_CLASSES = {
  paladin: {
    id: 'paladin', name: '聖騎士', emoji: '🛡️',
    base_class: 'warrior', level_req: 10,
    description: '戦士と僧侶の力を併せ持つ守護者。高い防御力と回復魔法を使いこなす。',
    stat_bonus: { max_hp: 50, max_mp: 20, atk: 5, def: 15, spd: -2 },
  },
  archmage: {
    id: 'archmage', name: '大魔法使い', emoji: '🌟',
    base_class: 'mage', level_req: 10,
    description: '魔法の極みに達した者。MPが大幅に増加し、強力な呪文を操る。',
    stat_bonus: { max_hp: -10, max_mp: 60, atk: 15, def: -2, spd: 3 },
  },
  bishop: {
    id: 'bishop', name: '司教', emoji: '✝️',
    base_class: 'cleric', level_req: 10,
    description: '神の力を最大限に引き出す高位聖職者。回復量と攻撃魔法が強化される。',
    stat_bonus: { max_hp: 20, max_mp: 40, atk: 8, def: 5, spd: 0 },
  },
  assassin: {
    id: 'assassin', name: '暗殺者', emoji: '🌑',
    base_class: 'rogue', level_req: 10,
    description: '闇に潜む死の使い。速度と会心率が極限まで高まる。',
    stat_bonus: { max_hp: -10, max_mp: 10, atk: 12, def: -3, spd: 15 },
  },
  ranger: {
    id: 'ranger', name: 'レンジャー', emoji: '🌿',
    base_class: 'archer', level_req: 10,
    description: '自然と一体化した狩人。複数攻撃と罠を駆使して戦う。',
    stat_bonus: { max_hp: 15, max_mp: 15, atk: 10, def: 3, spd: 5 },
  },
};

// 現在のクラスに対応する上位職を取得
function getAdvancedClass(playerClass) {
  return Object.values(ADVANCED_CLASSES).find(ac => ac.base_class === playerClass) || null;
}

// /rpg classchange コマンド
export async function handleClassChangeCommand(interaction) {
  const userId = interaction.user.id;
  const player = getPlayer(userId);
  if (!player) return interaction.reply({ content: 'まずは /rpg start でキャラクターを作成してください！', ephemeral: true });

  // 既にクラスチェンジ済みか確認
  const isAdvanced = Object.keys(ADVANCED_CLASSES).includes(player.class);
  if (isAdvanced) {
    const ac = ADVANCED_CLASSES[player.class];
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('⚔️ クラスチェンジ')
        .setDescription(`あなたはすでに **${ac.emoji} ${ac.name}** に転職しています！\n\nクラスチェンジは1回のみ可能です。`)
        .setFooter({ text: 'Etherion Chronicle' })
      ],
      ephemeral: true,
    });
  }

  const advClass = getAdvancedClass(player.class);
  if (!advClass) {
    return interaction.reply({ content: '⚠️ このクラスの上位職が見つかりません。', ephemeral: true });
  }

  const canChange = player.level >= advClass.level_req;
  const cls = CLASSES[player.class];

  const bonusLines = Object.entries(advClass.stat_bonus)
    .map(([stat, val]) => `${stat.toUpperCase()}: ${val > 0 ? '+' : ''}${val}`)
    .join(' / ');

  const embed = new EmbedBuilder()
    .setColor(canChange ? 0x9B59B6 : 0x666666)
    .setTitle('⚔️ クラスチェンジ')
    .setDescription(
      `**${cls.emoji} ${cls.name}** → **${advClass.emoji} ${advClass.name}**\n\n` +
      `${advClass.description}\n\n` +
      `**ステータス変化**\n${bonusLines}\n\n` +
      (canChange
        ? '転職の準備ができています！'
        : `🔒 Lv.**${advClass.level_req}**以上が必要です。（現在Lv.${player.level}）`)
    )
    .setFooter({ text: '※ クラスチェンジは1回のみ可能です | Etherion Chronicle' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`classchange_confirm:${advClass.id}`)
      .setLabel(`${advClass.name}に転職する`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!canChange),
    new ButtonBuilder()
      .setCustomId('classchange_cancel')
      .setLabel('やめる')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// 転職確認ボタン
export async function handleClassChangeButton(interaction) {
  const userId = interaction.user.id;

  if (interaction.customId === 'classchange_cancel') {
    return interaction.update({
      embeds: [new EmbedBuilder().setColor(0x666666).setTitle('⚔️ クラスチェンジ').setDescription('転職をキャンセルしました。')],
      components: [],
    });
  }

  const advClassId = interaction.customId.replace('classchange_confirm:', '');
  const advClass = ADVANCED_CLASSES[advClassId];
  const player = getPlayer(userId);

  if (!player || !advClass) return interaction.update({ content: '⚠️ エラーが発生しました。', embeds: [], components: [] });
  if (player.level < advClass.level_req) return interaction.update({ content: `⚠️ Lv.${advClass.level_req}以上が必要です。`, embeds: [], components: [] });

  // ステータス更新
  const newStats = {
    class: advClassId,
    max_hp:  player.max_hp  + (advClass.stat_bonus.max_hp  || 0),
    max_mp:  player.max_mp  + (advClass.stat_bonus.max_mp  || 0),
    atk:     player.atk     + (advClass.stat_bonus.atk     || 0),
    def:     player.def     + (advClass.stat_bonus.def     || 0),
    spd:     player.spd     + (advClass.stat_bonus.spd     || 0),
  };
  // HPとMPも全回復
  newStats.hp = newStats.max_hp;
  newStats.mp = newStats.max_mp;

  updatePlayer(userId, newStats);

  const bonusLines = Object.entries(advClass.stat_bonus)
    .map(([stat, val]) => `${stat.toUpperCase()}: ${val > 0 ? '+' : ''}${val}`)
    .join(' / ');

  await interaction.update({
    embeds: [new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('🎉 クラスチェンジ成功！')
      .setDescription(
        `**${advClass.emoji} ${advClass.name}** に転職しました！\n\n` +
        `${advClass.description}\n\n` +
        `**ステータス変化**\n${bonusLines}\n\n` +
        `HPとMPが全回復しました！`
      )
      .setFooter({ text: 'Etherion Chronicle' })
    ],
    components: [],
  });
}