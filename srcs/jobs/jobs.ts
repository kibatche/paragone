/**
 * @author [A likely boring stuff made by] Shevek
 * @desc jobs.ts : Lance le scan et le juge en arrière-plan, avec la configuration en mémoire au moment du
 *       lancement. Un seul travail à la fois ; son état et son avancement se lisent à tout moment.
 */

import { checkAnalyze, config } from "../config/config";
import { log } from "../cli/log/log";
import { countRemainingJudge } from "../db/judge";
import { judgeClasses } from "../judge/judge";
import type { JevClient } from "../judge/jev/client";
import { ensureScan } from "../scan/scan";
import { JobRefusal } from "./errors";
import type { Job, JobKind, JobProgress, Jobs } from "./types";

/** Un travail et, pour le juge, le nombre de leads à juger à son lancement. */
interface JobRecord extends Job {
  total: number;
}

let running: JobRecord | null = null;
let finished: JobRecord | null = null;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertIdle(): void {
  if (running)
    throw new JobRefusal(
      409,
      `un travail ${running.kind} est déjà en cours (${running.id})`,
    );
}

function remainingToJudge(classes: string[]): number {
  return classes.reduce((sum, cls) => sum + countRemainingJudge(cls), 0);
}

function judgeProgress(record: JobRecord): JobProgress {
  const remaining = remainingToJudge(record.classes);
  return { done: Math.max(0, record.total - remaining), total: record.total };
}

function snapshot(record: JobRecord): Job {
  const isLiveJudge = record.kind === "judge" && record.state === "running";
  return {
    id: record.id,
    kind: record.kind,
    state: record.state,
    started_at: record.started_at,
    ended_at: record.ended_at,
    classes: [...record.classes],
    progress: isLiveJudge ? judgeProgress(record) : record.progress,
    scan: record.scan,
    usage: record.usage,
    error: record.error,
  };
}

function register(kind: JobKind, classes: string[], total: number): JobRecord {
  const record: JobRecord = {
    id: `job_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    kind,
    state: "running",
    started_at: Date.now(),
    ended_at: null,
    classes,
    progress: null,
    scan: null,
    usage: null,
    error: null,
    total,
  };
  running = record;
  return record;
}

async function execute(
  record: JobRecord,
  work: () => Promise<void>,
): Promise<void> {
  try {
    await work();
    record.state = "done";
  } catch (error) {
    record.state = "error";
    record.error = messageOf(error);
    log(`[job:${record.id}] ⚠️  ${record.error}`);
  } finally {
    record.ended_at = Date.now();
    if (record.kind === "judge") record.progress = judgeProgress(record);
    running = null;
    finished = record;
  }
}

/** @throws JobRefusal si un travail tourne, ou si `config.analyze` n'est pas un fichier ou un dossier existant. */
export function startScan(): Job {
  assertIdle();
  try {
    checkAnalyze(config.analyze);
  } catch (error) {
    throw new JobRefusal(400, messageOf(error), { cause: error });
  }
  const record = register("scan", [], 0);
  void execute(record, async () => {
    record.scan = await ensureScan((done, total) => {
      record.progress = { done, total };
    });
  });
  return snapshot(record);
}

/**
 * @param createClient Fabrique du client du juge.
 * @throws JobRefusal si un travail tourne, ou si le client du juge est inutilisable.
 */
export function startJudge(createClient: () => JevClient): Job {
  assertIdle();
  let client: JevClient;
  try {
    client = createClient();
  } catch (error) {
    throw new JobRefusal(
      400,
      `client du juge indisponible : ${messageOf(error)}`,
      { cause: error },
    );
  }
  const classes = [...config.classes];
  const record = register("judge", classes, remainingToJudge(classes));
  void execute(record, async () => {
    record.usage = await judgeClasses(client);
  });
  return snapshot(record);
}

export function getJobs(): Jobs {
  return {
    current: running ? snapshot(running) : null,
    last: finished ? snapshot(finished) : null,
  };
}
