// positif : lit
html`<div>${unsafeHTML(e.body)}</div>`;
// positif : Ember
var s = Ember.String.htmlSafe(model.bio);
// positif : Handlebars
var safe = new Handlebars.SafeString(link);
// négatif : autre constructeur
var d = new Date(x);
