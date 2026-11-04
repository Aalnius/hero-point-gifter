/** Random reasons for hero point gifts and divine grants, kept in the language file. */

function entries(key) {
  return Object.values(foundry.utils.getProperty(game.i18n.translations, `HPG.${key}`) ?? {});
}

function pick(list) {
  return list.length ? list[Math.floor(Math.random() * list.length)] : "";
}

/** A funny reason, used when a player leaves their gift reason blank. */
export function pickFunnyReason() {
  return pick(entries("FunnyReasons"));
}

/** A funny or god-themed reason for the timed divine grants. */
export function pickDivineReason() {
  return pick([...entries("FunnyReasons"), ...entries("GodReasons")]);
}
