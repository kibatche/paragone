/**
 * @author [A likely boring stuff made by] Shevek
 * @desc param-boundaries.ts — Qualifie les culs-de-sac de `resolveParam` que l'on sait NOMMER.
 *       Quand aucune référence de la fonction porteuse n'est un call-site exploitable, deux cas ne
 *       sont pas des trous de l'outil : la fonction n'est référencée que par son export (la valeur
 *       entre par un appelant hors fichier), ou son paramètre est un service injecté nommé
 *       positionnellement par une annotation `$inject`. Prédicats purs, sans effet de bord.
 */

import * as t from "@babel/types";
import { Binding, NodePath } from "@babel/traverse";

/** Un export par lequel la fonction quitte le fichier. */
export interface ExportBoundary {
  /** Nom local dans ce fichier — minifié en pratique (`D2r`). */
  local: string;
  /** Nom sous lequel un autre fichier l'importe (`k_`), ou `default`. */
  exported: string;
}

/**
 * @brief Nom exporté porté par un `ExportSpecifier`.
 * @return Le nom, ou undefined si la clé n'est ni un identifiant ni une chaîne.
 */
function getSpecifierExportedName(
  specifier: t.ExportSpecifier,
): string | undefined {
  if (t.isIdentifier(specifier.exported)) return specifier.exported.name;
  if (t.isStringLiteral(specifier.exported)) return specifier.exported.value;
  return undefined;
}

/**
 * @brief Classe UNE référence comme frontière d'export, si elle en est une.
 * @param reference Une référence au nom de la fonction.
 * @param binding Le binding de la fonction, pour reconnaître la déclaration exportée elle-même.
 * @return La frontière, ou undefined si cette référence n'est pas un export.
 *
 * Trois formes : `export { f as g }` (la dominante sur du code bundlé — 46 références sur 46 au
 * corpus), `export default f`, et la déclaration exportée en place (`export function f(){}`), qui
 * fabrique une référence FANTÔME au nom de la fonction — mesuré au banc le 2026-08-20.
 */
function classifyExportReference(
  reference: NodePath<t.Node>,
  binding: Binding,
): ExportBoundary | undefined {
  const local = t.isIdentifier(reference.node)
    ? reference.node.name
    : binding.identifier.name;

  // Déclaration exportée en place (`export function f(a) {}`) : la référence FANTÔME n'est pas un
  // identifiant, c'est le noeud `ExportNamedDeclaration` lui-même — vérifié par sonde le
  // 2026-08-21 (`ref.type === "ExportNamedDeclaration"`, `parentPath === Program`). Le nom local
  // est alors aussi le nom exporté.
  if (
    reference.isExportNamedDeclaration() ||
    reference.isExportDefaultDeclaration()
  ) {
    const estSaPropreDeclaration =
      reference.node.declaration === binding.path.node;
    if (!estSaPropreDeclaration) return undefined;
    return {
      local: local,
      exported: reference.isExportDefaultDeclaration() ? "default" : local,
    };
  }

  const parent = reference.parentPath;
  if (!parent) return undefined;

  if (parent.isExportSpecifier()) {
    const exported = getSpecifierExportedName(parent.node);
    if (!exported) return undefined;
    const localName = t.isIdentifier(parent.node.local)
      ? parent.node.local.name
      : local;
    return { local: localName, exported: exported };
  }

  if (parent.isExportDefaultDeclaration()) {
    return { local: local, exported: "default" };
  }

  return undefined;
}

/**
 * @brief La fonction ne quitte-t-elle ce fichier QUE par ses exports ?
 * @param references Les références au nom de la fonction, telles que le binding les porte.
 * @param binding Le binding de la fonction.
 * @return La liste des frontières, ou null dès qu'UNE référence n'est pas un export.
 *
 * Le « toutes » est la condition de vérité : une fonction exportée mais aussi utilisée localement a
 * un usage dans le fichier, et déclarer la frontière masquerait ce que cet usage n'a pas résolu.
 * Une liste vide rend null — sans référence, il n'y a pas de frontière à nommer.
 */
export function getExportBoundaries(
  references: NodePath<t.Node>[],
  binding: Binding,
): ExportBoundary[] | null {
  if (!references.length) return null;

  const frontieres: ExportBoundary[] = [];
  for (const reference of references) {
    const frontiere = classifyExportReference(reference, binding);
    if (!frontiere) return null;
    frontieres.push(frontiere);
  }
  return frontieres;
}

/**
 * @brief Extrait les jetons d'un tableau d'annotation.
 * @param node Le noeud supposé être le tableau `["$http", "$q"]`.
 * @return Les jetons, ou null si le tableau contient autre chose que des chaînes.
 *
 * Un seul élément non littéral suffit à tout invalider : l'annotation nomme les paramètres PAR
 * POSITION, donc un trou dans la liste décale tout ce qui suit.
 */
function readAnnotationTokens(
  node: t.Node | null | undefined,
): string[] | null {
  if (!node || !t.isArrayExpression(node)) return null;

  const jetons: string[] = [];
  for (const element of node.elements) {
    if (!t.isStringLiteral(element)) return null;
    jetons.push(element.value);
  }
  return jetons.length ? jetons : null;
}

/**
 * @brief Annotation `f.$inject = [...]`, cherchée parmi les références au nom de la fonction.
 * @param references Les références au nom de la fonction, telles que le binding les porte.
 * @return Les jetons alignés sur les paramètres, ou null si la fonction n'est pas annotée ainsi.
 */
export function getInjectPropertyTokens(
  references: NodePath<t.Node>[],
): string[] | null {
  for (const reference of references) {
    const member = reference.parentPath;
    if (!member || !member.isMemberExpression()) continue;
    if (member.node.object !== reference.node) continue;

    const estCleInject =
      (t.isIdentifier(member.node.property, { name: "$inject" }) &&
        !member.node.computed) ||
      t.isStringLiteral(member.node.property, { value: "$inject" });
    if (!estCleInject) continue;

    const assignment = member.parentPath;
    if (!assignment || !assignment.isAssignmentExpression()) continue;
    if (assignment.node.left !== member.node) continue;

    const jetons = readAnnotationTokens(assignment.node.right);
    if (jetons) return jetons;
  }
  return null;
}

/**
 * @brief Annotation en ligne `["$http", function (a) {...}]`, lue depuis la fonction elle-même.
 * @param functionParent La fonction qui porte le paramètre teinté.
 * @return Les jetons, ou null.
 *
 * Même convention que `$inject`, autre syntaxe : la fonction est le DERNIER élément d'un tableau
 * dont les précédents sont les noms de ses paramètres. On exige cette position — une fonction au
 * milieu d'un tableau de chaînes n'est pas une annotation, et l'alignement positionnel n'y
 * tiendrait pas.
 */
export function getInlineInjectTokens(
  functionParent: NodePath<t.Function>,
): string[] | null {
  const tableau = functionParent.parentPath;
  if (!tableau || !tableau.isArrayExpression()) return null;

  const elements = tableau.node.elements;
  if (elements.length < 2) return null;
  if (elements[elements.length - 1] !== functionParent.node) return null;

  const jetons: string[] = [];
  for (const element of elements.slice(0, -1)) {
    if (!t.isStringLiteral(element)) return null;
    jetons.push(element.value);
  }
  return jetons;
}
