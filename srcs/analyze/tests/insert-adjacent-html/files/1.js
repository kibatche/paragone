// positif : seul le second argument est jugé
el.insertAdjacentHTML("beforeend", "<li>" + decodeURIComponent(location.hash) + "</li>");
// négatif : insertAdjacentText insère du texte
el.insertAdjacentText("beforeend", location.hash);
// négatif : un seul argument
el.insertAdjacentHTML("beforeend");
