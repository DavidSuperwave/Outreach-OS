import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = dirname(fileURLToPath(import.meta.url));
const pkg = join(root, "..");
const outdir = join(pkg, "dist", "assets");
const outfile = join(outdir, "outreach-shell.js");

mkdirSync(outdir, { recursive: true });

await esbuild.build({
  absWorkingDir: pkg,
  entryPoints: ["src/client-entry.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile,
  jsx: "automatic",
  minify: true,
  banner: { js: "/* LiveOutreach hydrate */" },
  logLevel: "info",
});
