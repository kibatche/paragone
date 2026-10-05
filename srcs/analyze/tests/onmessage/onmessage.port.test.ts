/**
 * @author [A likely boring stuff made by] Shevek
 * @desc onmessage.port.test.ts : Couverture de l'analyzer onmessage porté sur Babel :
 *       affectations (identifiant nu, chaîne de membres, propriété calculée) et
 *       addEventListener("message", …), plus les cas négatifs et le comportement actuel
 *       sur les formes non couvertes. Autonome : n'utilise pas le harnais tests/base.ts.
 */

import { afterAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { analyzeFile } from "../../analyzer";
import { type AnalyzerMatch } from "../../constants/types";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "onmessage-analyzer-"));
let fileCounter = 0;

afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

/**
 * @brief Analyse une source JS littérale avec le seul analyzer onmessage.
 * @param source Code JavaScript à analyser.
 * @return Les matches retournés par analyzeFile.
 *
 * Écrit la source dans un fichier temporaire : analyzeFile prend un chemin, pas une
 * chaîne. Passe donc par le vrai chemin de parsing (extension .js → plugin jsx).
 */
async function analyze(source: string): Promise<AnalyzerMatch[]> {
  const filePath = path.join(tmpDir, `${fileCounter++}.js`);
  fs.writeFileSync(filePath, source);
  return analyzeFile(filePath, ["onmessage"]);
}

/**
 * @brief Extrait les valeurs textuelles des matches, triées pour comparaison stable.
 */
async function values(source: string): Promise<string[]> {
  const matches = await analyze(source);
  return matches.map((m) => m.value).sort();
}

describe("onmessage : affectations", () => {
  it("identifiant nu : onmessage = fn", async () => {
    expect(await values("onmessage = handler;")).toEqual([
      "onmessage = handler",
    ]);
  });

  it("membre simple : window.onmessage = fn", async () => {
    expect(await values("window.onmessage = handler;")).toEqual([
      "window.onmessage = handler",
    ]);
  });

  it("self / worker / iframe : n'importe quel objet receveur", async () => {
    const source = [
      "self.onmessage = a;",
      "worker.onmessage = b;",
      "iframe.contentWindow.onmessage = c;",
    ].join("\n");

    expect(await values(source)).toEqual([
      "iframe.contentWindow.onmessage = c",
      "self.onmessage = a",
      "worker.onmessage = b",
    ]);
  });

  it("chaîne profonde : a.b.c.onmessage = fn", async () => {
    expect(await values("a.b.c.onmessage = handler;")).toEqual([
      "a.b.c.onmessage = handler",
    ]);
  });

  it("propriété calculée par chaîne littérale : window['onmessage'] = fn", async () => {
    expect(await values("window['onmessage'] = handler;")).toEqual([
      "window['onmessage'] = handler",
    ]);
  });

  it("chaîne optionnelle en lecture puis affectation : (a?.b).onmessage = fn", async () => {
    expect(await values("(a?.b).onmessage = handler;")).toEqual([
      "(a?.b).onmessage = handler",
    ]);
  });

  it("opérateurs composés : ||= et ??= sont aussi des AssignmentExpression", async () => {
    expect(
      await values("window.onmessage ||= handler;\nself.onmessage ??= other;"),
    ).toEqual(["self.onmessage ??= other", "window.onmessage ||= handler"]);
  });

  it("fonction fléchée, expression de fonction, référence : la forme de la droite est indifférente", async () => {
    const source = [
      "window.onmessage = (e) => log(e.data);",
      "self.onmessage = function (e) { log(e); };",
      "worker.onmessage = existingHandler;",
    ].join("\n");

    expect(await values(source)).toEqual([
      "self.onmessage = function (e) { log(e); }",
      "window.onmessage = (e) => log(e.data)",
      "worker.onmessage = existingHandler",
    ]);
  });
});

describe("onmessage : affectations non retenues", () => {
  it("propriété calculée par variable : window[onmessage] = fn", async () => {
    expect(await values("window[onmessage] = handler;")).toEqual([]);
  });

  it("propriété calculée par variable homonyme : window[evtName] = fn", async () => {
    expect(await values("window[evtName] = handler;")).toEqual([]);
  });

  it("nom voisin : onmessageerror, onMessage, onmessageHandler", async () => {
    const source = [
      "window.onmessageerror = a;",
      "window.onMessage = b;",
      "window.onmessageHandler = c;",
    ].join("\n");

    expect(await values(source)).toEqual([]);
  });

  it("déclaration de variable : const onmessage = fn", async () => {
    expect(await values("const onmessage = handler;")).toEqual([]);
  });

  it("propriété d'objet littéral : { onmessage: fn }", async () => {
    expect(await values("const o = { onmessage: handler };")).toEqual([]);
  });

  it("lecture seule : const h = window.onmessage", async () => {
    expect(await values("const h = window.onmessage;")).toEqual([]);
  });
});

