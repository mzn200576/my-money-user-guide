import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const files = ["0000_hot_ultimatum.sql", "0001_classroom_transactions.sql"];
const body = files.map((name) => `-- ${name}\n${readFileSync(new URL(`supabase/migrations/${name}`, root), "utf8")}`).join("\n\n");
const target = new URL("supabase/setup.sql", root);
writeFileSync(target, `-- NEW, EMPTY SUPABASE PROJECT ONLY. Run once in SQL Editor.\n-- Existing classroom accounts and rooms are not copied by this file.\nBEGIN;\n${body}\nCOMMIT;\n`);
console.log(`Created ${fileURLToPath(target)}`);
