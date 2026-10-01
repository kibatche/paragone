// positif : vue-router
this.$router.push("/orders/" + params.get("id"));
// positif : Angular
this.router.navigateByUrl(returnUrl);
// positif : react-router non minifié
navigate(`/account/${tab}`);
// positif : history, URL en troisième argument
history.pushState({}, "", "/search?q=" + q);
window.history.replaceState(null, "", url);
// négatif : push sur un tableau
items.push(x);
// négatif : replace de chaîne
s.replace("a", "b");
