// positif : .html(x) sous $(...)
$("#out").html(location.hash.slice(1));
// positif : chaîne d'appels
jQuery(".list").find("li").first().append("<b>" + name + "</b>");
// positif : statique HTML
var nodes = $.parseHTML(e.data);
// positif : statique code
jQuery.globalEval(code);
$.getScript(url);
// positif : attribut URL
$("a.next").attr("href", params.get("next"));
// négatif : .html() est une lecture
var current = $("#out").html();
// négatif : .append natif du DOM (texte)
document.body.append(location.hash);
// négatif : attribut sans risque
$("a").attr("title", t);
