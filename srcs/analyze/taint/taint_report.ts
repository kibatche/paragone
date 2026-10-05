/**
 * @author [A likely boring stuff made by] kbtch_ + Shevek
 * @desc taint-report.ts : Réduit un arbre de taint à ce qu'un juge doit lire : le sink et sa chaîne
 *       reconstruite, un verdict de racine, et les seuls noeuds retenus avec le chemin qui y mène.
 *       Ne rend aucune forme lisible : la présentation vit dans `srcs/judge/case/build.ts`.
 */

import * as t from "@babel/types";
import { NodePath } from "@babel/traverse";
import {
  FINDINGS_MAX,
  FRONTIERES_NOMMEES,
  KINDS_NON_INFORMATIFS,
  LABEL_MAX,
  type TaintFinding,
  type TaintFindingNormalized,
  type TaintNode,
  type TaintPathStep,
  type TaintReport,
  type TaintSinkContext,
  type TaintSinkHole,
  type TaintVerdict,
} from "../constants/taint_constants";
import { processStringConcatenation } from "../ast_analyzers/cspt/cspt_utils";
import { type Position } from "../constants/taint_constants";
import { type Lead } from "../constants/lead";
import { SHA256 } from "bun";

/** Ordre de retenue : une source d'abord, puis ce qui coupe une branche, puis le reste. */
function rangFinding(f: TaintFinding): number {
  if (f.knownSource) return 0;
  if (f.kind === "UNBOUND" || f.kind === "IMPORT") return 2;
  return 1;
}

/** Les seules formes dont `processStringConcatenation` sait tirer une chaîne. */
export type ReconstructibleNode =
  | t.StringLiteral
  | t.TemplateLiteral
  | t.BinaryExpression
  | t.CallExpression
  | t.OptionalCallExpression;

/**
 * @brief Numérote les trous d'une chaîne reconstruite et dit lesquels tombent dans la query.
 * @param brut Chaîne rendue par `processStringConcatenation` (trous marqués par le littéral `EXPR`).
 * @return La chaîne à trous numérotés, et la liste des trous.
 *
 */
function annotateHole(brut: string): {
  pattern: string;
  holes: TaintSinkHole[];
} {
  const holes: TaintSinkHole[] = [];
  const posQuery = brut.indexOf("?");
  let pattern = "";
  let curseur = 0;
  for (;;) {
    const i = brut.indexOf("EXPR", curseur);
    if (i < 0) break;
    const name = `EXPR#${holes.length}`;
    holes.push(
      posQuery === -1 ? { name: name } : { name: name, inQuery: i > posQuery },
    );
    pattern += brut.slice(curseur, i) + name;
    curseur = i + "EXPR".length;
  }
  pattern += brut.slice(curseur);
  return { pattern: pattern, holes: holes };
}

/**
 * @brief Construit le contexte de sink depuis le noeud teinté et son porteur syntaxique.
 * @param path Le chemin passé à `taintIdentifier`, c'est-à-dire l'opérande du sink.
 * @param carrier Le noeud qui porte l'opérande : l'appel, ou la propriété d'objet.
 * @return Le contexte. Toujours défini : un noeud entièrement opaque rend le `pattern` `EXPR#0`.
 *
 */
export function buildSinkContext(
  path: NodePath<t.Node>,
  carrier: NodePath<t.Node>,
): TaintSinkContext {
  const node = path.node;
  const brut = processStringConcatenation(node);
  const { pattern, holes } = annotateHole(brut);

  const holesMapped =
    t.isTemplateLiteral(node) && holes.length === node.expressions.length;

  return {
    carrierText: capTexte(carrier.toString(), TEXT_MAX),
    loc: { start: carrier.node.loc?.start, end: carrier.node.loc?.end },
    pattern: pattern,
    holes: holes,
    holesMapped: holesMapped,
  };
}

