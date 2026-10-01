/**
 * @author [A likely boring stuff made by] Shevek
 * @desc en/web_message.ts — Rubric et lignes de dossier de la classe WEB_MESSAGE, en anglais.
 */

import { POSTMESSAGE_ANALYZER_NAME } from "../../../analyze/ast_analyzers/web_message/postmessage";
import { ONMESSAGE_ANALYZER_NAME } from "../../../analyze/ast_analyzers/web_message/onmessage";
import { ADD_EVENT_LISTENER_ANALYZER_NAME } from "../../../analyze/ast_analyzers/web_message/add_event_listener";
import { ONHASHCHANGE_ANALYZER_NAME } from "../../../analyze/ast_analyzers/web_message/onhashchange";
import type { ClassWording, WebMessageLines } from "../types";

export const WEB_MESSAGE: ClassWording<WebMessageLines> = {
  rubric: {
    definition: [
      "You are a triage judge for the WEB_MESSAGE class (cross-window messaging).",
      "Two situations, told apart by the [Role] line of the case. Sending: postMessage sends data to another window; with the target origin `*` or a variable, any page holding the receiving window (iframe, popup) gets the message — a leak if the data is sensitive (token, credentials, personal data). Receiving: a handler (onmessage, addEventListener('message'), onhashchange) processes data coming from outside; without a strict check of event.origin, any site can send it data, which becomes an attacker source.",
      "What matters: when sending, the sensitivity of the data and the target origin; when receiving, the origin check (strict equality: safe; indexOf, includes, startsWith, endsWith, unanchored regex: bypassable) and what the handler does with the data (HTML sink, navigation, request, eval).",
      "Do not merge three states: unarmed (real exchange, no sensitive data or sink identified), unproven (target origin, origin check or data coming from a variable whose value cannot be shown statically), false positive (fixed origin, strict check, constant data, third-party code). Only the false positive is rejected.",
    ].join("\n\n"),
    scoreQuestion: "What is the triage verdict for this WEB_MESSAGE lead?",
    scores: {
      HIGH: "Sensitive data sent to a `*` or unfixed origin; or a receiver with no origin check (or a bypassable one) whose data reaches a sink (HTML, navigation, request, eval).",
      MEDIUM:
        "Data of uncertain sensitivity sent to an unfixed origin; or a receiver with no origin check and no visible sink reached.",
      IN_DEPTH:
        "Real exchange that cannot be decided statically: target origin or origin check coming from a variable, handler defined elsewhere, data of unknown origin. Escalate to a human; never reject for this reason alone.",
      REJECT:
        "Clear false positive only: sent to a fixed, explicit origin, constant non-sensitive data, receiver with a strict origin check, or library code (analytics SDK, third-party widget).",
    },
    reasonQuestion:
      "Assuming this lead is a false positive to reject, what would be its single reason? Ignore this question if the verdict is not REJECT.",
    reasons: {
      LITERAL_SOURCE: "The data sent is constant and not sensitive.",
      NOT_A_SINK:
        "Not a cross-window message exchange (Worker, internal MessageChannel, event with the same name).",
      VENDORED_LIB:
        "Code of a third-party SDK or widget (analytics, chat, payment), not application code.",
      READ_ONLY:
        "The handler reads the received data but does nothing exploitable with it.",
      SANITIZED:
        "Fixed target origin, or event.origin strictly compared to an expected origin.",
    },
  },
  lines: {
    emitterData:
      "[Role] sending: this argument of postMessage is the data being sent.",
    emitterTargetOrigin:
      "[Role] sending: this argument of postMessage is the target origin.",
    emitterOtherArgument: (index) =>
      `[Role] sending: argument #${index} of postMessage (transferred objects).`,
    receiverMessage: (analyzer) =>
      `[Role] receiving: message handler (${analyzer}); the tracked value is the function that processes event.data.`,
    receiverHashChange:
      "[Role] receiving: hashchange handler; it reacts to location.hash, which the attacker sets in the link.",
  },
  analyzerGuidance: {
    [POSTMESSAGE_ANALYZER_NAME]:
      "Sending: the risk is sending sensitive data with targetOrigin `*`: a malicious site can change the target window's location without the sender knowing and intercept the message. An exact origin as targetOrigin prevents that interception.",
    [ONMESSAGE_ANALYZER_NAME]:
      "Receiving: a handler that does not check event.origin, or checks it in a bypassable way (indexOf, startsWith, includes, unanchored regular expression), accepts messages from any window. What matters next: what the handler does with event.data (HTML, navigation, request, storage).",
    [ADD_EVENT_LISTENER_ANALYZER_NAME]:
      'Event listener: for "message", same rules as an onmessage handler (event.origin check, then use of event.data).',
    [ONHASHCHANGE_ANALYZER_NAME]:
      "The URL hash (the part after #) is entirely chosen by whoever sends the link, and hashchange fires when it changes; not when pushState or replaceState modifies it. What matters: what the handler does with location.hash.",
  },
};
