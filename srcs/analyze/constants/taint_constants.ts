/**
 * @author [A likely boring stuff made by] kbtch_
 * @description constantes
 */
export interface Position {
  line: number;
  column: number;
  index: number;
}

export interface TaintChildNode {
  role: string;
  node?: number;
  extra?: Record<string, unknown>;
}

/**
 * Etat d'un noeud de taint. INTERNAL == le noeud a des enfants, on continue de descendre.
 * Tout le reste est un arret, et dit POURQUOI en une valeur triable : `endReason` reste le
 * texte explicatif, ce type est la donnee.
 */
export type TaintEndKind =
  | "CLASS_CONSTANT" // Le noeud est égal à un classe ou une déclaration de classe.
  | "INTERNAL" // pas un arret : la descente continue
  | "LITERAL" // valeur constante, non controlable, decidable
  | "IMPORT" // declare dans un autre fichier
  | "UNBOUND" // aucun binding dans la chaine de portees du fichier : ce que le test
  // prouve, et rien de plus : global navigateur, variable posee par le
  // wrapper du bundler, ou identifiant jamais declare
  | "NO_OPERAND" // le noeud n'a pas l'operande dont il faudrait descendre
  | "PARAM_ANON_FN" // parametre d'une fonction anonyme : pas de nom, pas de call-site
  | "PARAM_NO_CALLSITE" // nom derive mais aucun appel direct par ce nom
  | "PARAM_NO_VALID_CALLSITE" // nom derive mais aucun appel direct par ce nom même si des références, non prises en charge, existent
  | "PARAM_UNDEFINED_CALLSITE" // nom derive mais aucun appel direct par ce nom car le type de fonction ne pas pris en charge
  | "PARAM_NAME_SHADOWED" // le nom resolu ne designe pas cette fonction
  | "PARAM_ARG_MISSING" // l'appelant ne passe pas d'argument a cet index
  | "PARAM_SHAPE" // forme de parametre non prise en charge (pattern, rest, spread)
  | "PARAM_UNBOUND" // nom derive mais binding introuvable
  | "UNSUPPORTED" // type de noeud non couvert par le switch
  | "NULL_NODE" // NodePath sans noeud
  | "THIS_NODE" // noeud de type "ThisExpression", inintéressant à explorer via l'AST.
  | "EXTERNAL_ENTRY" // la valeur entre par un appelant hors fichier : la fonction porteuse
  // n'est referencee que par son export. Miroir d'IMPORT, sens inverse :
  // frontiere NOMMEE (nom exporte + index du parametre), pas un trou.
  | "DI_TOKEN" // le parametre est un service injecte, nomme positionnellement par une
  // annotation `$inject` posee dans le fichier. Valeur identifiee.
  | "TRUNCATED"; // coupe par une borne : arret declare, jamais silencieux

export interface TaintNode {
  nodeType: string;
  text: string | boolean | number;
  loc: { start: Position | undefined; end: Position | undefined };
  end: boolean;
  endKind: TaintEndKind;
  endReason: string;
  sanitizeMethod?: string;
  knownSource?: string;
  children: TaintChildNode[];
}

/**
 * Verdict d'une racine, calcule par pli sur l'arbre. C'est ce qui decide si le juge voit
 * l'identifiant : LITERAL_ONLY se jette sans agent.
 */
export type TaintVerdict =
  | "SOURCE_REACHED" // au moins une source, aucune branche coupee
  | "MIXED" // au moins une source, et au moins une branche coupee
  | "LITERAL_ONLY" // toutes les feuilles sont constantes : rien a juger
  | "INCOMPLETE" // aucune source, au moins une branche coupee
  | "NAMED_BOUNDARY" // aucune source et aucune coupe, mais au moins une FRONTIERE NOMMEE : la
  // valeur vient d'un endroit qu'on sait designer (appelant hors fichier,
  // service injecte). Decidable par le juge : ce n'est pas un echec de l'outil,
  // et ce n'est pas non plus prouve non controlable comme LITERAL_ONLY
  | "OPAQUE"; // aucune source, aucune branche coupee exploitable (global, import, cycle)

/** Les verdicts de taint, dans l'ordre de la file : ce que `TaintVerdict` énumère, à l'exécution. */
export const TAINT_VERDICTS = [
  "SOURCE_REACHED",
  "MIXED",
  "LITERAL_ONLY",
  "INCOMPLETE",
  "NAMED_BOUNDARY",
  "OPAQUE",
] as const satisfies readonly TaintVerdict[];

/**
 * Un cran du chemin racine → noeud retenu. `role` est celui de l'arête sortante, `nodeType` et
 * `label` décrivent le noeud d'où elle part.
 *
 * Volontairement sans `text` complet : recopier le texte de chaque ancêtre dans chaque descendant
 * rend le rapport quadratique : mesuré, 79 Mo de rapports pour 17,6 Mo d'arbres. `label` est le
 * texte du noeud SEULEMENT quand il tient en `LABEL_MAX` sur une ligne, ce qui le réserve de fait
 * aux identifiants : sans lui un chemin est une suite de `BindingNode (const)` anonymes, et le juge
 * ne peut relier aucun cran au code qu'il relit.
 */
export interface TaintPathStep {
  role: string;
  nodeType: string;
  label?: string;
}

