import * as t from "@babel/types";
import { Binding, NodePath } from "@babel/traverse";
import {
  type Position,
  type TaintChildNode,
  type TaintEndKind,
  type TaintNode,
} from "../constants/taint_constants";
import { knownSourceProvenanceToString } from "../ast_analyzers/sources/check_sources";
import { frameworkRouterSourceLabel } from "./framework_router";
import {
  getExportBoundaries,
  getInjectPropertyTokens,
  getInlineInjectTokens,
} from "./param_boundaries";
import { getCallsOnKeyAnywhere, isUnprovenReceiverCall } from "./key_callsites";
import { getSanitizeCall } from "../ast_analyzers/detect_sanitization/sanitize";

const nodeTable: TaintNode[] = [];
const nodeIds = new Map<t.Node, number>();
const dummyNode: TaintNode = Object.freeze({
  nodeType: "dummy",
  text: "dummy",
  loc: { start: undefined, end: undefined },
  end: true,
  endKind: "NULL_NODE",
  endReason: "dummy reason",
  children: [],
});

function pushNode(n: TaintNode): number {
  const id = nodeTable.length;
  nodeTable.push(n);
  return id;
}

/** @brief La table du fichier courant. Les enfants d'un `TaintNode` la référencent par index. */
export function getTaintTable(): readonly TaintNode[] {
  return nodeTable;
}

/**
 * @brief Purge la table et les ids.
 *
 * @warning À appeler **par fichier**, depuis `analyzeFile` — jamais depuis `taintIdentifier`.
 */
export function resetTaintTable() {
  nodeTable.length = 0;
  nodeIds.clear();
}

export function taintIdentifier(path: NodePath<t.Node>) {
  const root = bindObject(path);
  return root;
}

function bindObject(path: NodePath<t.Node>): number {
  const node = path.node;
  if (!node) {
    return pushNode(
      setReturnObject(
        "Aucun type",
        `NodePath sans noeud (clé '${String(path.key)}' sous ${path.parentPath?.node.type ?? "?"})`,
        undefined,
        undefined,
        "NULL_NODE",
        `Le noeud est nul.`,
        [],
      ),
    );
  }

  const seen = nodeIds.get(node);
  if (seen !== undefined) return seen; // le noeud est en cours d'analyse ou déjà vu
  const id = nodeTable.length;
  nodeTable.push(dummyNode); // on réserve la place
  nodeIds.set(node, id);
  nodeTable[id] = taint(path);
  return id;
}

