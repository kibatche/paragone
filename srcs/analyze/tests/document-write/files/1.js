// positif
document.write("<script src='" + location.search.slice(1) + "'></script>");
// positif : writeln, plusieurs arguments
window.document.writeln(a, b);
// positif : document d'iframe
frame.contentDocument.write(e.data);
// négatif : autre receveur
stream.write(chunk);
