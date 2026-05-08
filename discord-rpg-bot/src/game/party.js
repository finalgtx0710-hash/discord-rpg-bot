// src/game/party.js
// パーティシステム（DB永続化対応）

import {
  dbCreateParty, dbGetPartyByUser, dbGetPartyById,
  dbUpdateParty, dbDeleteParty,
  dbSetInvite, dbGetInvite, dbDeleteInvite
} from '../database/db.js';

const MAX_PARTY_SIZE = 4;
const INVITE_EXPIRE_MS = 60 * 1000;

function generatePartyId() {
  return `party_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// パーティ作成
export function createParty(leaderId) {
  if (dbGetPartyByUser(leaderId)) {
    return { ok: false, message: '⚠️ すでにパーティに参加しています。先に `/rpg party leave` で抜けてください。' };
  }
  const partyId = generatePartyId();
  dbCreateParty(partyId, leaderId);
  return { ok: true, partyId };
}

// 招待を送る
export function inviteToParty(leaderId, inviteeId) {
  const party = dbGetPartyByUser(leaderId);
  if (!party) return { ok: false, message: '⚠️ パーティを持っていません。先に `/rpg party create` で作成してください。' };
  if (party.leader_id !== leaderId) return { ok: false, message: '⚠️ リーダーのみ招待できます。' };
  if (party.members.length >= MAX_PARTY_SIZE) return { ok: false, message: `⚠️ パーティは最大 ${MAX_PARTY_SIZE} 人です。` };
  if (party.members.includes(inviteeId)) return { ok: false, message: '⚠️ すでにパーティメンバーです。' };
  if (dbGetPartyByUser(inviteeId)) return { ok: false, message: '⚠️ そのユーザーはすでに別のパーティに参加しています。' };

  const expiresAt = new Date(Date.now() + INVITE_EXPIRE_MS).toISOString();
  dbSetInvite(inviteeId, party.party_id, leaderId, expiresAt);
  return { ok: true, partyId: party.party_id };
}

// 招待を承諾
export function acceptInvite(inviteeId) {
  const invite = dbGetInvite(inviteeId);
  if (!invite) return { ok: false, message: '⚠️ 有効な招待がありません。' };
  if (new Date(invite.expires_at) < new Date()) {
    dbDeleteInvite(inviteeId);
    return { ok: false, message: '⏰ 招待の有効期限が切れています。' };
  }
  if (dbGetPartyByUser(inviteeId)) return { ok: false, message: '⚠️ すでに別のパーティに参加しています。' };

  const party = dbGetPartyById(invite.party_id);
  if (!party) {
    dbDeleteInvite(inviteeId);
    return { ok: false, message: '⚠️ パーティが見つかりません（解散済みかもしれません）。' };
  }
  if (party.members.length >= MAX_PARTY_SIZE) {
    dbDeleteInvite(inviteeId);
    return { ok: false, message: `⚠️ パーティが満員です。` };
  }

  party.members.push(inviteeId);
  dbUpdateParty(party.party_id, { members: party.members });
  dbDeleteInvite(inviteeId);
  return { ok: true, party };
}

// 招待を拒否
export function declineInvite(inviteeId) {
  const invite = dbGetInvite(inviteeId);
  if (!invite) return { ok: false, message: '⚠️ 有効な招待がありません。' };
  dbDeleteInvite(inviteeId);
  return { ok: true, inviterId: invite.inviter_id };
}

// パーティを抜ける
export function leaveParty(userId) {
  const party = dbGetPartyByUser(userId);
  if (!party) return { ok: false, message: '⚠️ パーティに参加していません。' };

  party.members = party.members.filter(id => id !== userId);

  if (party.members.length === 0) {
    dbDeleteParty(party.party_id);
    return { ok: true, disbanded: true };
  }

  let newLeader = null;
  if (party.leader_id === userId) {
    newLeader = party.members[0];
    dbUpdateParty(party.party_id, { members: party.members, leader_id: newLeader });
  } else {
    dbUpdateParty(party.party_id, { members: party.members });
  }

  return { ok: true, disbanded: false, newLeader };
}

// パーティ解散
export function disbandParty(leaderId) {
  const party = dbGetPartyByUser(leaderId);
  if (!party) return { ok: false, message: '⚠️ パーティに参加していません。' };
  if (party.leader_id !== leaderId) return { ok: false, message: '⚠️ リーダーのみ解散できます。' };

  const members = [...party.members];
  dbDeleteParty(party.party_id);
  return { ok: true, members };
}

// パーティ取得（userIdから）
export function getParty(userId) {
  return dbGetPartyByUser(userId);
}

// パーティ取得（partyIdから）
export function getPartyById(partyId) {
  return dbGetPartyById(partyId);
}

// 招待取得
export function getPendingInvite(userId) {
  const invite = dbGetInvite(userId);
  if (!invite) return null;
  if (new Date(invite.expires_at) < new Date()) {
    dbDeleteInvite(userId);
    return null;
  }
  return invite;
}
