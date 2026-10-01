// positif : v-html compilé (Vue 3)
o("div", { class: "content", innerHTML: e.body }, null, 8, ["innerHTML"]);
// positif : domProps (Vue 2)
h("div", { domProps: { innerHTML: this.html } });
// négatif : textContent
o("div", { textContent: e.body });
