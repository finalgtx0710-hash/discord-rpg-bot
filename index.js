// index.js の戦闘終了判定部分 (result.battleEnd)

    if (result.battleEnd) {
      // 全画面共通の戻るボタン
      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('back_main')
          .setLabel('◀ メインメニューへ')
          .setStyle(ButtonStyle.Primary)
      );

      let statusColor = 0x666666;
      let title = '';

      if (result.victory) {
        statusColor = 0x00CC44;
        title = '🎉 戦闘勝利！';
        const { exp, gold } = result.rewards;
        description += `\n\n獲得: ${exp} EXP / ${gold} G`;
      } else if (result.playerDied) {
        statusColor = 0xFF0000;
        title = '💀 敗北...';
      } else {
        title = '💨 逃走成功';
      }

      return interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(statusColor)
          .setTitle(title)
          .setDescription(description)
          .setFooter({ text: 'Etherion Chronicle' })
        ],
        components: [backRow] // ここで必ずボタンを表示
      });
    }