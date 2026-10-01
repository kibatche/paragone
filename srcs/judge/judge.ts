/**
 * @author [A likely boring stuff made by] kbtch_ + Shevek
 * @desc judge.ts — Étape juge du pipeline : soumet à Jev les leads jugeables d'une classe, par lots de
 *       requêtes concurrentes, et écrit chaque verdict dans `judgements`. Un lead en erreur transitoire
 *       reste sans jugement pour le tour suivant ; une erreur permanente arrête le run.
 */

import { IMPACT_CLASSES, type ImpactClass } from "../analyze/constants/lead";
import {
  countJudgeableLeads,
  countRemainingJudge,
  listLeadsToJudge,
  saveJudgement,
} from "../db/judge";
import type { LeadToJudge } from "../db/types";
import { log, logEvent, RUN_ID } from "../cli/log/log";
import { saveBatchUsage } from "../db/usage";
import {
  chunk,
  stopReason,
} from "../cli/state/state";
import { buildCase } from "./case/build";
import type { JudgeRequest } from "./constants";
import { isPermanentJevError, type JevClient } from "./jev/client";
import { judgeCase, type JevVerdict } from "./jev/verdict";
import { wordingFor } from "./wording";
import type { Wording } from "./wording/types";
import type { Usage } from "../cli/usage/types";
import { ZERO_USAGE } from "../cli/usage/constants";
import { addUsage, formatUsage, usageOf } from "../cli/usage/usage";
import { config } from "../config/config";
import { DEFAULT_MAX_TURNS } from "../cli/state/constants";

/** @brief Adapte un lead lu en base en requête pour `buildCase`. */
export function toJudgeRequest(lead: LeadToJudge): JudgeRequest {
  return {
    id: String(lead.id),
    filePath: lead.filePath,
    line: lead.line,
    column: lead.column,
    lead: lead.lead,
  };
}

function isImpactClass(cls: string): cls is ImpactClass {
  return (IMPACT_CLASSES as readonly string[]).includes(cls);
}

/** Ce qu'un lot doit savoir pour juger et pour tracer. */
interface BatchContext {
  client: JevClient;
  cls: ImpactClass;
  wording: Wording;
  batch: number;
  of: number;
}

/** @brief Construit le dossier d'un lead et le soumet à Jev, avec la consigne de son analyzer. */
function judgeLead(lead: LeadToJudge, ctx: BatchContext): Promise<JevVerdict> {
  const classWording = ctx.wording[ctx.cls];
  const dossier = buildCase(toJudgeRequest(lead), ctx.cls, ctx.wording);
  return judgeCase(
    ctx.client,
    classWording.rubric,
    ctx.wording.case.stateKey,
    dossier,
    classWording.analyzerGuidance[lead.lead.analyzerName],
  );
}

function storeVerdict(lead: LeadToJudge, cls: string, verdict: JevVerdict) {
  saveJudgement({
    leadId: lead.id,
    cls,
    score: verdict.score,
    rejectReason: verdict.rejectReason,
    confidence: verdict.confidence,
    probabilities: verdict.probabilities,
    model: verdict.model,
  });
}

/** @brief Trace un lead dont l'appel a échoué ; il reste sans jugement. */
function reportLeadError(
  lead: LeadToJudge,
  ctx: BatchContext,
  err: unknown,
): void {
  const message = err instanceof Error ? err.message : String(err);
  log(
    `[judge:${ctx.cls}] ⚠️  lot ${ctx.batch}/${ctx.of} : lead ${lead.id} sans jugement — ${message}`,
  );
  logEvent("lead_error", {
    phase: "judge",
    sinkType: ctx.cls,
    batch: ctx.batch,
    leadId: lead.id,
    error: message,
  });
}

/**
 * @brief Juge un lot en parallèle et écrit chaque verdict obtenu. Les verdicts obtenus sont écrits
 *        avant qu'une erreur permanente ne soit levée : un lot interrompu ne perd rien de ce qu'il a payé.
 * @return L'usage du lot.
 */
