# Docs + tracker when a block ships

## Impl repo — `AGENTS.md`

1. **Component map** (§5 structure block): a 4–6 line entry for the new `components/<name>.jsx`, in the style of its neighbours.
2. **"Block views implemented:"** list — append the model name.
3. **Field contract** paragraph, inserted before `**Still placeholder:**`: model + ZUID, variant(s) + ZUID, every field with its type, decisions (merges, dropped fields, flattened repeaters), deviations from the design (contrast swaps), anything unverified.
4. If a run taught a repo-wide fact (an API quirk, a helper moving), fix the relevant section too — and the matching file in this skill.

## Design repo — `../KROC-draft`

- `informational-pages-block-tickets.md` — under the block's `### Block:` entry: final **Fields:** line and a `**✅ Built <date>**` paragraph (model/variant ZUIDs, what changed from the ticket and why). A block that became a variant of another model says so; one that won't be built gets `❌ DO NOT CREATE (closed <date>)` with the reason.
- `informational-pages-block-tickets.csv` — same row (`Task` = "Block: <Name>"), Notes column; edit with Python `csv`, then check every row still has 8 columns.
- `informational-pages-blocks.md` — the catalog table row (strike through a merged slug: `~~**[old]**~~ → **[new]**`).
- Merge decisions that dissolve an open platform question also amend `KROC prototype/uploads/architecture-proposal-v5.md` (precedent: the §793 amendment).

## Superhuman tracker

- Row IDs: `KROC-draft/superhuman/block-ticket-ids.csv` (`ID,rowId,Task,slug,page`).
- Read: `cd ../KROC-draft/superhuman && ./shdocs.py get <ID>`.
- Write: a bulk CSV `row,column,value` (columns `Notes`, `Solution/Action Taken`), dry-run, then run — writes are async (202) and the tool polls until `landed`:
  ```bash
  ./shdocs.py bulk out/<ID>-built.csv --dry-run
  ./shdocs.py bulk out/<ID>-built.csv
  ```
  Build the CSV with Python `csv` (multi-line values, quotes).
- **Status (`Progress Status`) is the user's call** — valid values: Queued / Received / In Progress / QA / Completed / Blocked (no "not needed"). Don't change it unless asked.
- The `.env` token there is unscoped — never print it or put it in a commit.
