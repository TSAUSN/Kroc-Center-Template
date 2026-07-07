// Formats the Parsley-processed view JS. Plain formatters can't touch these
// files (raw Parsley is invalid JS), so this wrapper masks every Parsley call,
// runs ESLint `curly` --fix + Prettier, then restores the calls verbatim.
// Safety: a file is only written if every mask round-trips and the Parsley
// call count/order is unchanged; otherwise it is skipped with a warning.
//
// Usage: npm run format        (add --check to fail instead of write)

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import prettier from "prettier";
import { Linter } from "eslint";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, "$1");
const VIEWS = join(ROOT, "webengine", "views");
const CHECK = process.argv.includes("--check");

const PRETTIER_OPTS = {
  parser: "babel",
  printWidth: 100,
  trailingComma: "none" // a trailing comma + Parsley `_arraycomma` would emit ",,"
};

const ESLINT_CONFIG = {
  files: ["**/*.jsx"], // must match the fixed lint filename below or no rules apply
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "script", // top-level consts are shared across babel scripts
    parserOptions: { ecmaFeatures: { jsx: true } }
  },
  rules: { curly: ["error", "all"] }
};

const linter = new Linter();

const PARSLEY = /\{\{[\s\S]*?\}\}/g;
// Regions that emit statements/punctuation rather than a value must be masked
// as comments (valid between array items); value regions become identifiers
// (valid as an expression or as text inside a string literal).
const CONTROL = /^\{\{\s*(each|end-each|if|else|else-if|end-if|include)\b|\._arraycomma\s*\}\}$/;

function mask(source) {
  const regions = [];
  const masked = source.replace(PARSLEY, (m) => {
    const i = regions.push(m) - 1;
    return CONTROL.test(m) ? `/*__PARSLEY_${i}__*/` : `__PARSLEY_${i}__`;
  });
  return { masked, regions };
}

function unmask(code, regions) {
  return code.replace(/(?:\/\*\s*)?__PARSLEY_(\d+)__(?:\s*\*\/)?/g, (_, n) => regions[Number(n)]);
}

function verifyRoundTrip(original, output) {
  if (/__PARSLEY_/.test(output)) return "unrestored placeholder";
  const before = (original.match(PARSLEY) || []).join("\n");
  const after = (output.match(PARSLEY) || []).join("\n");
  if (before !== after) return "Parsley calls changed or reordered";
  return null;
}

async function formatJs(source) {
  const { masked, regions } = mask(source);

  // fixed .jsx filename: real labels (loader, block .html) wouldn't match `files`
  const lint = linter.verifyAndFix(masked, ESLINT_CONFIG, { filename: "view.jsx" });
  const unmatched = lint.messages.find((m) => /No matching configuration/.test(m.message));
  if (unmatched) throw new Error("eslint config did not match — curly fix skipped");
  const fatal = lint.messages.find((m) => m.fatal);
  if (fatal) throw new Error(`parse error ${fatal.line}:${fatal.column} ${fatal.message}`);

  const pretty = await prettier.format(lint.output, PRETTIER_OPTS);
  const output = unmask(pretty, regions);

  const problem = verifyRoundTrip(source, output);
  if (problem) throw new Error(problem);
  return output;
}

// Views where only <script type="text/babel"> bodies are JS.
const BABEL_SCRIPT = /(<script\b[^>]*type=["']text\/babel["'][^>]*>)([\s\S]*?)(<\/script>)/g;

async function formatEmbedded(source) {
  const jobs = [];
  source.replace(BABEL_SCRIPT, (m, open, body, close) => {
    jobs.push({ open, body, close });
    return m;
  });
  let out = source;
  for (const job of jobs) {
    if (!job.body.trim()) continue;
    const formatted = await formatJs(job.body);
    out = out.replace(job.open + job.body + job.close, job.open + "\n" + formatted + job.close);
  }
  return out;
}

const targets = [];
for (const f of readdirSync(join(VIEWS, "components"))) {
  if (f.endsWith(".jsx")) targets.push({ path: join(VIEWS, "components", f), embedded: false });
}
targets.push({ path: join(VIEWS, "loader"), embedded: true });
targets.push({ path: join(VIEWS, "homepage"), embedded: true });
for (const f of readdirSync(join(VIEWS, "-", "block"))) {
  if (f.endsWith(".html")) targets.push({ path: join(VIEWS, "-", "block", f), embedded: true });
}

let changed = 0;
let failed = 0;
for (const t of targets) {
  const rel = t.path.slice(ROOT.length);
  const source = readFileSync(t.path, "utf8");
  try {
    const output = t.embedded ? await formatEmbedded(source) : await formatJs(source);
    if (output === source) continue;
    changed++;
    if (CHECK) {
      console.log(`needs formatting: ${rel}`);
    } else {
      writeFileSync(t.path, output);
      console.log(`formatted: ${rel}`);
    }
  } catch (err) {
    failed++;
    console.error(`SKIPPED ${rel} — ${err.message}`);
  }
}

console.log(`${targets.length} files scanned, ${changed} ${CHECK ? "need formatting" : "formatted"}, ${failed} skipped`);
if (failed || (CHECK && changed)) process.exit(1);
