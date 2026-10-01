export interface ProjectConfig {
  project_name: string; // défaut = nom du dossier racine
  analyze: string; // dossier de JS à scanner
  classes: string[]; // classe(s) à juger
  scan: boolean; // lancer un scan
  judge: boolean; // lancer le juge
  reset: boolean; // refaire le scan et/ou l'analyse
  noninteractive: boolean; // mode non-interactif
  batch: number; // taille des lots
  serve: boolean; // lancer l'API
  port: number; // port d'écoute de l'API
  host: string; // adresse d'écoute de l'API
  cors: string[]; // origines autorisées à appeler l'API depuis un autre site
  public?: string; // dossier servi à la racine de l'API
}
