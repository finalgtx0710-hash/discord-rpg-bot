import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

// ここに export がついているか確認！
export function buildTownMenu() {
    const embed = new EmbedBuilder()
        .setTitle('🏘️ 町 - セーフエリア')
        .setDescription('町に到着しました。どこへ向かいますか？')
        .setColor('#00ff00');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('shop').setLabel('🛒 ショップ').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('inn').setLabel('🛌 宿屋').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('back_to_main').setLabel('⬅️ 戻る').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row] };
}