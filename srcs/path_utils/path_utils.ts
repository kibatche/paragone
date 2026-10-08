import { existsSync, statSync } from "node:fs";

export function isFile(path: string) {
  return existsSync(path) && statSync(path).isFile();
}

export function isDirectory(path: string) {
  return existsSync(path) && statSync(path).isDirectory();
}
