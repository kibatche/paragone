// positif : affectation
frame.srcdoc = "<p>" + msg.data + "</p>";
// positif : props React compilées
r.createElement("iframe", { srcDoc: t.preview, sandbox: "" });
// négatif : src n'est pas srcdoc
frame.src = "/embed";
