// XSS
const q = new URLSearchParams(location.search).get("q");
document.getElementById("out").innerHTML = q;

// CSPT
const id = new URLSearchParams(location.search).get("id");
fetch("/api/users/" + id + "/profile");

// CODE_EXEC
const expr = new URLSearchParams(location.search).get("expr");
eval(expr);

// OPEN_REDIRECT
const next = new URLSearchParams(location.search).get("next");
location.href = next;

// WEB_MESSAGE
window.addEventListener("message", (event) => {
  document.getElementById("msg").innerHTML = event.data.html;
});