function taint(path: NodePath<t.Node>): TaintNode {
  const node = path.node;
  switch (node.type) {
    case "Identifier": {
      const binding = path.scope.getBinding(node.name);
      if (binding) {
        return nodeDispatch(binding, path);
      }
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "UNBOUND",
        `Le noeud '${node.name}' est terminal.`,
        [],
      );
    }
    case "ImportNamespaceSpecifier":
    case "ImportDefaultSpecifier":
    case "ImportSpecifier": {
      const importDeclaration = (
        path as NodePath<t.ImportSpecifier>
      ).parentPath.toString();
      return setReturnObject(
        node.type,
        `ImportDeclaration:\n${importDeclaration}`,
        node.loc?.start,
        node.loc?.end,
        "IMPORT",
        `Le noeud a le type '${node.type}', donc déclaré dans un autre fichier.`,
        [],
      );
    }

    case "NullLiteral":
    case "StringLiteral":
    case "NumericLiteral":
    case "BooleanLiteral":
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "LITERAL",
        `Le noeud a le type '${node.type}'. Valeur constante.`,
        [],
      );
    case "RegExpLiteral":
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "LITERAL",
        `Le noeud est de type ${node.type}. Valeur constante.`,
        [],
      );
    case "UnaryExpression": {
      const arg = (path as NodePath<t.UnaryExpression>).get("argument");
      const operator = node.operator;
      const loc = node.loc;
      switch (operator) {
        case "void":
          return setReturnObject(
            node.type,
            path.toString(),
            loc?.start,
            loc?.end,
            "LITERAL",
            `Le noeud a le type '${node.type}' et a l'opérateur '${operator}'. Valeur constante.`,
            [],
          );
        case "!": {
          if (
            t.isNumericLiteral(arg.node) ||
            t.isStringLiteral(arg.node) ||
            t.isBooleanLiteral(arg.node) ||
            t.isNullLiteral(arg.node)
          ) {
            return setReturnObject(
              node.type,
              path.toString(),
              loc?.start,
              loc?.end,
              "LITERAL",
              `Le noeud a le type '${node.type}'. L'expression unaire est évaluée à '${!t.isNullLiteral(arg.node) ? !arg.node.value : "true"}'. Valeur constante.`,
              [],
            );
          } else {
            return setReturnObject(
              node.type,
              path.toString(),
              node.loc?.start,
              loc?.end,
              "INTERNAL",
              "",
              [{ role: "argument", node: bindObject(arg) }],
            );
          }
        }
        case "typeof":
        case "delete": {
          return setReturnObject(
            node.type,
            path.toString(),
            loc?.start,
            loc?.end,
            "LITERAL",
            `Le noeud a le type '${node.type}'. L'expression unaire utilise l'opérateur '${operator}' et ne sera donc pas évaluée. Noeud terminal.`,
            [],
          );
        }
        case "throw":
        case "+":
        case "-":
        case "~": {
          return setReturnObject(
            node.type,
            path.toString(),
            loc?.start,
            loc?.end,
            "INTERNAL",
            "",
            [{ role: "argument", node: bindObject(arg) }],
          );
        }
        default: {
          const nevr: never = operator;
          return setReturnObject(
            "UnaryExpression",
            path.toString(),
            loc?.start,
            loc?.end,
            "UNSUPPORTED",
            `Opérateur unaire non pris en charge : '${String(nevr)}'.`,
            [],
          );
        }
      }
    }

    case "OptionalMemberExpression":
    case "MemberExpression": {
      const obj = (
        path as NodePath<t.MemberExpression | t.OptionalMemberExpression>
      ).get("object");
      const prop = (
        path as NodePath<t.MemberExpression | t.OptionalMemberExpression>
      ).get("property");
      const children = [];

      if (obj.node) children.push({ role: "object", node: bindObject(obj) });
      if (prop.node && node.computed)
        children.push({ role: "property", node: bindObject(prop) });

      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        children.length ? "INTERNAL" : "NO_OPERAND",
        children.length ? "" : "'object' et 'property' sont nuls.",
        children,
        knownSourceProvenanceToString(
          (path as NodePath<t.MemberExpression | t.OptionalMemberExpression>)
            .node,
        ),
      );
    }
    case "ArrayExpression": {
      const elements = (path as NodePath<t.ArrayExpression>).get("elements");
      // Compte les tableaux vides comme des littéraux.
      if (!elements.length)
        return setReturnObject(
          node.type,
          path.toString(),
          node.loc?.start,
          node.loc?.end,
          "LITERAL",
          `Le noeud de type ${node.type} est vide. Valeur constante.`,
          [],
        );
      const children = [];
      children.push(
        ...elements.map((a, i) => {
          if (a.node) return { role: `elements[${i}]`, node: bindObject(a) };
          return {
            role: `elements[${i}]`,
            node: pushNode(
              setReturnObject(
                node.type,
                path.toString(),
                node.loc?.start,
                node.loc?.end,
                "LITERAL",
                `Le path de type ${a.type} a un noeud 'undefined' (objet du 'ArrayExpression' non spécifié). Impossible d'aller plus loin.`,
                [],
              ),
            ),
          };
        }),
      );
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "INTERNAL",
        "",
        children,
      );
    }
    case "AwaitExpression": {
      const arg = (path as NodePath<t.AwaitExpression>).get("argument");
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "INTERNAL",
        "",
        [{ role: "argument", node: bindObject(arg) }],
      );
    }
    case "OptionalCallExpression":
    case "CallExpression": {
      const callee = (
        path as NodePath<t.CallExpression | t.OptionalCallExpression>
      ).get("callee");
      const args = (
        path as NodePath<t.CallExpression | t.OptionalCallExpression>
      ).get("arguments");

      const children = [];
      if (callee.node)
        children.push({ role: "callee", node: bindObject(callee) });
      if (args.length)
        children.push(
          ...args.map((a, i) => ({
            role: `argument[${i}]`,
            node: bindObject(a),
          })),
        );

      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        !callee.node ? "NO_OPERAND" : "INTERNAL",
        !callee.node ? "'callee' est nul." : "",
        children,
        knownSourceProvenanceToString(
          node,
          args.map((a) => {
            return a.node;
          }),
        ),
        getSanitizeCall(node)
      );
    }

    case "NewExpression": {
      const calleePath = (path as NodePath<t.NewExpression>).get("callee");
      const argsPath = (path as NodePath<t.NewExpression>).get("arguments");

      const children = [
        {
          role: "callee",
          node: bindObject(calleePath),
        },
        ...argsPath.map((a, i) => {
          return {
            role: `arguments[${i}]`,
            node: bindObject(a),
          };
        }),
      ];
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        argsPath.length ? "INTERNAL" : "NO_OPERAND",
        argsPath.length
          ? ""
          : "Il n'y a pas d'argument(s) attaché(s) au 'callee'. Impossible d'aller plus loin.",
        argsPath.length ? children : [],
        knownSourceProvenanceToString(
          node,
          argsPath.map((a) => {
            return a.node;
          }),
        ),
      );
    }

    case "TemplateLiteral": {
      const e = (path as NodePath<t.TemplateLiteral>).get("expressions");
      const children = [
        ...e.map((expr, i) => {
          return {
            role: `expressions[${i}]`,
            node: bindObject(expr),
          };
        }),
      ];
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "INTERNAL",
        "",
        children,
      );
    }
    case "VariableDeclarator": {
      const init = path.get("init");
      const children = init.isExpression()
        ? [
            {
              role: "init",
              node: bindObject(init),
            },
          ]
        : [];
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        init.isExpression() ? "INTERNAL" : "NO_OPERAND",
        init.isExpression()
          ? ""
          : "L'objet `init` du VariableDeclarator n'est pas une expression.",
        children,
      );
    }
    case "ThisExpression":
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "THIS_NODE",
        `Le noeud est de type ${node.type}, déterminé par la classe/fonction englobante et ne sera donc pas exploré.`,
        [],
      );
    case "ConditionalExpression": {
      const consequent = (path as NodePath<t.ConditionalExpression>).get(
        "consequent",
      );
      const alternate = (path as NodePath<t.ConditionalExpression>).get(
        "alternate",
      );

      const children = [
        {
          role: "consequent",
          node: bindObject(consequent),
        },
        {
          role: "alternate",
          node: bindObject(alternate),
        },
      ];
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "INTERNAL",
        "",
        children,
      );
    }
    case "AssignmentExpression": {
      const right = (path as NodePath<t.AssignmentExpression>).get("right");
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "INTERNAL",
        "",
        [{ role: "right", node: bindObject(right) }],
      );
    }

    case "UpdateExpression": {
      const arg = (path as NodePath<t.UpdateExpression>).get("argument");
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "INTERNAL",
        "",
        [{ role: `argument`, node: bindObject(arg) }],
      );
    }

    case "SpreadElement": {
      const arg = (path as NodePath<t.UpdateExpression>).get("argument");
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "INTERNAL",
        "",
        [{ role: `argument`, node: bindObject(arg) }],
      );
    }

    case "ClassExpression":
    case "ClassDeclaration":
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "CLASS_CONSTANT",
        `Le noeud a le type '${node.type}'. Dans le contexte d'une identification, c'est une valeur constante..`,
        [],
      );
    // (a, b, c) → valeur = c
    case "SequenceExpression": {
      const expressions = (path as NodePath<t.SequenceExpression>).get(
        "expressions",
      );
      const last = expressions[expressions.length - 1];
      // Une SequenceExpression vide n'existe pas dans la grammaire, mais un noeud sans enfant qui
      // se declare INTERNAL fait disparaitre la branche sans trace : on la termine explicitement.
      if (!last)
        return setReturnObject(
          node.type,
          path.toString(),
          node.loc?.start,
          node.loc?.end,
          "NO_OPERAND",
          "Sequence sans expression.",
          [],
        );
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "INTERNAL",
        "",
        [
          {
            role: `expressions[${expressions.length - 1}]`,
            node: bindObject(last),
          },
        ],
      );
    }

    // a || b, a ?? b
    case "LogicalExpression": {
      const left = (path as NodePath<t.LogicalExpression>).get("left");
      const right = (path as NodePath<t.LogicalExpression>).get("right");
      const children = [
        {
          role: "left",
          node: bindObject(left),
        },
        {
          role: "right",
          node: bindObject(right),
        },
      ];
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "INTERNAL",
        "",
        children,
      );
    }
    // '/x/' + id
    case "BinaryExpression": {
      const left = (path as NodePath<t.BinaryExpression>).get("left");
      const right = (path as NodePath<t.BinaryExpression>).get("right");
      const children = [
        {
          role: "left",
          node: bindObject(left),
        },
        {
          role: "right",
          node: bindObject(right),
        },
      ];
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "INTERNAL",
        "",
        children,
      );
    }
    case "ObjectExpression": {
      const properties = (path as NodePath<t.ObjectExpression>).get(
        "properties",
      );
      // Objet vide : même argument que le tableau vide ci-dessus — une valeur constante, pas un trou.
      if (!properties.length)
        return setReturnObject(
          node.type,
          path.toString(),
          node.loc?.start,
          node.loc?.end,
          "LITERAL",
          "L'objet est vide. Valeur constante.",
          [],
        );
      const children = [
        ...properties.map((p, i) => {
          return objectPropertiesLogic(p, i);
        }),
      ];
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "INTERNAL",
        "",
        children,
      );
    }
    case "ArrowFunctionExpression":
    case "FunctionExpression":
    case "FunctionDeclaration":
    case "ObjectMethod":
    case "ClassPrivateMethod":
    case "ClassMethod":
      return functionExpressionLogic(node, path as NodePath<t.Function>);
    default:
      return setReturnObject(
        node.type,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "UNSUPPORTED",
        `'${node.type}': type de noeud non pris en charge.`,
        [],
      );
  }
}