/** Un trou (`EXPR`) de la chaîne reconstruite du sink. */
export interface TaintSinkHole {
  /** Nom d'affichage, `EXPR#0`, `EXPR#1`… dans l'ordre d'apparition dans la chaîne. */
  name: string;
  /** Le trou tombe après le premier `?` de la chaîne : il alimente la query, pas le chemin. */
  inQuery?: boolean;
}

/**
 * Ce dont part la teinte : l'appel, l'argument teinté, et sa chaîne reconstruite.
 *
 * Sans ça le rapport est indécidable : `bt.get(`/api/${v}/x`)` et `bt.get(`/api/x?id=${v}`)`
 * produisent le MÊME arbre de taint (mesuré au banc), alors que le premier est un CSPT et le second
 * ne l'est pas. Le discriminant est la position de l'interpolation, et il n'existe que côté sink.
 */
export interface TaintSinkContext {
  /**
   * Texte du porteur syntaxique, borné : l'appel pour un client HTTP, la propriété pour une clé
   * d'objet. Le porteur est passé par l'analyzer, qui seul sait de quelle forme il s'agit.
   */
  carrierText: string;
  loc: TaintNode["loc"];
  /** Chaîne reconstruite, trous numérotés (`/api/EXPR#0/x`), ou "" si non reconstructible. */
  pattern: string;
  holes: TaintSinkHole[];
  /**
   * Vrai quand le trou n°i correspond exactement à l'enfant n°i de la racine. Ne vaut que pour un
   * `TemplateLiteral` dont le nombre de trous égale le nombre d'expressions : ailleurs
   * (`+`, `.concat()`, imbrication) les trous ne sont pas dans une correspondance de rang avec les
   * enfants, et prétendre le contraire ferait mentir le rapport.
   */
  holesMapped: boolean;
}

/** Un noeud retenu, avec son chemin et ce qui le rend intéressant. */
export interface TaintFinding {
  kind: TaintEndKind;
  knownSource: string;
  sanitizeMethod: string;
  sourceString: string;
  nodeType: string;
  text: string;
  loc: TaintNode["loc"];
  endReason: string;
  path: TaintPathStep[];
  /** Identité stable, avant tri : sert à relier une source dérivée à celle dont elle descend. */
  id: number;
  /** `id` de la source ancêtre, quand ce noeud est lui-même sous une source. */
  derivedFrom?: number;
  /**
   * Trous du sink dont ce noeud descend, quand la correspondance est établie.
   *
   * Une LISTE, parce qu'un noeud peut être partagé par plusieurs trous : `f(a.client, a.returnTo)`
   * descend deux fois dans le même `a`, et tout ce qui est sous `a` alimente les deux. Rendre un
   * seul trou obligerait à choisir, et le choix serait celui de l'ordre de parcours : mesuré sur
   * `/sso/`, les deux sources tombaient sur `EXPR#0` alors que l'une n'alimente que `returnTo`.
   */
  holes?: TaintSinkHole[];
}

export interface TaintFindingNormalized {
  kind: TaintEndKind;
  knownSource: string;
  sanitizeMethod: string;
  nodeType: string;
  endReason: string;
  derivedFrom?: number;
  holes?: TaintSinkHole[];
}

/** Ce que le juge reçoit pour une racine. */
export interface TaintReport {
  verdict: TaintVerdict;
  sources: string[];
  findings: TaintFinding[];
  /** Noeuds écartés, par motif. Une coupe comptée n'est pas une coupe silencieuse. */
  omitted: Record<string, number>;
  /** Noeuds DISTINCTS visités. `nodeCount === kept + omittedTotal + traversed`, vérifié à l'affichage. */
  nodeCount: number;
  /** Retenus avant troncature. */
  kept: number;
  /** Noeuds ni retenus ni écartés : de la mécanique interne, traversée sans rien décider. */
  traversed: number;
  /**
   * Arêtes qui pointent vers un noeud déjà visité : arête arrière, ou simple partage entre deux
   * branches. Elles ne sont pas redescendues ; les compter évite qu'un partage se lise comme une
   * coupe silencieuse.
   */
  shared: number;
  sink?: TaintSinkContext;
}

/**
 * @brief Plafond de noeuds retenus par racine.
 *
 * Sans lui, un arbre de 10 215 noeuds sort des milliers de terminaux identiques et noie le juge.
 * Le tri place les sources d'abord, puis les branches coupées : ce qui déborde est le moins
 * informatif, et il est compté dans `omitted` sous `TRUNCATED` : arrêt déclaré, jamais silencieux.
 */
export const FINDINGS_MAX = 20;

/** Au-delà, le texte d'un noeud n'est plus un nom : il ne sert pas de repère dans un chemin. */
export const LABEL_MAX = 24;

/**
 * @brief Motifs d'arrêt qui n'apprennent rien au juge et ne sont donc pas listés un par un.
 *
 */
export const KINDS_NON_INFORMATIFS: TaintEndKind[] = ["LITERAL"];

/**
 * Motifs d'arrêt qui NOMMENT leur frontière au lieu de constater un trou.
 *
 */
export const FRONTIERES_NOMMEES: TaintEndKind[] = [
  "EXTERNAL_ENTRY",
  "DI_TOKEN",
];
