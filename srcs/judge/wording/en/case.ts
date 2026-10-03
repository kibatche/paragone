/**
 * @author [A likely boring stuff made by] Shevek
 * @desc en/case.ts — Étiquettes et phrases du dossier commun à toutes les classes, en anglais.
 */

import type { CaseWording } from "../types";

export const CASE: CaseWording = {
  stateKey: "case_file",
  file: (path, line) => `[File] ${path}:${line}`,
  carrier: (text) => `[Carrier] ${text}`,
  unknownCarrier: "(unknown)",
  slotObjectKey: (key) => `[Slot] value of the key "${key}"`,
  slotCallArgument: (index) => `[Slot] argument #${index} of the call`,
  slotAssignment: "[Slot] right-hand side of the assignment",
  taintVerdict: (verdict) => `[Taint verdict] ${verdict}`,
  pattern: (pattern) => `[Pattern] ${pattern}`,
  patternUnavailable: "[Pattern] cannot be rebuilt as is",
  holesUnmapped:
    "[Caveat] the holes cannot be matched one by one to the origins below: the string is built by concatenation, not by a single template.",
  origins:
    "[Origins of the value] the chain reads from the sink TOWARDS the value, not the other way round.",
  noOrigins: "[Origins] none: the chain kept no node.",
  origin: (rank, holes, text) =>
    `[Origin #${rank}${holes ? ` for ${holes}` : ""}] ${text}`,
  knownSource: (source) => `  Known source: ${source}`,
  knownSanitizeMethod: (sanitizeMethod) =>
    `  Sanitization detected: ${sanitizeMethod}`,
  derivedOrigin: "  Derives from an origin already listed, same chain.",
  originCode: (line, code) => `  Code (line ${line}): ${code}`,
  chainStop: (kind) => `  Chain stops: ${kind}`,
  chainStopDetail: (detail) => `  Detail: ${detail}`,
  droppedOrigins: (count) =>
    `[Origins not shown] ${count}, the least informative ones.`,
  context: (first, last) => `[Context] lines ${first} to ${last} of the file`,
  contextUnavailable: (path) =>
    `[Context] unavailable: ${path} is unreadable or was replaced since the analysis.`,
  cut: (total) => `… [cut, ${total} characters in total]`,

  verdictLegend: {
    SOURCE_REACHED:
      "an attacker-controllable source is reached, and no branch stops without a conclusion",
    MIXED:
      "an attacker-controllable source is reached, and at least one other branch stops without a conclusion",
    LITERAL_ONLY: "every branch ends on constants written in the code",
    INCOMPLETE:
      "no source reached, and at least one branch stops without a conclusion",
    NAMED_BOUNDARY:
      "no source reached, but the value enters through a place that can be named",
    OPAQUE: "no source reached, and no usable branch",
  },

  endKindLegend: {
    INTERNAL: "the descent goes on",
    LITERAL: "constant written in the code",
    CLASS_CONSTANT: "a class declared in the file",
    IMPORT: "comes from another file, through an import",
    UNBOUND:
      "identifier with no declaration in the file: browser global, bundler variable, or never declared",
    NO_OPERAND: "the node has no operand to follow",
    PARAM_ANON_FN:
      "parameter of an anonymous function: no name and no call site to follow",
    PARAM_NO_CALLSITE: "parameter of a function this file never calls by name",
    PARAM_NO_VALID_CALLSITE:
      "parameter of a referenced function, never called directly",
    PARAM_UNDEFINED_CALLSITE:
      "parameter of a function whose shape is not supported",
    PARAM_NAME_SHADOWED: "the resolved name points to another function",
    PARAM_ARG_MISSING: "the caller passes nothing at this position",
    PARAM_SHAPE: "unsupported parameter shape: destructuring, rest, spread",
    PARAM_UNBOUND: "parameter whose declaration cannot be found",
    UNSUPPORTED: "node type not covered by the resolver",
    NULL_NODE: "missing node",
    THIS_NODE: "`this`: not followed by the resolver",
    EXTERNAL_ENTRY:
      "the value comes from a caller outside this file — a named boundary, not a gap",
    DI_TOKEN: "injected service, named by a `$inject` annotation in the file",
    TRUNCATED: "cut by a resolver limit",
  },
};