function setReturnObject(
  nodeType: string,
  text: string,
  startLoc: Position | undefined,
  endLoc: Position | undefined,
  endKind: TaintEndKind,
  endReason: string,
  children: TaintChildNode[],
  knownSource?: string,
  sanitizeMethod?: string,
): TaintNode {
  return {
    nodeType: nodeType,
    text: capText(text),
    loc: { start: startLoc, end: endLoc },
    end: endKind !== "INTERNAL",
    endKind: endKind,
    endReason: endReason,
    knownSource: knownSource ?? "",
    sanitizeMethod: sanitizeMethod ?? "",
    children: children,
  };
}

const TEXT_MAX = 200;
function capText(text: string): string {
  if (text.length <= TEXT_MAX) return text;
  return `${text.slice(0, TEXT_MAX)}… [texte coupé, ${text.length} caractères au total]`;
}

function functionExpressionLogic(node: t.Node, path: NodePath<t.Function>) {
  const body = path.get("body");
  if (!body.node) {
    return setReturnObject(
      node.type,
      path.toString(),
      node.loc?.start,
      node.loc?.end,
      "NO_OPERAND",
      `Le 'body' du ${node.type} ${path.toString()} est nul.`,
      [],
    );
  }
  if (!t.isBlockStatement(body.node)) {
    return setReturnObject(
      node.type,
      path.toString(),
      node.loc?.start,
      node.loc?.end,
      "INTERNAL",
      "",
      [{ role: "body", node: bindObject(body) }],
    );
  }
  const args: NodePath<t.Node>[] = [];
  (body as NodePath<t.BlockStatement>).traverse({
    Function(f: NodePath<t.Function>) {
      f.skip();
    }, //pour ne pas avoir des ReturnStatement de fonctions internes à la fonction.
    ReturnStatement(p: NodePath<t.ReturnStatement>) {
      const a = p.get("argument");
      if (a.node) args.push(a);
    },
  });
  if (!args.length)
    return setReturnObject(
      node.type,
      path.toString(),
      node.loc?.start,
      node.loc?.end,
      "NO_OPERAND",
      `Aucun ReturnStatement n'a été trouvé dans le body de ${node.type}`,
      [],
    );
  const children = [
    ...args.map((a, i) => {
      return {
        role: `argument n°${i}`,
        node: bindObject(a),
      };
    }),
  ];
  return setReturnObject(
    node.type,
    path.toString(),
    node.loc?.start,
    node.loc?.end,
    "INTERNAL",
    "",
    children,
  );
}

function objectPropertiesLogic(
  path: NodePath<t.Node>,
  propIdx: number,
): TaintChildNode {
  switch (path.type) {
    case "ObjectProperty":
      return {
        role: `value de ObjectProperty pour sa properties[${propIdx}]`,
        node: bindObject((path as NodePath<t.ObjectProperty>).get("value")),
      };
    case "ObjectMethod":
      return {
        role: `body de ObjectMethod pour sa properties[${propIdx}]`,
        node: bindObject(path as NodePath<t.ObjectMethod>),
      };
    case "SpreadElement":
      return {
        role: `argument de SpreadElement pour sa properties[${propIdx}]`,
        node: bindObject((path as NodePath<t.SpreadElement>).get("argument")),
      };
    default:
      return {
        role: `Aucun. '${path.node.type}' non pris en charge.`,
        node: undefined,
      };
  }
}

// type Function = FunctionDeclaration | FunctionExpression | ObjectMethod | ArrowFunctionExpression | ClassMethod | ClassPrivateMethod;
function nodeDispatch(binding: Binding, path: NodePath<t.Node>): TaintNode {
  const node = path.node;
  switch (binding.kind) {
    case "param":
      return paramKindDispatch(binding, path);
    case "module":
      return setReturnObject(
        `BindingNode (${binding.kind})`,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "INTERNAL",
        "",
        [{ role: "bindNode", node: bindObject(binding.path) }],
      );
    default: {
      const children = [
        { role: "bindNode", node: bindObject(binding.path) },
        ...binding.constantViolations.map((p, i) => ({
          role: `constantViolation[${i}]`,
          node: bindObject(p),
        })),
      ];
      return setReturnObject(
        `BindingNode (${binding.kind})`,
        path.toString(),
        node.loc?.start,
        node.loc?.end,
        "INTERNAL",
        "",
        children,
      );
    }
  }
}

