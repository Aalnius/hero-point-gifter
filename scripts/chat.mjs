import { TEMPLATES } from "./constants.mjs";

const { escapeHTML } = foundry.utils;

/**
 * Post a themed chat card. Every interpolated value is escaped here, so callers
 * pass raw names and reasons.
 * @param {object} options
 * @param {string} options.speaker   Alias shown as the message author.
 * @param {string} options.title
 * @param {string} options.body      Localization key; `{param}` placeholders are escaped.
 * @param {object} [options.params]  Plain-text values for the body placeholders (escaped).
 * @param {object} [options.html]    Placeholder values that are already-safe HTML, such as `nameList()` output.
 * @param {string} [options.note]    Plain-text footnote.
 */
export async function postCard({ speaker, title, body, params = {}, html = {}, note = "" }) {
  const escaped = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, escapeHTML(String(v))]));
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.chatCard, {
    title,
    body: game.i18n.format(body, { ...escaped, ...html }),
    note
  });
  return ChatMessage.create({ content, speaker: { alias: speaker } });
}

/** Wrap names in <strong> for card bodies that list several characters. */
export function nameList(names) {
  return names.map(name => `<strong>${escapeHTML(name)}</strong>`).join(", ");
}
