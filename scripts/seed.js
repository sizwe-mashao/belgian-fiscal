/**
 * scripts/seed.js
 *
 * Loads Firestore from the two real source files only:
 *   1. Belgium_Combined_Expenditure_20252026.csv
 *   2. Belgium_Population.csv
 *
 * Run with: npm run seed
 */

const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { spawnSync } = require("child_process");

// slugify lives in lib/slugify.ts — re-exec under Node's TypeScript strip so
// we import the one shared implementation rather than a near-copy that could
// drift on accents, ampersands, parentheses or slashes.
if (!process.execArgv.includes("--experimental-strip-types")) {
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", ...process.argv],
    { stdio: "inherit" }
  );
  process.exit(result.status ?? 1);
}

const { parse } = require("csv-parse/sync");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const EXPENDITURE_CSV = path.join(__dirname, "../data/Belgium_Combined_Expenditure_20252026.csv");
const POPULATION_CSV = path.join(__dirname, "../data/Belgium_Population.csv");

const app = initializeApp();
const db = getFirestore(app);

const REGION_ID = {
  Flanders: "flanders",
  Wallonia: "wallonia",
  Brussels: "brussels",
  Federal: "federal",
};

const REGION_META = {
  flanders: { color: "#D8A118", names: { EN: "Flanders", FR: "Flandre", NL: "Vlaanderen", DE: "Flandern" } },
  wallonia: { color: "#B5442A", names: { EN: "Wallonia", FR: "Wallonie", NL: "Wallonie", DE: "Wallonien" } },
  brussels: { color: "#3B5BA5", names: { EN: "Brussels-Capital", FR: "Bruxelles-Capitale", NL: "Brussels Hoofdstedelijk Gewest", DE: "Region Brussel-Hauptstadt" } },
  federal: { color: "#5f5e58", names: { EN: "Federal", FR: "Federal", NL: "Federaal", DE: "Federal" } },
};

async function readExpenditureRows() {
  const raw = fs.readFileSync(EXPENDITURE_CSV, "utf-8").replace(/^\uFEFF/, "");
  const records = parse(raw, { columns: true, skip_empty_lines: true, cast: (value, ctx) => {
    const numericCols = ["Year", "Commitment (EUR '000)", "Payment (EUR '000)"];
    if (numericCols.includes(ctx.column)) {
      if (value === "") return null;
      const n = Number(value);
      // Some rows use text markers like "n/q — see Notes" for figures that
      // are genuinely not quantified or not applicable (see the Notes
      // column for why). Store these as null, never as raw text, so
      // downstream sums stay numeric and the caveat lives in `notes`.
      return Number.isFinite(n) ? n : null;
    }
    return value === "" ? null : value;
  }});
  return records.filter((r) => r["Region"]);
}

function readPopulationRows() {
  const raw = fs.readFileSync(POPULATION_CSV, "utf-8").replace(/^\uFEFF/, "");
  const records = parse(raw, { columns: true, skip_empty_lines: true });
  return records.map((r) => ({
    region: r.Region,
    year: parseInt(r.Year, 10),
    population: parseInt(r.Population, 10),
  }));
}

async function seedRegions(popRows) {
  const batch = db.batch();
  const regionIds = Object.keys(REGION_META);

  for (const regionId of regionIds) {
    const meta = REGION_META[regionId];
    const populations = {};
    popRows
      .filter((p) => REGION_ID[p.region] === regionId)
      .forEach((p) => { populations[p.year] = p.population; });
    if (regionId === "federal") {
      const years = [...new Set(popRows.map((p) => p.year))];
      years.forEach((y) => {
        const total = popRows.filter((p) => p.year === y).reduce((s, p) => s + p.population, 0);
        populations[y] = total;
      });
    }
    const ref = db.collection("regions").doc(regionId);
    batch.set(ref, {
      id: regionId,
      names: meta.names,
      heraldic_color: meta.color,
      populations,
      population_source: regionId === "federal"
        ? "derived: sum of Flanders + Wallonia + Brussels (Belgium_Population.csv)"
        : "Belgium_Population.csv",
    });
  }
  await batch.commit();
  console.log(`Seeded ${regionIds.length} region docs.`);
}

async function seedDepartments(expRows, slugify) {
  const categories = [...new Set(expRows.map((r) => r["Broad Category"]))].filter(Boolean);
  const batch = db.batch();
  categories.forEach((cat) => {
    const id = slugify(cat);
    batch.set(db.collection("departments").doc(id), {
      id,
      name_en: cat,
      name_fr: null,
      name_nl: null,
      name_de: null,
    });
  });
  await batch.commit();
  console.log(`Seeded ${categories.length} department docs.`);
}

async function seedExpenditure(expRows, slugify) {
  const chunkSize = 450;
  let written = 0;
  for (let i = 0; i < expRows.length; i += chunkSize) {
    const batch = db.batch();
    const chunk = expRows.slice(i, i + chunkSize);
    chunk.forEach((r) => {
      const regionId = REGION_ID[r["Region"]];
      const deptId = slugify(r["Broad Category"]);
      const year = r["Year"];
      const docId = `${regionId}_${year}_${deptId}_${slugify(r["Original Code"] || r["COFOG Division"] || "")}`;
      const ref = db.collection("expenditure").doc(docId);
      batch.set(ref, {
        region_id: regionId,
        department_id: deptId,
        financial_year: year,
        cofog_division: r["COFOG Division"],
        cofog_division_name: r["COFOG Division Name"],
        cofog_basis: r["COFOG Basis"],
        original_code: r["Original Code"],
        original_name_native: r["Original Name (native language)"],
        original_name_en: r["English Translation"],
        commitment_amount_eur_000: r["Commitment (EUR '000)"],
        payment_amount_eur_000: r["Payment (EUR '000)"],
        notes: r["Notes"] || null,
      });
    });
    await batch.commit();
    written += chunk.length;
    console.log(`  ...${written}/${expRows.length} expenditure rows written`);
  }
  console.log(`Seeded ${written} expenditure docs.`);
}

async function main() {
  const { slugify } = await import(
    pathToFileURL(path.join(__dirname, "../lib/slugify.ts")).href
  );

  console.log("Reading source files...");
  const expRows = await readExpenditureRows();
  const popRows = readPopulationRows();
  console.log(`  ${expRows.length} expenditure rows, ${popRows.length} population rows`);

  console.log("Seeding regions...");
  await seedRegions(popRows);

  console.log("Seeding departments...");
  await seedDepartments(expRows, slugify);

  console.log("Seeding expenditure...");
  await seedExpenditure(expRows, slugify);

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});