import { MODULE_ID, MAX_LOG_ENTRIES } from "./constants.mjs";

const { fields } = foundry.data;

/** The persisted state of the current hero point session. */
export class SessionModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      active: new fields.BooleanField({ initial: false }),
      number: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      /** When the next divine grant is due, or null while the timer is paused or the session is inactive. */
      nextGrantAt: new fields.NumberField({ required: false, nullable: true, initial: null }),
      /** Time left on the divine grant timer while it is paused for lack of online players. */
      pausedRemaining: new fields.NumberField({ required: false, nullable: true, initial: null }),
      /** Number of gifts given this session, keyed by giver user ID. */
      gifts: new fields.ObjectField(),
      log: new fields.ArrayField(new fields.SchemaField({
        giverId: new fields.StringField({ required: true }),
        recipientId: new fields.StringField({ required: true }),
        reason: new fields.StringField({ required: true, blank: true, initial: "" }),
        timestamp: new fields.NumberField({ required: true, integer: true })
      }))
    };
  }
}

/** Read-only snapshot of the session. */
export function getSession() {
  return game.settings.get(MODULE_ID, "session");
}

/**
 * Merge updates into the session. World settings may only be written by a GM.
 * @param {object} updates
 */
export async function updateSession(updates) {
  const current = getSession().toObject();
  const next = { ...current, ...updates };
  next.log = next.log.slice(-MAX_LOG_ENTRIES);
  return game.settings.set(MODULE_ID, "session", next);
}

export const giftLimit = () => game.settings.get(MODULE_ID, "giftsPerSession");
export const intervalMs = () => game.settings.get(MODULE_ID, "grantIntervalMinutes") * 60_000;
export const grantCount = () => game.settings.get(MODULE_ID, "grantsPerInterval");

/** @returns {{value: number, max: number}} PF2e hero point resource of an actor. */
export function heroPointsOf(actor) {
  const resource = actor?.system?.resources?.heroPoints;
  return { value: resource?.value ?? 0, max: resource?.max ?? 3 };
}

/** Players (non-GM users) who own a character. */
export function getPlayers() {
  return game.users.filter(user => !user.isGM && user.character);
}
