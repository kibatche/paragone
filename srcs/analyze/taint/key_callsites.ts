/**
 * @author [A likely boring stuff made by] Shevek
 * @desc key-callsites.ts — Appels `X.clé(...)` cherchés dans TOUT le fichier, sans prouver le
 *       récepteur. Dernier recours quand la fonction est rangée dans un objet qui n'a pas de
 *       binding (`return { getSsoUrl: s }`) : le couple (objet, clé) n'existe pas, il ne reste que
 *       la clé. Index construit une fois par Program, appels marqués comme non prouvés.
 */

import * as t from "@babel/types";
import { NodePath } from "@babel/traverse";

/**
 * Nombre maximal d'appels acceptés pour une clé.
 *
 * Au-delà, la clé est trop commune pour désigner cette fonction-là (`get`, `set`, `then`…) et
 * accepter les appels reviendrait à teinter des arguments qui n'ont rien à voir. Mesuré sur le
 * corpus : les clés effectivement interrogées par le résolveur sont soit uniques, soit très
 * au-dessus de ce seuil — il n'y a pas de zone grise à arbitrer.
 */
export const KEY_CALLSITES_MAX = 3;

/** Index par Program : clé de méthode → tous les appels `X.clé(...)` du fichier. */
const indexParProgram = new WeakMap<
  t.Node,
  Map<string, NodePath<t.CallExpression>[]>
>();

/**
 * Appels retenus sans avoir prouvé le récepteur.
 *
 * Le résolveur doit pouvoir le DIRE dans le rôle de l'arête : une résolution dont on ne sait pas
 * prouver qu'elle porte sur le bon objet n'est pas de même nature qu'un appel direct, et un juge qui
 * ne verrait pas la différence lirait une certitude là où il y a une heuristique.
 */
const recepteursNonProuves = new WeakSet<t.Node>();

/** @brief Cet appel a-t-il été retenu par la seule clé, sans preuve de récepteur ? */
export function isUnprovenReceiverCall(node: t.Node): boolean {
  return recepteursNonProuves.has(node);
}

/**
 * @brief Nom de la propriété appelée dans `X.clé(...)`.
 * @return Le nom, ou undefined si le callee n'est pas un membre à clé statique.
 */
function getCalledKeyName(
  call: t.CallExpression | t.OptionalCallExpression,
): string | undefined {
  const callee = call.callee;
  if (!t.isMemberExpression(callee) && !t.isOptionalMemberExpression(callee))
    return undefined;
  if (t.isIdentifier(callee.property) && !callee.computed)
    return callee.property.name;
  if (t.isStringLiteral(callee.property)) return callee.property.value;
  return undefined;
}

/**
 * @brief Construit (ou récupère) l'index des appels par clé pour le fichier de ce chemin.
 * @param path N'importe quel chemin du fichier.
 * @return La table clé → appels.
 *
 * Un seul parcours par fichier, mémorisé sur le noeud `Program`. Le `WeakMap` rend la purge
 * inutile : l'index meurt avec l'AST, ce qui évite un `reset` de plus à tenir synchronisé.
 */
function getIndex(
  path: NodePath<t.Node>,
): Map<string, NodePath<t.CallExpression>[]> {
  const program = path.scope.getProgramParent().path;
  const existant = indexParProgram.get(program.node);
  if (existant) return existant;

  const index = new Map<string, NodePath<t.CallExpression>[]>();
  program.traverse({
    "CallExpression|OptionalCallExpression"(
      call: NodePath<t.CallExpression | t.OptionalCallExpression>,
    ) {
      const key = getCalledKeyName(call.node);
      if (!key) return;
      const liste = index.get(key);
      if (liste) liste.push(call as NodePath<t.CallExpression>);
      else index.set(key, [call as NodePath<t.CallExpression>]);
    },
  });

  indexParProgram.set(program.node, index);
  return index;
}

/**
 * @brief Appels `X.clé(...)` du fichier, quel que soit le récepteur.
 * @param path N'importe quel chemin du fichier (sert à retrouver le Program).
 * @param keyName La clé sous laquelle la fonction est rangée.
 * @return Les appels, ou [] si la clé est absente ou trop commune.
 *
 * ⚠️ Ce que ça suppose, et qui n'est pas prouvé : que `X.clé(...)` appelle bien CETTE fonction. On
 * ne le sait pas — l'objet qui la porte n'a pas de nom, donc la chaîne récepteur → objet ne peut pas
 * être refermée. C'est assumé et marqué : les appels rendus passent par `isUnprovenReceiverCall`,
 * et le rôle de l'arête le dit au juge. Le plafond est ce qui empêche l'heuristique de dériver.
 */
export function getCallsOnKeyAnywhere(
  path: NodePath<t.Node>,
  keyName: string,
): NodePath<t.CallExpression>[] {
  const appels = getIndex(path).get(keyName);
  if (!appels || appels.length > KEY_CALLSITES_MAX) return [];

  for (const appel of appels) recepteursNonProuves.add(appel.node);
  return appels;
}
