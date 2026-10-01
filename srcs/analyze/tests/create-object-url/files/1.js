// positif
var u = URL.createObjectURL(new Blob([e.data], { type: "text/html" }));
// positif : préfixé
window.webkitURL.createObjectURL(file);
// négatif : revokeObjectURL
URL.revokeObjectURL(u);
