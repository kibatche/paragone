/**
 * @author Shevek
 * @desc navigation_sink.ts : ce qu'un sink de navigation exécute, en plus de rediriger.
 *
 * Une navigation n'est pas un transport neutre : elle exécute le SCHÉMA que porte l'URL qu'on lui
 * donne. Un sink qui remplace l'URL entière accepte donc `javascript:`, et une valeur dont le
 * schéma n'est pas épinglé par un littéral y est une DOM-XSS autant qu'une redirection ouverte —
 * le script s'exécutant dans le document courant, avec son origine.
 *
 * Les deux prédicats sont indépendants, et aucun des deux n'est calibré sur un corpus :
 *
 *   1. le SINK remplace-t-il l'URL entière ? (`location.href`, `window.open`) ou seulement un
 *      composant de l'URL courante (`hash`, `search`, `pathname`, `protocol`, `host`…) — c'est
 *      une propriété de la forme syntaxique, décidée par l'analyzer appelant ;
 *   2. la VALEUR laisse-t-elle la position de schéma libre ? C'est `TaintSinkHole.atStart`, du
 *      même genre que `inQuery` : `location.href = v` l'autorise, `location.href = "https://x/" + v`
 *      non, et les deux produisent le même arbre de taint — le discriminant n'existe que côté sink.
 *
 * S'y ajoute une seule condition sur le verdict, et ce n'est pas un seuil : `LITERAL_ONLY` est le
 * verdict qui ÉTABLIT que la valeur n'a que des feuilles littérales, donc qu'elle est constante et
 * son schéma connu. Mesuré au banc : `window.open(url)` où `url` se résout en littéral rend un
 * motif `EXPR#0` — position de schéma libre — tout en étant `LITERAL_ONLY` ; les deux prédicats
 * sont donc bien indépendants. Tous les autres verdicts laissent une influence possible et ne
 * permettent pas de conclure que le schéma est fixé ; on ne les discrimine pas entre eux, car le
 * verdict mesure l'influence, pas la position du schéma.
 */

import { type TaintReport } from "../../constants/taint_constants";
import { type ImpactClass } from "../../constants/lead";

/**
 * @brief La valeur donnée au sink peut-elle fournir le schéma de l'URL ?
 * @param taint Rapport de teinte du lead, dont le contexte de sink porte les trous numérotés.
 * @return `true` quand le premier trou ouvre la chaîne, donc qu'aucun littéral n'épingle le schéma.
 *
 * Une chaîne sans aucun trou est entièrement littérale : le schéma y est écrit en clair, donc
 * épinglé. Un motif non reconstructible (`pattern` vide) ne permet aucune conclusion, et on ne
 * conclut pas — arrêt déclaré du raisonnement, pas supposition favorable.
 */
export function schemePositionOpen(taint: TaintReport): boolean {
  const sink = taint.sink;
  if (!sink || sink.pattern === "") return false;
  return sink.holes.some((hole) => hole.atStart === true);
}

/**
 * @brief Classes d'impact d'un sink de navigation.
 * @param taint Rapport de teinte du lead.
 * @param replacesWholeUrl Le sink remplace l'URL entière (décidé par l'analyzer appelant).
 * @return `["OPEN_REDIRECT", "XSS"]` quand le schéma est exécutable, `["OPEN_REDIRECT"]` sinon.
 */
export function navigationImpactClasses(
  taint: TaintReport,
  replacesWholeUrl: boolean,
): ImpactClass[] {
  return replacesWholeUrl &&
    taint.verdict !== "LITERAL_ONLY" &&
    schemePositionOpen(taint)
    ? ["OPEN_REDIRECT", "XSS"]
    : ["OPEN_REDIRECT"];
}
