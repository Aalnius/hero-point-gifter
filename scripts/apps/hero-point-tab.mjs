import { MAX_REASON_LENGTH, TAB_ID, TEMPLATES } from "../constants.mjs";
import { endSession, giveHeroPoint, resetGift, setSessionNumber, startSession, takeHeroPoint } from "../actions.mjs";
import { giftBlockReason, requestGift } from "../gift.mjs";
import { divineGrantsEnabled, getPlayers, getSession, giftLimit, heroPointsOf } from "../session.mjs";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { AbstractSidebarTab } = foundry.applications.sidebar;

/** Sidebar tab showing everyone's hero points; GMs get session controls, players get gift buttons. */
export class HeroPointTab extends HandlebarsApplicationMixin(AbstractSidebarTab) {
  /** @override */
  static tabName = TAB_ID;

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["hero-points"],
    window: { title: "HPG.Title", icon: "fa-solid fa-star" },
    actions: {
      startSession: HeroPointTab.#onStartSession,
      endSession: HeroPointTab.#onEndSession,
      setSessionNumber: HeroPointTab.#onSetSessionNumber,
      resetGift: HeroPointTab.#onResetGift,
      giveHeroPoint: HeroPointTab.#onGiveHeroPoint,
      takeHeroPoint: HeroPointTab.#onTakeHeroPoint,
      gift: HeroPointTab.#onGift
    }
  };

  /** @override */
  static PARTS = {
    content: { template: TEMPLATES.tab, root: true }
  };

  /** Handle of the 1 Hz countdown refresher. */
  #tick = null;

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const session = getSession();
    const isGM = game.user.isGM;
    const limit = giftLimit();

    context.isGM = isGM;
    context.session = { active: session.active, number: session.number };
    context.statusLabel = session.active
      ? game.i18n.format("HPG.Session.Active", { number: session.number })
      : game.i18n.localize("HPG.Session.Inactive");
    const timed = session.active && divineGrantsEnabled();
    context.nextGrantAt = timed ? session.nextGrantAt : null;
    context.timerPaused = timed && session.pausedRemaining != null;
    context.ownGifted = (session.gifts[game.user.id] ?? 0) >= limit;

    context.players = getPlayers().map(user => {
      const { value, max } = heroPointsOf(user.character);
      const block = isGM ? null : giftBlockReason(game.user.id, user.id);
      return {
        id: user.id,
        name: user.name,
        character: user.character.name,
        online: user.active,
        isSelf: user.id === game.user.id,
        pips: Array.from({ length: max }, (_, i) => ({ filled: i < value })),
        value,
        max,
        gifted: (session.gifts[user.id] ?? 0) >= limit,
        atMax: value >= max,
        showGift: !isGM && user.id !== game.user.id,
        canGift: !isGM && !block,
        giftTip: block
          ? game.i18n.localize(`HPG.Notify.Rejected.${block}`)
          : game.i18n.localize("HPG.Gift.Button")
      };
    });

    context.log = session.log.slice(-8).reverse().map(entry => {
      const giver = game.users.get(entry.giverId);
      const recipient = game.users.get(entry.recipientId);
      return {
        time: new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        giver: giver?.character?.name ?? giver?.name ?? "?",
        recipient: recipient?.character?.name ?? recipient?.name ?? "?",
        reason: entry.reason
      };
    });
    return context;
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#startCountdown();
  }

  /** @override */
  _onClose(options) {
    clearInterval(this.#tick);
    this.#tick = null;
    super._onClose(options);
  }

  /** Keep the "next divine grant" label live without re-rendering the whole tab. */
  #startCountdown() {
    clearInterval(this.#tick);
    const label = this.element.querySelector("[data-countdown]");
    if (!label) return;
    const due = Number(label.dataset.countdown);
    const update = () => {
      if (!label.isConnected) return clearInterval(this.#tick);
      const seconds = Math.max(0, Math.ceil((due - Date.now()) / 1000));
      const [h, m, s] = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60];
      label.textContent = (h ? `${h}h ` : "") + `${m}m ${String(s).padStart(2, "0")}s`;
    };
    update();
    this.#tick = setInterval(update, 1000);
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static #onStartSession() {
    return startSession();
  }

  static #onEndSession() {
    return endSession();
  }

  static async #onSetSessionNumber() {
    const { active, number } = getSession();
    const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.sessionDialog, {
      label: game.i18n.localize(active ? "HPG.Session.NumberCurrent" : "HPG.Session.NumberNext"),
      hint: game.i18n.localize(active ? "HPG.Session.SetHintActive" : "HPG.Session.SetHintInactive"),
      value: active ? number : number + 1
    });
    const result = await DialogV2.input({
      window: { title: "HPG.Session.SetTitle", icon: "fa-solid fa-pen" },
      content,
      ok: { label: "HPG.Session.Confirm", icon: "fa-solid fa-check" },
      rejectClose: false
    });
    if (result) await setSessionNumber(Number(result.number));
  }

  static #onResetGift(event, target) {
    return resetGift(target.dataset.userId);
  }

  static #onGiveHeroPoint(event, target) {
    return giveHeroPoint(target.dataset.userId);
  }

  static #onTakeHeroPoint(event, target) {
    return takeHeroPoint(target.dataset.userId);
  }

  static async #onGift(event, target) {
    const recipient = game.users.get(target.dataset.userId);
    if (!recipient) return;
    const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.giftDialog, {
      maxLength: MAX_REASON_LENGTH
    });
    const result = await DialogV2.input({
      window: {
        title: game.i18n.format("HPG.Gift.DialogTitle", { name: recipient.character?.name ?? recipient.name }),
        icon: "fa-solid fa-star"
      },
      content,
      ok: { label: "HPG.Gift.Confirm", icon: "fa-solid fa-star" },
      rejectClose: false
    });
    if (result) requestGift(recipient.id, result.reason);
  }
}
