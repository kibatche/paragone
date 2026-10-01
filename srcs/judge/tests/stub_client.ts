/**
 * @author [A likely boring stuff made by] Shevek
 * @desc stub_client.ts — Faux clients du juge pour les tests : un qui répond, un qui attend qu'on le libère, deux
 *       qui échouent. Aucun n'appelle Jev.
 */

import { AuthenticationError } from "@typesafe-ai/sdk";
import type { JevClient } from "../jev/client";

export const ANSWER = {
  model: "stub",
  usage: { input_tokens: 100, output_tokens: 10 },
  answers: {
    score: {
      choice: "HIGH",
      confidence: 0.9,
      probabilities: { HIGH: 0.9, MEDIUM: 0.05, IN_DEPTH: 0.03, REJECT: 0.02 },
    },
    reason: { choice: "NOT_A_SINK", confidence: 0.5, probabilities: {} },
  },
};

function asClient(systemOne: () => Promise<typeof ANSWER>): JevClient {
  return { systemOne } as unknown as JevClient;
}

export const answeringClient = asClient(async () => ANSWER);

/** Panne qui n'arrête pas le run : le lead reste sans jugement. */
export const failingClient = asClient(async () => {
  throw new Error("panne réseau simulée");
});

/** Erreur que le juge classe comme permanente : le run s'arrête. */
export const permanentFailureClient = asClient(async () => {
  throw Object.assign(Object.create(AuthenticationError.prototype), {
    message: "clé refusée",
  });
});

/** Un client qui ne répond qu'après `release()`, et le nombre de fois qu'il a été appelé. */
export function gatedClient(): {
  client: JevClient;
  release: () => void;
  calls: () => number;
} {
  let calls = 0;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const client = asClient(async () => {
    calls += 1;
    await gate;
    return ANSWER;
  });
  return { client, release, calls: () => calls };
}
