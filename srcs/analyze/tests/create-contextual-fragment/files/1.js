// positif
var frag = document.createRange().createContextualFragment(location.hash.substring(1));
// négatif : createDocumentFragment ne prend pas de HTML
var empty = document.createDocumentFragment();
