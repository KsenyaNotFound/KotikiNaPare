import { mkdir, readFile, writeFile } from "node:fs/promises";

const files = await Promise.all(["index.html", "style.css", "app.js"].map(name => readFile(new URL("../public/" + name, import.meta.url), "utf8")));
const api = (await readFile(new URL("../lib/classroom.mjs", import.meta.url), "utf8")).replace("export async function classroom", "async function classroom");
const manifest = JSON.parse(await readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"));
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await writeFile("dist/.openai/hosting.json", JSON.stringify(manifest));
await writeFile("dist/server/index.js", api + "\nconst files = " + JSON.stringify(files) + ";\n" + `
export default {
  fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === "/api/classroom") return classroom(request, env.DB);
    const index = ["/", "/style.css", "/app.js"].indexOf(path);
    if (index === -1) return new Response("Not found", { status: 404 });
    return new Response(files[index], { headers: {
      "Content-Type": ["text/html", "text/css", "text/javascript"][index] + "; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    } });
  },
};
`);