describe("onmessage : addEventListener", () => {
  it("cas de base : window.addEventListener('message', fn)", async () => {
    expect(
      await values("window.addEventListener('message', handler);"),
    ).toEqual(["window.addEventListener('message', handler)"]);
  });

  it("troisième argument : options ou capture", async () => {
    const source = [
      "window.addEventListener('message', handler, false);",
      "window.addEventListener('message', handler, { once: true });",
    ].join("\n");

    expect(await values(source)).toEqual([
      "window.addEventListener('message', handler, false)",
      "window.addEventListener('message', handler, { once: true })",
    ]);
  });

  it("appel optionnel : el?.addEventListener('message', fn)", async () => {
    expect(await values("el?.addEventListener('message', handler);")).toEqual([
      "el?.addEventListener('message', handler)",
    ]);
  });

  it("chaîne optionnelle profonde : a?.b?.addEventListener('message', fn)", async () => {
    expect(await values("a?.b?.addEventListener('message', handler);")).toEqual(
      ["a?.b?.addEventListener('message', handler)"],
    );
  });

  it("méthode calculée par chaîne littérale : window['addEventListener']('message', fn)", async () => {
    expect(
      await values("window['addEventListener']('message', handler);"),
    ).toEqual(["window['addEventListener']('message', handler)"]);
  });

  it("receveur quelconque : document, worker, chaîne de membres", async () => {
    const source = [
      "document.addEventListener('message', a);",
      "worker.port.addEventListener('message', b);",
      "getTarget().addEventListener('message', c);",
    ].join("\n");

    expect(await values(source)).toEqual([
      "document.addEventListener('message', a)",
      "getTarget().addEventListener('message', c)",
      "worker.port.addEventListener('message', b)",
    ]);
  });

  it("guillemets doubles : le type de guillemet est indifférent", async () => {
    expect(
      await values('window.addEventListener("message", handler);'),
    ).toEqual(['window.addEventListener("message", handler)']);
  });
});

describe("onmessage : addEventListener non retenus", () => {
  it("autre évènement : click, messageerror", async () => {
    const source = [
      "window.addEventListener('click', handler);",
      "window.addEventListener('messageerror', handler);",
    ].join("\n");

    expect(await values(source)).toEqual([]);
  });

  it("type d'évènement non littéral : addEventListener(evtName, fn)", async () => {
    expect(await values("window.addEventListener(evtName, handler);")).toEqual(
      [],
    );
  });

  it("littéral gabarit : addEventListener(`message`, fn)", async () => {
    expect(
      await values("window.addEventListener(`message`, handler);"),
    ).toEqual([]);
  });

  it("un seul argument : addEventListener('message')", async () => {
    expect(await values("window.addEventListener('message');")).toEqual([]);
  });

  it("méthode voisine : removeEventListener('message', fn)", async () => {
    expect(
      await values("window.removeEventListener('message', handler);"),
    ).toEqual([]);
  });

  it("méthode calculée par variable : window[method]('message', fn)", async () => {
    expect(await values("window[method]('message', handler);")).toEqual([]);
  });
});

describe("onmessage : comportement actuel sur les formes non couvertes", () => {
  it("addEventListener nu (callee Identifier) est détecté", async () => {
    // Le callee Identifier est désormais couvert au même titre que le MemberExpression :
    // `addEventListener("message", fn)` sans receveur explicite remonte un match.
    expect(await values("addEventListener('message', handler);")).toEqual([
      "addEventListener('message', handler)",
    ]);
  });

  it("les alias ne sont pas suivis (pas d'analyse de flot)", async () => {
    const source = [
      "const add = window.addEventListener;",
      "add('message', handler);",
    ].join("\n");

    expect(await values(source)).toEqual([]);
  });
});

describe("onmessage : forme des matches", () => {
  it("filePath, analyzerName, tags et positions", async () => {
    const source = "\nwindow.onmessage = handler;\n";
    const matches = await analyze(source);

    expect(matches).toHaveLength(1);
    const match = matches[0];
    if (!match) throw new Error("aucun match");

    expect(match.analyzerName).toBe("onmessage");
    expect(match.filePath.startsWith(tmpDir)).toBe(true);
    // Lignes en base 1, colonnes en base 0 ; l'affectation occupe la ligne 2 entière
    // hors point-virgule.
    expect(match.start).toEqual({ line: 2, column: 0, index: 1 });
    expect(match.end).toEqual({ line: 2, column: 26, index: 27 });
    expect(source.slice(match.start.index, match.end.index)).toBe(match.value);
  });

  it("un fichier mêlant plusieurs formes remonte un match par occurrence", async () => {
    const source = [
      "window.onmessage = a;",
      "window.addEventListener('message', b);",
      "window['onmessage'] = c;",
      "el?.addEventListener('message', d);",
      "window.addEventListener('click', e);",
    ].join("\n");

    expect(await values(source)).toEqual(
      [
        "el?.addEventListener('message', d)",
        "window['onmessage'] = c",
        "window.addEventListener('message', b)",
        "window.onmessage = a",
      ].sort(),
    );
  });
});
