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

function resolveBackgroundPath(areaKey, { battle = false } = {}) {
  const candidates = [
    battle && path.join(ROOT, `assets/backgrounds/battle/${areaKey}.png`),
    path.join(ROOT, `assets/backgrounds/${areaKey}.png`),
    areaKey === 'forest_of_whispers' && path.join(ROOT, 'assets/backgrounds/battle/forest.png'),
    path.join(ROOT, 'assets/backgrounds/starting_village.png'),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function resolveNpcSpritePath(npcKey) {
  if (!npcKey) return null;

  const npcFiles = {
    old_woman: '23e19327-8861-437f-84ec-a01e56357877.png',
    traveling_merchant: '656e44f2-5a84-40ab-9f8e-27e61dcc3de2.png',
  };

  const candidates = [
    path.join(ROOT, `assets/events/explore/npc/${npcKey}.png`),
    npcFiles[npcKey] && path.join(ROOT, `assets/events/explore/npc/${npcFiles[npcKey]}`),
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
      drawTrimmedImageContain(ctx, monster, 360, 20, 700, 570);
    }
  } catch(e) {
    // モンスター画像なし
  }

  // ===== 画像をBufferに変換 =====
  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: `battle-scene-${enemyKey}-${Date.now()}.png` });
}

// エリア探索画面を合成
export async function createExploreImage(areaKey, areaName, event = null) {
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

  if (event?.type === 'npc') {
    const npcPath = resolveNpcSpritePath(event.npc?.imageKey);
    if (npcPath) {
      try {
        const npc = await loadImage(npcPath);
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(690, 635, 185, 34, 0, 0, Math.PI * 2);
        ctx.fill();
        drawTrimmedImageContain(ctx, npc, 500, 70, 380, 560);
        ctx.restore();
      } catch(e) {}
    }
  }

  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: 'explore-scene.png' });
}
