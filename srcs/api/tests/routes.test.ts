/**
 * @author [A likely boring stuff made by] Shevek
 * @desc routes.test.ts — Chaque route de données de l'API, appelée comme un client HTTP (`app.handle`) sur
 *       une base jetable : contenu, erreurs, effets sur la base, et conformité au contrat publié.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  assertIsolated,
  enterTempProject,
  seedCorpus,
} from "../../db/tests/seed";

const root = enterTempProject();
const corpus = join(root, "corpus");
const publicDir = join(root, "public");
const APP = [
  "function load(id) {",
  "  return fetch(`/api/users/${id}/profile`);",
  "}",
  "document.body.innerHTML = location.hash;",
  'document.body.innerHTML = "<b>fixe</b>";',
  'document.cookie = "a=1";',
  "",
].join("\n");
for (const build of ["build1", "build2"]) {
  mkdirSync(join(corpus, build), { recursive: true });
  writeFileSync(join(corpus, build, "app.js"), APP);
}
mkdirSync(join(publicDir, "assets"), { recursive: true });
writeFileSync(join(publicDir, "index.html"), "<h1>factice</h1>");
writeFileSync(join(publicDir, "assets", "app.js"), "console.log(1);");

const { createApp } = await import("../app");
const queue = await import("../../db/queue");
const scan = await import("../../db/scan");
const judgeDb = await import("../../db/judge");
const usageDb = await import("../../db/usage");
const { getDatabase } = await import("../../db/db");
const constants = await import("../../db/constants");
const lead = await import("../../analyze/constants/lead");
const judgeConstants = await import("../../judge/constants");
const { getVocabulary } = await import("../../judge/vocabulary");
const { LeadsModel } = await import("../leads/model");
const { EDITOR_COMMAND_ENV } = await import("../utils/constants");
await assertIsolated();
await seedCorpus(corpus);

const app = await createApp({
  port: 0,
  host: "127.0.0.1",
  cors: [],
  publicDir,
});

function call(path: string, init?: RequestInit): Promise<Response> {
  return app.handle(new Request(`http://localhost${path}`, init));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getJson(path: string): Promise<{ status: number; body: any }> {
  const response = await call(path);
  return { status: response.status, body: await response.json() };
}

function sendJson(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  return call(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const raw = () => getDatabase();
const idOf = (sql: string): number =>
  raw().query<{ id: number }, []>(sql).get()!.id;

const xssSource = idOf(
  "SELECT id FROM leads WHERE duplicate_of IS NULL AND verdict = 'SOURCE_REACHED' ORDER BY id LIMIT 1",
);
const cspt = idOf(
  "SELECT id FROM leads WHERE duplicate_of IS NULL AND EXISTS (SELECT 1 FROM json_each(classes) c WHERE c.value = 'CSPT') ORDER BY id LIMIT 1",
);
const duplicate = idOf(
  `SELECT id FROM leads WHERE duplicate_of = ${xssSource} ORDER BY id LIMIT 1`,
);

beforeAll(() => {
  judgeDb.saveJudgement({
    leadId: xssSource,
    cls: "XSS",
    score: "HIGH",
    confidence: 0.9,
    probabilities: { HIGH: 0.9, MEDIUM: 0.1 },
    model: "test",
  });
  judgeDb.saveJudgement({
    leadId: cspt,
    cls: "CSPT",
    score: "MEDIUM",
    confidence: 0.5,
    probabilities: { HIGH: 0.2, MEDIUM: 0.8 },
    model: "test",
  });
  const usage = (batch: number, total: number) => ({
    input: total,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total,
    cost: total / 1000,
  });
  usageDb.saveBatchUsage({
    runId: "run_a",
    sinkType: "XSS",
    phase: "judge",
    batch: 1,
    usage: usage(1, 100),
  });
  usageDb.saveBatchUsage({
    runId: "run_b",
    sinkType: "CSPT",
    phase: "judge",
    batch: 1,
    usage: usage(1, 50),
  });
});

afterEach(() => {
  delete process.env[EDITOR_COMMAND_ENV];
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("meta et stats", () => {
  it("/api/meta donne le dossier, la base et la version du contrat", async () => {
    const { status, body } = await getJson("/api/meta");
    expect(status).toBe(200);
    expect(body.root).toBe(process.cwd());
    expect(body.dbPath).toBe(join(process.cwd(), ".paragone", "findings.db"));
    expect(body.apiVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("/api/summary rend les compteurs de la base", async () => {
    const { status, body } = await getJson("/api/summary");
    expect(status).toBe(200);
    expect(body).toEqual(JSON.parse(JSON.stringify(queue.summary())));
    expect(body.totals.agent_judged).toBe(2);
  });

  it("/api/tokens totalise l'usage de la base, sans rien écrire", async () => {
    const before = raw()
      .query<{ n: number }, []>("SELECT total_changes() n")
      .get()!.n;
    const { status, body } = await getJson("/api/tokens");
    const after = raw()
      .query<{ n: number }, []>("SELECT total_changes() n")
      .get()!.n;
    expect(status).toBe(200);
    expect(after).toBe(before);
    expect(body.summary).toMatchObject({ runs: 2, batches: 2, total: 150 });
    expect(body.runs.map((r: { run_id: string }) => r.run_id).sort()).toEqual([
      "run_a",
      "run_b",
    ]);
    expect(body.byClass).toHaveLength(2);
    expect(body.byPhase.judge.total).toBe(150);
  });
});

describe("file de triage", () => {
  it("/api/leads rend la file par défaut, la mieux espérée d'abord", async () => {
    const { status, body } = await getJson("/api/leads");
    expect(status).toBe(200);
    expect(body.map((r: { id: number }) => r.id)).toEqual(
      queue.listLeads().map((r) => r.id),
    );
    expect(body[0].id).toBe(xssSource);
    expect(body[0].expectation).toBeCloseTo(2.9);
  });

  it("applique les filtres et lève les masques", async () => {
    const all = await getJson(
      "/api/leads?showInventory=1&showDuplicates=1&showLiteral=1",
    );
    expect(all.body.length).toBeGreaterThan(1);
    const bycls = await getJson("/api/leads?class=CSPT&limit=1&offset=0");
    expect(bycls.body.map((r: { id: number }) => r.id)).toEqual([cspt]);
    const score = await getJson("/api/leads?score=HIGH");
    expect(score.body.map((r: { id: number }) => r.id)).toEqual([xssSource]);
  });

  it("refuse une valeur hors vocabulaire", async () => {
    expect((await call("/api/leads?class=NOPE")).status).toBe(422);
    expect((await call("/api/leads?showRejected=oui")).status).toBe(422);
  });

  it("/api/leads/count donne l'effectif et ce que chaque masque cache", async () => {
    const { status, body } = await getJson("/api/leads/count");
    expect(status).toBe(200);
    expect(body.total).toBe(queue.countQueue().total);
    expect(body.hidden.showDuplicates).toBeGreaterThanOrEqual(1);
  });

  it("le schéma de filtres porte exactement les masques de la file", () => {
    const keys = Object.keys(LeadsModel.queue.properties);
    for (const mask of constants.QUEUE_MASKS) expect(keys).toContain(mask);
  });
});

describe("un lead", () => {
  it("/api/lead/:id rend le lead décodé, ses jugements datés et ses doublons", async () => {
    const { status, body } = await getJson(`/api/lead/${xssSource}`);
    expect(status).toBe(200);
    expect(body.lead.analyzerName).toBe("inner-html");
    expect(body.lead.taint.verdict).toBe("SOURCE_REACHED");
    expect(body.duplicates).toBe(1);
    expect(body.judgements).toHaveLength(1);
    expect(body.judgements[0].probabilities).toEqual({
      HIGH: 0.9,
      MEDIUM: 0.1,
    });
    expect(body.judgements[0].judged_at).toBeGreaterThan(0);
  });

  it("répond 404 JSON pour un lead inconnu et 422 pour un id qui n'en est pas un", async () => {
    const missing = await getJson("/api/lead/999999");
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: "lead introuvable" });
    expect((await call("/api/lead/abc")).status).toBe(422);
  });

  it("/api/lead/:id/dossier suit la langue demandée et porte références et légendes", async () => {
    const fr = await getJson(`/api/lead/${xssSource}/dossier`);
    const en = await getJson(`/api/lead/${xssSource}/dossier?lang=en`);
    expect(fr.status).toBe(200);
    expect(fr.body.analyzerName).toBe("inner-html");
    expect(fr.body.references.length).toBeGreaterThanOrEqual(2);
    expect(fr.body.classes.map((c: { cls: string }) => c.cls)).toEqual(["XSS"]);
    expect(fr.body.classes[0].caseText).toContain("[Porteur]");
    expect(fr.body.verdictLegend).toBeTruthy();
    expect(en.body.classes[0].definition).not.toBe(
      fr.body.classes[0].definition,
    );
    expect((await call(`/api/lead/${xssSource}/dossier?lang=de`)).status).toBe(
      422,
    );
    expect((await call("/api/lead/999999/dossier")).status).toBe(404);
  });

  it("/api/lead/:id/duplicates liste les leads qui le dupliquent", async () => {
    const { status, body } = await getJson(`/api/lead/${xssSource}/duplicates`);
    expect(status).toBe(200);
    expect(body.map((r: { id: number }) => r.id)).toEqual([duplicate]);
    expect(body[0].duplicate_of).toBe(xssSource);
  });
});

describe("source et éditeur", () => {
  it("/api/source rend le fichier entier et la ligne du match", async () => {
    const { status, body } = await getJson(`/api/source?id=${xssSource}`);
    expect(status).toBe(200);
    expect(body.text).toBe(APP);
    expect(body.targetLine).toBe(4);
    expect(body.file.endsWith("build1/app.js")).toBe(true);
  });

  it("répond 404 pour un lead inconnu, et 404 avec le chemin quand le fichier a disparu", async () => {
    expect((await call("/api/source?id=999999")).status).toBe(404);
    const gone = idOf(
      "SELECT l.id FROM leads l JOIN matches m ON m.id = l.match_id JOIN files f ON f.id = m.file_id WHERE f.path LIKE '%build2%' AND l.kind = 'impact' ORDER BY l.id LIMIT 1",
    );
    rmSync(join(corpus, "build2", "app.js"));
    const { status, body } = await getJson(`/api/source?id=${gone}`);
    expect(status).toBe(404);
    expect(body.error).toContain("build2/app.js");
  });

  it("/api/lead/:id/open exige un corps JSON, puis lance l'éditeur", async () => {
    process.env[EDITOR_COMMAND_ENV] = "true";
    const refused = await call(`/api/lead/${xssSource}/open`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "x",
    });
    expect(refused.status).toBe(415);
    const ok = await sendJson("POST", `/api/lead/${xssSource}/open`);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true });
    expect((await sendJson("POST", "/api/lead/999999/open")).status).toBe(404);
  });

  it("rend 500 avec la raison quand l'éditeur échoue", async () => {
    process.env[EDITOR_COMMAND_ENV] = "false";
    const consoleError = console.error;
    console.error = () => {};
    const response = await sendJson("POST", `/api/lead/${xssSource}/open`);
    console.error = consoleError;
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("false a échoué");
  });
});

describe("revue humaine", () => {
  it("enregistre puis efface le verdict d'un lead", async () => {
    const saved = await sendJson("POST", `/api/lead/${cspt}/human`, {
      human_score: "LEAD",
      human_note: "à creuser",
    });
    expect(saved.status).toBe(200);
    const after = await getJson(`/api/lead/${cspt}`);
    expect(after.body).toMatchObject({
      human_score: "LEAD",
      human_note: "à creuser",
    });
    expect(after.body.reviewed_at).toBeGreaterThan(0);
    const cleared = await sendJson("DELETE", `/api/lead/${cspt}/human`);
    expect(cleared.status).toBe(200);
    expect((await getJson(`/api/lead/${cspt}`)).body.human_score).toBeNull();
  });

  it("refuse un score hors vocabulaire, et un lead inconnu", async () => {
    expect(
      (
        await sendJson("POST", `/api/lead/${cspt}/human`, {
          human_score: "NOPE",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await sendJson("POST", "/api/lead/999999/human", {
          human_score: "LEAD",
        })
      ).status,
    ).toBe(404);
    expect((await sendJson("DELETE", "/api/lead/999999/human")).status).toBe(
      404,
    );
  });

  it("accepte une note seule", async () => {
    const response = await sendJson("POST", `/api/lead/${cspt}/human`, {
      human_note: "vu",
    });
    expect(response.status).toBe(200);
    await sendJson("DELETE", `/api/lead/${cspt}/human`);
  });
});

describe("corpus", () => {
  it("/api/files liste les fichiers avec leurs effectifs", async () => {
    const { status, body } = await getJson("/api/files");
    expect(status).toBe(200);
    expect(body.map((f: { path: string }) => f.path.slice(-13))).toEqual([
      "build1/app.js",
      "build2/app.js",
    ]);
    expect(body[0]).toMatchObject({ status: "ok", error: null });
    expect(body[0].leads).toBeGreaterThan(0);
    expect((await getJson("/api/files/count")).body).toEqual({ total: 2 });
    expect((await getJson("/api/files?status=parse_error")).body).toEqual([]);
    expect((await getJson("/api/files/count?q=build2")).body).toEqual({
      total: 1,
    });
    expect((await call("/api/files?status=autre")).status).toBe(422);
  });

  it("/api/matches liste les matches, filtrés par fichier et analyzer", async () => {
    const files = (await getJson("/api/files")).body;
    const all = await getJson("/api/matches");
    expect(all.status).toBe(200);
    expect(all.body.length).toBe(scan.countMatches());
    const first = await getJson(
      `/api/matches?file_id=${files[0].id}&analyzer=inner-html`,
    );
    expect(first.body.length).toBeGreaterThan(0);
    expect(
      first.body.every(
        (m: { analyzer: string; file_id: number }) =>
          m.analyzer === "inner-html" && m.file_id === files[0].id,
      ),
    ).toBe(true);
    expect(
      (await getJson("/api/matches/count?analyzer=inner-html")).body.total,
    ).toBe(first.body.length * 2);
  });
});

describe("catalogue", () => {
  it("/api/vocabulary reprend les constantes et les légendes de chaque langue", async () => {
    const { status, body } = await getJson("/api/vocabulary");
    expect(status).toBe(200);
    expect(body.impactClasses).toEqual([...lead.IMPACT_CLASSES]);
    expect(body.queueMasks).toEqual([...constants.QUEUE_MASKS]);
    expect(body.humanScores).toEqual([...constants.HUMAN_SCORES]);
    expect(body.judgeScores).toEqual([...judgeConstants.JUDGE_SCORES]);
    expect(body.languages).toEqual([...judgeConstants.JUDGE_LANGUAGES]);
    const vocabulary = getVocabulary();
    for (const language of body.languages) {
      expect(Object.keys(body.legends[language].verdict).sort()).toEqual(
        [...body.taintVerdicts].sort(),
      );
      expect(Object.keys(body.rubrics[language])).toEqual([
        ...lead.IMPACT_CLASSES,
      ]);
    }
    expect(body.taintEndKinds).toEqual(vocabulary.taintEndKinds);
  });

  it("/api/analyzers donne les classes, références et consignes de chaque analyzer", async () => {
    const { status, body } = await getJson("/api/analyzers");
    expect(status).toBe(200);
    const innerHtml = body.find(
      (a: { name: string }) => a.name === "inner-html",
    );
    expect(innerHtml.classes).toEqual(["XSS"]);
    expect(innerHtml.references.length).toBeGreaterThanOrEqual(2);
    expect(innerHtml.guidance.fr.XSS).toBeTruthy();
    expect(innerHtml.guidance.en.XSS).toBeTruthy();
    const jquery = body.find((a: { name: string }) => a.name === "jquery");
    expect(jquery.classes).toEqual(["XSS", "CODE_EXEC"]);
  });
});

function success(responses: Record<string, unknown>): string {
  const code = Object.keys(responses).find((status) => status.startsWith("2"));
  if (!code) throw new Error("Error [success]: aucune réponse 2xx");
  return code;
}

describe("contrat OpenAPI", () => {
  it("décrit chaque route de données avec un schéma de sortie", async () => {
    const { status, body } = await getJson("/openapi/json");
    expect(status).toBe(200);
    const expected = [
      "get /api/meta",
      "get /api/summary",
      "get /api/tokens",
      "get /api/leads",
      "get /api/leads/count",
      "get /api/lead/{id}",
      "get /api/lead/{id}/dossier",
      "get /api/lead/{id}/duplicates",
      "get /api/source",
      "post /api/lead/{id}/open",
      "post /api/lead/{id}/human",
      "delete /api/lead/{id}/human",
      "get /api/files",
      "get /api/files/count",
      "get /api/matches",
      "get /api/matches/count",
      "get /api/vocabulary",
      "get /api/analyzers",
      "get /api/config",
      "put /api/config",
      "post /api/scan",
      "post /api/judge",
      "get /api/jobs",
    ];
    for (const route of expected) {
      const [method, path] = route.split(" ") as [string, string];
      const operation = body.paths[path]?.[method];
      expect(operation, route).toBeDefined();
      expect(
        operation.responses[success(operation.responses)].content[
          "application/json"
        ].schema,
        route,
      ).toBeDefined();
    }
    const documented = Object.entries(body.paths).flatMap(([path, item]) =>
      Object.keys(item as object).map((method) => `${method} ${path}`),
    );
    expect(documented.filter((r) => r.includes("/api/")).sort()).toEqual(
      [...expected].sort(),
    );
  });

  it("publie la page de documentation", async () => {
    const response = await call("/openapi");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  it("répond 404 JSON, pas la page d'accueil, à une route /api inconnue", async () => {
    const { status, body } = await getJson("/api/nexiste/pas");
    expect(status).toBe(404);
    expect(body).toEqual({ error: "route inconnue" });
  });
});
