/**
 * @author [A likely boring stuff made by] Shevek
 * @desc fr/cspt.ts : Rubric et lignes de dossier de la classe CSPT, en français.
 */

import {
  HTTP_CLIENTS_ANALYZER_NAME,
  FETCH_ANALYZER_NAME,
  AXIOS_ANALYZER_NAME,
  REQUEST_ANALYZER_NAME,
  KY_ANALYZER_NAME,
} from "../../../analyze/ast_analyzers/cspt/http_clients";
import { URL_IN_OBJECT_EXPR_ANALYZER_NAME } from "../../../analyze/ast_analyzers/cspt/url_object_expression";
import { PATH_ATTRIBUTE_ASSIGNMENT_ANALYZER_NAME } from "../../../analyze/ast_analyzers/cspt/path_attribute_assignment";
import { SPA_NAVIGATION_ANALYZER_NAME } from "../../../analyze/ast_analyzers/open_redirect/spa_navigation";
import type { ClassWording, CsptLines } from "../types";

export const CSPT: ClassWording<CsptLines> = {
  rubric: {
    definition: [
      "Tu es un juge de triage pour la classe CSPT (Client-Side Path Traversal).",
      "Une CSPT survient quand du JavaScript côté client insère une valeur dans le CHEMIN d'une requête que le navigateur émet vers sa propre origine (fetch, XMLHttpRequest, axios, client aliasé, objet de configuration url/path). Si la valeur peut porter « ../ » ou ses encodages, l'attaquant reroute la requête vers un autre endpoint de la même origine, avec les cookies et en-têtes de la victime.",
      "Ce qui compte : (1) la valeur tombe dans un segment de chemin, pas dans la query ; (2) l'endpoint rerouté a un effet : une action qui change un état (POST, PUT, PATCH, DELETE : CSPT vers CSRF) ou une réponse réinjectée dans la page (CSPT vers XSS) ; (3) la requête porte la session de la victime. Un suffixe imposé (« .json ») se neutralise avec « ? » ou « # ».",
      "Rester sur la même origine est la définition de la classe, jamais un motif de rejet.",
      "Trois états à ne pas confondre : non armé (primitive réelle, aucun endpoint utile identifié), non prouvé (la valeur vient d'un paramètre, d'un import ou d'une donnée serveur : le code seul ne dit pas si l'attaquant la maîtrise), faux positif (pas un chemin, ou valeur constante). Seul le faux positif se rejette.",
    ].join("\n\n"),
    scoreQuestion: "Quel est le verdict de triage de ce lead CSPT ?",
    scores: {
      HIGH: "Primitive armée : une source contrôlable atteint un segment de chemin, et l'endpoint rerouté a un effet : requête qui change un état, ou réponse réinjectée dans la page.",
      MEDIUM:
        "Reroutage plausible et effet probable, mais l'un des deux n'est pas établi : source atteinte avec un effet incertain (simple lecture), ou effet net avec une source seulement probable.",
      IN_DEPTH:
        "Non armé ou non prouvé : le trou est bien dans le chemin, mais la contrôlabilité n'est pas démontrable en statique (paramètre de fonction, import, donnée serveur) ou aucun effet n'est visible. À remonter à un humain ; ne jamais rejeter pour ce seul motif.",
      REJECT:
        "Faux positif franc uniquement : aucun trou dans le chemin (valeur en query, URL entièrement littérale), valeur constante, code de bibliothèque tierce, ou valeur normalisée avant usage.",
    },
    reasonQuestion:
      "En supposant que ce lead soit un faux positif à rejeter, quel en serait l'unique motif ? Ignore cette question si le verdict n'est pas REJECT.",
    reasons: {
      LITERAL_SOURCE:
        "La valeur insérée dans le chemin est une constante écrite dans le code : aucune source contrôlable.",
      NOT_A_SINK:
        "Pas un chemin de requête reroutable : trou en query, URL entièrement littérale, ou aucune requête émise.",
      VENDORED_LIB:
        "Code de bibliothèque tierce ou de framework (rrweb, Sentry, interne React…), pas applicatif.",
      READ_ONLY:
        "Lecture d'une valeur d'URL, et non écriture dans le chemin d'une requête.",
      SANITIZED:
        "La valeur passe par un encodage (encodeURIComponent), une normalisation ou une liste blanche avant d'atteindre le chemin.",
    },
  },
  lines: {
    method: (method) => `[Méthode] ${method}`,
    methodUnknown: "[Méthode] non déterminable statiquement",
    authenticated: (evidence) => `[Requête authentifiée] oui : ${evidence}`,
    notAuthenticated: "[Requête authentifiée] non attesté par le code",
    holeInPath: (hole) => `  ${hole} → segment de chemin`,
    holeInQuery: (hole) => `  ${hole} → paramètre de query`,
    forcedSuffix: (suffix) => `[Suffixe imposé] ${suffix}`,
  },
  analyzerGuidance: {
    [HTTP_CLIENTS_ANALYZER_NAME]:
      "Appel direct d'un client HTTP : le motif est l'URL de la requête. Vérifier (1) si un trou est dans le CHEMIN, où une valeur contrôlée peut injecter « ../ » et viser un autre endpoint, ou seulement dans la query ; (2) si la requête porte la session de la victime (même origine, credentials, withCredentials) ; (3) si la méthode modifie un état (POST, PUT, PATCH, DELETE), ce qui aggrave le détournement.",
    [FETCH_ANALYZER_NAME]:
      "Appel direct d'un client HTTP : le motif est l'URL de la requête. Vérifier (1) si un trou est dans le CHEMIN, où une valeur contrôlée peut injecter « ../ » et viser un autre endpoint, ou seulement dans la query ; (2) si la requête porte la session de la victime (même origine, credentials, withCredentials) ; (3) si la méthode modifie un état (POST, PUT, PATCH, DELETE), ce qui aggrave le détournement.",
    [AXIOS_ANALYZER_NAME]:
      "Appel direct d'un client HTTP : le motif est l'URL de la requête. Vérifier (1) si un trou est dans le CHEMIN, où une valeur contrôlée peut injecter « ../ » et viser un autre endpoint, ou seulement dans la query ; (2) si la requête porte la session de la victime (même origine, credentials, withCredentials) ; (3) si la méthode modifie un état (POST, PUT, PATCH, DELETE), ce qui aggrave le détournement.",
    [REQUEST_ANALYZER_NAME]:
      "Appel direct d'un client HTTP : le motif est l'URL de la requête. Vérifier (1) si un trou est dans le CHEMIN, où une valeur contrôlée peut injecter « ../ » et viser un autre endpoint, ou seulement dans la query ; (2) si la requête porte la session de la victime (même origine, credentials, withCredentials) ; (3) si la méthode modifie un état (POST, PUT, PATCH, DELETE), ce qui aggrave le détournement.",
    [KY_ANALYZER_NAME]:
      "Appel direct d'un client HTTP : le motif est l'URL de la requête. Vérifier (1) si un trou est dans le CHEMIN, où une valeur contrôlée peut injecter « ../ » et viser un autre endpoint, ou seulement dans la query ; (2) si la requête porte la session de la victime (même origine, credentials, withCredentials) ; (3) si la méthode modifie un état (POST, PUT, PATCH, DELETE), ce qui aggrave le détournement.",
    [URL_IN_OBJECT_EXPR_ANALYZER_NAME]:
      "Valeur de la clé url, path, endpoint, uri ou route d'un objet de configuration. L'objet n'est pas forcément une requête : vérifier dans le contexte à quoi il est passé (client HTTP, routeur, composant). S'il ne part vers aucune requête, ce n'est pas un sink CSPT.",
    [PATH_ATTRIBUTE_ASSIGNMENT_ANALYZER_NAME]:
      "Chemin ancré (« /… ») affecté à src ou href d'un élément. src : la page charge elle-même la ressource (image, script, iframe), en même origine et avec les cookies, sur un chemin qu'un « ../ » peut détourner. href : aucune requête ne part sans clic.",
    [SPA_NAVIGATION_ANALYZER_NAME]:
      "Navigation d'application monopage : la valeur choisit la route, et la route choisit les vues et les appels d'API qui suivent. Un chemin contrôlé peut atteindre une route inattendue, ou une vue qui construit ses requêtes à partir des paramètres de route.",
  },
};
