/**
 * @author [A likely boring stuff made by] Shevek
 * @desc fr/code_exec.ts : Rubric et lignes de dossier de la classe CODE_EXEC, en français.
 */

import { EVAL_ANALYZER_NAME } from "../../../analyze/ast_analyzers/code_exec/eval";
import { FUNCTION_CONSTRUCTOR_ANALYZER_NAME } from "../../../analyze/ast_analyzers/code_exec/function_constructor";
import { STRING_TIMER_ANALYZER_NAME } from "../../../analyze/ast_analyzers/code_exec/string_timer";
import { DYNAMIC_IMPORT_ANALYZER_NAME } from "../../../analyze/ast_analyzers/code_exec/dynamic_import";
import { SCRIPT_ELEMENT_ANALYZER_NAME } from "../../../analyze/ast_analyzers/code_exec/script_element";
import { WORKER_ANALYZER_NAME } from "../../../analyze/ast_analyzers/code_exec/worker";
import { LODASH_TEMPLATE_ANALYZER_NAME } from "../../../analyze/ast_analyzers/code_exec/lodash_template";
import { JQUERY_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/jquery";
import type { ClassWording, CodeExecLines } from "../types";

export const CODE_EXEC: ClassWording<CodeExecLines> = {
  rubric: {
    definition: [
      "Tu es un juge de triage pour la classe CODE_EXEC (exécution de code JavaScript arbitraire).",
      "Une CODE_EXEC survient quand une valeur est évaluée comme du code : eval, new Function, setTimeout ou setInterval avec une chaîne, import() dynamique. Si l'attaquant contrôle la valeur, il exécute du JavaScript dans l'origine de la page.",
      "Ce qui compte : (1) la chaîne évaluée est construite à partir d'une donnée externe ; (2) un eval sur une constante, sur du code généré par le bundler (polyfill, détection d'environnement, « eval('this') ») ou sur du JSON de confiance n'est pas exploitable.",
      "Trois états à ne pas confondre : non armé (évaluation réelle d'une chaîne variable, sans source attaquant identifiée), non prouvé (la chaîne vient d'un paramètre, d'un import ou d'une donnée serveur : le code seul ne dit pas si l'attaquant la maîtrise), faux positif (constante, code de bundler ou de bibliothèque). Seul le faux positif se rejette.",
    ].join("\n\n"),
    scoreQuestion: "Quel est le verdict de triage de ce lead CODE_EXEC ?",
    scores: {
      HIGH: "Une source contrôlable atteint la chaîne évaluée comme code.",
      MEDIUM:
        "Une donnée externe probable (réponse d'API, configuration distante, stockage) est évaluée, sans preuve que l'attaquant la maîtrise.",
      IN_DEPTH:
        "La chaîne évaluée vient d'un paramètre, d'un import ou d'une donnée serveur : contrôlabilité non démontrable en statique. À remonter à un humain ; ne jamais rejeter pour ce seul motif.",
      REJECT:
        "Faux positif franc uniquement : chaîne constante, code de bundler ou de bibliothèque (détection d'environnement, polyfill), ou valeur validée avant l'évaluation.",
    },
    reasonQuestion:
      "En supposant que ce lead soit un faux positif à rejeter, quel en serait l'unique motif ? Ignore cette question si le verdict n'est pas REJECT.",
    reasons: {
      LITERAL_SOURCE:
        "La chaîne évaluée est une constante écrite dans le code.",
      NOT_A_SINK:
        "L'appel n'évalue pas de code : fonction homonyme, ou fonction passée par référence plutôt qu'une chaîne.",
      VENDORED_LIB:
        "Code de bundler ou de bibliothèque tierce (polyfill, détection d'environnement).",
      READ_ONLY: "La valeur est seulement lue ou comparée, jamais évaluée.",
      SANITIZED:
        "La valeur est validée (liste blanche, JSON.parse strict) avant l'évaluation.",
    },
  },
  lines: {
    evalCall:
      "[Exécution] la valeur est passée à eval : elle est exécutée comme du code JavaScript.",
    functionConstructor:
      "[Exécution] la valeur est un argument de Function ou new Function : le dernier argument est compilé comme corps de fonction, les autres comme noms de paramètres.",
    stringTimer:
      "[Exécution] la valeur est le premier argument de setTimeout ou setInterval : une chaîne y est évaluée comme du code ; une référence de fonction, non.",
    dynamicImport:
      "[Exécution] la valeur est la source d'un import() dynamique : le module chargé depuis cette URL s'exécute dans l'origine de la page.",
    scriptElement:
      '[Exécution] la valeur est affectée à src, text ou textContent d\'un élément créé par createElement("script") : script chargé depuis cette URL, ou code exécuté tel quel.',
    worker:
      "[Exécution] la valeur est l'URL d'un new Worker ou new SharedWorker : le script chargé s'exécute dans un worker de l'origine de la page.",
    lodashTemplate:
      "[Exécution] la valeur est la source d'un _.template : lodash la compile en fonction, et ses blocs <% %> sont du JavaScript.",
    jquery:
      "[Exécution] la valeur passe par $.globalEval (code exécuté) ou $.getScript (script chargé depuis cette URL puis exécuté).",
    otherSink: (analyzer) => `[Exécution] sink « ${analyzer} »`,
  },
  analyzerGuidance: {
    [EVAL_ANALYZER_NAME]:
      "eval direct s'exécute dans la portée locale, eval indirect ((0, eval)(x), window.eval) dans la portée globale : les deux exécutent la chaîne.",
    [FUNCTION_CONSTRUCTOR_ANALYZER_NAME]:
      "Le dernier argument est le corps de la fonction, les autres des noms de paramètres. Bundlers et polyfills génèrent Function(\"return this\")() ; les formateurs de messages (ICU, i18n) compilent leurs gabarits ainsi : code de bibliothèque. La fonction produite n'exécute rien tant qu'elle n'est pas appelée.",
    [STRING_TIMER_ANALYZER_NAME]:
      "Seule une chaîne en premier argument est évaluée ; une fonction ne l'est pas.",
    [DYNAMIC_IMPORT_ANALYZER_NAME]:
      "Le module est chargé depuis l'URL puis exécuté. Un chemin relatif ou un préfixe d'hôte fixe borne l'attaquant aux modules que l'application sert déjà ; un préfixe libre lui permet de charger un module depuis son propre hôte, qui doit alors répondre avec les en-têtes CORS.",
    [SCRIPT_ELEMENT_ANALYZER_NAME]:
      "src : le script est chargé depuis cette URL, et un hôte contrôlé suffit. text ou textContent : le code est exécuté tel quel. Dans les deux cas, rien ne s'exécute avant l'insertion de l'élément dans le document.",
    [WORKER_ANALYZER_NAME]:
      "Le constructeur Worker n'accepte qu'une URL de même origine, une URL blob: (qui hérite de l'origine du document qui l'a créée) ou une URL data: (qui s'exécute dans une origine opaque, sans accès à celle de la page). Une URL d'un autre hôte lève une SecurityError.",
    [LODASH_TEMPLATE_ANALYZER_NAME]:
      "_.template compile la chaîne en fonction (par Function) : <% %> exécute du JavaScript, <%= %> interpole une expression, <%- %> l'interpole échappée. Le danger est une SOURCE de gabarit contrôlée, pas les données passées ensuite au gabarit compilé.",
    [JQUERY_ANALYZER_NAME]:
      "$.globalEval exécute la chaîne dans la portée globale ; $.getScript charge un script depuis l'URL puis l'exécute, et un hôte contrôlé suffit.",
  },
};
