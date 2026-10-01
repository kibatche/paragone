// positif : source calculée
import("/plugins/" + location.hash.slice(1) + ".js");
// positif : gabarit à trou
import(`./locales/${lang}.js`);
// négatif : chunk du bundler
import("./chunk-AB12.js");
// négatif : gabarit sans trou
import(`./static.js`);
