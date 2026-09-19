// Vercel build for the static site: the deployment's own files become the
// output (public/). No bucket fetch, no dependencies. Works with the project
// linked to git (root directory future-clips-site/) and for a file deploy.
const fs = require("fs"), path = require("path");
const SKIP = new Set(["public", "build.js", "README.txt", "node_modules", ".vercel"]);
fs.rmSync("public", { recursive: true, force: true });
fs.mkdirSync("public", { recursive: true });
let n = 0;
for (const f of fs.readdirSync(".")) {
  if (SKIP.has(f)) continue;
  fs.cpSync(f, path.join("public", f), { recursive: true });
  n++;
}
console.log(`site: ${n} entries copied into public/`);
