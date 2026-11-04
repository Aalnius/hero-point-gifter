import { MAX_REASON_LENGTH, SOCKET } from "./constants.mjs";
import { addHeroPoint } from "./actions.mjs";
import { postCard } from "./chat.mjs";
import { pickFunnyReason } from "./reasons.mjs";
import { getSession, giftLimit, heroPointsOf, updateSession } from "./session.mjs";

/**
 * Why a gift cannot go through, or null when it can. Used by the sidebar to disable
 * buttons and, authoritatively, by the GM client before applying a gift.
 * @param {string} giverId
 * @param {string} recipientId
 * @returns {string|null}  A key of `HPG.Notify.Rejected`.
 */
export function giftBlockReason(giverId, recipientId) {
  const session = getSession();
  const giver = game.users.get(giverId);
  const recipient = game.users.get(recipientId);

  if (!session.active) return "inactive";
  if (!giver || giver.isGM) return "invalidGiver";
  if (giverId === recipientId) return "self";
  if ((session.gifts[giverId] ?? 0) >= giftLimit()) return "alreadyGifted";
  if (!recipient || recipient.isGM || !recipient.character) return "invalidRecipient";
  if (!recipient.active) return "offline";
  const { value, max } = heroPointsOf(recipient.character);
  if (value >= max) return "recipientMax";
  return null;
}

/** Listen for gift requests (on the active GM) and rejections (on the giver). */
export function activateSocket() {
  game.socket.on(SOCKET, onSocketMessage);
}

function onSocketMessage(message, senderId) {
  switch (message?.type) {
    case "gift":
      if (game.user === game.users.activeGM) enqueue(() => processGift(senderId, message));
      break;
    case "reject":
      if (message.to === game.user.id) {
        ui.notifications.warn(game.i18n.localize(`HPG.Notify.Rejected.${message.reason}`));
      }
      break;
  }
}

/** Gifts are applied one at a time so the per-session limit cannot be raced. */
let queue = Promise.resolve();
function enqueue(task) {
  queue = queue.then(task).catch(err => console.error("Hero Point Gift | gift failed", err));
}

/**
 * Ask the active GM to apply a gift from the current user.
 * @param {string} recipientId
 * @param {string} reason
 */
export function requestGift(recipientId, reason) {
  if (!game.users.activeGM) return ui.notifications.warn(game.i18n.localize("HPG.Notify.NoActiveGM"));
  const message = { type: "gift", recipientId, reason: String(reason ?? "").trim().slice(0, MAX_REASON_LENGTH) };
  game.socket.emit(SOCKET, message);
  ui.notifications.info(game.i18n.localize("HPG.Gift.Sent"));
}

/** Runs on the active GM's client. `senderId` is supplied by the server, so it cannot be spoofed. */
async function processGift(senderId, { recipientId, reason }) {
  const blocked = giftBlockReason(senderId, recipientId);
  if (blocked) return game.socket.emit(SOCKET, { type: "reject", to: senderId, reason: blocked });

  const giver = game.users.get(senderId);
  const recipient = game.users.get(recipientId);
  reason = String(reason ?? "").trim().slice(0, MAX_REASON_LENGTH) || pickFunnyReason();

  await addHeroPoint(recipient);

  const session = getSession().toObject();
  await updateSession({
    gifts: { ...session.gifts, [senderId]: (session.gifts[senderId] ?? 0) + 1 },
    log: [...session.log, { giverId: senderId, recipientId, reason, timestamp: Date.now() }]
  });

  await postCard({
    speaker: game.i18n.localize("HPG.Chat.GiftSpeaker"),
    title: game.i18n.localize("HPG.Chat.GiftTitle"),
    body: "HPG.Chat.GiftBody",
    params: {
      giver: giver.character?.name ?? giver.name,
      recipient: recipient.character.name
    },
    note: reason ? game.i18n.format("HPG.Chat.GiftReason", { reason }) : ""
  });
}
