// Traction Rec memberships for [membership_tiers] and [day_pass_passes].
// Loaded after catalogdata.jsx (krocTrInline, krocTrRows, krocTrText) and before
// membershiptiers.jsx / daypasspasses.jsx.
//
// Source: /tractionrec/membership_types.json, published by kroc-tractionrec-sync
// (files only — memberships have no Zesty model or items, Japheth 2026-10-08).
// Only types sold online are in it: the type AND its category must be
// available online and for purchase. Each row is the Salesforce
// TREX1__Membership_Type__c record plus `prices`: its Price Levels, each with
// its Planned Billing Schedules.
//
// A block row points at a type by `tractionrec_id`. When it does, Traction Rec
// supplies the price, period and ages and the row's typed values are ignored;
// the typed name, if any, overrides the name (it is wording, not data, so a
// stale one cannot show a wrong price). A row with no id renders as typed.
//
// Where the price is depends on the kind (verified on all 24 types 2026-10-08):
//
//   Autopay            schedule Term Type "Monthly", its Amount ($46) — the
//                      level's total ($552) is a year's worth
//   Annual / 1 Month   schedule Term Type "One Time", its Amount
//   Day Pass           no schedule, the level's total is $0: the price is the
//                      level's Initial Fee ($15)
//
// On the first two the level's Initial Fee is the one-time registration fee
// ($20), so it is never the price there.

// Purchase links (Japheth 2026-10-08): never a block's own link field
// (cta_link, primary_cta_url, cta_url are not read). The link belongs to
// Traction Rec, like the catalog's Register (the class's Deep_Link_URL__c), but
// no membership has one yet: the class link is an org-made formula with no
// membership counterpart, and the portal address it is built from is not
// readable by the integration user. Meanwhile every purchase button uses the
// site-wide Globals -> Membership Purchase URL the block view passes in. When
// the org adds a link field: sync it and return `row`'s here first.
const krocTrMembershipPurchaseUrl = (row, interimUrl) => krocExternalUrl(krocTrText(interimUrl));

// The one-time registration fee across the cards a block shows: "$20", or
// "$20–$55" if they differ, "" when Traction Rec gives none.
const krocTrFeeText = (fees) => {
  const amounts = [...new Set(fees.map(Number).filter((n) => n > 0))].sort((a, b) => a - b);
  if (!amounts.length) {
    return "";
  }
  const low = krocMoney(amounts[0]);
  return amounts.length === 1 ? low : low + "\u2013" + krocMoney(amounts[amounts.length - 1]);
};

// Editor copy with the fee left to Traction Rec: "{fee}" becomes krocTrFeeText.
// With no fee to show, the sentence holding the placeholder is dropped rather
// than printed with a hole in it.
const KROC_TR_FEE_TOKEN = "{fee}";
const krocTrFillFee = (text, fee) => {
  const copy = krocTrText(text);
  if (copy.indexOf(KROC_TR_FEE_TOKEN) < 0) {
    return copy;
  }
  if (fee) {
    return copy.split(KROC_TR_FEE_TOKEN).join(fee);
  }
  return copy
    .split("\n")
    .map((line) =>
      line
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => sentence.indexOf(KROC_TR_FEE_TOKEN) < 0)
        .join(" ")
    )
    .join("\n")
    .trim();
};

// The block view inlines the whole tier file (about 58 KB) next to the mount.
// A missing file (an instance without the sync) includes as nothing, so every
// row falls back to its typed values.
const krocTrMembershipIndex = (inlineId) => {
  const index = {};
  for (const row of krocTrRows(krocTrInline(inlineId))) {
    index[row.Id] = row;
  }
  return index;
};

const KROC_TR_TERM_UNITS = {
  daily: ["day", "days", "/day"],
  weekly: ["week", "weeks", "/wk"],
  monthly: ["month", "months", "/mo"]
};