/**
 * @brief Parcourt le graphe une fois et rend tout ce dont le rapport a besoin.
 * @param rootId Id de la racine, rendu par `taintIdentifier`.
 * @param table Table de noeuds du fichier courant, rendue par `getTaintTable()`.
 * @param sink Contexte du sink, rendu par `buildSinkContext`.
 * @return Le rapport, ou undefined si la racine est vide ou absente de la table.
 *
 */
export function taintReport(
  rootId: number | undefined,
  table: readonly TaintNode[],
  sourceFile: string,
  sink?: TaintSinkContext,
): TaintReport | undefined {
  if (rootId === undefined || !table[rootId]) return undefined;

  const trous = trousParNoeud(rootId, table, sink);

  const findings: TaintFinding[] = [];
  const omitted: Record<string, number> = {};
  const sources = new Set<string>();
  /** Ids déjà visités. Sert de garde de terminaison ET de règle « première route gagne ». */
  const seen = new Set<number>();
  let nodeCount = 0;
  let shared = 0;
  let hasSource = false;
  let hasCut = false;
  let hasNamedBoundary = false;
  let hasLiteralLeaf = false;
  let hasOtherLeaf = false;

  /**
   * @param nodeId Index dans `table`. Rien à voir avec `TaintFinding.id`, qui numérote les findings.
   * @param path Route depuis la racine jusqu'à ce noeud.
   * @param sourceAncestor `TaintFinding.id` de la source la plus proche au-dessus, s'il y en a une.
   */
  const visit = (
    nodeId: number | undefined,
    path: TaintPathStep[],
    sourceAncestor: number | undefined,
  ) => {
    if (nodeId === undefined) return;
    const node = table[nodeId];
    if (!node) return;

    if (seen.has(nodeId)) {
      shared++;
      return;
    }
    seen.add(nodeId);
    nodeCount++;

    // Un noeud source a presque toujours des enfants (`new URLSearchParams(location.search)` porte
    // son callee et son argument) : le retenir sur le seul critère `end` perdrait toutes les sources.
    const isSource = !!node.knownSource;
    if (isSource) {
      hasSource = true;
      sources.add(node.knownSource!);
    }

    const isSanitized = !!node.sanitizeMethod;
    // Sous un noeud déjà étiqueté source, l'identifiant sans binding est sa propre base (`window` sous
    // `window.location.search`, `URLSearchParams` sous son `new`) : le label le dit déjà.
    const redondant =
      sourceAncestor !== undefined && node.endKind === "UNBOUND";

    if (node.end) {
      if (KINDS_NON_INFORMATIFS.includes(node.endKind) || redondant) {
        if (node.endKind === "LITERAL") hasLiteralLeaf = true;
        const motif = redondant ? "UNBOUND (base de la source)" : node.endKind;
        omitted[motif] = (omitted[motif] ?? 0) + 1;
      } else {
        hasOtherLeaf = true;
        // Ce qui empêche de conclure : le juge doit savoir qu'une branche s'arrête là, et pourquoi.
        if (FRONTIERES_NOMMEES.includes(node.endKind)) hasNamedBoundary = true;
        else if (node.endKind !== "UNBOUND" && node.endKind !== "IMPORT")
          hasCut = true;
      }
    }

    let currentSource = sourceAncestor;
    if (
      isSource ||
      (node.end &&
        !redondant &&
        !KINDS_NON_INFORMATIFS.includes(node.endKind)) ||
      isSanitized
    ) {
      const findingId = findings.length;
      findings.push({
        kind: node.endKind,
        knownSource: node.knownSource ?? "",
        sourceString:
          getSourceString(sourceFile, node.loc.start, node.loc.end) ?? "",
        sanitizeMethod: node.sanitizeMethod ?? "",
        nodeType: node.nodeType,
        text: String(node.text),
        loc: node.loc,
        endReason: node.endReason,
        path: path,
        id: findingId,
        derivedFrom: sourceAncestor,
        holes: trous.get(nodeId),
      });
      if (isSource) currentSource = findingId;
    }

    // Le label ne dépend que du noeud courant : le calculer une fois, pas une fois par enfant.
    const label = labelOf(node);
    for (const child of node.children) {
      const cran: TaintPathStep = {
        role: child.role,
        nodeType: node.nodeType,
        label: label,
      };
      visit(child.node, [...path, cran], currentSource);
    }
  };
  visit(rootId, [], undefined);

  const retenus = [...findings].sort((a, b) => rangFinding(a) - rangFinding(b));
  const kept = retenus.length;
  if (retenus.length > FINDINGS_MAX) {
    omitted["TRUNCATED"] = retenus.length - FINDINGS_MAX;
    retenus.length = FINDINGS_MAX;
  }

  const ecartesTotal = Object.entries(omitted)
    .filter(([k]) => k !== "TRUNCATED")
    .reduce((acc, [, v]) => acc + v, 0);

  return {
    verdict: verdictDepuisPli(
      hasSource,
      hasCut,
      hasLiteralLeaf,
      hasOtherLeaf,
      hasNamedBoundary,
    ),
    sources: [...sources],
    findings: retenus,
    omitted: omitted,
    nodeCount: nodeCount,
    kept: kept,
    traversed: nodeCount - kept - ecartesTotal,
    shared: shared,
    sink: sink,
  };
}

