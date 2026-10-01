/**
 * @author [A likely boring stuff made by] Shevek
 * @desc jobs.test.ts — Les routes de configuration et de travaux : changer la configuration en mémoire, lancer
 *       le scan et le juge à partir d'elle, refus d'un second travail, et aucun appel réel au juge.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { assertIsolated, enterTempProject } from "../../db/tests/seed";
import { gatedClient } from "../../judge/tests/stub_client";

const root = enterTempProject();
const corpus = join(root, "corpus");
const publicDir = join(root, "public");
mkdirSync(corpus);
mkdirSync(publicDir);
writeFileSync(join(publicDir, "index.html"), "<h1>x</h1>");
writeFileSync(
  join(corpus, "a.js"),
  [
    "document.body.innerHTML = location.hash;",
    "document.title.innerHTML = location.search;",
    "",
  ].join("\n"),
);

const { createApp } = await import("../app");
const { RUN_ID } = await import("../../cli/log/log");
await assertIsolated();

afterAll(() => rmSync(root, { recursive: true, force: true }));

const { client, release, calls } = gatedClient();

const app = await createApp({
  port: 0,
  host: "127.0.0.1",
  cors: [],
  publicDir,
  createJudgeClient: () => client,
});
const appWithoutKey = await createApp({
  port: 0,
  host: "127.0.0.1",
  cors: [],
  publicDir,
  createJudgeClient: () => {
    throw new Error("JEV_API_KEY absente");
  },
});

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(
  target: typeof app,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: Json }> {
  const response = await target.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  return { status: response.status, body: (await response.json()) as Json };
}

async function jobsSettled(): Promise<Json> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const { body } = await call(app, "GET", "/api/jobs");
    if (!body.current) return body.last;
    if (Date.now() > deadline)
      throw new Error("Error [jobsSettled]: le travail ne se termine pas");
    await Bun.sleep(10);
  }
}

describe("configuration", () => {
  it("rend l'objet de configuration : sans dossier, tous les classes, lot de 1", async () => {
    const { status, body } = await call(app, "GET", "/api/config");
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(["analyze", "batch", "classes"]);
    expect(body).toMatchObject({ analyze: "", batch: 1 });
    expect(body.classes).toContain("all");
  });

  it("refuse un scan sans dossier configuré", async () => {
    const { status, body } = await call(app, "POST", "/api/scan");
    expect(status).toBe(400);
    expect(body.error).toContain("--analyze");
  });

  it("refuse une valeur invalide en 400 et un corps mal formé en 422", async () => {
    const missing = await call(app, "PUT", "/api/config", {
      analyze: join(root, "absent"),
      classes: ["xss"],
      batch: 1,
    });
    expect(missing.status).toBe(400);
    expect(missing.body.error).toContain("absent");
    const badClass = await call(app, "PUT", "/api/config", {
      analyze: corpus,
      classes: ["nope"],
      batch: 1,
    });
    expect(badClass.status).toBe(400);
    const malformed = await call(app, "PUT", "/api/config", {
      analyze: corpus,
    });
    expect(malformed.status).toBe(422);
    expect((await call(app, "GET", "/api/config")).body.analyze).toBe("");
  });

  it("remplace la configuration et la rend ensuite", async () => {
    const put = await call(app, "PUT", "/api/config", {
      analyze: corpus,
      classes: ["xss", "XSS"],
      batch: 1,
    });
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({
      analyze: corpus,
      classes: ["XSS"],
      batch: 1,
    });
    const get = await call(app, "GET", "/api/config");
    expect(get.body).toEqual(put.body);
  });
});

describe("scan", () => {
  it("rend 202 puis le travail se termine avec son bilan", async () => {
    const started = await call(app, "POST", "/api/scan");
    expect(started.status).toBe(202);
    expect(started.body).toMatchObject({ kind: "scan", state: "running" });
    const last = await jobsSettled();
    expect(last).toMatchObject({
      id: started.body.id,
      state: "done",
      error: null,
    });
    expect(last.scan).toMatchObject({ files: 1, addedLeads: 2 });
    expect(last.progress).toEqual({ done: 1, total: 1 });
    const summary = await call(app, "GET", "/api/summary");
    expect(summary.body.totals.total).toBe(2);
  });
});

describe("juge", () => {
  it("refuse de lancer quand le client du juge est inutilisable, sans l'appeler", async () => {
    const { status, body } = await call(appWithoutKey, "POST", "/api/judge");
    expect(status).toBe(400);
    expect(body.error).toContain("JEV_API_KEY absente");
    expect(calls()).toBe(0);
  });

  it("lance le juge, refuse tout le reste pendant qu'il tourne, puis rend l'usage", async () => {
    const started = await call(app, "POST", "/api/judge");
    expect(started.status).toBe(202);
    expect(started.body).toMatchObject({
      kind: "judge",
      state: "running",
      classes: ["XSS"],
    });
    const during = await call(app, "GET", "/api/jobs");
    expect(during.body.current.id).toBe(started.body.id);
    expect(during.body.current.progress).toEqual({ done: 0, total: 2 });
    expect((await call(app, "POST", "/api/scan")).status).toBe(409);
    expect((await call(app, "POST", "/api/judge")).status).toBe(409);
    release();
    const last = await jobsSettled();
    expect(last).toMatchObject({
      id: started.body.id,
      state: "done",
      error: null,
    });
    expect(last.usage.XSS).toMatchObject({
      input: 200,
      output: 20,
      total: 220,
    });
    const tokens = await call(app, "GET", "/api/tokens");
    expect(tokens.body.runs.map((run: Json) => run.run_id)).toEqual([RUN_ID]);
    expect(tokens.body.summary).toMatchObject({
      runs: 1,
      batches: 2,
      total: 220,
    });
  });

  it("change le lot pour le travail suivant", async () => {
    const put = await call(app, "PUT", "/api/config", {
      analyze: corpus,
      classes: ["xss"],
      batch: 2,
    });
    expect(put.status).toBe(200);
    expect(put.body.batch).toBe(2);
  });
});
