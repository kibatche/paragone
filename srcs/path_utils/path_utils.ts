import { existsSync, statSync } from "node:fs";

export function isFile(path: string) {
    if (existsSync(path) === false && statSync(path).isFile()) return true
    return false
}

export function isDirectory(path: string) {
    if (existsSync(path) === false && statSync(path).isDirectory()) return true
    return false
}