async function judgeBatch(
  batch: LeadToJudge[],
  ctx: BatchContext,
): Promise<Usage> {
  
  log(
    `[judge:${ctx.cls}] lot ${ctx.batch}/${ctx.of} (${batch.length} leads : ${batch.map((lead) => lead.id).join(", ")})`,
  );
  
  logEvent("batch_start", {
    phase: "judge",
    sinkType: ctx.cls,
    batch: ctx.batch,
    of: ctx.of,
    rowids: batch.map((lead) => lead.id),
  });
  
  const results = await Promise.allSettled(
    batch.map((lead) => judgeLead(lead, ctx)),
  );

  let usage: Usage = { ...ZERO_USAGE };
  let permanent: { lead: LeadToJudge; err: unknown } | undefined;
  
  results.forEach((result, i) => {
    const lead = batch[i]!;
    if (result.status === "fulfilled") {
      storeVerdict(lead, ctx.cls, result.value);
      usage = addUsage(usage, usageOf(result.value));
      return;
    }
    reportLeadError(lead, ctx, result.reason);
    if (!permanent && isPermanentJevError(result.reason))
      permanent = { lead, err: result.reason };
  });

  saveBatchUsage({
    runId: RUN_ID,
    sinkType: ctx.cls,
    phase: "judge",
    batch: ctx.batch,
    usage,
  });
  logEvent("batch_end", {
    phase: "judge",
    sinkType: ctx.cls,
    batch: ctx.batch,
    ...usage,
  });
  if (permanent) {
    throw new Error(
      `Error [judge:${ctx.cls}]: lead ${permanent.lead.id} — erreur permanente de l'API Jev, run arrêté.`,
      { cause: permanent.err },
    );
  }
  return usage;
}

/**
 * @brief Trace les analyzers dont les leads partent sans consigne de jugement : ils sont jugés sur la
 *        seule définition de classe. Une ligne par analyzer, pas par lead.
 * @return Les analyzers sans consigne.
 */
export function reportMissingGuidance(
  leads: LeadToJudge[],
  cls: ImpactClass,
  wording: Wording,
): string[] {
  const analyzers = new Set(leads.map((lead) => lead.lead.analyzerName));
  const missing = [...analyzers].filter(
    (analyzer) => !wording[cls].analyzerGuidance[analyzer],
  );
  for (const analyzer of missing) {
    log(
      `[judge:${cls}] ⚠️  analyzer « ${analyzer} » sans consigne de jugement : ses leads sont jugés sur la seule définition de classe.`,
    );
    logEvent("missing_guidance", {
      phase: "judge",
      sinkType: cls,
      analyzer,
    });
  }
  return missing;
}

/**
 * @brief Juge les leads encore sans jugement d'une classe. `reset` efface d'abord les jugements de
 *        la classe, après confirmation.
 * @return L'usage cumulé du passage.
 */
export async function runJudge(
client: JevClient, sinkType: string
): Promise<Usage> {
  if (!isImpactClass(sinkType)) {
    throw new Error(
      `Error [judge]: « ${sinkType} » n'est pas une classe d'impact (${IMPACT_CLASSES.join(", ")}).`,
    );
  }
  const judgeable = countJudgeableLeads(sinkType);
  const remaining = listLeadsToJudge(sinkType);
  log(
    `[judge:${sinkType}] ${judgeable} leads jugeables — ${judgeable - remaining.length} déjà jugés (ignorés), ${remaining.length} à juger (langue : fr}).`,
  );
  if (remaining.length === 0) return { ...ZERO_USAGE };

  const wording = wordingFor("fr");
  reportMissingGuidance(remaining, sinkType, wording);
  const batches = chunk(remaining, config.batch);
  let usage: Usage = { ...ZERO_USAGE };
  for (let i = 0; i < batches.length; i++) {
    const ctx = {
      client,
      cls: sinkType,
      wording,
      batch: i + 1,
      of: batches.length,
    };
    usage = addUsage(usage, await judgeBatch(batches[i]!, ctx));
  }
  log(`[judge:${sinkType}] ${formatUsage(usage)}`);
  return usage;
}

/**
 * @brief Relance `runJudge` tant que des leads restent sans jugement, dans la limite des tours.
 *        `reset` n'agit qu'au tour 1. Cumule l'usage de tous les tours.
 * @return Usage cumulé.
 */
export async function runJudgeUntilDone(
  client: JevClient,
  sinkType: string,
): Promise<Usage> {
  let total: Usage = { ...ZERO_USAGE };
  let prevRemaining = Number.POSITIVE_INFINITY;
  for (let turn = 1; ; turn++) {
    total = addUsage(
      total,
      await runJudge(client, sinkType),
    );
    const remaining = countRemainingJudge(sinkType);
    const reason = stopReason({
      remaining,
      prevRemaining,
      turn,
      limit: DEFAULT_MAX_TURNS,
    });
    if (reason) {
      if (turn > 1)
        log(
          `[judge:${sinkType}] max_turns : arrêt après ${turn} tours — ${reason}.`,
        );
      break;
    }
    log(
      `[judge:${sinkType}] max_turns : ${remaining} leads restants après le tour ${turn} → relance (${turn + 1}/3).`,
    );
    prevRemaining = remaining;
  }
  return total;
}

/** @return L'usage de chaque classe de `config.classes`, jugées l'une après l'autre. */
export async function judgeClasses(
  client: JevClient,
): Promise<Record<string, Usage>> {
  const usage: Record<string, Usage> = {};
  for (const cls of config.classes) usage[cls] = await runJudgeUntilDone(client, cls);
  return usage;
}
