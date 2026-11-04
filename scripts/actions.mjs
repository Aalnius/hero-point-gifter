import { postCard, nameList } from "./chat.mjs";
import { MODULE_ID } from "./constants.mjs";
import { pickDivineReason } from "./reasons.mjs";
import { divineGrantsEnabled, getPlayers, getSession, grantCount, heroPointsOf, intervalMs, updateSession } from "./session.mjs";

const HERO_POINTS_PATH = "system.resources.heroPoints.value";

/** Add one hero point to a user's character, capped at the actor's maximum. */
export async function addHeroPoint(user) {
  const actor = user.character;
  const { value, max } = heroPointsOf(actor);
  await actor.update({ [HERO_POINTS_PATH]: Math.min(value + 1, max) });
}

/** In-place Fisher–Yates shuffle. */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const activePlayers = () => getPlayers().filter(user => user.active);

export async function startSession() {
  const { number } = getSession();
  await updateSession({
    active: true,
    number: number + 1,
    nextGrantAt: divineGrantsEnabled() ? Date.now() + intervalMs() : null,
    pausedRemaining: null,
    gifts: {},
    log: []
  });
  ui.notifications.info(game.i18n.format("HPG.Notify.SessionStarted", { number: number + 1 }));

  const atZero = activePlayers().filter(user => heroPointsOf(user.character).value === 0);
  if (!atZero.length) return;
  for (const user of atZero) await addHeroPoint(user);
  await postCard({
    speaker: game.i18n.localize("HPG.Chat.GodsSpeaker"),
    title: game.i18n.localize("HPG.Chat.StartTitle"),
    body: "HPG.Chat.StartBody",
    html: { names: nameList(atZero.map(user => user.character.name)) }
  });
}

/**
 * Correct the session counter if it drifts out of sync. While a session runs this renames it;
 * otherwise it sets the number the next session will use.
 * @param {number} number
 */
export async function setSessionNumber(number) {
  if (!Number.isInteger(number) || number < 1) return;
  await updateSession({ number: getSession().active ? number : number - 1 });
}

export async function endSession() {
  if (!getSession().active) return ui.notifications.warn(game.i18n.localize("HPG.Notify.NoSessionToEnd"));
  await updateSession({ active: false, nextGrantAt: null, pausedRemaining: null });
  ui.notifications.info(game.i18n.localize("HPG.Notify.SessionEnded"));
}

export async function resetGift(userId) {
  const gifts = { ...getSession().gifts };
  delete gifts[userId];
  await updateSession({ gifts });
  ui.notifications.info(game.i18n.format("HPG.Notify.GiftReset", { name: game.users.get(userId)?.name ?? userId }));
}

/** Grant a hero point to random active players below their maximum. */
export async function grantRandomHeroPoints() {
  const speaker = game.i18n.localize("HPG.Chat.GodsSpeaker");
  const eligible = activePlayers().filter(user => {
    const { value, max } = heroPointsOf(user.character);
    return value < max;
  });

  if (!eligible.length) {
    return postCard({ speaker, title: game.i18n.localize("HPG.Chat.GrantTitle"), body: "HPG.Chat.GrantNobody" });
  }

  const chosen = shuffle(eligible).slice(0, grantCount());
  for (const user of chosen) await addHeroPoint(user);
  await postCard({
    speaker,
    title: game.i18n.localize("HPG.Chat.GrantTitle"),
    body: "HPG.Chat.GrantBody",
    html: { names: nameList(chosen.map(user => user.character.name)) },
    note: game.settings.get(MODULE_ID, "divineReasons")
      ? game.i18n.format("HPG.Chat.GiftReason", { reason: pickDivineReason() })
      : ""
  });
}

/** GM override: give a hero point outside the gift rules, with no session, limit or online check. */
export async function giveHeroPoint(userId) {
  const user = game.users.get(userId);
  if (!game.user.isGM || !user?.character) return;
  const { value, max } = heroPointsOf(user.character);
  if (value >= max) return ui.notifications.warn(game.i18n.localize("HPG.Notify.Rejected.recipientMax"));
  await addHeroPoint(user);
  await postCard({
    speaker: game.i18n.localize("HPG.Chat.GodsSpeaker"),
    title: game.i18n.localize("HPG.Chat.GrantTitle"),
    body: "HPG.Chat.GrantBody",
    html: { names: nameList([user.character.name]) }
  });
}

/** GM override: remove one hero point. */
export async function takeHeroPoint(userId) {
  const user = game.users.get(userId);
  if (!game.user.isGM || !user?.character) return;
  const { value } = heroPointsOf(user.character);
  if (value > 0) await user.character.update({ [HERO_POINTS_PATH]: value - 1 });
}
