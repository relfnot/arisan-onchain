// Copies the IDL produced by `anchor build` into the frontend.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "target/idl/arisan.json");
const dest = resolve(root, "app/src/idl/arisan.json");

if (!existsSync(src)) {
  console.error("target/idl/arisan.json not found. Run `anchor build` first.");
  process.exit(1);
}
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`Copied IDL to ${dest}`);