// "1 Monthly" -> "/mo", "12 Monthly" -> "/yr", "3 Monthly" -> " for 3 months"
// (the leading space: the card prints the period straight after the price).
const krocTrTermPeriod = (row) => {
  const unit = KROC_TR_TERM_UNITS[krocTrText(row.TREX1__Term_Type__c).toLowerCase()];
  const length = Number(row.TREX1__Term_Length__c);
  if (!unit || !(length > 0)) {
    return "";
  }
  if (length === 1) {
    return unit[2];
  }
  if (length === 12 && unit[0] === "month") {
    return "/yr";
  }
  return " for " + length + " " + unit[1];
};

// { amount, period, fee } or null when Traction Rec has no price for the type.
// None of the online types has a Member / Non-Member split (Price Type is empty
// on all 24), so the first level is the price.
const krocTrMembershipPrice = (row) => {
  const level = krocTrRows(row && row.prices)[0];
  if (!level) {
    return null;
  }
  const schedules = krocTrRows(level.schedules);
  const recurring = schedules.find((s) => s.termType && s.termType !== "One Time");
  if (recurring) {
    const unit = KROC_TR_TERM_UNITS[krocTrText(recurring.termType).toLowerCase()];
    return { amount: recurring.amount, period: unit ? unit[2] : "", fee: level.initialFee };
  }
  const once = schedules.find((s) => s.termType === "One Time");
  if (once) {
    return { amount: once.amount, period: krocTrTermPeriod(row), fee: level.initialFee };
  }
  const amount =
    level.initialFee !== null && level.initialFee !== undefined ? level.initialFee : level.amount;
  return { amount: amount, period: krocTrTermPeriod(row), fee: null };
};

// 110 is Traction Rec's "no upper limit" (Senior 62-110, Adult 18-110). The
// dash is wrapped in word joiners so "(0–17)" never breaks across lines.
const KROC_TR_AGE_DASH = "\u2060\u2013\u2060";
const krocTrAgeSpan = (min, max) => {
  const has = (v) => v !== null && v !== undefined && v !== "";
  const hasMax = has(max) && Number(max) < 100;
  if (has(min) && hasMax) {
    return min + KROC_TR_AGE_DASH + max;
  }
  if (has(min)) {
    return min + "+";
  }
  return hasMax ? "0" + KROC_TR_AGE_DASH + max : "";
};

// Individual: "Ages 18–61" / "Ages 62+". Family: the household rules,
// "Up to 2 adults (18+) · up to 4 youth (0–17)".
const krocTrMembershipAges = (row) => {
  if (row.TREX1__Is_Group__c) {
    const groups = [1, 2, 3]
      .map((n) => {
        const name = krocTrText(row["TREX1__Group_" + n + "_Name__c"]);
        const allowed = Number(row["TREX1__Group_" + n + "_Max_Allowed__c"]);
        if (!name || !(allowed > 0)) {
          return "";
        }
        const noun =
          allowed === 1 ? name : krocTrText(row["TREX1__Group_" + n + "_Plural_Name__c"]) || name;
        const span = krocTrAgeSpan(
          row["TREX1__Group_" + n + "_Min_Age__c"],
          row["TREX1__Group_" + n + "_Max_Age__c"]
        );
        return "up to " + allowed + " " + noun.toLowerCase() + (span ? " (" + span + ")" : "");
      })
      .filter(Boolean)
      .join(" · ");
    if (groups) {
      return groups.charAt(0).toUpperCase() + groups.slice(1);
    }
  }
  const span = krocTrAgeSpan(row.TREX1__Min_Age__c, row.TREX1__Max_Age__c);
  return span ? "Ages " + span : "";
};

// The card name from Traction Rec's: drop the payment plan, then a trailing
// "Membership" — "Adult Membership - Autopay" -> "Adult", "Up to 6 Membership -
// Annual" -> "Up to 6". The age label is NOT used: "Summer Teen Membership
// 2026" carries "Teen", which would read as the regular Teen membership.
const KROC_TR_PLAN_SUFFIX = /\s*[-–]\s*(autopay|annual|\d+\s*months?)\s*$/i;
const krocTrMembershipName = (row) =>
  krocTrText(row && row.Name)
    .replace(KROC_TR_PLAN_SUFFIX, "")
    .replace(/\s+membership$/i, "")
    .replace(/\s*\+\s*/g, " + ");
