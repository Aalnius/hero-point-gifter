import { grantRandomHeroPoints } from "./actions.mjs";
import { divineGrantsEnabled, getPlayers, getSession, intervalMs, updateSession } from "./session.mjs";

/** setTimeout cannot exceed a signed 32-bit integer of milliseconds. */
const MAX_DELAY = 2 ** 31 - 1;

let timeout = null;

const playersOnline = () => getPlayers().some(user => user.active);

/**
 * Bring the divine-grant timer in line with the session and who is online. Only the active GM
 * runs it. The due time lives in the session setting, so it survives reloads, GM handovers and a
 * GM being offline for a while (an overdue grant fires once on the next load). While no players
 * are online the remaining time is frozen in `pausedRemaining` and resumes when one returns.
 */
export async function syncScheduler() {
  clearTimeout(timeout);
  timeout = null;

  if (game.user !== game.users.activeGM || !divineGrantsEnabled()) return;
  const { active, nextGrantAt, pausedRemaining } = getSession();
  if (!active) return;

  const online = playersOnline();
  // These writes re-run syncScheduler on every client through the setting's onChange.
  if (!online && nextGrantAt) {
    return updateSession({ nextGrantAt: null, pausedRemaining: Math.max(0, nextGrantAt - Date.now()) });
  }
  if (online && pausedRemaining != null && !nextGrantAt) {
    return updateSession({ nextGrantAt: Date.now() + pausedRemaining, pausedRemaining: null });
  }

  if (!nextGrantAt) return;
  timeout = setTimeout(fire, Math.min(Math.max(0, nextGrantAt - Date.now()), MAX_DELAY));
}

async function fire() {
  timeout = null;
  if (game.user !== game.users.activeGM || !divineGrantsEnabled() || !getSession().active) return;
  await grantRandomHeroPoints();
  await updateSession({ nextGrantAt: Date.now() + intervalMs() });
}
