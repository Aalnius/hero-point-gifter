import { MODULE_ID } from "./constants.mjs";
import { SessionModel } from "./session.mjs";

/**
 * Register module settings. The callbacks run on every client when the setting changes.
 * @param {object} handlers
 * @param {() => void} handlers.onSessionChange   The session state changed.
 * @param {() => void} handlers.onIntervalChange  The divine grant interval changed.
 * @param {() => void} handlers.onLimitChange     The per-session gift limit changed.
 */
export function registerSettings({ onSessionChange, onIntervalChange, onLimitChange }) {
  game.settings.register(MODULE_ID, "session", {
    scope: "world",
    config: false,
    type: SessionModel,
    onChange: onSessionChange
  });

  game.settings.register(MODULE_ID, "grantIntervalMinutes", {
    name: "HPG.Settings.IntervalName",
    hint: "HPG.Settings.IntervalHint",
    scope: "world",
    config: true,
    type: new foundry.data.fields.NumberField({ integer: true, min: 1, max: 1440, initial: 60 }),
    onChange: onIntervalChange
  });

  game.settings.register(MODULE_ID, "grantsPerInterval", {
    name: "HPG.Settings.CountName",
    hint: "HPG.Settings.CountHint",
    scope: "world",
    config: true,
    type: new foundry.data.fields.NumberField({ integer: true, min: 1, max: 10, initial: 2 })
  });

  game.settings.register(MODULE_ID, "startReminder", {
    name: "HPG.Settings.ReminderName",
    hint: "HPG.Settings.ReminderHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "endOnGMExit", {
    name: "HPG.Settings.EndOnExitName",
    hint: "HPG.Settings.EndOnExitHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "divineReasons", {
    name: "HPG.Settings.DivineReasonsName",
    hint: "HPG.Settings.DivineReasonsHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "giftsPerSession", {
    name: "HPG.Settings.LimitName",
    hint: "HPG.Settings.LimitHint",
    scope: "world",
    config: true,
    type: new foundry.data.fields.NumberField({ integer: true, min: 1, max: 10, initial: 1 }),
    onChange: onLimitChange
  });
}
