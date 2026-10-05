// Server-renders a KROC block component for each case in a JSON file, then
// checks every utility class the component uses made it into the compiled
// CSS (components/styles.html) — the two checks every block gets before it
// ships.
//
// Usage (from the Kroc-Center-Template root):
//   node .claude/skills/zesty/scripts/ssr-check.cjs <Component> <file.jsx> <cases.json> [--html]
//     <Component>   the function name, e.g. CardGrid
//     <file.jsx>    webengine/views/components/cardgrid.jsx
//     <cases.json>  { "case name": { ...the block view's `data` object }, ... }
//                   repeater fields go in the shape the view hands over: [[row, row]]
//     --html        print each case's full markup instead of a summary
//
// Needs React 18 + @babel/standalone outside the repo (the repo's own
// devDependencies are Tailwind/ESLint/Prettier only). Once per machine:
//   npm i --prefix ~/.cache/kroc-ssr react@18.3.1 react-dom@18.3.1 @babel/standalone@7
// or point KROC_SSR_MODULES at another node_modules.
//
// Effects don't run under server rendering, so anything a component fetches
// after mount (e.g. useKrocMediaUrls) renders in its pre-fetch state here.

const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = process.cwd();
const VIEWS = path.join(ROOT, "webengine", "views", "components");
const MODULES = process.env.KROC_SSR_MODULES || path.join(os.homedir(), ".cache", "kroc-ssr", "node_modules");

const [name, file, casesPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const HTML = process.argv.includes("--html");
if (!name || !file || !casesPath) {
  console.error("usage: ssr-check.cjs <Component> <file.jsx> <cases.json> [--html]");
  process.exit(1);
}

let Babel, React, RDS;
try {
  Babel = require(path.join(MODULES, "@babel/standalone"));
  React = require(path.join(MODULES, "react"));
  RDS = require(path.join(MODULES, "react-dom/server"));
} catch {
  console.error(`missing test modules in ${MODULES}\n  npm i --prefix ~/.cache/kroc-ssr react@18.3.1 react-dom@18.3.1 @babel/standalone@7`);
  process.exit(1);
}

// Parsley isn't run here: strip its calls the way an unset field renders.
const load = (p) => {
  const src = fs
    .readFileSync(p, "utf8")
    .replace(/\{\{\s*globals\.social_handles\s*\}\}/g, "[]")
    .replace(/\{\{![^}]*\}\}/g, "")
    .replace(/\{\{[^}]*\}\}/g, "");
  return Babel.transform(src, { presets: ["react"] }).code;
};

// The loader's shared helpers (cx, Icon, krocExternalUrl, krocSortRows, …).
const shared = ["shared.jsx", "cards.jsx", "catalog.jsx", "featuredpages.jsx"]
  .map((f) => path.join(VIEWS, f))
  .filter((p) => fs.existsSync(p) && path.resolve(p) !== path.resolve(file));
const code = [...shared.map(load), load(file)].join("\n;\n");
const Component = new Function("React", "window", "document", "console", `${code}\n; return ${name};`)(
  React,
  { location: { pathname: "/" }, addEventListener() {}, removeEventListener() {} },
  { getElementById: () => null, querySelectorAll: () => [] },
  console
);

const cases = JSON.parse(fs.readFileSync(casesPath, "utf8"));
for (const [label, data] of Object.entries(cases)) {
  let html;
  try {
    html = RDS.renderToStaticMarkup(React.createElement(Component, { data }));
  } catch (e) {
    console.log(`\n### ${label}\n   ✗ THROWS: ${e.message}`);
    continue;
  }
  console.log(`\n### ${label}`);
  if (!html) {
    console.log("   renders nothing");
    continue;
  }
  if (HTML) {
    console.log(html);
    continue;
  }
  const tags = {};
  for (const m of html.matchAll(/<([a-z0-9]+)[\s>]/g)) tags[m[1]] = (tags[m[1]] || 0) + 1;
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  console.log(`   ${html.length} chars · tags ${JSON.stringify(tags)}`);
  console.log(`   text: ${text.length > 240 ? text.slice(0, 240) + "…" : text}`);
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  if (hrefs.length) console.log(`   hrefs: ${hrefs.join(" | ")}`);
}

// Every utility-looking token in the component's string literals must exist
// in the compiled CSS, or `npm run build:css` hasn't run since it was added.
const css = fs.readFileSync(path.join(VIEWS, "styles.html"), "utf8");
const BARE = new Set(["flex", "grid", "hidden", "block", "inline", "contents", "uppercase", "italic", "underline", "truncate", "relative", "absolute", "fixed", "sticky", "rounded", "border", "shadow", "btn", "grow", "shrink"]);
const tokens = new Set();
for (const m of fs.readFileSync(file, "utf8").matchAll(/"([^"\n]*)"/g)) {
  for (const t of m[1].split(/\s+/)) {
    if (!t || /^[0-9/#]|^https?:|\.(jsx?|json|html|svg)$|\{\{|:$/.test(t)) continue;
    if (/^[a-z!-][a-z0-9:[\]().\/_%#,=!'-]*$/i.test(t) && (t.includes("-") || t.includes(":") || BARE.has(t))) {
      tokens.add(t);
    }
  }
}
const esc = (t) => t.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
const missing = [...tokens].filter((t) => !css.includes("." + esc(t)));
console.log(`\nclasses: ${tokens.size - missing.length}/${tokens.size} compiled`);
if (missing.length) {
  console.log("   not in styles.html (run npm run build:css; ids/option values here are false alarms):");
  console.log("   " + missing.join("  "));
}