/**
 * @brief Terminal d'un paramètre nommé par une annotation d'injection de dépendance.
 * @param functionParent La fonction qui porte le paramètre.
 * @param tokens Les noms de services, alignés sur les paramètres.
 * @param paramIdx Index du paramètre teinté.
 * @param paramText Le paramètre tel qu'il est écrit, pour le message.
 * @return Le noeud terminal, ou undefined si l'annotation ne couvre pas cet index.
 *
 */
function injectTokenTerminal(
  functionParent: NodePath<t.Function>,
  tokens: string[],
  paramIdx: number,
  paramText: string,
): TaintNode | undefined {
  if (paramIdx < 0 || paramIdx >= tokens.length) return undefined;

  const token = tokens[paramIdx];
  if (token === undefined) return undefined;
  const sourceLabel = frameworkRouterSourceLabel(token);
  return setReturnObject(
    `BindingNode (${functionParent.node.type})`,
    `Injected: '${token}'`,
    functionParent.node.loc?.start,
    functionParent.node.loc?.end,
    "DI_TOKEN",
    `Le paramètre '${paramText}' (index ${paramIdx}) est le service injecté '${token}', nommé positionnellement par l'annotation d'injection posée dans ce fichier. Valeur identifiée.`,
    [],
    sourceLabel || undefined,
  );
}

/**
 * @brief Rôle de l'arête qui mène à l'argument d'un call-site.
 * @param paramIdx Index du paramètre teinté.
 * @param referenceIdx Rang du call-site dans la liste des références retenues.
 * @param call Le call-site.
 * @return Le rôle, augmenté d'une mention quand le récepteur n'a pas été prouvé.
 */
function argumentEdgeRole(
  paramIdx: number,
  referenceIdx: number,
  call: NodePath<t.Node>,
): string {
  const base = `arguments[${paramIdx}] for referencePaths[${referenceIdx}]`;
  if (!isUnprovenReceiverCall(call.node)) return base;
  return `${base} — récepteur NON PROUVÉ, appel retrouvé par la seule clé`;
}

