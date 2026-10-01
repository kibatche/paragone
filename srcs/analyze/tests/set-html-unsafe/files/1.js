// positif
host.setHTMLUnsafe(location.hash.slice(1));
// positif
var d = Document.parseHTMLUnsafe(t.body);
// négatif : setHTML désinfecte
host.setHTML(location.hash);
