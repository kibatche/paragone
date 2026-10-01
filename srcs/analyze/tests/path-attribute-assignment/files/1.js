// positif : src ancré
img.src = "/api/avatars/" + user.id + "/image";
// positif : href ancré, gabarit
link.href = `/orders/${orderId}/invoice`;
// négatif : location.href relève de location
window.location.href = "/login?next=" + next;
// négatif : URL absolue
img.src = "https://cdn.example.com/" + name;
// négatif : pas un chemin ancré
a.href = next;
