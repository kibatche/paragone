/**
 * @author [A likely boring stuff made by] Shevek
 * @desc fr/case.ts : Étiquettes et phrases du dossier commun à toutes les classes, en français.
 */

import type { CaseWording } from "../types";

export const CASE: CaseWording = {
  stateKey: "dossier",
  file: (path, line) => `[Fichier] ${path}:${line}`,
  carrier: (text) => `[Porteur] ${text}`,
  unknownCarrier: "(inconnu)",
  slotObjectKey: (key) => `[Emplacement] valeur de la clé « ${key} »`,
  slotCallArgument: (index) => `[Emplacement] argument n°${index} de l'appel`,
  slotAssignment: "[Emplacement] membre droit de l'affectation",
  taintVerdict: (verdict) => `[Verdict du taint] ${verdict}`,
  pattern: (pattern) => `[Motif] ${pattern}`,
  patternUnavailable: "[Motif] non reconstructible tel quel",
  holesUnmapped:
    "[Réserve] les trous ne sont pas rattachables un à un aux origines ci-dessous : la chaîne est assemblée par concaténation, pas par un seul gabarit.",
  origins:
    "[Origines de la valeur] la chaîne se lit du sink VERS la valeur, pas l'inverse.",
  noOrigins: "[Origines] aucune : la chaîne n'a produit aucun noeud retenu.",
  origin: (rank, holes, text) =>
    `[Origine n°${rank}${holes ? ` pour ${holes}` : ""}] ${text}`,
  knownSource: (source) => `  Source reconnue : ${source}`,
  knownSanitizeMethod: (sanitizeMethod) =>
    `  Désinfection détectée : ${sanitizeMethod}`,
  derivedOrigin: "  Descend d'une origine déjà citée, même chaîne.",
  originCode: (line, code) => `  Code (ligne ${line}) : ${code}`,
  chainStop: (kind) => `  Arrêt de la chaîne : ${kind}`,
  chainStopDetail: (detail) => `  Détail : ${detail}`,
  droppedOrigins: (count) =>
    `[Origines non rendues] ${count}, les moins informatives.`,
  context: (first, last) => `[Contexte] lignes ${first} à ${last} du fichier`,
  contextUnavailable: (path) =>
    `[Contexte] indisponible : ${path} est illisible ou a été remplacé depuis l'analyse.`,
  cut: (total) => `… [coupé, ${total} caractères au total]`,

  verdictLegend: {
    SOURCE_REACHED:
      "une source contrôlable est atteinte, et aucune branche ne s'arrête sans conclure",
    MIXED:
      "une source contrôlable est atteinte, et au moins une autre branche s'arrête sans conclure",
    LITERAL_ONLY:
      "toutes les branches finissent sur des constantes écrites dans le code",
    INCOMPLETE:
      "aucune source atteinte, et au moins une branche s'arrête sans conclure",
    NAMED_BOUNDARY:
      "aucune source atteinte, mais la valeur entre par un endroit qu'on sait désigner",
    OPAQUE: "aucune source atteinte, et aucune branche exploitable",
  },

  endKindLegend: {
    INTERNAL: "la descente continue",
    LITERAL: "constante écrite dans le code",
    CLASS_CONSTANT: "une classe déclarée dans le fichier",
    IMPORT: "vient d'un autre fichier, par import",
    UNBOUND:
      "identifiant sans déclaration dans le fichier : global du navigateur, variable posée par le bundler, ou jamais déclaré",
    NO_OPERAND: "le noeud n'a pas d'opérande à suivre",
    PARAM_ANON_FN:
      "paramètre d'une fonction anonyme : ni nom ni site d'appel à remonter",
    PARAM_NO_CALLSITE:
      "paramètre d'une fonction que ce fichier n'appelle jamais par son nom",
    PARAM_NO_VALID_CALLSITE:
      "paramètre d'une fonction référencée, mais jamais par un appel direct",
    PARAM_UNDEFINED_CALLSITE:
      "paramètre d'une fonction dont la forme n'est pas prise en charge",
    PARAM_NAME_SHADOWED: "le nom résolu désigne une autre fonction",
    PARAM_ARG_MISSING: "l'appelant ne passe rien à ce rang",
    PARAM_SHAPE:
      "forme de paramètre non prise en charge : déstructuration, reste, étalement",
    PARAM_UNBOUND: "paramètre dont la déclaration est introuvable",
    UNSUPPORTED: "type de noeud non couvert par le résolveur",
    NULL_NODE: "noeud absent",
    THIS_NODE: "`this` : non suivi par le résolveur",
    EXTERNAL_ENTRY:
      "la valeur entre par un appelant hors de ce fichier : frontière nommée, pas un trou",
    DI_TOKEN: "service injecté, nommé par une annotation `$inject` du fichier",
    TRUNCATED: "coupé par une borne du résolveur",
  },
};
