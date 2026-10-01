/**
 * @author [A likely boring stuff made by] Shevek
 * @desc vocabulary.ts — Les valeurs que prennent les champs des données (classes, scores, motifs, verdicts,
 *       statuts, masques) et les phrases qui les expliquent, dans chaque langue du juge.
 */

import { TAINT_VERDICTS } from "../analyze/constants/taint_constants";
import {
  IMPACT_CLASSES,
  INVENTORY_CLASSES,
  LEAD_KINDS,
  type ImpactClass,
  type InventoryClass,
  type LeadKind,
} from "../analyze/constants/lead";
import {
  FILE_STATUSES,
  HUMAN_SCORES,
  QUEUE_MASKS,
  type FileStatus,
  type QueueMask,
} from "../db/constants";
import {
  JUDGE_LANGUAGES,
  JUDGE_SCORES,
  REJECT_REASONS,
  DEFAULT_JUDGE_LANGUAGE,
  type JudgeLanguage,
  type JudgeScore,
  type RejectReason,
} from "./constants";
import { wordingFor } from "./wording";

/** Définition d'une classe d'impact et sens de chaque score et motif de rejet pour elle. */
interface ClassRubric {
  definition: string;
  scores: Record<JudgeScore, string>;
  reasons: Record<RejectReason, string>;
}

/** Phrase de chaque verdict de taint et de chaque motif d'arrêt d'une chaîne. */
interface TaintLegends {
  verdict: Record<string, string>;
  endKind: Record<string, string>;
}

/** Toutes les valeurs énumérées des données, et leurs explications par langue. */
export interface Vocabulary {
  impactClasses: ImpactClass[];
  inventoryClasses: InventoryClass[];
  leadKinds: LeadKind[];
  fileStatuses: FileStatus[];
  judgeScores: JudgeScore[];
  rejectReasons: RejectReason[];
  humanScores: string[];
  queueMasks: QueueMask[];
  taintVerdicts: string[];
  taintEndKinds: string[];
  languages: JudgeLanguage[];
  defaultLanguage: JudgeLanguage;
  legends: Record<JudgeLanguage, TaintLegends>;
  rubrics: Record<JudgeLanguage, Record<ImpactClass, ClassRubric>>;
}

function legendsOf(language: JudgeLanguage): TaintLegends {
  const { verdictLegend, endKindLegend } = wordingFor(language).case;
  return { verdict: { ...verdictLegend }, endKind: { ...endKindLegend } };
}

function rubricsOf(language: JudgeLanguage): Record<ImpactClass, ClassRubric> {
  const wording = wordingFor(language);
  const entries = IMPACT_CLASSES.map((cls) => {
    const { definition, scores, reasons } = wording[cls].rubric;
    return [cls, { definition, scores, reasons }] as const;
  });
  return Object.fromEntries(entries) as Record<ImpactClass, ClassRubric>;
}

function byLanguage<T>(
  build: (language: JudgeLanguage) => T,
): Record<JudgeLanguage, T> {
  return Object.fromEntries(
    JUDGE_LANGUAGES.map((language) => [language, build(language)]),
  ) as Record<JudgeLanguage, T>;
}

export function getVocabulary(): Vocabulary {
  const legends = legendsOf(DEFAULT_JUDGE_LANGUAGE);
  return {
    impactClasses: [...IMPACT_CLASSES],
    inventoryClasses: [...INVENTORY_CLASSES],
    leadKinds: [...LEAD_KINDS],
    fileStatuses: [...FILE_STATUSES],
    judgeScores: [...JUDGE_SCORES],
    rejectReasons: [...REJECT_REASONS],
    humanScores: [...HUMAN_SCORES],
    queueMasks: [...QUEUE_MASKS],
    taintVerdicts: [...TAINT_VERDICTS],
    taintEndKinds: Object.keys(legends.endKind),
    languages: [...JUDGE_LANGUAGES],
    defaultLanguage: DEFAULT_JUDGE_LANGUAGE,
    legends: byLanguage(legendsOf),
    rubrics: byLanguage(rubricsOf),
  };
}
