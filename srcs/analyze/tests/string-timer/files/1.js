// positif : chaîne concaténée
setTimeout("update(" + location.hash.slice(1) + ")", 100);
// positif : gabarit
window.setInterval(`poll("${id}")`, 1000);
// négatif : référence, une fonction en code compilé
setTimeout(t, 0);
setInterval(this.update, 300);
// négatif : fonction fléchée
setTimeout(() => refresh(), 50);
// négatif : fonction anonyme
setInterval(function () { tick(); }, 1000);
