import { HELP } from "./constants";

export function printHelpAndExit() {
  console.log(HELP.trim());
  process.exit(0);
}
