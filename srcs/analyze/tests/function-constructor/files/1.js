// positif
var fn = new Function("a", "return a + " + location.hash.slice(1));
// positif : appel sans new
var g = Function(body);
// négatif : autre constructeur
var p = new Promise(r);