function paramKindDispatch(
  binding: Binding,
  path: NodePath<t.Node>,
): TaintNode {
  const node = path.node;
  //on chope la fonction parente
  const functionParent = binding.path.getFunctionParent();
  if (!functionParent) {
    return setReturnObject(
      `BindingNode (${binding.kind})`,
      path.toString(),
      node.loc?.start,
      node.loc?.end,
      "PARAM_UNBOUND",
      "Impossible d'avoir la fonction parent de l'identifiant.",
      [],
    );
  }
  if (
    t.isFunctionDeclaration(functionParent.node) ||
    t.isFunctionExpression(functionParent.node) ||
    t.isArrowFunctionExpression(functionParent.node) ||
    t.isObjectMethod(functionParent.node) ||
    t.isClassPrivateMethod(functionParent.node) ||
    t.isClassMethod(functionParent.node)
  ) {
    const inlineTokens = getInlineInjectTokens(functionParent);
    if (inlineTokens && t.isIdentifier(binding.path.node)) {
      const terminal = injectTokenTerminal(
        functionParent,
        inlineTokens,
        functionParent.node.params.indexOf(binding.path.node),
        path.toString(),
      );
      if (terminal) return terminal;
    }

    let functionName;
    const propertyCarrier = getPropertyCarrier(functionParent);
    // on teste si le parent de la fonction parent est du type variabledeclarator ou AssignmentExpression .
    // Si oui, c'est le name de l'id du parent, ou le name du noeud à droite
    //  dont on doit chercher les références
    // si non, le name de l'id de la fonction, c'est à dire, son nom.
    // ex: const f = a(x){...} => On part de x, a est la fonction parent, f, ce qu'on cherche car VariableDeclarator.
    // ex: f = (x) => {...} => On part de x, la fonciton parent est une ArrowFunctionExpression, f, ce qu'on cherche car AssignmentExpression.
    // ex: a(x) {...} => On part de x, a est la fonction parent, on garde a.
    if (propertyCarrier) {
      // parentPath === ObjectExpression, parent du parentPath == VariableDeclator.
      if (
        t.isVariableDeclarator(propertyCarrier.parentPath.parent) &&
        t.isIdentifier(propertyCarrier.parentPath.parent.id)
      )
        functionName = propertyCarrier.parentPath.parent.id.name;
      else if (
        t.isAssignmentExpression(propertyCarrier.parentPath.parent) &&
        t.isIdentifier(propertyCarrier.parentPath.parent.left)
      )
        functionName = propertyCarrier.parentPath.parent.left.name;
      else
        return setReturnObject(
          functionParent.node.type,
          `Function Name: aucun nom.`,
          functionParent.node.loc?.start,
          functionParent.node.loc?.end,
          "PARAM_ANON_FN",
          "La fonction est portée par une propriété d'objet dont l'ObjectExpression n'a pas de nom assigné ou déclaré.",
          [],
        );
    } else if (
      t.isClassMethod(functionParent.node) ||
      t.isClassPrivateMethod(functionParent.node)
    ) {
      if (
        t.isVariableDeclarator(functionParent.parentPath.parentPath.node) &&
        t.isIdentifier(functionParent.parentPath.parentPath.node.id)
      ) {
        functionName = functionParent.parentPath.parentPath.node.id.name;
      } else if (
        t.isAssignmentExpression(functionParent.parentPath.parentPath.parent) &&
        t.isIdentifier(functionParent.parentPath.parentPath.parent.left)
      ) {
        functionName = functionParent.parentPath.parentPath.parent.left.name;
      } else if (
        t.isClassDeclaration(functionParent.parentPath.parentPath.node) &&
        t.isIdentifier(functionParent.parentPath.parentPath.node.id)
      ) {
        functionName = functionParent.parentPath.parentPath.node.id.name;
      }
      //const Api = class { send(p) { SINK(p) } };
      else if (t.isClassExpression(functionParent.parentPath.parentPath.node)) {
        if (
          t.isVariableDeclarator(functionParent.parentPath.parentPath.parent) &&
          t.isIdentifier(functionParent.parentPath.parentPath.parent.id)
        ) {
          functionName = functionParent.parentPath.parentPath.parent.id.name;
        } else if (
          t.isAssignmentExpression(
            functionParent.parentPath.parentPath.parent,
          ) &&
          t.isIdentifier(functionParent.parentPath.parentPath.parent.left)
        ) {
          functionName = functionParent.parentPath.parentPath.parent.left.name;
        }
      }
    } else {
      if (
        t.isVariableDeclarator(functionParent.parent) &&
        t.isIdentifier(functionParent.parent.id)
      )
        functionName = functionParent.parent.id.name;
      else if (
        t.isAssignmentExpression(functionParent.parent) &&
        t.isIdentifier(functionParent.parent.left)
      )
        functionName = functionParent.parent.left.name;
      else if (
        t.isFunctionDeclaration(functionParent.node) ||
        t.isFunctionExpression(functionParent.node)
      ) {
        if (t.isIdentifier(functionParent.node.id))
          functionName = functionParent.node.id.name;
      }
    }
    // on va un cran plus haut pour éviter le name shadowing et donc éviter d'attraper l'argument qui shadow plutôt que le nom de la fonction.
    // ici on part donc du scope de la fonction parent, qui va attraper la fonction avant le paramètre, alors que de son propre scope, ce serait le paramètre en premier (et pas elle-même).
    const functionBinding = functionName
      ? functionParent.parentPath?.scope.getBinding(functionName)
      : undefined;

    if (functionName && functionBinding) {
      if (!isFunctionParentNotShadowed(functionParent, functionBinding)) {
        return setReturnObject(
          `${functionParent.node.type}`,
          `Function Name: '${functionName}'`,
          functionParent.node.loc?.start,
          functionParent.node.loc?.end,
          "PARAM_NAME_SHADOWED",
          "Le nom résolu ne désigne pas cette fonction (masqué par un paramètre ou une autre déclaration). Impossible d'aller plus loin.",
          [],
        );
      }
      const paramNode = binding.path.node;
      // claudo: `indexOf` trouve aussi les patterns et le rest : c'est la forme qui décide, pas l'index
      if (
        !t.isIdentifier(paramNode) &&
        !t.isAssignmentPattern(paramNode) &&
        !t.isObjectPattern(paramNode)
      ) {
        return setReturnObject(
          `BindingNode (${functionParent.node.type})`,
          `Function Name: '${functionName}'`,
          functionParent.node.loc?.start,
          functionParent.node.loc?.end,
          "PARAM_SHAPE",
          `Paramètre de type '${paramNode.type}' : la correspondance index/argument ne tient pas. Non pris en charge.`,
          [],
        );
      }
      const referencePaths: NodePath<t.Node>[] | undefined = getReferencePaths(
        functionParent,
        functionBinding,
      );
      if (referencePaths && !referencePaths.length) {
        if (functionBinding.referencePaths.length > 0) {
          // Aucune référence n'est un call-site exploitable. Avant de déclarer un trou, on regarde
          // si ce cul-de-sac se NOMME : les deux cas ci-dessous ne sont pas des échecs de l'outil,
          // ce sont des frontières, et les nommer est ce qui les sort d'`INCOMPLETE`.
          // Mesuré sur les 56 racines incomplètes du corpus : 33 pour l'export, 12 pour `$inject`.
          const paramIdx = functionParent.node.params.indexOf(paramNode);

          // L'injection d'abord : elle donne une VALEUR (le service nommé), l'export une provenance.
          const token = getInjectPropertyTokens(functionBinding.referencePaths);
          if (token && t.isIdentifier(paramNode)) {
            const terminal = injectTokenTerminal(
              functionParent,
              token,
              paramIdx,
              path.toString(),
            );
            if (terminal) return terminal;
          }

          const boundaries = getExportBoundaries(
            functionBinding.referencePaths,
            functionBinding,
          );
          if (boundaries) {
            const noms = boundaries
              .map((f) =>
                f.local === f.exported
                  ? `'${f.exported}'`
                  : `'${f.local}' exporté sous '${f.exported}'`,
              )
              .join(", ");
            return setReturnObject(
              `BindingNode (${functionParent.node.type})`,
              `Function Name: '${functionName}'`,
              functionParent.node.loc?.start,
              functionParent.node.loc?.end,
              "EXTERNAL_ENTRY",
              `Le paramètre '${path.toString()}' (index ${paramIdx}) de la fonction '${functionName}' reçoit sa valeur d'un appelant hors de ce fichier : les seules références à la fonction sont ses exports (${noms}). Frontière déclarée, pas une coupe.`,
              [],
            );
          }

          return setReturnObject(
            `BindingNode (${functionParent.node.type})`,
            `Function Name: '${functionName}'`,
            functionParent.node.loc?.start,
            functionParent.node.loc?.end,
            "PARAM_NO_VALID_CALLSITE",
            `La fonction de type '${functionParent.type}' qui porte le paramètre '${path.toString()}' n'a aucun appel direct par le nom '${functionName}' même si des références existent. Ces dernières ne satisfont pas aux prérequis mis en place. Noeud terminal.`,
            [],
          );
        }
        return setReturnObject(
          `BindingNode (${functionParent.node.type})`,
          `Function Name: '${functionName}'`,
          functionParent.node.loc?.start,
          functionParent.node.loc?.end,
          "PARAM_NO_CALLSITE",
          `La fonction de type '${functionParent.type}' qui porte le paramètre '${path.toString()}' n'a aucun appel direct par le nom '${functionName}'. Noeud terminal.`,
          [],
        );
      } else if (referencePaths === undefined) {
        return setReturnObject(
          `BindingNode (${functionParent.node.type})`,
          `Function Name: '${functionName}'`,
          functionParent.node.loc?.start,
          functionParent.node.loc?.end,
          "PARAM_UNDEFINED_CALLSITE",
          `La fonction de type '${functionParent.type}' qui porte le paramètre '${path.toString()}' est d'un type pour l'instant non pris en charge. Noeud terminal.`,
          [],
        );
      }
      // on chope que les noeuds qui sont les callee d'une CallExpression (via le parent), de telle façon à écarter les assignations et autres.
      const identifierIdx = functionParent.node.params.indexOf(paramNode);
      // on cherche l'index de l'argument dont on souhaite récupérer l'assignation. Ex : api.send(x, y), si on cherche y, on cherche le second argument (idx == 1).
      // on bind l'argument
      if (identifierIdx > -1 && referencePaths && referencePaths.length) {
        const children = [
          ...referencePaths.map((p, i) => {
            const args = (
              p as NodePath<t.CallExpression | t.OptionalCallExpression>
            ).get("arguments");
            const role = argumentEdgeRole(identifierIdx, i, p);
            // si dans un des arguments, il y a un SpreadElement avant l'index de l'argument qu'on souhaite retrouver, on arrête, car on ne sait pas encore le traiter.
            if (
              args.some(
                (e, i) => t.isSpreadElement(e.node) && i <= identifierIdx,
              )
            ) {
              const terminalNode = pushNode(
                setReturnObject(
                  "arguments",
                  p.toString(),
                  p.node.loc?.start,
                  p.node.loc?.end,
                  "PARAM_SHAPE",
                  "L'argument est un SpreadElement qui décale les index des arguments. Etant situé avant l'index de l'argument à teinter, impossible d'aller plus loin.",
                  [],
                ),
              );
              return {
                role: role,
                node: terminalNode,
                extra: { functionNode: functionBinding.path.toString() },
              };
            }
            // si l'argument est undefined, on arrête, sinon, on continue.
            const arg = args[identifierIdx];
            if (!arg) {
              const terminalNode = pushNode(
                setReturnObject(
                  "arguments",
                  p.toString(),
                  p.node.loc?.start,
                  p.node.loc?.end,
                  "PARAM_ARG_MISSING",
                  "L'argument de la fonction n'est pas utilisé sur cet appel et retourne undefined. Impossible d'aller plus loin.",
                  [],
                ),
              );
              return {
                role: role,
                node: terminalNode,
                extra: { functionNode: functionBinding.path.toString() },
              };
            } else {
              return {
                role: role,
                node: bindObject(arg),
                extra: { functionNode: functionBinding.path.toString() },
              };
            }
          }),
        ];
        return setReturnObject(
          `BindingNode (${binding.kind})`,
          `Function Name: '${functionName}'`,
          functionParent.node.loc?.start,
          functionParent.node.loc?.end,
          "INTERNAL",
          "",
          children,
        );
      } else if (identifierIdx < 0 && referencePaths && referencePaths.length) {
        return setReturnObject(
          `BindingNode (${functionParent.node.type})`,
          `Function Name: '${functionName}'`,
          functionParent.node.loc?.start,
          functionParent.node.loc?.end,
          "PARAM_SHAPE",
          "L'index de l'argument à retrouver est plus petit que 0. Soit le paramètre est dans un objet {a}, destructuré ...a et n'est donc pas pris en charge pour l'instant.",
          [],
        );
      }
    } else if (functionName && !functionBinding) {
      return setReturnObject(
        `${functionParent.node.type}`,
        `Function Name: '${functionName}'`,
        functionParent.node.loc?.start,
        functionParent.node.loc?.end,
        "PARAM_UNBOUND",
        "Impossible de binder la fonction.",
        [],
      );
    }
    //fonction anonyme
    return setReturnObject(
      `${functionParent.node.type}`,
      `Function Name: '${functionName}'`,
      functionParent.node.loc?.start,
      functionParent.node.loc?.end,
      "PARAM_ANON_FN",
      "La fonction est anonyme. Impossible d'aller plus loin.",
      [],
    );
  }
  return setReturnObject(
    `${functionParent.type}`,
    `Function Name: aucun nom.`,
    node.loc?.start,
    node.loc?.end,
    "UNSUPPORTED",
    "La fonction est d'un type non pris en charge.",
    [],
  );
}

