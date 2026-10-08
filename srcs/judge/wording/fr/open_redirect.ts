/**
 * @author [A likely boring stuff made by] Shevek
 * @desc fr/open_redirect.ts : Rubric et lignes de dossier de la classe OPEN_REDIRECT, en français.
 */

import { LOCATION_ANALYZER_NAME } from "../../../analyze/ast_analyzers/open_redirect/location";
import { WINDOW_OPEN_ANALYZER_NAME } from "../../../analyze/ast_analyzers/open_redirect/window_open";
import { URL_IN_OBJECT_EXPR_ANALYZER_NAME } from "../../../analyze/ast_analyzers/cspt/url_object_expression";
import { PATH_ATTRIBUTE_ASSIGNMENT_ANALYZER_NAME } from "../../../analyze/ast_analyzers/cspt/path_attribute_assignment";
import { SPA_NAVIGATION_ANALYZER_NAME } from "../../../analyze/ast_analyzers/open_redirect/spa_navigation";
import type { ClassWording, OpenRedirectLines } from "../types";

export const OPEN_REDIRECT: ClassWording<OpenRedirectLines> = {
  rubric: {
    definition: [
      "Tu es un juge de triage pour la classe OPEN_REDIRECT (redirection ouverte).",
      "Une OPEN_REDIRECT survient quand une valeur détermine la destination d'une navigation : affectation à location ou location.href, location.assign ou replace, window.open, ou propriété url/href d'un objet de configuration. Si l'attaquant contrôle le début de la destination, il envoie la victime vers le site de son choix ; s'il contrôle le schéma, « javascript: » ou « data: » donnent une XSS.",
      "Ce qui compte : (1) la partie de la destination que la valeur contrôle, donnée par la ligne [Destination] : une valeur en tête contrôle schéma et hôte ; un préfixe « / » seul laisse passer « //hôte » ; un préfixe avec un hôte complet ne laisse varier que le chemin ; (2) les paramètres de retour (returnTo, redirect, next) lus dans l'URL sont la source typique ; (3) une vérification d'hôte ou une liste blanche avant la navigation neutralise.",
      "Trois états à ne pas confondre : non armé (destination réellement variable, sans source attaquant identifiée), non prouvé (la valeur vient d'un paramètre, d'un import ou d'une donnée serveur : le code seul ne dit pas si l'attaquant la maîtrise), faux positif (destination constante, hôte figé, destination validée). Seul le faux positif se rejette.",
    ].join("\n\n"),
    scoreQuestion: "Quel est le verdict de triage de ce lead OPEN_REDIRECT ?",
    scores: {
      HIGH: "Une source contrôlable détermine le début de la destination (schéma ou hôte) sans vérification visible.",
      MEDIUM:
        "Destination externe probable, mais l'un des deux manque : source atteinte avec un préfixe qui fige presque tout, ou hôte libre avec une source seulement probable.",
      IN_DEPTH:
        "La destination dépend d'une valeur dont la contrôlabilité n'est pas démontrable en statique (paramètre, import, donnée serveur), ou la vérification d'hôte est douteuse. À remonter à un humain ; ne jamais rejeter pour ce seul motif.",
      REJECT:
        "Faux positif franc uniquement : destination constante, hôte figé par un préfixe complet, code de bibliothèque, ou destination validée par une liste blanche.",
    },
    reasonQuestion:
      "En supposant que ce lead soit un faux positif à rejeter, quel en serait l'unique motif ? Ignore cette question si le verdict n'est pas REJECT.",
    reasons: {
      LITERAL_SOURCE: "La destination est une constante écrite dans le code.",
      NOT_A_SINK:
        "La valeur ne détermine pas la destination d'une navigation, ou l'hôte est figé par un préfixe complet.",
      VENDORED_LIB:
        "Code de bibliothèque tierce ou de framework (routeur, SDK d'authentification), pas applicatif.",
      READ_ONLY: "Lecture de location, pas écriture.",
      SANITIZED:
        "La destination est vérifiée (hôte comparé à une liste blanche, URL relative imposée) avant la navigation.",
    },
  },
  lines: {
    locationAssignment:
      "[Navigation] affectation à location : la page courante navigue vers la valeur.",
    windowOpenUrl:
      "[Navigation] premier argument de window.open : l'URL ouverte.",
    windowOpenOtherArgument: (index) =>
      `[Navigation] argument n°${index} de window.open : nom de fenêtre ou options, pas l'URL.`,
    objectProperty: (key) =>
      `[Navigation] valeur de la clé « ${key} » d'un objet de configuration.`,
    pathAttributeAssignment:
      "[Navigation] affectation d'un chemin ancré à src ou href d'un élément : un lien suivi au clic, ou une ressource chargée par la page.",
    spaNavigation:
      "[Navigation] navigation d'application monopage (router.push/replace/navigate, history.pushState/replaceState) : la route change sans rechargement de la page.",
    destinationStartsWithValue:
      "[Destination] commence par la valeur : schéma et hôte suivent la valeur (« javascript: », « data: », « //hôte » possibles si elle est contrôlée).",
    destinationRootOnly:
      "[Destination] préfixe « / » seul : une valeur commençant par « / » produit « //hôte », une URL externe.",
    destinationFixedHost: (prefix) =>
      `[Destination] préfixe fixe « ${prefix} » : l'hôte est figé, seule la suite du chemin varie.`,
    destinationOpenHost: (prefix) =>
      `[Destination] préfixe « ${prefix} » sans hôte complet : l'hôte dépend encore de la valeur.`,
  },
  analyzerGuidance: {
    [LOCATION_ANALYZER_NAME]:
      "Affectation à location ou à l'une de ses propriétés : la navigation est immédiate, sans interaction. pathname, search et hash ne changent pas l'hôte ; location, href, host, hostname, protocol le peuvent.",
    [WINDOW_OPEN_ANALYZER_NAME]:
      "window.open : seul le premier argument est l'URL ; le second est un nom de fenêtre, le troisième des options. Un argument autre que l'URL n'est pas une redirection.",
    [URL_IN_OBJECT_EXPR_ANALYZER_NAME]:
      "Valeur url, href ou route d'un objet de configuration : vérifier dans le contexte que l'objet sert à naviguer (routeur, lien, redirection après connexion). Un objet de requête HTTP ne redirige pas.",
    [PATH_ATTRIBUTE_ASSIGNMENT_ANALYZER_NAME]:
      "Chemin ancré affecté à href ou src : pour une redirection, seul href compte, et il faut un clic de la victime.",
    [SPA_NAVIGATION_ANALYZER_NAME]:
      "history.pushState et replaceState lèvent une exception sur une URL d'une autre origine, et un routeur (vue-router, Angular, react-router) navigue entre routes de l'application : cet appel seul ne mène pas hors du site. Il n'y a redirection externe que si la route atteinte redirige ensuite vers une URL tirée de la valeur.",
  },
};
