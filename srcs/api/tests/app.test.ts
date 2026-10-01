/**
 * @author [A likely boring stuff made by] Shevek
 * @desc app.test.ts — L'enveloppe de l'API : dossier public servi à `/` avec repli sur son index.html,
 *       ouverture aux autres origines seulement sur demande, et refus d'un dossier public introuvable.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { assertIsolated, enterTempProject } from "../../db/tests/seed";

const root = enterTempProject();
const publicDir = join(root, "public");
const otherDir = join(root, "autre");
mkdirSync(join(publicDir, "assets"), { recursive: true });
mkdirSync(otherDir);
writeFileSync(join(publicDir, "index.html"), "<h1>factice</h1>");
writeFileSync(join(publicDir, "assets", "app.js"), "console.log(1);");
writeFileSync(join(otherDir, "index.html"), "<h1>autre front</h1>");

const { createApp } = await import("../app");
const { DEFAULT_PUBLIC_DIR } = await import("../constants");
await assertIsolated();

const ORIGIN = "http://localhost:5173";

function appWith(cors: string[], dir: string | null = publicDir) {
  return createApp({
    port: 0,
    host: "127.0.0.1",
    cors,
    publicDir: dir ?? undefined,
  });
}

function get(
  app: Awaited<ReturnType<typeof appWith>>,
  path: string,
  headers = {},
) {
  return app.handle(new Request(`http://localhost${path}`, { headers }));
}

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("dossier public", () => {
  it("sert l'index.html à / et les fichiers du dossier", async () => {
    const app = await appWith([]);
    const index = await get(app, "/");
    expect(index.status).toBe(200);
    expect(await index.text()).toBe("<h1>factice</h1>");
    const asset = await get(app, "/assets/app.js");
    expect(asset.status).toBe(200);
    expect(await asset.text()).toBe("console.log(1);");
  });

  it("renvoie l'index.html pour la page d'un front, pas pour un fichier manquant", async () => {
    const app = await appWith([]);
    const page = await get(app, "/leads/12/detail");
    expect(page.status).toBe(200);
    expect(await page.text()).toBe("<h1>factice</h1>");
    expect((await get(app, "/assets/absent.js")).status).toBe(404);
  });

  it("garde /api et /openapi hors du repli", async () => {
    const app = await appWith([]);
    const unknown = await get(app, "/api/rien");
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "route inconnue" });
    expect((await get(app, "/openapi/absent")).status).toBe(404);
    expect((await get(app, "/openapi")).status).toBe(200);
  });

  it("sert le dossier désigné par --public à la place de la page factice", async () => {
    const app = await appWith([], otherDir);
    expect(await (await get(app, "/")).text()).toBe("<h1>autre front</h1>");
  });

  it("la page factice livrée existe et se sert quand aucun dossier n'est donné", async () => {
    const app = await appWith([], null);
    const index = await get(app, "/");
    expect(index.status).toBe(200);
    expect(await index.text()).toContain("/api/meta");
    expect(DEFAULT_PUBLIC_DIR.endsWith("api/public")).toBe(true);
  });

  it("refuse de démarrer sur un dossier public introuvable, en le nommant", async () => {
    const missing = join(root, "nulle-part");
    await expect(appWith([], missing)).rejects.toThrow(missing);
  });
});

describe("autres origines", () => {
  it("n'envoie aucun en-tête CORS sans --cors", async () => {
    const app = await appWith([]);
    const response = await get(app, "/api/meta", { origin: ORIGIN });
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("autorise l'origine listée et pas une autre", async () => {
    const app = await appWith([ORIGIN]);
    const allowed = await get(app, "/api/meta", { origin: ORIGIN });
    expect(allowed.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    const refused = await get(app, "/api/meta", {
      origin: "http://evil.example",
    });
    expect(refused.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("répond au préambule d'un POST JSON de l'origine listée", async () => {
    const app = await appWith([ORIGIN]);
    const response = await app.handle(
      new Request("http://localhost/api/lead/1/human", {
        method: "OPTIONS",
        headers: {
          origin: ORIGIN,
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type",
        },
      }),
    );
    expect(response.status).toBeLessThan(300);
    expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(
      response.headers.get("access-control-allow-methods") ?? "",
    ).toContain("POST");
  });
});