/**
 * @brief Le noeud qui joue le rôle de "la propriété", quand la fonction est portée par un objet.
 * @param functionParent La fonction qui porte le paramètre teinté.
 * @return L'`ObjectMethod` ou l'`ObjectProperty` porteuse, ou undefined si la fonction n'en est pas.
 */
function getPropertyCarrier(
  functionParent: NodePath<t.Node>,
): NodePath<t.ObjectMethod | t.ObjectProperty> | undefined {
  if (t.isObjectMethod(functionParent.node))
    return functionParent as NodePath<t.ObjectMethod>;
  const parent = functionParent.parentPath;
  if (
    parent &&
    t.isObjectProperty(parent.node) &&
    parent.node.value === functionParent.node
  ) {
    return parent as NodePath<t.ObjectProperty>;
  }
  return undefined;
}

/** @brief Nom d'appel porté par une propriété d'objet, `Identifier` ou `StringLiteral`. */
function getCarrierKeyName(
  carrier: NodePath<t.ObjectMethod | t.ObjectProperty>,
): string | undefined {
  if (t.isIdentifier(carrier.node.key) && !carrier.node.computed)
    return carrier.node.key.name;
  if (t.isStringLiteral(carrier.node.key)) return carrier.node.key.value;
  return undefined;
}

function isFunctionParentNotShadowed(
  functionParent: NodePath<t.Node>,
  functionBinding: Binding,
) {
  // claudo : on teste s'il y a effectivement du shadowing (fatigue/20).
  const propertyCarrier = getPropertyCarrier(functionParent);
  const namedNode = propertyCarrier
    ? propertyCarrier.parentPath!.node
    : t.isClassMethod(functionParent.node) ||
        t.isClassPrivateMethod(functionParent.node)
      ? functionParent.parentPath!.parentPath!.node
      : functionParent.node;

  return (
    functionBinding.path.node === namedNode ||
    (t.isVariableDeclarator(functionBinding.path.node) &&
      functionBinding.path.node.init === namedNode) ||
    functionBinding.constantViolations.some(
      (p) => p.get("right").node === namedNode,
    )
  );
}

