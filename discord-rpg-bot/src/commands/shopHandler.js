// src/commands/shopHandler.js
// ショップ機能ハンドラ

import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder
} from 'discord.js';
import { getPlayer, updatePlayer } from '../database/db.js';
import { ITEMS } from '../data/master.js';

// ショップで売っているアイテムリスト（エリアごとに変えることも可能）
const SHOP_INVENTORY = {
  starting_village: [
    { key: 'potion',    price: 50  },
    { key: 'mp_potion', price: 80  },
    { key: 'iron_dagger', price: 120 },
  ],
  forest_of_whispers: [
    { key: 'potion',      price: 50  },
    { key: 'mp_potion',   price: 80  },
    { key: 'steel_sword', price: 350 },
  ],
  ancient_ruins: [
    { key: 'potion',      price: 50  },
    { key: 'mp_potion',   price: 80  },
    { key: 'steel_sword', price: 350 },
  ],
};

// 売却時の買取率
const SELL_RATE = 0.5;

// ショップ一覧Embedを生成
export function buildShopEmbed(player) {
  const shopItems = SHOP_INVENTORY[player.current_area] || SHOP_INVENTORY['starting_village'];

  const lines = shopItems.map(({ key, price }) => {
    const item = ITEMS[key];
    const canAfford = player.gold >= price ? '' : ' *(所持金不足)*';
    return `${item.name}　**${price}G**${canAfford}\n　*${item.description}*`;
  });

  return new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🛒 ショップ')
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: `💰 所持金: ${player.gold} G　| 売却は所持品の50%で買取` });
}

// 売却用: プレイヤーの売れるアイテム一覧
function getSellableItems(player) {
  const inventory = player.inventory || [];
  const counts = {};
  for (const key of inventory) counts[key] = (counts[key] || 0) + 1;

  return Object.entries(counts)
    .filter(([key]) => ITEMS[key] && ITEMS[key].price > 0)
    .map(([key, cnt]) => ({
      key,
      count: cnt,
      sellPrice: Math.floor(ITEMS[key].price * SELL_RATE),
      item: ITEMS[key],
    }));
}

// ショップメインハンドラ（/rpg shop）
export async function handleShopCommand(interaction) {
  const userId = interaction.user.id;
  const player = getPlayer(userId);

  if (!player) {
    return interaction.reply({ content: '⚠️ まずは `/rpg start` でキャラクターを作成してください！', ephemeral: true });
  }

  const shopItems = SHOP_INVENTORY[player.current_area] || SHOP_INVENTORY['starting_village'];

  // 購入メニュー
  const buyOptions = shopItems.map(({ key, price }) => {
    const item = ITEMS[key];
    return {
      label: `${item.name}　${price}G`,
      value: `buy:${key}`,
      description: item.description.substring(0, 50),
    };
  });

  const buyMenu = new StringSelectMenuBuilder()
    .setCustomId('shop_buy')
    .setPlaceholder('🛍️ 購入するアイテムを選ぶ')
    .addOptions(buyOptions);

  const sellableItems = getSellableItems(player);
  const rows = [new ActionRowBuilder().addComponents(buyMenu)];

  // 売却ボタン（売れるアイテムがある場合のみ）
  if (sellableItems.length > 0) {
    const sellOptions = sellableItems.map(({ key, count, sellPrice, item }) => ({
      label: `${item.name} ×${count}　売却: ${sellPrice}G/個`,
      value: `sell:${key}`,
      description: item.description.substring(0, 50),
    }));

    const sellMenu = new StringSelectMenuBuilder()
      .setCustomId('shop_sell')
      .setPlaceholder('💰 売却するアイテムを選ぶ')
      .addOptions(sellOptions);

    rows.push(new ActionRowBuilder().addComponents(sellMenu));
  }

  await interaction.reply({
    embeds: [buildShopEmbed(player)],
    components: rows,
    ephemeral: true,
  });
}

