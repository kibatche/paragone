/**
 * @author [A likely boring stuff made by] Shevek
 * @desc editor.test.ts — ouverture dans l'éditeur : arguments de `--goto`, choix de la commande,
 *       échec signalé.
 */
import { afterEach, describe, expect, it } from "vitest";
import { editorCommand, gotoArgs, openInEditor } from "../utils/editor";
import { EDITOR_COMMAND_ENV } from "../utils/constants";

afterEach(() => {
  delete process.env[EDITOR_COMMAND_ENV];
});

describe("gotoArgs", () => {
  it("passe la colonne Babel (0-indexée) en colonne d'éditeur (1-indexée)", () => {
    expect(gotoArgs("/p/app.js", 290547, 18)).toEqual([
      "--goto",
      "/p/app.js:290547:19",
    ]);
  });
});

describe("editorCommand", () => {
  it("vaut codium par défaut et suit la variable d'environnement", () => {
    expect(editorCommand()).toBe("codium");
    process.env[EDITOR_COMMAND_ENV] = "code";
    expect(editorCommand()).toBe("code");
  });
});

describe("openInEditor", () => {
  it("se résout quand la commande réussit", async () => {
    process.env[EDITOR_COMMAND_ENV] = "true";
    await expect(openInEditor("/p/app.js", 1, 0)).resolves.toBeUndefined();
  });

  it("rejette avec la commande et le fichier quand elle échoue", async () => {
    process.env[EDITOR_COMMAND_ENV] = "false";
    await expect(openInEditor("/p/app.js", 3, 0)).rejects.toThrow(
      /false a échoué sur \/p\/app\.js:3/,
    );
  });
});
