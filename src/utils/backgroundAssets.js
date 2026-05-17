import { AttachmentBuilder } from 'discord.js';
import { existsSync } from 'fs';
import path from 'path';

export function attachBackgroundImage(payload, key, { clearAttachments = false } = {}) {
  const embed = payload.embeds?.[0];
  if (!embed) return payload;

  const backgroundPath = path.join(process.cwd(), 'assets', 'backgrounds', key, `${key}.png`);
  if (!existsSync(backgroundPath)) return payload;

  const attachmentName = `${key}-background-${Date.now()}.png`;
  embed.setImage(`attachment://${attachmentName}`);

  return {
    ...payload,
    ...(clearAttachments ? { attachments: [] } : {}),
    files: [new AttachmentBuilder(backgroundPath, { name: attachmentName })],
  };
}
