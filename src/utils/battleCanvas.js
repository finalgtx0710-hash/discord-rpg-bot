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
  const spriteKey = {
    dark_goblin: 'goblin',
  }[enemyKey] || enemyKey;

  const candidates = [
    path.join(ROOT, `assets/enemies/normal/${enemyKey}.png`),
    path.join(ROOT, `assets/enemies/normal/${spriteKey}.png`),
    path.join(ROOT, `assets/monsters/${enemyKey}.png`),
    path.join(ROOT, `assets/monsters/${spriteKey}.png`),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function drawEnemyPlaceholder(ctx, enemyName) {
  const cx = 640;
  const cy = 265;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, 472, 210, 42, 0, 0, Math.PI * 2);
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

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(enemyName, cx, 508);
  ctx.restore();
}

// 戦闘画面を1枚の画像に合成して返す
export async function createBattleImage(areaKey, enemyKey, enemyName, enemyHp, enemyMaxHp) {
  const canvas = createCanvas(1280, 720);
  const ctx = canvas.getContext('2d');

  // ===== 背景画像 =====
  const bgPath = path.join(ROOT, `assets/backgrounds/${areaKey}.png`);
  const bgFallback = path.join(ROOT, 'assets/backgrounds/starting_village.png');

  try {
    const bgFile = fs.existsSync(bgPath) ? bgPath : bgFallback;
    const bg = await loadImage(bgFile);
    ctx.drawImage(bg, 0, 0, 1280, 720);
  } catch(e) {
    // 背景なければグラデーション
    const grad = ctx.createLinearGradient(0, 0, 0, 720);
    grad.addColorStop(0, '#0a0a1a');
    grad.addColorStop(1, '#1a1a3a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 720);
  }

  // ===== 暗幕オーバーレイ =====
  ctx.fillStyle = 'rgba(0, 0, 20, 0.35)';
  ctx.fillRect(0, 0, 1280, 720);

  // ===== モンスター画像 =====
  const monsterPath = resolveEnemySpritePath(enemyKey);
  let drewMonster = false;
  try {
    if (monsterPath) {
      const monster = await loadImage(monsterPath);
      // 中央に表示（512x512サイズ想定）
      const mw = 420, mh = 420;
      const mx = (1280 - mw) / 2;
      const my = 80;
      ctx.drawImage(monster, mx, my, mw, mh);
      drewMonster = true;
    }
  } catch(e) {
    // モンスター画像なし
  }

  if (!drewMonster) {
    drawEnemyPlaceholder(ctx, enemyName);
  }

  // ===== 下部UI背景 =====
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 540, 1280, 180);

  // ===== 上部エーテル光彩 =====
  const glow = ctx.createLinearGradient(0, 0, 1280, 0);
  glow.addColorStop(0, 'rgba(77, 166, 255, 0)');
  glow.addColorStop(0.5, 'rgba(77, 166, 255, 0.15)');
  glow.addColorStop(1, 'rgba(77, 166, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 535, 1280, 3);

  // ===== 敵名 =====
  ctx.shadowColor = '#4DA6FF';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText(enemyName, 60, 70);
  ctx.shadowBlur = 0;

  // ===== HPバー背景 =====
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(60, 85, 400, 30, 8);
  ctx.fill();

  // HPバー本体
  const hpRatio = Math.max(0, enemyHp / enemyMaxHp);
  const hpColor = hpRatio > 0.5 ? '#00CC44' : hpRatio > 0.25 ? '#FFAA00' : '#CC0000';
  ctx.fillStyle = hpColor;
  ctx.beginPath();
  ctx.roundRect(62, 87, (396 * hpRatio), 26, 6);
  ctx.fill();

  // HPテキスト
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`HP ${enemyHp} / ${enemyMaxHp}`, 70, 107);

  // ===== 下部テキスト =====
  ctx.fillStyle = '#4DA6FF';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('行動を選択してください', 60, 590);

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '20px sans-serif';
  ctx.fillText('Etherion Chronicle', 60, 630);

  // ===== 画像をBufferに変換 =====
  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: 'battle-scene.png' });
}

// エリア探索画面を合成
export async function createExploreImage(areaKey, areaName) {
  const canvas = createCanvas(1280, 720);
  const ctx = canvas.getContext('2d');

  const bgPath = path.join(ROOT, `assets/backgrounds/${areaKey}.png`);

  try {
    if (fs.existsSync(bgPath)) {
      const bg = await loadImage(bgPath);
      ctx.drawImage(bg, 0, 0, 1280, 720);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, 720);
      grad.addColorStop(0, '#0a0a1a');
      grad.addColorStop(1, '#1a1a3a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1280, 720);
    }
  } catch(e) {}

  // オーバーレイ
  ctx.fillStyle = 'rgba(0, 0, 20, 0.3)';
  ctx.fillRect(0, 0, 1280, 720);

  // 下部UI
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 560, 1280, 160);

  // 光彩ライン
  const glow = ctx.createLinearGradient(0, 0, 1280, 0);
  glow.addColorStop(0, 'rgba(77, 166, 255, 0)');
  glow.addColorStop(0.5, 'rgba(77, 166, 255, 0.3)');
  glow.addColorStop(1, 'rgba(77, 166, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 557, 1280, 3);

  // エリア名
  ctx.shadowColor = '#4DA6FF';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(areaName, 60, 630);
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(77,166,255,0.8)';
  ctx.font = '24px sans-serif';
  ctx.fillText('Etherion Chronicle', 60, 665);

  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: 'explore-scene.png' });
}
