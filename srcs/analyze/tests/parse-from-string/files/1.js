// positif : text/html
var doc = new DOMParser().parseFromString(e.data, "text/html");
// positif : type non littéral, gardé
var doc2 = parser.parseFromString(xml, mime);
// négatif : XML
var feed = new DOMParser().parseFromString(body, "application/xml");
