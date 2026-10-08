/**
 * @author [A likely boring stuff made by] Shevek
 * @desc fr/xss.ts : Rubric et lignes de dossier de la classe XSS, en français.
 */

import { INNER_HTML_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/inner_html";
import { DANGEROUS_HTML_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/react_dangerously_set_inner_html";
import { OUTER_HTML_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/outer_html";
import { DOCUMENT_WRITE_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/document_write";
import { INSERT_ADJACENT_HTML_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/insert_adjacent_html";
import { SRCDOC_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/srcdoc";
import { CREATE_CONTEXTUAL_FRAGMENT_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/create_contextual_fragment";
import { PARSE_FROM_STRING_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/parse_from_string";
import { SET_HTML_UNSAFE_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/set_html_unsafe";
import { JQUERY_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/jquery";
import { INNER_HTML_PROPERTY_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/innerhtml_property";
import { HTML_PROPERTY_CALL_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/html_property_call";
import { ANGULAR_BYPASS_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/angular_bypass";
import { UNSAFE_HTML_WRAPPER_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/unsafe_html_wrapper";
import { CREATE_OBJECT_URL_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/create_object_url";
import type { ClassWording, XssLines } from "../types";

export const XSS: ClassWording<XssLines> = {
  rubric: {
    definition: [
      "Tu es un juge de triage pour la classe XSS (injection de HTML ou de script côté client).",
      "Une XSS survient quand une valeur est insérée dans le document par un point qui interprète du HTML : innerHTML ou outerHTML, insertAdjacentHTML, document.write, React dangerouslySetInnerHTML, et leurs équivalents de frameworks. Si l'attaquant contrôle la valeur et qu'aucune désinfection ne s'interpose, il exécute du JavaScript dans l'origine de la page.",
      "Ce qui compte : (1) la valeur atteint le sink sans passer par un désinfectant (DOMPurify, sanitize, encodage HTML) ; (2) son origine : URL (location.hash, location.search), message entre fenêtres, stockage, réponse serveur réinjectée ; (3) une chaîne entièrement littérale ou un gabarit fixe de l'application n'est pas une XSS.",
      "Trois états à ne pas confondre : non armé (valeur réellement insérée comme HTML, sans source attaquant identifiée), non prouvé (la valeur vient d'un paramètre, d'un import ou d'une réponse serveur : le code seul ne dit pas si l'attaquant la maîtrise), faux positif (constante, contenu fixe, bibliothèque, valeur désinfectée). Seul le faux positif se rejette.",
    ].join("\n\n"),
    scoreQuestion: "Quel est le verdict de triage de ce lead XSS ?",
    scores: {
      HIGH: "Une source contrôlable (URL, message, stockage) atteint le sink HTML sans désinfection visible.",
      MEDIUM:
        "Insertion HTML d'une donnée externe probable (réponse d'API, donnée utilisateur stockée) sans désinfection visible, mais la source n'est pas démontrée atteinte.",
      IN_DEPTH:
        "Insertion HTML réelle dont l'origine n'est pas démontrable en statique (paramètre, import, donnée serveur), ou désinfection douteuse. À remonter à un humain ; ne jamais rejeter pour ce seul motif.",
      REJECT:
        "Faux positif franc uniquement : valeur constante ou gabarit fixe de l'application, code de bibliothèque ou de framework, lecture plutôt qu'écriture, ou valeur désinfectée avant l'insertion.",
    },
    reasonQuestion:
      "En supposant que ce lead soit un faux positif à rejeter, quel en serait l'unique motif ? Ignore cette question si le verdict n'est pas REJECT.",
    reasons: {
      LITERAL_SOURCE:
        "La valeur insérée est une constante ou un gabarit fixe écrit dans le code.",
      NOT_A_SINK:
        "Le point n'interprète pas de HTML (textContent, attribut inoffensif) ou le récepteur n'est pas un élément du DOM.",
      VENDORED_LIB:
        "Code de bibliothèque tierce ou de framework (React, Angular, jQuery, rendu interne), pas applicatif.",
      READ_ONLY: "Lecture de innerHTML ou outerHTML, pas écriture.",
      SANITIZED:
        "La valeur passe par un désinfectant (DOMPurify, sanitize, encodage HTML) avant l'insertion.",
    },
  },
  lines: {
    innerHtml:
      "[Insertion] la valeur est affectée à innerHTML ou outerHTML : elle est interprétée comme du HTML.",
    reactDangerouslySetInnerHtml:
      "[Insertion] la valeur passe par dangerouslySetInnerHTML (React) : elle est interprétée comme du HTML, sans échappement.",
    outerHtml:
      "[Insertion] la valeur est affectée à outerHTML : l'élément est remplacé par la valeur interprétée comme du HTML.",
    documentWrite:
      "[Insertion] la valeur est écrite par document.write ou writeln : elle est interprétée comme du HTML, et un <script> écrit ainsi s'exécute.",
    insertAdjacentHtml:
      "[Insertion] la valeur est le HTML d'insertAdjacentHTML : elle est interprétée comme du HTML à côté de l'élément.",
    srcdoc:
      "[Insertion] la valeur est le srcdoc d'une iframe : elle devient le document HTML de l'iframe.",
    createContextualFragment:
      "[Insertion] la valeur passe par createContextualFragment : elle est analysée comme du HTML, et ses <script> s'exécutent à l'insertion du fragment.",
    parseFromString:
      "[Insertion] la valeur est analysée par DOMParser.parseFromString en text/html : elle est analysée comme un document HTML séparé de la page.",
    setHtmlUnsafe:
      "[Insertion] la valeur passe par setHTMLUnsafe ou parseHTMLUnsafe : elle est analysée comme du HTML sans désinfection.",
    jquery:
      "[Insertion] la valeur passe par une méthode jQuery qui interprète du HTML (html, append, prepend, after, before, replaceWith, wrap, parseHTML) ou devient un attribut href/src (un « javascript: » s'y exécute).",
    innerHtmlProperty:
      "[Insertion] la valeur est la propriété innerHTML ou outerHTML d'un objet de rendu (v-html compilé par Vue, domProps) : le framework l'affecte à l'élément comme du HTML.",
    htmlPropertyCall:
      "[Insertion] la valeur suit le nom de propriété innerHTML, outerHTML ou srcdoc dans un appel (liaison [innerHTML] compilée par Angular, Renderer2.setProperty, Reflect.set) : elle est affectée comme du HTML.",
    angularBypass:
      "[Insertion] la valeur passe par bypassSecurityTrust* (Angular) ou $sce.trustAs* (AngularJS), qui la marquent sûre, ou par $sce.parseAs* (AngularJS), qui l'évalue comme expression.",
    unsafeHtmlWrapper:
      "[Insertion] la valeur est enveloppée comme HTML de confiance (unsafeHTML de lit, htmlSafe d'Ember, SafeString de Handlebars) : le moteur de gabarits l'insère sans échappement.",
    createObjectUrl:
      "[Insertion] la valeur devient une URL blob: par URL.createObjectURL : l'URL désigne le contenu du Blob.",
    otherSink: (analyzer) => `[Insertion] sink « ${analyzer} »`,
  },
  analyzerGuidance: {
    [INNER_HTML_ANALYZER_NAME]:
      "Un <script> inséré par innerHTML ne s'exécute pas, mais un gestionnaire d'événement (<img src=x onerror=…>) si : l'absence de <script> dans la valeur ne protège pas.",
    [DANGEROUS_HTML_ANALYZER_NAME]:
      "React passe __html tel quel au navigateur, comme la propriété innerHTML sous-jacente : mêmes règles d'exécution qu'innerHTML. Seules comptent l'origine de __html et la présence d'un désinfectant avant.",
    [OUTER_HTML_ANALYZER_NAME]:
      "Mêmes règles d'exécution qu'innerHTML : pas de <script>, mais les gestionnaires d'événement s'exécutent.",
    [DOCUMENT_WRITE_ANALYZER_NAME]:
      "Les <script> écrits par document.write s'exécutent, y compris un <script src> vers un hôte choisi ; la spécification permet au navigateur de ne pas exécuter un script ainsi inséré, par exemple d'une autre origine sur un réseau lent. Appelé après le chargement, document.write rouvre le document et en remplace tout le contenu.",
    [INSERT_ADJACENT_HTML_ANALYZER_NAME]:
      "Seul le second argument est du HTML ; le premier est une position fixe. Mêmes règles d'exécution qu'innerHTML.",
    [SRCDOC_ANALYZER_NAME]:
      "La valeur devient le document de l'iframe, qui prend l'origine du document qui a posé srcdoc. Sans attribut sandbox, ses scripts s'exécutent dans l'origine de la page. Avec sandbox : sans allow-scripts, aucun script ne s'exécute ; sans allow-same-origin, ils s'exécutent dans une origine opaque, sans accès à la page ; avec allow-scripts ET allow-same-origin, le document peut retirer lui-même l'attribut sandbox, qui ne protège alors plus rien.",
    [CREATE_CONTEXTUAL_FRAGMENT_ANALYZER_NAME]:
      "Contrairement à innerHTML, les <script> du fragment s'exécutent quand le fragment est inséré dans le document. Vérifier dans le contexte que le fragment est inséré.",
    [PARSE_FROM_STRING_ANALYZER_NAME]:
      "Le document produit par parseFromString est inerte : ni script ni gestionnaire ne s'exécute tant qu'aucun de ses nœuds n'est réinséré dans la page. Chercher la réinsertion dans le contexte (appendChild, replaceWith, importNode, innerHTML d'un nœud du document) ; sans elle, ce n'est pas un sink. Désinfecter ce document puis le re-sérialiser est le terrain typique des mutations mXSS.",
    [SET_HTML_UNSAFE_ANALYZER_NAME]:
      "setHTMLUnsafe ne désinfecte que si l'appel passe une option sanitizer ; ses <script> ne s'exécutent que si l'option runScripts vaut true, mais comme avec innerHTML, un gestionnaire d'événement (<img onerror>) s'exécute. parseHTMLUnsafe rend un document inerte, sans contexte de navigation : rien ne s'exécute tant qu'un de ses nœuds n'est pas réinséré dans la page. Les deux acceptent le shadow DOM déclaratif. setHTML, sans « Unsafe », désinfecte toujours : il n'est pas visé.",
    [JQUERY_ANALYZER_NAME]:
      'Contrairement à innerHTML, une méthode jQuery qui reçoit une chaîne HTML peut exécuter les <script> qu\'elle contient, en plus des gestionnaires d\'événement. Pour attr("href"|"src"), la valeur est une URL : le danger est une URL « javascript: ». Une valeur qui est un nœud DOM ou un objet jQuery, pas une chaîne, n\'injecte rien.',
    [INNER_HTML_PROPERTY_ANALYZER_NAME]:
      "Propriété innerHTML d'un objet de rendu compilé (v-html de Vue, domProps) : le framework l'affecte à innerHTML sans échappement. Même lecture qu'une affectation à innerHTML.",
    [HTML_PROPERTY_CALL_ANALYZER_NAME]:
      "Chez Angular, une valeur liée à [innerHTML] est désinfectée automatiquement : un désinfectant passé après la valeur (par exemple ɵɵsanitizeHtml, souvent renommé en bundle) vaut SANITIZED, sauf si la valeur sort d'un bypassSecurityTrustHtml. Hors liaison de gabarit (Renderer2.setProperty, Reflect.set), rien ne garantit une désinfection : la chercher dans le contexte.",
    [ANGULAR_BYPASS_ANALYZER_NAME]:
      "bypassSecurityTrust* (Angular) et $sce.trustAs* (AngularJS) exemptent explicitement la valeur de la désinfection du framework : tout ce qui y entre est inséré tel quel. $sce.parseAs* est différent : il ne marque rien comme sûr, il évalue une EXPRESSION AngularJS puis exige que son résultat soit déjà approuvé ; le risque est alors une expression contrôlée (injection de gabarit côté client). Une constante ou un gabarit fixe de l'application est un faux positif.",
    [UNSAFE_HTML_WRAPPER_ANALYZER_NAME]:
      "La valeur est déclarée HTML de confiance pour le moteur de gabarits, qui échappe tout le reste. L'enveloppe n'est dangereuse que si ce qu'elle enveloppe vient de l'extérieur.",
    [CREATE_OBJECT_URL_ANALYZER_NAME]:
      "L'URL blob: a pour origine celle du document qui l'a créée. Il n'y a XSS que si le Blob est un document HTML (type text/html) ET que l'URL est ouverte (window.open, location, lien) ou chargée en iframe. Un Blob servi en téléchargement (a.download), une image affichée, ou un fichier que l'utilisateur a choisi lui-même : pas un sink.",
  },
};
