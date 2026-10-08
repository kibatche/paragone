/**
 * @author [A likely boring stuff made by] Shevek
 * @desc queue.test.ts : file de triage sur une base jetable : masques par défaut, levée de
 *       chaque masque, ordre de priorité, compteurs, et dossier d'un lead.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertIsolated, enterTempProject, seedCorpus } from "./seed";

const root = await enterTempProject();
const corpus = join(root, "corpus");

const APP = [
  "function load(id) {",
  "  return fetch(`/api/users/${id}/profile`);",
  "}",
  "document.body.innerHTML = location.hash;",
  'document.body.innerHTML = "<b>fixe</b>";',
  'document.cookie = "a=1";',
  "",
].join("\n");

mkdirSync(join(corpus, "build1"), { recursive: true });
mkdirSync(join(corpus, "build2"), { recursive: true });
writeFileSync(join(corpus, "build1", "app.js"), APP);
writeFileSync(join(corpus, "build2", "app.js"), APP);

const judgeDb = await import("../judge");
const queue = await import("../queue");
const { Database } = await import("bun:sqlite");
const { buildLeadDossier } = await import("../../judge/dossier");
await assertIsolated();
const raw = new Database(join(root, ".paragone", "findings.db"));

type IdRow = { id: number };

function canonicalLeadOf(analyzerName: string, verdict: string): number {
  const row = raw
    .query(
      `SELECT id FROM leads WHERE duplicate_of IS NULL AND verdict = ?
       AND json_extract(lead, '$.analyzerName') = ? ORDER BY id LIMIT 1`,
    )
    .get(verdict, analyzerName) as IdRow | null;
  if (!row) throw new Error(`aucun lead ${analyzerName} ${verdict}`);
  return row.id;
}

function judge(leadId: number, cls: string, score: string): void {
  judgeDb.saveJudgement({
    leadId,
    cls,
    score,
    confidence: 0.9,
    probabilities: { [score]: 0.9 },
    model: "test",
  });
}

let xssSource: number;
let xssLiteral: number;
let cspt: number;

beforeAll(async () => {
  await seedCorpus(corpus);
  xssSource = canonicalLeadOf("inner-html", "SOURCE_REACHED");
  xssLiteral = canonicalLeadOf("inner-html", "LITERAL_ONLY");
  cspt = (
    raw
      .query(
        `SELECT id FROM leads WHERE duplicate_of IS NULL
         AND EXISTS (SELECT 1 FROM json_each(classes) c WHERE c.value = 'CSPT') LIMIT 1`,
      )
      .get() as IdRow
  ).id;
  judge(xssSource, "XSS", "HIGH");
  judge(cspt, "CSPT", "REJECT");
});

function ids(rows: { id: number }[]): number[] {
  return rows.map((r) => r.id);
}

describe("listLeads : masques par défaut", () => {
  it("ne garde que les leads d'impact canoniques, non littéraux, non rejetés, non triés", () => {
    const rows = queue.listLeads();
    expect(ids(rows)).toEqual([xssSource]);
    expect(rows[0]!.analyzer_name).toBe("inner-html");
    expect(rows[0]!.priority).toBe(0);
  });

  it("chaque case lève son masque", () => {
    expect(ids(queue.listLeads({ showRejected: true }))).toContain(cspt);
    expect(ids(queue.listLeads({ showLiteral: true }))).toContain(xssLiteral);
    expect(
      queue
        .listLeads({ showInventory: true })
        .some((r) => r.kind === "inventory"),
    ).toBe(true);
    expect(
      queue
        .listLeads({ showDuplicates: true })
        .some((r) => r.duplicate_of !== null),
    ).toBe(true);
  });

  it("un filtre explicite lève le masque qu'il contredit", () => {
    expect(ids(queue.listLeads({ score: "REJECT" }))).toEqual([cspt]);
    expect(ids(queue.listLeads({ verdict: "LITERAL_ONLY" }))).toContain(
      xssLiteral,
    );
  });

  it("classe HIGH avant non jugé avant REJECT", () => {
    const rows = queue.listLeads({ showRejected: true, showLiteral: true });
    const priorities = rows.map((r) => r.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
    expect(rows[0]!.id).toBe(xssSource);
    expect(rows.at(-1)!.id).toBe(cspt);
  });

  it("un lead trié par l'humain quitte la file, et revient par son verdict", () => {
    raw
      .query(
        "UPDATE leads SET human_score = 'LEAD', reviewed_at = 1 WHERE id = ?",
      )
      .run(xssSource);
    expect(ids(queue.listLeads())).not.toContain(xssSource);
    expect(ids(queue.listLeads({ humanScore: "LEAD" }))).toEqual([xssSource]);
    raw
      .query(
        "UPDATE leads SET human_score = NULL, reviewed_at = NULL WHERE id = ?",
      )
      .run(xssSource);
  });
});

describe("countQueue", () => {
  it("compte la file et ce que chaque masque cache en plus", () => {
    const { total, hidden } = queue.countQueue();
    expect(total).toBe(1);
    expect(hidden.showRejected).toBe(1);
    expect(hidden.showLiteral).toBeGreaterThanOrEqual(1);
    expect(hidden.showReviewed).toBe(0);
  });

  it("n'annonce pas un masque déjà levé", () => {
    expect(
      queue.countQueue({ showRejected: true }).hidden.showRejected,
    ).toBeUndefined();
  });
});

describe("buildLeadDossier", () => {
  it("rend le cadre de jugement de la classe, la consigne de l'analyzer et le texte envoyé à Jev", () => {
    const dossier = buildLeadDossier(
      queue.getLead(xssSource) as unknown as Parameters<
        typeof buildLeadDossier
      >[0],
      "fr",
    );
    expect(dossier.analyzerName).toBe("inner-html");
    expect(dossier.classes.map((c) => c.cls)).toEqual(["XSS"]);
    const [xss] = dossier.classes;
    expect(xss!.guidance).toBeTruthy();
    expect(Object.keys(xss!.scores)).toEqual([
      "HIGH",
      "MEDIUM",
      "IN_DEPTH",
      "REJECT",
    ]);
    expect(xss!.caseText).toContain("[Porteur]");
    expect(dossier.references.length).toBeGreaterThan(0);
    expect(dossier.verdictLegend).toBeTruthy();
  });

  it("un lead d'inventaire n'a aucun cadre de jugement", () => {
    const inventory = raw
      .query("SELECT id FROM leads WHERE kind = 'inventory' LIMIT 1")
      .get() as IdRow;
    const dossier = buildLeadDossier(
      queue.getLead(inventory.id) as unknown as Parameters<
        typeof buildLeadDossier
      >[0],
      "fr",
    );
    expect(dossier.classes).toEqual([]);
  });
});

describe("listLeads : espérance du grade", () => {
  afterAll(() => judge(cspt, "CSPT", "REJECT"));

  it("départage deux leads jugés par l'espérance, pas par le score retenu", () => {
    judgeDb.saveJudgement({
      leadId: cspt,
      cls: "CSPT",
      score: "MEDIUM",
      confidence: 0.5,
      probabilities: { HIGH: 0.9, MEDIUM: 0.1 },
      model: "test",
    });
    const rows = queue.listLeads();
    expect(ids(rows)).toEqual([cspt, xssSource]);
    expect(rows[0]!.expectation).toBeCloseTo(2.9);
    expect(rows[1]!.expectation).toBeCloseTo(2.7);
  });

  it("un jugement sans probabilités vaut le poids de son score", () => {
    raw
      .query(
        "UPDATE judgements SET probabilities = NULL WHERE lead_id = ? AND class = 'CSPT'",
      )
      .run(cspt);
    const rows = queue.listLeads();
    expect(ids(rows)).toEqual([xssSource, cspt]);
    expect(rows[1]!.expectation).toBe(2);
  });

  it("restreint l'espérance à la classe filtrée", () => {
    const rows = queue.listLeads({ cls: "XSS" });
    expect(ids(rows)).toEqual([xssSource]);
    expect(rows[0]!.expectation).toBeCloseTo(2.7);
  });
});
