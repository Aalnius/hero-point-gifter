import { MODULE_ID, TAB_ID, TEMPLATES } from "./constants.mjs";
import { HeroPointTab } from "./apps/hero-point-tab.mjs";
import { activateSocket } from "./gift.mjs";
import { syncScheduler } from "./scheduler.mjs";
import { divineGrantsEnabled, getSession, intervalMs, updateSession } from "./session.mjs";
import { registerSettings } from "./settings.mjs";

const refreshTab = foundry.utils.debounce(() => ui[TAB_ID]?.render(), 100);

/**
 * End a session left running by a GM who has since closed out. Only a GM client can write the
 * session, so this runs when a GM next loads in rather than at the moment the last GM leaves.
 * Reloading the page is the same GM staying, so it never ends the session.
 */
async function endAbandonedSession() {
  if (!game.settings.get(MODULE_ID, "endOnGMExit") || !getSession().active) return;
  if (game.user !== game.users.activeGM) return;
  if (performance.getEntriesByType("navigation")[0]?.type === "reload") return;
  if (game.users.some(user => user.isGM && user.active && user.id !== game.user.id)) return;
  await updateSession({ active: false, nextGrantAt: null, pausedRemaining: null });
  ui.notifications.info(game.i18n.localize("HPG.Notify.SessionEndedGMLeft"));
}

Hooks.once("init", () => {
  registerSettings({
    onSessionChange: () => {
      syncScheduler();
      refreshTab();
    },
    onIntervalChange: async () => {
      // Restart the countdown from now with the new interval. Only the active GM writes the session.
      const { active, pausedRemaining } = getSession();
      if (!active || !divineGrantsEnabled() || game.user !== game.users.activeGM) return;
      await updateSession(pausedRemaining == null
        ? { nextGrantAt: Date.now() + intervalMs() }
        : { pausedRemaining: intervalMs() });
    },
    onLimitChange: refreshTab,
    onDivineGrantsChange: async () => {
      refreshTab();
      if (!getSession().active || game.user !== game.users.activeGM) return;
      // Switching on starts a fresh countdown; switching off clears the timer. Either write re-syncs everyone.
      await updateSession({
        nextGrantAt: divineGrantsEnabled() ? Date.now() + intervalMs() : null,
        pausedRemaining: null
      });
    }
  });

  // Register the sidebar tab: Sidebar#TABS describes the tab button, CONFIG.ui supplies the application.
  foundry.applications.sidebar.Sidebar.TABS[TAB_ID] = {
    icon: "fa-solid fa-star",
    tooltip: "HPG.TabTooltip"
  };
  CONFIG.ui[TAB_ID] = HeroPointTab;

  foundry.applications.handlebars.loadTemplates(Object.values(TEMPLATES));
});

Hooks.once("ready", () => {
  if (game.system.id !== "pf2e") {
    console.warn(`${MODULE_ID} | requires the PF2e system; the Hero Points tab will show no hero points.`);
  }
  activateSocket();
  endAbandonedSession();
  syncScheduler();

  // Remind GMs to start a session when they log in without one running.
  if (game.user.isGM && game.settings.get(MODULE_ID, "startReminder") && !getSession().active) {
    ui.notifications.info(game.i18n.localize("HPG.Notify.StartReminder"));
  }
});

// Keep the tab current when hero points, player assignments or connections change.
Hooks.on("updateActor", (actor, changes) => {
  if (foundry.utils.hasProperty(changes, "system.resources.heroPoints")) refreshTab();
});
Hooks.on("updateUser", (user, changes) => {
  if ("character" in changes || "active" in changes) {
    syncScheduler(); // players coming or going pauses or resumes the divine grant timer
    refreshTab();
  }
});
Hooks.on("userConnected", () => {
  syncScheduler(); // the active GM may have changed
  refreshTab();
});
