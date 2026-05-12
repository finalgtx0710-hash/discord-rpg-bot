// src/utils/battleCanvas.js
// Canvas を使った戦闘画面合成

import { createCanvas, loadImage } from 'canvas';
import { AttachmentBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../../');

function resolveEnemySpritePath(enemyKey) {
  const candidates = [
    path.join(ROOT, `assets/enemies/bosses/${enemyKey}.png`),
    path.join(ROOT, `assets/bosses/${enemyKey}.png`),
    path.join(ROOT, `assets/enemies/normal/${enemyKey}.png`),
    path.join(ROOT, `assets/monsters/${enemyKey}.png`),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function drawImageContain(ctx, image, x, y, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const drawX = x + (maxWidth - width) / 2;
  const drawY = y + (maxHeight - height) / 2;
  ctx.drawImage(image, drawX, drawY, width, height);
}

function drawImageCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function resolveBackgroundPath(areaKey, { battle = false } = {}) {
  const candidates = [
    battle && path.join(ROOT, `assets/backgrounds/battle/${areaKey}.png`),
    path.join(ROOT, `assets/backgrounds/${areaKey}.png`),
    areaKey === 'forest_of_whispers' && path.join(ROOT, 'assets/backgrounds/battle/forest.png'),
    path.join(ROOT, 'assets/backgrounds/starting_village.png'),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

// 戦闘画面を1枚の画像に合成して返す
export async function createBattleImage(areaKey, enemyKey, enemyName, enemyHp, enemyMaxHp) {
  const canvas = createCanvas(1280, 720);
  const ctx = canvas.getContext('2d');

  // ===== 背景画像 =====
  try {
    const bgFile = resolveBackgroundPath(areaKey, { battle: true });
    const bg = await loadImage(bgFile);
    drawImageCover(ctx, bg, 0, 0, 1280, 720);
  } catch(e) {
    // 背景がなければグラデーション
    const grad = ctx.createLinearGradient(0, 0, 0, 720);
    grad.addColorStop(0, '#0a0a1a');
    grad.addColorStop(1, '#1a1a3a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 720);
  }

  // ===== モンスター画像 =====
  const monsterPath = resolveEnemySpritePath(enemyKey);
  try {
    if (monsterPath) {
      const monster = await loadImage(monsterPath);
      drawImageContain(ctx, monster, 430, 80, 420, 420);
    }
  } catch(e) {
    // モンスター画像なし
  }

  // ===== 画像をBufferに変換 =====
  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: `battle-scene-${enemyKey}-${Date.now()}.png` });
}

// エリア探索画面を合成
export async function createExploreImage(areaKey, areaName) {
  const canvas = createCanvas(1280, 720);
  const ctx = canvas.getContext('2d');

  try {
    const bgPath = resolveBackgroundPath(areaKey);
    if (bgPath) {
      const bg = await loadImage(bgPath);
      drawImageCover(ctx, bg, 0, 0, 1280, 720);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, 720);
      grad.addColorStop(0, '#0a0a1a');
      grad.addColorStop(1, '#1a1a3a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1280, 720);
    }
  } catch(e) {}

  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: 'explore-scene.png' });
}