export function normalizeNode(
  rootId: number | undefined,
  table: readonly TaintNode[],
  sink?: TaintSinkContext,
): string | undefined {
  if (rootId === undefined || !table[rootId]) return undefined;

  const trous = trousParNoeud(rootId, table, sink);

  const findings: TaintFindingNormalized[] = [];
  const omitted: Record<string, number> = {};
  const sources = new Set<string>();
  const seen = new Set<number>();

  // eslint considère ces lignes comme étant des variables inutilisées. Or, c'est faux, elles sont utilisées dans la fonction interne.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let nodeCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let shared = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let hasSource = false;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let hasCut = false;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let hasNamedBoundary = false;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let hasLiteralLeaf = false;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let hasOtherLeaf = false;

  const visit = (
    nodeId: number | undefined,
    path: TaintPathStep[],
    sourceAncestor: number | undefined,
  ) => {
    if (nodeId === undefined) return;
    const node = table[nodeId];
    if (!node) return;

    if (seen.has(nodeId)) {
      shared++;
      return;
    }
    seen.add(nodeId);
    nodeCount++;

    const isSource = !!node.knownSource;
    if (isSource) {
      hasSource = true;
      sources.add(node.knownSource!);
    }
    const isSanitized = !!node.sanitizeMethod;
    const redondant =
      sourceAncestor !== undefined && node.endKind === "UNBOUND";

    if (node.end) {
      if (KINDS_NON_INFORMATIFS.includes(node.endKind) || redondant) {
        if (node.endKind === "LITERAL") hasLiteralLeaf = true;
        const motif = redondant ? "UNBOUND (base de la source)" : node.endKind;
        omitted[motif] = (omitted[motif] ?? 0) + 1;
      } else {
        hasOtherLeaf = true;
        if (FRONTIERES_NOMMEES.includes(node.endKind)) hasNamedBoundary = true;
        else if (node.endKind !== "UNBOUND" && node.endKind !== "IMPORT")
          hasCut = true;
      }
    }

    let currentSource = sourceAncestor;
    if (
      isSource ||
      (node.end &&
        !redondant &&
        !KINDS_NON_INFORMATIFS.includes(node.endKind)) ||
      isSanitized
    ) {
      const findingId = findings.length;
      findings.push({
        kind: node.endKind,
        knownSource: node.knownSource ?? "",
        sanitizeMethod: node.sanitizeMethod ?? "",
        nodeType: node.nodeType,
        endReason: node.endReason,
        derivedFrom: sourceAncestor,
        holes: trous.get(nodeId),
      });
      if (isSource) currentSource = findingId;
    }
    const label = labelOf(node);
    for (const child of node.children) {
      const cran: TaintPathStep = {
        role: child.role,
        nodeType: node.nodeType,
        label: label,
      };
      visit(child.node, [...path, cran], currentSource);
    }
  };
  visit(rootId, [], undefined);
  return JSON.stringify(findings);
}

