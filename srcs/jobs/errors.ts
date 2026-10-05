/**
 * @author [A likely boring stuff made by] Shevek
 * @desc errors.ts : Le refus de lancer un travail : un travail tourne déjà (409), ou la configuration ne
 *       permet pas de lancer (400).
 */

export class JobRefusal extends Error {
  constructor(
    readonly code: 400 | 409,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "JobRefusal";
  }
}