/**
 * @brief Appels `objet.clé(...)` parmi les références d'un objet.
 * @param objectBinding Binding de l'objet qui porte la propriété.
 * @param keyName Nom de la propriété appelée.
 * @return Les `CallExpression` dont le récepteur est cet objet et la propriété cette clé.
 */
function getCallsOnObjectKey(
  objectBinding: Binding,
  keyName: string,
): NodePath<t.CallExpression>[] {
  const calls: NodePath<t.CallExpression>[] = [];
  for (const ref of objectBinding.referencePaths) {
    const call = ref.parentPath?.parentPath;
    if (!call || !(call.isCallExpression() || call.isOptionalCallExpression()))
      continue;

    const callee = call.node.callee;
    if (!t.isMemberExpression(callee) && !t.isOptionalMemberExpression(callee))
      continue;
    if (callee.object !== ref.node) continue;

    const calledKey =
      t.isIdentifier(callee.property) && !callee.computed
        ? callee.property.name
        : t.isStringLiteral(callee.property)
          ? callee.property.value
          : undefined;
    if (calledKey !== keyName) continue;

    calls.push(call as NodePath<t.CallExpression>);
  }
  return calls;
}

/**
 * @brief Binding de l'objet littéral qui porte cette propriété.
 * @param property La propriété, `ObjectMethod` ou `ObjectProperty`.
 * @return Le binding de `o` dans `const o = { … }` / `o = { … }`, ou undefined.
 */
function getOwningObjectBinding(
  property: NodePath<t.Node>,
): Binding | undefined {
  const objectExpression = property.parentPath;
  if (!objectExpression) return undefined;

  const owner = objectExpression.parent;
  let objectName: string | undefined;
  if (t.isVariableDeclarator(owner) && t.isIdentifier(owner.id))
    objectName = owner.id.name;
  else if (t.isAssignmentExpression(owner) && t.isIdentifier(owner.left))
    objectName = owner.left.name;
  if (!objectName) return undefined;

  return objectExpression.scope.getBinding(objectName);
}

/**
 * @brief Call-sites atteints par une **référence** rangée en valeur de propriété d'objet.
 * @param functionBinding Binding de la fonction dont on cherche les appels.
 * @return Les `CallExpression` de la forme `objet.clé(...)`, dédoublonnées.
 */
function getCallSitesThroughObjectProperty(
  functionBinding: Binding,
): NodePath<t.CallExpression>[] {
  const calls: NodePath<t.CallExpression>[] = [];
  const seen = new Set<t.Node>();

  for (const ref of functionBinding.referencePaths) {
    const property = ref.parentPath;
    if (
      !property ||
      !t.isObjectProperty(property.node) ||
      property.node.value !== ref.node
    )
      continue;

    const keyName = getCarrierKeyName(property as NodePath<t.ObjectProperty>);
    if (!keyName) continue;

    // Objet sans binding (`return { getSsoUrl: s }`, objet imbriqué, `use({…})`) : le couple
    // (objet, clé) n'existe pas, il ne reste que la clé. On retombe sur les appels `X.clé(...)` du
    // fichier, plafonnés et marqués comme non prouvés — cf. `key-callsites.ts`.
    const objectBinding = getOwningObjectBinding(property);
    const appels = objectBinding
      ? getCallsOnObjectKey(objectBinding, keyName)
      : getCallsOnKeyAnywhere(property, keyName);

    // Deux propriétés distinctes peuvent mener au même appel : on dédoublonne sur le noeud, sinon
    // l'argument serait teinté deux fois et le rapport compterait deux branches pour une.
    for (const call of appels) {
      if (seen.has(call.node)) continue;
      seen.add(call.node);
      calls.push(call);
    }
  }
  return calls;
}

