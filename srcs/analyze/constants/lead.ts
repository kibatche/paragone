/**
 * @author [A likely boring stuff made by] Shevek
 * @desc lead.ts : Contrat d'entrée du juge : une racine de taint et ce qui la rend décidable.
 */

import { type TaintReport } from "./taint_constants";

export const LEAD_SCHEMA_VERSION = 2; //useless, voir pour enlever.

export const DEDUP_KEY_VERSION = 1; //useless, voir pour enlever.

/** Classes d'impact : les seules qui partent au juge. */
export const IMPACT_CLASSES = [
  "CSPT",
  "XSS",
  "CODE_EXEC",
  "OPEN_REDIRECT",
  "WEB_MESSAGE",
] as const;

/** Classes d'inventaire : conservées en base, jamais jugées. */
export const INVENTORY_CLASSES = [
  "COOKIE_INVENTORY",
  "GRAPHQL_INVENTORY",
  "HOSTNAME_INVENTORY",
  "ROBUST_PATH",
  "DOCUMENT_DOMAIN_INVENTORY",
  "LOCAL_STORAGE_INVENTORY",
  "SESSION_STORAGE_INVENTORY",
  "WINDOW_NAME_INVENTORY",
  "SECRET_INVENTORY",
  "REGEX_MATCH_INVENTORY",
  "REGEX_PATTERN_INVENTORY",
] as const;

export type ImpactClass = (typeof IMPACT_CLASSES)[number];
export type InventoryClass = (typeof INVENTORY_CLASSES)[number];

/** Classe de vulnérabilité portée par le lead. Un analyzer porte une classe, pas l'inverse. */
export type LeadClass = ImpactClass | InventoryClass;

/** Nature d'un lead : `impact` se juge, `inventory` se consulte. */
export const LEAD_KINDS = ["impact", "inventory"] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

const IMPACT_SET = new Set<string>(IMPACT_CLASSES);
const LEAD_CLASS_SET = new Set<string>([
  ...IMPACT_CLASSES,
  ...INVENTORY_CLASSES,
]);

/** @brief Garde d'exécution sur `ImpactClass`. Seules ces classes partent au juge. */
export function isImpactClass(value: unknown): value is ImpactClass {
  return typeof value === "string" && IMPACT_SET.has(value);
}

/**
 * @brief Garde d'exécution sur `LeadClass`, qui n'existe qu'à la compilation.
 *
 * Un analyzer qui dérive sa classe d'un lookup peut produire autre chose qu'une `LeadClass` sans
 * que TypeScript le voie. Il faut le tester avant toute écriture : `JSON.stringify` aplatit
 * `undefined` et les fonctions en `null` **dans un tableau**, ce qui rend la faute indétectable
 * une fois en base.
 */
export function isLeadClass(value: unknown): value is LeadClass {
  return typeof value === "string" && LEAD_CLASS_SET.has(value);
}

/**
 * @brief Un lead est d'impact dès qu'une de ses classes l'est.
 *
 * Teste l'appartenance par `IMPACT_SET`, et non par la négation de l'inventaire : une valeur hors
 * nomenclature n'est dans aucun des deux ensembles, et la négation la promouvrait en impact —
 * donc l'enverrait au juge.
 */
export function leadKind(classes: readonly LeadClass[]): LeadKind {
  return classes.some((c) => IMPACT_SET.has(c)) ? "impact" : "inventory";
}

/** Porteur syntaxique de la racine. */
export type LeadSlotKind =
  "call-argument" | "object-property" | "assignment-expression-right";

/** Où se trouve la racine dans son porteur. */
export interface LeadSlot {
  kind: LeadSlotKind;
  /** Rang dans les arguments de l'appel, ou dans les propriétés de l'objet. */
  index?: number;
  /** Nom de la propriété, seulement quand `kind` vaut `object-property`. */
  key?: string;
}

/** Ce qui décrit la requête, quand le porteur est un appel de client HTTP. */
export interface LeadRequest {
  /** Toujours en majuscules. Le tag `method-…` du match reste en minuscules. */
  method: string;
  options: Record<string, string>;
}

/**
 * L'unité de jugement.
 */
export interface Lead {
  schemaVersion: number;
  class: LeadClass[];
  analyzerName: string;
  hash: string;
  reconstructed: string;
  slot?: LeadSlot;
  request?: LeadRequest;
  taint?: TaintReport;
}
