/**
 * @author [A likely boring stuff made by] Shevek
 * @desc types.ts — Forme de tout texte envoyé au modèle : le dossier commun, le rubric et les lignes
 *       propres à chaque classe. Chaque langue fournit un `Wording` complet ; le compilateur refuse
 *       une traduction à laquelle il manque une phrase.
 */

import type {
  TaintEndKind,
  TaintVerdict,
} from "../../analyze/constants/taint_constants";
import type { JudgeScore, RejectReason } from "../constants";

/** Ce que Jev reçoit comme questions pour une classe. */
export interface Rubric {
  /** Définition de la classe et règles de jugement, placées en tête des deux questions. */
  definition: string;
  scoreQuestion: string;
  /** Une description par verdict : c'est elle que Jev compare au dossier. */
  scores: Record<JudgeScore, string>;
  /** Posée dans la même requête que le score ; lue seulement si le score est REJECT. */
  reasonQuestion: string;
  reasons: Record<RejectReason, string>;
}

/** Sections communes du dossier, quelle que soit la classe. */
export interface CaseWording {
  /** Nom du champ qui porte le dossier dans l'état envoyé à Jev. */
  stateKey: string;
  file: (path: string, line: number) => string;
  carrier: (text: string) => string;
  unknownCarrier: string;
  slotObjectKey: (key: string) => string;
  slotCallArgument: (index: number) => string;
  slotAssignment: string;
  taintVerdict: (verdictWithLegend: string) => string;
  pattern: (pattern: string) => string;
  patternUnavailable: string;
  holesUnmapped: string;
  origins: string;
  noOrigins: string;
  origin: (rank: number, holes: string | undefined, text: string) => string;
  knownSource: (source: string) => string;
  derivedOrigin: string;
  originCode: (line: number, code: string) => string;
  chainStop: (kindWithLegend: string) => string;
  chainStopDetail: (detail: string) => string;
  droppedOrigins: (count: number) => string;
  context: (first: number, last: number) => string;
  contextUnavailable: (path: string) => string;
  cut: (total: number) => string;
  verdictLegend: Record<TaintVerdict, string>;
  endKindLegend: Record<TaintEndKind, string>;
}

/** Lignes propres à CSPT : ce qui décide d'un reroutage de requête. */
export interface CsptLines {
  method: (method: string) => string;
  methodUnknown: string;
  authenticated: (evidence: string) => string;
  notAuthenticated: string;
  holeInPath: (hole: string) => string;
  holeInQuery: (hole: string) => string;
  forcedSuffix: (suffix: string) => string;
}

/** Lignes propres à XSS : comment la valeur est insérée dans le document. */
export interface XssLines {
  innerHtml: string;
  reactDangerouslySetInnerHtml: string;
  outerHtml: string;
  documentWrite: string;
  insertAdjacentHtml: string;
  srcdoc: string;
  createContextualFragment: string;
  parseFromString: string;
  setHtmlUnsafe: string;
  jquery: string;
  innerHtmlProperty: string;
  htmlPropertyCall: string;
  angularBypass: string;
  unsafeHtmlWrapper: string;
  createObjectUrl: string;
  otherSink: (analyzer: string) => string;
}

/** Lignes propres à CODE_EXEC : comment la valeur est exécutée. */
export interface CodeExecLines {
  evalCall: string;
  functionConstructor: string;
  stringTimer: string;
  dynamicImport: string;
  scriptElement: string;
  worker: string;
  lodashTemplate: string;
  jquery: string;
  otherSink: (analyzer: string) => string;
}

/** Lignes propres à OPEN_REDIRECT : ce que le code fige de la destination. */
export interface OpenRedirectLines {
  locationAssignment: string;
  windowOpenUrl: string;
  windowOpenOtherArgument: (index: number) => string;
  objectProperty: (key: string) => string;
  pathAttributeAssignment: string;
  spaNavigation: string;
  destinationStartsWithValue: string;
  destinationRootOnly: string;
  destinationFixedHost: (prefix: string) => string;
  destinationOpenHost: (prefix: string) => string;
}

/** Lignes propres à WEB_MESSAGE : émission ou réception d'un message. */
export interface WebMessageLines {
  emitterData: string;
  emitterTargetOrigin: string;
  emitterOtherArgument: (index: number) => string;
  receiverMessage: (analyzer: string) => string;
  receiverHashChange: string;
}

/** Le rubric d'une classe et ses lignes de dossier. */
export interface ClassWording<Lines> {
  rubric: Rubric;
  lines: Lines;
  /**
   * Comment juger un lead selon l'analyzer qui l'a produit, par nom d'analyzer. Inséré entre la
   * définition de classe et la question de score : ce qui fait basculer CE sink vers HIGH ou REJECT.
   */
  analyzerGuidance: Record<string, string>;
}

/** Tout le texte d'une langue. */
export interface Wording {
  case: CaseWording;
  CSPT: ClassWording<CsptLines>;
  XSS: ClassWording<XssLines>;
  CODE_EXEC: ClassWording<CodeExecLines>;
  OPEN_REDIRECT: ClassWording<OpenRedirectLines>;
  WEB_MESSAGE: ClassWording<WebMessageLines>;
}