// 購入処理
export async function handleShopBuy(interaction) {
  const userId = interaction.user.id;
  const key = interaction.values[0].replace('buy:', '');
  const player = getPlayer(userId);
  if (!player) return interaction.reply({ content: '⚠️ キャラクターが見つかりません。', ephemeral: true });

  const shopItems = SHOP_INVENTORY[player.current_area] || SHOP_INVENTORY['starting_village'];
  const shopEntry = shopItems.find(s => s.key === key);
  if (!shopEntry) return interaction.update({ content: '⚠️ そのアイテムはこのショップにありません。', embeds: [], components: [] });

  const item = ITEMS[key];
  if (player.gold < shopEntry.price) {
    return interaction.update({
      embeds: [buildShopEmbed(player).setDescription(`❌ **所持金が足りません！**\n必要: ${shopEntry.price}G　所持: ${player.gold}G`)],
      components: interaction.message.components,
    });
  }

  // 購入処理
  const newGold = player.gold - shopEntry.price;
  const newInventory = [...(player.inventory || []), key];
  updatePlayer(userId, { gold: newGold, inventory: newInventory });

  const updatedPlayer = getPlayer(userId);
  const embed = buildShopEmbed(updatedPlayer);
  embed.setTitle('🛒 ショップ　✅ 購入完了！');
  embed.setDescription(`**${item.name}** を購入しました！（-${shopEntry.price}G）\n\n` + embed.data.description);

  // 売却メニューを再構築
  const sellableItems = getSellableItems(updatedPlayer);
  const shopItems2 = SHOP_INVENTORY[updatedPlayer.current_area] || SHOP_INVENTORY['starting_village'];
  const buyOptions = shopItems2.map(({ key: k, price }) => {
    const it = ITEMS[k];
    return { label: `${it.name}　${price}G`, value: `buy:${k}`, description: it.description.substring(0, 50) };
  });
  const buyMenu = new StringSelectMenuBuilder().setCustomId('shop_buy').setPlaceholder('🛍️ 購入するアイテムを選ぶ').addOptions(buyOptions);
  const rows = [new ActionRowBuilder().addComponents(buyMenu)];
  if (sellableItems.length > 0) {
    const sellOptions = sellableItems.map(({ key: k, count, sellPrice, item: it }) => ({
      label: `${it.name} ×${count}　売却: ${sellPrice}G/個`,
      value: `sell:${k}`,
      description: it.description.substring(0, 50),
    }));
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('shop_sell').setPlaceholder('💰 売却するアイテムを選ぶ').addOptions(sellOptions)
    ));
  }

  await interaction.update({ embeds: [embed], components: rows });
}

// 売却処理
export async function handleShopSell(interaction) {
  const userId = interaction.user.id;
  const key = interaction.values[0].replace('sell:', '');
  const player = getPlayer(userId);
  if (!player) return interaction.reply({ content: '⚠️ キャラクターが見つかりません。', ephemeral: true });

  const item = ITEMS[key];
  if (!item || item.price === 0) return interaction.update({ content: '⚠️ そのアイテムは売却できません。', embeds: [], components: [] });

  const inventory = [...(player.inventory || [])];
  const idx = inventory.indexOf(key);
  if (idx === -1) return interaction.update({ content: '⚠️ そのアイテムを持っていません。', embeds: [], components: [] });

  const sellPrice = Math.floor(item.price * SELL_RATE);
  inventory.splice(idx, 1);
  const newGold = player.gold + sellPrice;
  updatePlayer(userId, { gold: newGold, inventory });

  const updatedPlayer = getPlayer(userId);
  const embed = buildShopEmbed(updatedPlayer);
  embed.setTitle('🛒 ショップ　💰 売却完了！');
  embed.setDescription(`**${item.name}** を売却しました！（+${sellPrice}G）\n\n` + embed.data.description);

  // メニュー再構築
  const sellableItems = getSellableItems(updatedPlayer);
  const shopItems = SHOP_INVENTORY[updatedPlayer.current_area] || SHOP_INVENTORY['starting_village'];
  const buyOptions = shopItems.map(({ key: k, price }) => {
    const it = ITEMS[k];
    return { label: `${it.name}　${price}G`, value: `buy:${k}`, description: it.description.substring(0, 50) };
  });
  const buyMenu = new StringSelectMenuBuilder().setCustomId('shop_buy').setPlaceholder('🛍️ 購入するアイテムを選ぶ').addOptions(buyOptions);
  const rows = [new ActionRowBuilder().addComponents(buyMenu)];
  if (sellableItems.length > 0) {
    const sellOptions = sellableItems.map(({ key: k, count, sellPrice: sp, item: it }) => ({
      label: `${it.name} ×${count}　売却: ${sp}G/個`,
      value: `sell:${k}`,
      description: it.description.substring(0, 50),
    }));
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('shop_sell').setPlaceholder('💰 売却するアイテムを選ぶ').addOptions(sellOptions)
    ));
  }

  await interaction.update({ embeds: [embed], components: rows });
}