function getReferencePaths(
  functionParent: NodePath<t.Node>,
  functionBinding: Binding,
) {
  // Une fonction portée par une propriété d'objet s'appelle par `objet.clé(...)`, quelle que soit
  // sa forme syntaxique. Cette garde précède le switch parce que le type du noeud ne suffit pas à
  // la reconnaître : une flèche posée en valeur de propriété a le type d'une flèche.
  const propertyCarrier = getPropertyCarrier(functionParent);
  if (propertyCarrier) {
    const keyName = getCarrierKeyName(propertyCarrier);
    if (!keyName) return [];
    return getCallsOnObjectKey(functionBinding, keyName);
  }

  switch (functionParent.type) {
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression": {
      // Appel direct par le nom : `f(x)`.
      const directCalls = functionBinding.referencePaths
        .filter(
          (ref) =>
            (ref.parentPath.isCallExpression() ||
              ref.parentPath.isOptionalCallExpression()) &&
            ref.parentPath.node.callee === ref.node,
        )
        .map((ref) => ref.parentPath as NodePath<t.CallExpression>);

      // Appel indirect, la fonction ayant été rangée dans un objet : `{ extend: f }` puis `o.extend(x)`.
      // Les deux se cumulent — une même fonction peut être appelée des deux façons.
      return [
        ...directCalls,
        ...getCallSitesThroughObjectProperty(functionBinding),
      ];
    }
    // `ObjectMethod` n'a plus de `case` : il est absorbé par la garde `propertyCarrier` en tête.
    case "ClassPrivateMethod":
    case "ClassMethod": {
      const keyName = t.isIdentifier(functionParent.node.key)
        ? functionParent.node.key.name
        : t.isStringLiteral(functionParent.node.key)
          ? functionParent.node.key.value
          : undefined;
      const refs: NodePath<t.Node>[] | undefined = [];
      functionBinding.referencePaths.forEach((ref) => {
        const pp = ref.parentPath.parentPath;
        // const Api = class Inner { send(p) { SINK(p) } };
        // a = new Api(); | let a  = new Api()
        // a.send(location.hash)
        if (
          keyName &&
          pp.isAssignmentExpression() &&
          t.isNewExpression(pp.node.right) &&
          t.isIdentifier(pp.node.right.callee) &&
          t.isIdentifier(pp.node.left)
        ) {
          const bindRef = ref.scope.getBinding(pp.node.left.name);
          const assRefs = bindRef?.referencePaths
            .filter(
              (r) =>
                (r.parentPath.parentPath.isCallExpression() ||
                  r.parentPath.parentPath.isOptionalCallExpression()) &&
                t.isMemberExpression(r.parentPath.parentPath.node.callee) &&
                t.isIdentifier(r.parentPath.parentPath.node.callee.object) &&
                ((t.isIdentifier(
                  r.parentPath.parentPath.node.callee.property,
                ) &&
                  r.parentPath.parentPath.node.callee.property.name ===
                    keyName &&
                  !r.parentPath.parentPath.node.callee.computed) ||
                  (t.isStringLiteral(
                    r.parentPath.parentPath.node.callee.property,
                  ) &&
                    r.parentPath.parentPath.node.callee.property.value ===
                      keyName)),
            )
            .map(
              (ref) => ref.parentPath.parentPath as NodePath<t.CallExpression>,
            );
          if (assRefs?.length) refs.push(...assRefs);
        } else if (
          keyName &&
          pp.isVariableDeclarator() &&
          t.isNewExpression(pp.node.init) &&
          t.isIdentifier(pp.node.init.callee) &&
          t.isIdentifier(pp.node.id)
        ) {
          const bindRef = ref.scope.getBinding(pp.node.id.name);
          const varRefs = bindRef?.referencePaths
            .filter(
              (r) =>
                (r.parentPath.parentPath.isCallExpression() ||
                  r.parentPath.parentPath.isOptionalCallExpression()) &&
                t.isMemberExpression(r.parentPath.parentPath.node.callee) &&
                t.isIdentifier(r.parentPath.parentPath.node.callee.object) &&
                ((t.isIdentifier(
                  r.parentPath.parentPath.node.callee.property,
                ) &&
                  r.parentPath.parentPath.node.callee.property.name ===
                    keyName &&
                  !r.parentPath.parentPath.node.callee.computed) ||
                  (t.isStringLiteral(
                    r.parentPath.parentPath.node.callee.property,
                  ) &&
                    r.parentPath.parentPath.node.callee.property.value ===
                      keyName)),
            )
            .map(
              (ref) => ref.parentPath.parentPath as NodePath<t.CallExpression>,
            );
          if (varRefs?.length) refs.push(...varRefs);
        } else if (
          keyName &&
          pp.parentPath.isAssignmentExpression() &&
          t.isMemberExpression(pp.parentPath.node.right) &&
          t.isNewExpression(pp.parentPath.node.right.object) &&
          ((t.isIdentifier(pp.parentPath.node.right.property) &&
            !pp.parentPath.node.right.computed &&
            pp.parentPath.node.right.property.name === keyName) ||
            (t.isStringLiteral(pp.parentPath.node.right.property) &&
              pp.parentPath.node.right.property.value === keyName)) &&
          t.isIdentifier(pp.parentPath.node.left)
        ) {
          const bindRef = ref.scope.getBinding(pp.parentPath.node.left.name);
          if (bindRef?.referencePaths.length)
            refs.push(
              ...bindRef.referencePaths
                .filter((r) => {
                  return (
                    r.isIdentifier() &&
                    r.parentPath.isCallExpression() &&
                    r.parentPath.node.callee === r.node
                  );
                })
                .map((ref) => ref.parentPath as NodePath<t.CallExpression>),
            );
        } else if (
          keyName &&
          pp.parentPath.isVariableDeclarator() &&
          t.isMemberExpression(pp.parentPath.node.init) &&
          t.isNewExpression(pp.parentPath.node.init.object) &&
          ((t.isIdentifier(pp.parentPath.node.init.property) &&
            !pp.parentPath.node.init.computed &&
            pp.parentPath.node.init.property.name === keyName) ||
            (t.isStringLiteral(pp.parentPath.node.init.property) &&
              pp.parentPath.node.init.property.value === keyName)) &&
          t.isIdentifier(pp.parentPath.node.id)
        ) {
          const bindRef = ref.scope.getBinding(pp.parentPath.node.id.name);
          if (bindRef?.referencePaths.length)
            refs.push(
              ...bindRef.referencePaths
                .filter((r) => {
                  return (
                    r.isIdentifier() &&
                    r.parentPath.isCallExpression() &&
                    r.parentPath.node.callee === r.node
                  );
                })
                .map((ref) => ref.parentPath as NodePath<t.CallExpression>),
            );
        } else if (
          keyName &&
          (pp.parentPath.isCallExpression() ||
            pp.parentPath.isOptionalCallExpression()) &&
          (t.isMemberExpression(pp.parentPath.node.callee) ||
            t.isOptionalMemberExpression(pp.parentPath.node.callee)) &&
          t.isNewExpression(pp.parentPath.node.callee.object) &&
          ((t.isIdentifier(pp.parentPath.node.callee.property) &&
            !pp.parentPath.node.callee.computed &&
            pp.parentPath.node.callee.property.name === keyName) ||
            (t.isStringLiteral(pp.parentPath.node.callee.property) &&
              pp.parentPath.node.callee.property.value === keyName))
        ) {
          refs.push(pp.parentPath);
        } else if (
          keyName &&
          (pp.isCallExpression() || pp.isOptionalCallExpression()) &&
          (t.isMemberExpression(pp.node.callee) ||
            t.isOptionalMemberExpression(pp.node.callee)) &&
          pp.node.callee.object === ref.node &&
          ((t.isIdentifier(pp.node.callee.property) &&
            !pp.node.callee.computed &&
            pp.node.callee.property.name === keyName) ||
            (t.isStringLiteral(pp.node.callee.property) &&
              pp.node.callee.property.value === keyName))
        ) {
          refs.push(pp);
        }
      });
      return refs;
    }
    default:
      return undefined;
  }
}