/**
 * @brief Clé de dédup d'un lead : SHA256 de ses classes triées, du motif de son sink, du texte de
 *        son porteur et de la forme de son taint (`lead.hash`).
 * @param lead Le lead.
 * @param carrierText Le texte du match qui porte le lead.
 * @return Un SHA256 hexadécimal.
 */
export function dedupKey(lead: Lead, carrierText: string): string {
  const parts = [
    [...lead.class].sort(),
    lead.taint?.sink?.pattern ?? "",
    carrierText,
    lead.hash,
  ];
  return SHA256.hash(JSON.stringify(parts), "hex").toString();
}

function getSourceString(
  functionStr: string,
  start?: Position,
  end?: Position,
): string | undefined {
  if (!end || !start) return undefined;
  const startIdx = functionStr.lastIndexOf("\n", start.index) + 1;
  const endIdx = functionStr.indexOf("\n", end.index);
  return functionStr
    .slice(startIdx, endIdx == -1 ? end.index : endIdx)
    .slice(0, 500);
}

/**
 * @brief Trous du sink dont chaque noeud du graphe descend.
 * @param rootId Id de la racine.
 * @param table Table de noeuds du fichier.
 * @param sink Contexte du sink.
 * @return Id de noeud → trous qui l'atteignent. Vide si la correspondance n'est pas établie.
 *
 */
function trousParNoeud(
  rootId: number,
  table: readonly TaintNode[],
  sink?: TaintSinkContext,
): Map<number, TaintSinkHole[]> {
  const parNoeud = new Map<number, TaintSinkHole[]>();
  const racine = table[rootId];
  if (!sink?.holesMapped || !racine) return parNoeud;

  for (const branche of racine.children) {
    const m = /^expressions\[(\d+)\]$/.exec(branche.role);
    if (!m) continue;
    const trou = sink.holes[Number(m[1])];
    if (!trou) continue;

    const seen = new Set<number>();
    const pile: (number | undefined)[] = [branche.node];
    while (pile.length) {
      const id = pile.pop();
      if (id === undefined || seen.has(id) || !table[id]) continue;
      seen.add(id);

      const deja = parNoeud.get(id);
      if (deja) {
        if (!deja.includes(trou)) deja.push(trou);
      } else parNoeud.set(id, [trou]);

      for (const enfant of table[id].children) pile.push(enfant.node);
    }
  }
  return parNoeud;
}

/**
 * @brief Nom du noeud, pour les seuls types qui en portent un.
 *
 */
function labelOf(node: TaintNode): string | undefined {
  if (
    node.nodeType !== "Identifier" &&
    !node.nodeType.startsWith("BindingNode")
  )
    return undefined;
  const texte = String(node.text);
  if (!texte || texte.length > LABEL_MAX || texte.includes("\n"))
    return undefined;
  return texte;
}

const TEXT_MAX = 200;
function capTexte(texte: string, max: number): string {
  if (texte.length <= max) return texte;
  return `${texte.slice(0, max)}… [texte coupé, ${texte.length} caractères au total]`;
}

/**
 * @brief Assemble le verdict à partir de ce que le parcours a vu.
 */
function verdictDepuisPli(
  hasSource: boolean,
  hasCut: boolean,
  hasLiteralLeaf: boolean,
  hasOtherLeaf: boolean,
  hasNamedBoundary: boolean,
): TaintVerdict {
  if (hasSource) return hasCut ? "MIXED" : "SOURCE_REACHED";
  if (hasLiteralLeaf && !hasOtherLeaf) return "LITERAL_ONLY";
  if (hasCut) return "INCOMPLETE";
  if (hasNamedBoundary) return "NAMED_BOUNDARY";
  return "OPAQUE";
}
