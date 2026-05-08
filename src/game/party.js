// src/game/party.js
// パーティシステム

// パーティデータ（メモリ上で管理）
// { partyId: { leaderId, members: [userId], invites: [userId], status: 'waiting'|'exploring' } }
const parties = new Map();

// ユーザーがどのパーティに所属しているか
// { userId: partyId }
const userPartyMap = new Map();

// 招待の管理 { inviteeId: { partyId, inviterId, expiresAt } }
const pendingInvites = new Map();

const MAX_PARTY_SIZE = 4;
const INVITE_EXPIRE_MS = 60 * 1000; // 招待は60秒で失効

// ユニークなパーティIDを生成
function generatePartyId() {
  return `party_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// パーティ作成（リーダーが呼ぶ）
export function createParty(leaderId) {
  if (userPartyMap.has(leaderId)) {
    return { ok: false, message: '⚠️ すでにパーティに参加しています。先に `/rpg party leave` で抜けてください。' };
  }

  const partyId = generatePartyId();
  parties.set(partyId, {
    partyId,
    leaderId,
    members: [leaderId],
    status: 'waiting',
    createdAt: Date.now(),
  });
  userPartyMap.set(leaderId, partyId);

  return { ok: true, partyId };
}

// 招待を送る
export function inviteToParty(leaderId, inviteeId) {
  const partyId = userPartyMap.get(leaderId);
  if (!partyId) return { ok: false, message: '⚠️ あなたはパーティを持っていません。先に `/rpg party create` でパーティを作ってください。' };

  const party = parties.get(partyId);
  if (party.leaderId !== leaderId) return { ok: false, message: '⚠️ パーティのリーダーのみ招待できます。' };
  if (party.members.length >= MAX_PARTY_SIZE) return { ok: false, message: `⚠️ パーティは最大 ${MAX_PARTY_SIZE} 人です。` };
  if (party.members.includes(inviteeId)) return { ok: false, message: '⚠️ そのユーザーはすでにパーティメンバーです。' };
  if (userPartyMap.has(inviteeId)) return { ok: false, message: '⚠️ そのユーザーはすでに別のパーティに参加しています。' };

  pendingInvites.set(inviteeId, {
    partyId,
    inviterId: leaderId,
    expiresAt: Date.now() + INVITE_EXPIRE_MS,
  });

  return { ok: true, partyId };
}

// 招待を承諾
export function acceptInvite(inviteeId) {
  const invite = pendingInvites.get(inviteeId);
  if (!invite) return { ok: false, message: '⚠️ 有効な招待がありません。' };
  if (Date.now() > invite.expiresAt) {
    pendingInvites.delete(inviteeId);
    return { ok: false, message: '⏰ 招待の有効期限が切れています。' };
  }
  if (userPartyMap.has(inviteeId)) return { ok: false, message: '⚠️ すでに別のパーティに参加しています。' };

  const party = parties.get(invite.partyId);
  if (!party) {
    pendingInvites.delete(inviteeId);
    return { ok: false, message: '⚠️ パーティが見つかりません（解散済みかもしれません）。' };
  }
  if (party.members.length >= MAX_PARTY_SIZE) {
    pendingInvites.delete(inviteeId);
    return { ok: false, message: `⚠️ パーティが満員（${MAX_PARTY_SIZE}人）です。` };
  }

  party.members.push(inviteeId);
  userPartyMap.set(inviteeId, invite.partyId);
  pendingInvites.delete(inviteeId);

  return { ok: true, party };
}

// 招待を拒否
export function declineInvite(inviteeId) {
  if (!pendingInvites.has(inviteeId)) return { ok: false, message: '⚠️ 有効な招待がありません。' };
  const invite = pendingInvites.get(inviteeId);
  pendingInvites.delete(inviteeId);
  return { ok: true, inviterId: invite.inviterId };
}

// パーティを抜ける
export function leaveParty(userId) {
  const partyId = userPartyMap.get(userId);
  if (!partyId) return { ok: false, message: '⚠️ パーティに参加していません。' };

  const party = parties.get(partyId);
  party.members = party.members.filter(id => id !== userId);
  userPartyMap.delete(userId);

  // メンバーが0人になったら解散
  if (party.members.length === 0) {
    parties.delete(partyId);
    return { ok: true, disbanded: true };
  }

  // リーダーが抜けたら次のメンバーに引き継ぎ
  if (party.leaderId === userId) {
    party.leaderId = party.members[0];
    return { ok: true, disbanded: false, newLeader: party.leaderId };
  }

  return { ok: true, disbanded: false };
}

// パーティを解散（リーダーのみ）
export function disbandParty(leaderId) {
  const partyId = userPartyMap.get(leaderId);
  if (!partyId) return { ok: false, message: '⚠️ パーティに参加していません。' };

  const party = parties.get(partyId);
  if (party.leaderId !== leaderId) return { ok: false, message: '⚠️ リーダーのみ解散できます。' };

  // 全メンバーのマップから削除
  for (const memberId of party.members) {
    userPartyMap.delete(memberId);
  }
  parties.delete(partyId);

  return { ok: true, members: party.members };
}

// パーティ情報取得
export function getParty(userId) {
  const partyId = userPartyMap.get(userId);
  if (!partyId) return null;
  return parties.get(partyId) || null;
}

// 保留中の招待を取得
export function getPendingInvite(userId) {
  const invite = pendingInvites.get(userId);
  if (!invite) return null;
  if (Date.now() > invite.expiresAt) {
    pendingInvites.delete(userId);
    return null;
  }
  return invite;
}

// パーティの戦闘力スコア（ボス難易度調整用）
export function getPartyPower(party) {
  return party.members.length; // 人数分だけボスのHP・攻撃がスケール
}

export function getPartyById(partyId) {
  return dbGetPartyById(partyId);
}