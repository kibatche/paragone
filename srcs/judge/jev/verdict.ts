/**
 * @author [A likely boring stuff made by] Shevek
 * @desc jev/verdict.ts — Une requête Jev par lead : le dossier en `state`, le score et le motif de
 *       rejet d'un rubric en deux questions `choice`. Le motif n'est retenu que si le score est REJECT.
 */

import type { JudgeScore, RejectReason } from "../constants";
import type { Rubric } from "../wording/types";
import type { JevClient } from "./client";
import { JEV_MODEL } from "./constants";

/** Verdict Jev pour un lead. */
export interface JevVerdict {
  model: string;
  score: JudgeScore;
  confidence: number;
  probabilities: Record<JudgeScore, number>;
  rejectReason?: RejectReason;
  rejectReasonConfidence?: number;
  inputTokens: number;
  outputTokens: number;
}

/**
 * @brief Instructions de la question de score : définition de la classe, consigne propre à l'analyzer
 *        quand elle existe, puis la question.
 */
export function buildScoreInstructions(
  rubric: Rubric,
  guidance?: string,
): string {
  const parts = [rubric.definition];
  if (guidance) parts.push(guidance);
  parts.push(rubric.scoreQuestion);
  return parts.join("\n\n");
}

/** @brief Les deux questions d'un rubric, sous la forme attendue par `systemOne`. */
export function buildQuestions(rubric: Rubric, guidance?: string) {
  return {
    score: {
      type: "choice",
      instructions: buildScoreInstructions(rubric, guidance),
      criteria: rubric.scores,
    },
    reason: {
      type: "choice",
      instructions: rubric.reasonQuestion,
      criteria: rubric.reasons,
    },
  } as const;
}

/**
 * @brief Juge un dossier.
 * @param stateKey Nom du champ qui porte le dossier dans l'état.
 * @param guidance Consigne propre à l'analyzer du lead, ou undefined.
 */
export async function judgeCase(
  client: JevClient,
  rubric: Rubric,
  stateKey: string,
  dossier: string,
  guidance?: string,
): Promise<JevVerdict> {
  const { model, answers, usage } = await client.systemOne({
    state: { [stateKey]: dossier },
    questions: buildQuestions(rubric, guidance),
    model: JEV_MODEL,
  });

  const score = answers.score;
  const verdict: JevVerdict = {
    model,
    score: score.choice,
    confidence: score.confidence,
    probabilities: { ...score.probabilities },
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  };
  if (score.choice === "REJECT") {
    verdict.rejectReason = answers.reason.choice;
    verdict.rejectReasonConfidence = answers.reason.confidence;
  }
  return verdict;
}
