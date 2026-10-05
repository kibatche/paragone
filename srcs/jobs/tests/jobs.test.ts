/**
 * @author [A likely boring stuff made by] Shevek
 * @desc jobs.test.ts : Les travaux de scan et de juge : lancés avec `config`, un seul à la fois, avancement
 *       lisible, échec rendu sans bloquer le suivant.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { assertIsolated, enterTempProject } from "../../db/tests/seed";
import {
  failingClient,
  gatedClient,
  permanentFailureClient,
} from "../../judge/tests/stub_client";

const root = enterTempProject();
const corpus = join(root, "corpus");
mkdirSync(corpus);
writeFileSync(
  join(corpus, "a.js"),
  [
    "document.body.innerHTML = location.hash;",
    "document.title.innerHTML = location.search;",
    "",
  ].join("\n"),
);

const jobs = await import("../jobs");
const { JobRefusal } = await import("../errors");
const { setConfig } = await import("../../config/config");
const { RUN_ID } = await import("../../cli/log/log");
const { getDatabase } = await import("../../db/db");
await assertIsolated();

afterAll(() => rmSync(root, { recursive: true, force: true }));

async function settled() {
  const deadline = Date.now() + 10_000;
  while (jobs.getJobs().current) {
    if (Date.now() > deadline)
      throw new Error("Error [settled]: le travail ne se termine pas");
    await Bun.sleep(10);
  }
  return jobs.getJobs().last!;
}

describe("sans dossier configuré", () => {
  it("refuse un scan en 400, sans rien lancer", () => {
    expect(() => jobs.startScan()).toThrow(JobRefusal);
    expect(jobs.getJobs()).toEqual({ current: null, last: null });
  });
});

describe("scan", () => {
  it("tourne en arrière-plan puis rend son bilan et son avancement", async () => {
    setConfig({ analyze: corpus, classes: ["xss"], batch: 1 });
    const started = jobs.startScan();
    expect(started).toMatchObject({
      kind: "scan",
      state: "running",
      classes: [],
    });
    expect(jobs.getJobs().current?.id).toBe(started.id);
    const last = await settled();
    expect(last).toMatchObject({ id: started.id, state: "done", error: null });
    expect(last.scan).toMatchObject({ files: 1, scanned: 1, addedLeads: 2 });
    expect(last.progress).toEqual({ done: 1, total: 1 });
    expect(last.ended_at).toBeGreaterThanOrEqual(last.started_at);
  });
});

describe("juge", () => {
  it("refuse un client inutilisable avant de lancer", () => {
    expect(() =>
      jobs.startJudge(() => {
        throw new Error("JEV_API_KEY absente");
      }),
    ).toThrow(/client du juge indisponible : JEV_API_KEY absente/);
    expect(jobs.getJobs().current).toBeNull();
  });

  it("un seul travail à la fois, avec l'avancement du juge lisible pendant qu'il tourne", async () => {
    const { client, release } = gatedClient();
    const started = jobs.startJudge(() => client);
    expect(started).toMatchObject({
      kind: "judge",
      state: "running",
      classes: ["XSS"],
    });
    expect(started.progress).toEqual({ done: 0, total: 2 });
    expect(() => jobs.startScan()).toThrowError(
      expect.objectContaining({ code: 409 }),
    );
    expect(() => jobs.startJudge(() => failingClient)).toThrowError(
      expect.objectContaining({ code: 409 }),
    );
    release();
    const last = await settled();
    expect(last).toMatchObject({ id: started.id, state: "done", error: null });
    expect(last.progress).toEqual({ done: 2, total: 2 });
    expect(last.usage?.XSS).toMatchObject({
      input: 200,
      output: 20,
      total: 220,
    });
  });

  it("range l'usage sous l'identifiant du lancement du processus", () => {
    const rows = getDatabase()
      .query<
        { run_id: string; n: number },
        []
      >("SELECT run_id, count(*) n FROM usage GROUP BY run_id")
      .all();
    expect(rows).toEqual([{ run_id: RUN_ID, n: 2 }]);
  });

  it("rend l'erreur permanente du juge dans le travail et libère le verrou", async () => {
    writeFileSync(
      join(corpus, "b.js"),
      "document.head.innerHTML = location.href;\n",
    );
    jobs.startScan();
    await settled();
    jobs.startJudge(() => permanentFailureClient);
    const last = await settled();
    expect(last.state).toBe("error");
    expect(last.error).toContain("erreur permanente");
    expect(jobs.getJobs().current).toBeNull();
    jobs.startScan();
    expect((await settled()).state).toBe("done");
  });
});
