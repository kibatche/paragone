/**
 * @author [A likely boring stuff made by] Shevek
 * @desc fr/web_message.ts : Rubric et lignes de dossier de la classe WEB_MESSAGE, en français.
 */

import { POSTMESSAGE_ANALYZER_NAME } from "../../../analyze/ast_analyzers/web_message/postmessage";
import { ONMESSAGE_ANALYZER_NAME } from "../../../analyze/ast_analyzers/web_message/onmessage";
import { ADD_EVENT_LISTENER_ANALYZER_NAME } from "../../../analyze/ast_analyzers/web_message/add_event_listener";
import { ONHASHCHANGE_ANALYZER_NAME } from "../../../analyze/ast_analyzers/web_message/onhashchange";
import type { ClassWording, WebMessageLines } from "../types";

export const WEB_MESSAGE: ClassWording<WebMessageLines> = {
  rubric: {
    definition: [
      "Tu es un juge de triage pour la classe WEB_MESSAGE (messages entre fenêtres).",
      "Deux situations, que la ligne [Rôle] du dossier distingue. Émission : postMessage envoie des données à une autre fenêtre ; avec l'origine cible « * » ou une variable, toute page qui tient la fenêtre destinataire (iframe, popup) reçoit le message : fuite si les données sont sensibles (jeton, identifiants, données personnelles). Réception : un gestionnaire (onmessage, addEventListener('message'), onhashchange) traite une donnée venue de l'extérieur ; sans contrôle strict de event.origin, n'importe quel site peut lui envoyer des données, qui deviennent une source attaquant.",
      "Ce qui compte : en émission, la sensibilité des données et l'origine cible ; en réception, le contrôle d'origine (égalité stricte : sûr ; indexOf, includes, startsWith, endsWith, regex non ancrée : contournable) et ce que le gestionnaire fait de la donnée (sink HTML, navigation, requête, eval).",
      "Trois états à ne pas confondre : non armé (échange réel, sans donnée sensible ni sink identifié), non prouvé (origine cible, contrôle d'origine ou données venant d'une variable dont la valeur n'est pas démontrable en statique), faux positif (origine fixe, contrôle strict, données constantes, code tiers). Seul le faux positif se rejette.",
    ].join("\n\n"),
    scoreQuestion: "Quel est le verdict de triage de ce lead WEB_MESSAGE ?",
    scores: {
      HIGH: "Émission de données sensibles vers une origine « * » ou non fixée ; ou réception sans contrôle d'origine (ou avec un contrôle contournable) dont la donnée atteint un sink (HTML, navigation, requête, eval).",
      MEDIUM:
        "Émission vers une origine non fixée de données dont la sensibilité est incertaine ; ou réception sans contrôle d'origine, sans sink atteint visible.",
      IN_DEPTH:
        "Échange réel mais indécidable en statique : origine cible ou contrôle d'origine venant d'une variable, gestionnaire défini ailleurs, données d'origine inconnue. À remonter à un humain ; ne jamais rejeter pour ce seul motif.",
      REJECT:
        "Faux positif franc uniquement : émission vers une origine fixe et explicite, données constantes et non sensibles, réception avec contrôle d'origine strict, ou code de bibliothèque (SDK d'analytique, widget tiers).",
    },
    reasonQuestion:
      "En supposant que ce lead soit un faux positif à rejeter, quel en serait l'unique motif ? Ignore cette question si le verdict n'est pas REJECT.",
    reasons: {
      LITERAL_SOURCE: "Les données émises sont constantes et non sensibles.",
      NOT_A_SINK:
        "Pas un échange de messages entre fenêtres (Worker, MessageChannel interne, événement homonyme).",
      VENDORED_LIB:
        "Code d'un SDK ou d'un widget tiers (analytique, chat, paiement), pas applicatif.",
      READ_ONLY:
        "Le gestionnaire lit la donnée reçue sans rien en faire d'exploitable.",
      SANITIZED:
        "Origine cible fixe, ou event.origin comparé strictement à une origine attendue.",
    },
  },
  lines: {
    emitterData:
      "[Rôle] émission : cet argument de postMessage est la donnée envoyée.",
    emitterTargetOrigin:
      "[Rôle] émission : cet argument de postMessage est l'origine cible.",
    emitterOtherArgument: (index) =>
      `[Rôle] émission : argument n°${index} de postMessage (objets transférés).`,
    receiverMessage: (analyzer) =>
      `[Rôle] réception : gestionnaire de messages (${analyzer}) ; la valeur suivie est la fonction qui traite event.data.`,
    receiverHashChange:
      "[Rôle] réception : gestionnaire hashchange ; il réagit à location.hash, que l'attaquant fixe dans le lien.",
  },
  analyzerGuidance: {
    [POSTMESSAGE_ANALYZER_NAME]:
      "Émission : le risque est d'envoyer une donnée sensible avec targetOrigin « * » : un site malveillant peut changer l'emplacement de la fenêtre cible à l'insu de l'émetteur et intercepter le message. Une origine exacte en targetOrigin empêche cette interception.",
    [ONMESSAGE_ANALYZER_NAME]:
      "Réception : un gestionnaire sans vérification de event.origin, ou avec une vérification contournable (indexOf, startsWith, includes, expression régulière non ancrée), accepte les messages de n'importe quelle fenêtre. Ce qui compte ensuite : ce que le gestionnaire fait de event.data (HTML, navigation, requête, stockage).",
    [ADD_EVENT_LISTENER_ANALYZER_NAME]:
      "Écouteur d'événement : pour « message », mêmes règles qu'un gestionnaire onmessage (vérification de event.origin, puis usage de event.data).",
    [ONHASHCHANGE_ANALYZER_NAME]:
      "Le hash de l'URL (la partie après #) est entièrement choisi par qui envoie le lien, et hashchange se déclenche quand il change ; pas quand pushState ou replaceState le modifie. Ce qui compte : ce que le gestionnaire fait de location.hash.",
  },
};
