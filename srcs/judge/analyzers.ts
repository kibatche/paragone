/**
 * @author [A likely boring stuff made by] Shevek
 * @desc analyzers.ts — Catalogue des analyzers dont les leads se jugent : leurs classes d'impact, les
 *       sources lues pour les juger et la consigne de jugement, dans chaque langue.
 */

import { IMPACT_CLASSES, type ImpactClass } from "../analyze/constants/lead";
import {
  ANALYZER_REFERENCES,
  type Reference,
} from "../analyze/references/references";
import {
  IMPACT_ANALYZERS,
  JUDGE_LANGUAGES,
  type JudgeLanguage,
} from "./constants";
import { wordingFor } from "./wording";

/** Un analyzer jugé : où il compte, ce qui le documente, comment le juge le lit. */
export interface AnalyzerInfo {
  name: string;
  classes: ImpactClass[];
  references: Reference[];
  /** Consigne de jugement par langue, puis par classe ; absente quand l'analyzer n'en a pas. */
  guidance: Record<JudgeLanguage, Partial<Record<ImpactClass, string>>>;
}

function classesOf(name: string): ImpactClass[] {
  return IMPACT_CLASSES.filter((cls) => IMPACT_ANALYZERS[cls].includes(name));
}

function guidanceOf(
  name: string,
  classes: ImpactClass[],
): AnalyzerInfo["guidance"] {
  const guidance = {} as AnalyzerInfo["guidance"];
  for (const language of JUDGE_LANGUAGES) {
    const wording = wordingFor(language);
    guidance[language] = {};
    for (const cls of classes) {
      const text = wording[cls].analyzerGuidance[name];
      if (text) guidance[language][cls] = text;
    }
  }
  return guidance;
}

/** @brief Triés par nom ; un analyzer qui sert deux classes figure une fois. */
export function listAnalyzers(): AnalyzerInfo[] {
  const names = new Set(Object.values(IMPACT_ANALYZERS).flat());
  return [...names].sort().map((name) => {
    const classes = classesOf(name);
    return {
      name,
      classes,
      references: [...(ANALYZER_REFERENCES[name] ?? [])],
      guidance: guidanceOf(name, classes),
    };
  });
}
