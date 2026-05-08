import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('rpg')
    .setDescription('エーテリオン・クロニクル RPGボット')
    .addSubcommand(sub =>
      sub.setName('start').setDescription('冒険を始める（新規キャラクター作成）')
    )
    .addSubcommand(sub =>
      sub.setName('status').setDescription('自分のステータスを確認する')
    )
    .addSubcommand(sub =>
      sub.setName('explore').setDescription('現在のエリアを探索する')
    )
    .addSubcommand(sub =>
      sub.setName('inventory').setDescription('所持品を確認する')
    )
    .addSubcommand(sub =>
      sub.setName('ranking').setDescription('サーバー内のランキングを確認する')
    )
    .addSubcommand(sub =>
      sub.setName('shop').setDescription('ショップでアイテムを売買する')
    )
    .addSubcommand(sub =>
      sub.setName('inn').setDescription('宿屋でHP・MPを全回復する（50G）')
    )
    .addSubcommand(sub =>
      sub.setName('story').setDescription('メインストーリーを読む')
    )
    .addSubcommand(sub =>
      sub.setName('skill').setDescription('習得済みスキルと今後覚えるスキルを確認する')
    )
    .addSubcommand(sub =>
      sub.setName('classchange').setDescription('第二職業に転職する（Lv.10以上・1回限り）')
    )
    .addSubcommand(sub =>
      sub.setName('achievement').setDescription('実績・称号を確認する')
    )
    .addSubcommand(sub =>
      sub.setName('equip').setDescription('装備を管理する（武器・防具の着脱）')
    )
    .addSubcommand(sub =>
      sub.setName('map').setDescription('現在のエリアを確認し、別のエリアへ移動する')
    )
    .addSubcommand(sub =>
      sub.setName('quest').setDescription('クエストボードを見る・進行中クエストを確認する')
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('操作を選択')
            .setRequired(true)
            .addChoices(
              { name: 'クエストボード（受注）', value: 'board' },
              { name: '進行中クエスト確認',     value: 'list' },
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('party').setDescription('パーティの操作')
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('操作を選択')
            .setRequired(true)
            .addChoices(
              { name: '✨ 作成', value: 'create' },
              { name: '📋 状況確認', value: 'status' },
              { name: '📨 招待する', value: 'invite' },
              { name: '🚪 抜ける', value: 'leave' },
              { name: '💥 解散する', value: 'disband' },
            )
        )
        .addUserOption(opt =>
          opt.setName('target')
            .setDescription('招待するユーザー（invite時のみ）')
        )
    ),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('📡 スラッシュコマンドを登録中...');
    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);
    await rest.put(route, { body: commands });
    console.log('✅ スラッシュコマンドの登録完了！');
    console.log(process.env.GUILD_ID
      ? `   → サーバー限定（Guild: ${process.env.GUILD_ID}）`
      : '   → グローバル（全サーバー対象）'
    );
  } catch (error) {
    console.error('❌ エラー:', error);
  }
})();
