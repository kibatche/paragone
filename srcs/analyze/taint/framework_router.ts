/**
 * @author [A likely boring stuff made by] Shevek
 * @desc framework-router.ts — Jetons d'injection de dépendance qui SONT de la donnée d'URL.
 *       Sert à qualifier un paramètre résolu par annotation `$inject` : le paramètre n'est pas une
 *       expression que l'on peut lire dans l'AST, c'est un nom de service, et certains de ces noms
 *       désignent la donnée que l'utilisateur contrôle dans la barre d'adresse.
 */

/**
 * Jetons dont la VALEUR est de la donnée d'URL.
 *
 * `$stateParams` (ui-router) et `$routeParams` (ngRoute) sont les paramètres de route déjà
 * découpés ; `$location` est le service d'URL, dont `search()`, `path()` et `hash()` rendent
 * directement ce que porte la barre d'adresse.
 */
const URL_ROUTER_TOKENS = new Map<string, string>([
  ["$stateParams", "$stateParams (paramètres de route ui-router)"],
  ["$routeParams", "$routeParams (paramètres de route ngRoute)"],
  ["$location", "$location (service d'URL Angular)"],
]);

/**
 * @brief Étiquette de source pour un jeton d'injection, s'il en est une.
 * @param token Le nom du service tel que l'annotation `$inject` l'écrit.
 * @return L'étiquette de provenance, ou la chaîne vide si le jeton n'est pas de la donnée d'URL.
 *
 * Signature en `string` et non en noeud AST, contrairement aux autres prédicats de ce répertoire :
 * ici la preuve n'est pas une forme syntaxique mais un nom, posé dans un tableau littéral à côté de
 * la fonction. Le dispatch de `check-sources.ts` ne peut donc pas la porter.
 */
export function frameworkRouterSourceLabel(token: string): string {
  return URL_ROUTER_TOKENS.get(token) ?? "";
}
