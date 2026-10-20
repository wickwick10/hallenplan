// Erzeugt dist/hallenplan.html: eine einzelne Datei mit eingebetteten Skripten (zum Teilen oder als Artifact).
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const html = read("index.html").replace('<script src="data.js"></script>\n<script src="app.js"></script>',
  () => "<script>\n" + read("data.js") + "\n" + read("app.js") + "</script>");
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist", "hallenplan.html"), html);
console.log("dist/hallenplan.html geschrieben");
