/**
 * @author [A likely boring stuff made by] Shevek
 * @desc dossier.ts — Ce qui aide un humain à comprendre un lead : par classe d'impact, la définition, la
 *       consigne de l'analyzer, le sens de chaque score et le dossier exact envoyé à Jev ; pour le
 *       lead, ses références et les légendes de son taint.
 */

import {
  IMPACT_CLASSES,
  type ImpactClass,
  type Lead,
} from "../analyze/constants/lead";
import {
  ANALYZER_REFERENCES,
  type Reference,
} from "../analyze/references/references";
import { buildCase } from "./case/build";
import type { JudgeLanguage, JudgeScore, RejectReason } from "./constants";
import { wordingFor } from "./wording";

/** Ce qu'il faut savoir d'un lead pour en construire le dossier. */
export interface DossierInput {
  id: number;
  file: string;
  line: number;
  column: number;
  lead: Lead;
}

/** Le cadre de jugement d'une classe, appliqué à ce lead. */
export interface ClassDossier {
  cls: ImpactClass;
  definition: string;
  /** Consigne propre à l'analyzer ; null quand l'analyzer n'en a pas pour cette classe. */
  guidance: string | null;
  scores: Record<JudgeScore, string>;
  reasons: Record<RejectReason, string>;
  /** Le texte envoyé à Jev pour cette classe, tel quel. */
  caseText: string;
}

/** Tout ce que le front ajoute au lead brut pour le rendre lisible. */
export interface LeadDossier {
  analyzerName: string;
  references: Reference[];
  classes: ClassDossier[];
  /** Phrase du verdict de taint, ou null sans taint. */
  verdictLegend: string | null;
  /** Phrase de chaque motif d'arrêt présent dans les origines du lead. */
  endKindLegend: Record<string, string>;
}

function isImpactClass(cls: string): cls is ImpactClass {
  return (IMPACT_CLASSES as readonly string[]).includes(cls);
}

function presentEndKinds(
  lead: Lead,
  legend: Record<string, string>,
): Record<string, string> {
  const kinds = new Set((lead.taint?.findings ?? []).map((f) => f.kind));
  const present: Record<string, string> = {};
  for (const kind of kinds) {
    const sentence = legend[kind];
    if (sentence) present[kind] = sentence;
  }
  return present;
}

/**
 * @brief Dossier d'un lead dans la langue du juge. Un lead d'inventaire n'a aucune classe d'impact,
 *        donc aucun cadre de jugement : seules ses références et légendes sont rendues.
 */
export function buildLeadDossier(
  input: DossierInput,
  language: JudgeLanguage,
): LeadDossier {
  const wording = wordingFor(language);
  const { lead } = input;
  const request = {
    id: String(input.id),
    filePath: input.file,
    line: input.line,
    column: input.column,
    lead,
  };
  const classes = lead.class.filter(isImpactClass).map((cls) => {
    const classWording = wording[cls];
    return {
      cls,
      definition: classWording.rubric.definition,
      guidance: classWording.analyzerGuidance[lead.analyzerName] ?? null,
      scores: classWording.rubric.scores,
      reasons: classWording.rubric.reasons,
      caseText: buildCase(request, cls, wording),
    };
  });
  const verdict = lead.taint?.verdict;
  return {
    analyzerName: lead.analyzerName,
    references: [...(ANALYZER_REFERENCES[lead.analyzerName] ?? [])],
    classes,
    verdictLegend: verdict ? wording.case.verdictLegend[verdict] : null,
    endKindLegend: presentEndKinds(lead, wording.case.endKindLegend),
  };
}
