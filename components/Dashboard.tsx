"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Tooltip,
  type Plugin,
} from "chart.js";
import { geoMercator, geoPath } from "d3-geo";
import { feature, merge } from "topojson-client";
import type {
  Topology,
  GeometryCollection,
  GeometryObject,
} from "topojson-specification";
import styles from "./Dashboard.module.css";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

export type RegionId = "flanders" | "wallonia" | "brussels";
type ApiRegion = RegionId | "federal";
type Basis = "commitment" | "payment";
type Metric = "total" | "perCapita";
type Tier = "regional" | "federal";
type Lang = "EN" | "FR" | "NL" | "DE";

type RegionNames = { EN: string; FR: string; NL: string; DE: string };

type Department = {
  department_id: string;
  name_en: string;
  amount_eur_000: number;
  incomplete: boolean;
};

type ExpenditureResult = {
  region_id: string;
  region_names: RegionNames;
  heraldic_color: string;
  population: number | null;
  population_source: string;
  total_amount_eur_000: number;
  per_capita_eur: number | null;
  by_department: Department[];
};

type RegionCardData = {
  id: RegionId;
  names: RegionNames;
  heraldicColor: string;
  totalEur000: number;
  perCapitaEur: number | null;
  pctChange: number | null;
  departments: Department[];
  // Previous year, kept so the chart can draw a paired bar. Populations are
  // held per year: per-resident divides each year by its own headcount, so
  // real population growth is visible rather than flattened away.
  departmentsPrev: Department[];
  population: number | null;
  populationPrev: number | null;
};

type FederalData = {
  names: RegionNames;
  heraldicColor: string;
  totalEur000: number;
  prevTotalEur000: number;
  pctChange: number | null;
  perCapitaEur: number | null;
  populationSource: string;
  departments: Department[];
  departmentsPrev: Department[];
  population: number | null;
  populationPrev: number | null;
};

type ChartRow = {
  id: string;
  name: string;
  incomplete: boolean;
  current: number | null;
  previous: number | null;
};

type MapPath = {
  id: RegionId;
  d: string;
};

type BelTopology = Topology<{ bel: GeometryCollection }>;

const REGIONS: RegionId[] = ["flanders", "wallonia", "brussels"];
const LANGS: Lang[] = ["EN", "FR", "NL", "DE"];
const TOPO_URL =
  "https://cdn.jsdelivr.net/npm/datamaps@0.5.10/src/js/data/bel.topo.json";
const MAP_WIDTH = 360;
const MAP_HEIGHT = 240;

// The brand mark itself is bilingual by design and is not translated.
const BRAND = "Klare Lijn · Ligne Claire";

const UI = {
  dashLabel: {
    EN: "/ Dashboard",
    FR: "/ Tableau de bord",
    NL: "/ Dashboard",
    DE: "/ Dashboard",
  },
  subcaption: {
    EN: "2026 budgets · change shown vs 2025 · EUR",
    FR: "Budgets 2026 · variation par rapport à 2025 · EUR",
    NL: "Begroting 2026 · wijziging t.o.v. 2025 · EUR",
    DE: "Haushalt 2026 · Veränderung gegenüber 2025 · EUR",
  },
  vs2025: {
    EN: "vs 2025",
    FR: "vs 2025",
    NL: "t.o.v. 2025",
    DE: "ggü. 2025",
  },
  footer: {
    EN: "Regional figures: official 2025–2026 expenditure budgets, commitment and payment bases · Federal figures: payment basis only",
    FR: "Chiffres régionaux : budgets de dépenses officiels 2025-2026, bases engagement et paiement · Chiffres fédéraux : base paiement uniquement",
    NL: "Regionale cijfers: officiële uitgavenbegrotingen 2025-2026, op basis van vastlegging en betaling · Federale cijfers: enkel betalingsbasis",
    DE: "Regionale Zahlen: offizielle Ausgabenhaushalte 2025-2026, Verpflichtungs- und Zahlungsbasis · Bundeszahlen: nur Zahlungsbasis",
  },
  fedExpenditure2025: {
    EN: "Federal expenditure 2025",
    FR: "Dépenses fédérales 2025",
    NL: "Federale uitgaven 2025",
    DE: "Bundesausgaben 2025",
  },
  fedExpenditure2026: {
    EN: "Federal expenditure 2026",
    FR: "Dépenses fédérales 2026",
    NL: "Federale uitgaven 2026",
    DE: "Bundesausgaben 2026",
  },
  perResident2026: {
    EN: "Per resident 2026",
    FR: "Par habitant 2026",
    NL: "Per inwoner 2026",
    DE: "Pro Einwohner 2026",
  },
  paymentBasisOnly: {
    EN: "payment basis only",
    FR: "base paiement uniquement",
    NL: "enkel betalingsbasis",
    DE: "nur Zahlungsbasis",
  },
  regional: {
    EN: "Regional",
    FR: "Régional",
    NL: "Gewestelijk",
    DE: "Regional",
  },
  federal: {
    EN: "Federal",
    FR: "Fédéral",
    NL: "Federaal",
    DE: "Föderal",
  },
  commitment: {
    EN: "Commitment",
    FR: "Engagement",
    NL: "Vastlegging",
    DE: "Verpflichtung",
  },
  payment: {
    EN: "Payment",
    FR: "Paiement",
    NL: "Betaling",
    DE: "Zahlung",
  },
  loading: {
    EN: "Loading…",
    FR: "Chargement…",
    NL: "Laden…",
    DE: "Laden…",
  },
  loadingMap: {
    EN: "Loading map…",
    FR: "Chargement de la carte…",
    NL: "Kaart laden…",
    DE: "Karte wird geladen…",
  },
  mapUnavailable: {
    EN: "Map unavailable.",
    FR: "Carte indisponible.",
    NL: "Kaart niet beschikbaar.",
    DE: "Karte nicht verfügbar.",
  },
  mapAria: {
    EN: "Interactive map of Belgian regions",
    FR: "Carte interactive des régions belges",
    NL: "Interactieve kaart van de Belgische gewesten",
    DE: "Interaktive Karte der belgischen Regionen",
  },
  mapListAria: {
    EN: "Region map and list",
    FR: "Carte et liste des régions",
    NL: "Gewestkaart en lijst",
    DE: "Regionenkarte und Liste",
  },
  hint: {
    EN: "Click a region on the map or in the list to update the breakdown below.",
    FR: "Cliquez sur une région sur la carte ou dans la liste pour mettre à jour la répartition ci-dessous.",
    NL: "Klik op een gewest op de kaart of in de lijst om de uitsplitsing hieronder bij te werken.",
    DE: "Klicken Sie auf eine Region auf der Karte oder in der Liste, um die Aufschlüsselung unten zu aktualisieren.",
  },
  chartAria: {
    EN: "Category spending chart",
    FR: "Graphique des dépenses par catégorie",
    NL: "Grafiek van uitgaven per categorie",
    DE: "Diagramm der Ausgaben nach Kategorie",
  },
  topCategories: {
    EN: "top spending categories, 2026",
    FR: "principales catégories de dépenses, 2026",
    NL: "belangrijkste uitgavencategorieën, 2026",
    DE: "wichtigste Ausgabenkategorien, 2026",
  },
  metricTotal: {
    EN: "Total",
    FR: "Total",
    NL: "Totaal",
    DE: "Gesamt",
  },
  metricPerCapita: {
    EN: "Per resident",
    FR: "Par habitant",
    NL: "Per inwoner",
    DE: "Pro Einwohner",
  },
  year2025: {
    EN: "2025",
    FR: "2025",
    NL: "2025",
    DE: "2025",
  },
  previousLevel: {
    EN: "2025 level",
    FR: "niveau 2025",
    NL: "niveau 2025",
    DE: "Niveau 2025",
  },
  year2026: {
    EN: "2026",
    FR: "2026",
    NL: "2026",
    DE: "2026",
  },
  allCategories: {
    EN: "all spending categories, 2026",
    FR: "toutes les catégories de dépenses, 2026",
    NL: "alle uitgavencategorieën, 2026",
    DE: "alle Ausgabenkategorien, 2026",
  },
  partialData: {
    EN: "partial data",
    FR: "données partielles",
    NL: "gedeeltelijke gegevens",
    DE: "Teilangaben",
  },
  partialTitle: {
    EN: "Partial data — some source figures were not numerically reported",
    FR: "Données partielles — certaines figures sources n'ont pas été rapportées numériquement",
    NL: "Gedeeltelijke gegevens — sommige broncijfers werden niet numeriek gerapporteerd",
    DE: "Teilangaben — einige Quellwerte wurden nicht numerisch gemeldet",
  },
  perResident: {
    EN: "per resident",
    FR: "par habitant",
    NL: "per inwoner",
    DE: "pro Einwohner",
  },
  readWithCare: {
    EN: "Read with care:",
    FR: "À lire avec prudence :",
    NL: "Met zorg lezen:",
    DE: "Mit Vorsicht lesen:",
  },
  derivedPopulation: {
    EN: "Population used for per-capita figures is derived (sum of regional populations), not an official federal headcount.",
    FR: "La population utilisée pour les montants par habitant est dérivée (somme des populations régionales), et non un effectif fédéral officiel.",
    NL: "De bevolking voor de per-inwonercijfers is afgeleid (som van de gewestbevolkingen), geen officiële federale telling.",
    DE: "Die für Pro-Kopf-Werte verwendete Bevölkerung ist abgeleitet (Summe der Regionalbevölkerungen), keine offizielle föderale Kopfzahl.",
  },
  loadError: {
    EN: "Failed to load expenditure data",
    FR: "Échec du chargement des données de dépenses",
    NL: "Uitgavengegevens konden niet worden geladen",
    DE: "Ausgabendaten konnten nicht geladen werden",
  },
} as const;

type UiKey = keyof typeof UI;

// Grounded in the `notes` column of the source extract — each sentence below
// corresponds to a specific flag in the data, not general hedging.
const CAVEATS: Record<RegionId, Record<Lang, string>> = {
  flanders: {
    EN: "Education appears only under Flanders because it merged its region and community — Wallonia and Brussels fund education through the communities, outside this dataset. Ministerial cabinets are not quantified: the source gives only an approximate per-cabinet range, not a summable total. And 2026 folded the separate Welzijn, Gezondheids- en woonzorg and Sociale bescherming domains into a single Zorg domain, so care spending cannot be compared code-to-code with 2025.",
    FR: "L'éducation n'apparaît que sous la Flandre, qui a fusionné région et communauté — la Wallonie et Bruxelles financent l'enseignement via les communautés, hors de ce jeu de données. Les cabinets ministériels ne sont pas quantifiés : la source ne donne qu'une fourchette approximative par cabinet, non totalisable. Et en 2026, les domaines distincts Welzijn, Gezondheids- en woonzorg et Sociale bescherming ont été fusionnés en un seul domaine Zorg : les dépenses de soins ne sont donc pas comparables code par code avec 2025.",
    NL: "Onderwijs verschijnt enkel bij Vlaanderen, dat gewest en gemeenschap samenvoegde — Wallonië en Brussel financieren onderwijs via de gemeenschappen, buiten deze dataset. Ministeriële kabinetten zijn niet gekwantificeerd: de bron geeft enkel een benaderende marge per kabinet, geen optelbaar totaal. En in 2026 werden de afzonderlijke domeinen Welzijn, Gezondheids- en woonzorg en Sociale bescherming samengevoegd tot één Zorg-domein, waardoor zorguitgaven niet code-per-code met 2025 te vergelijken zijn.",
    DE: "Bildung erscheint nur bei Flandern, das Region und Gemeinschaft zusammengelegt hat — Wallonien und Brüssel finanzieren Bildung über die Gemeinschaften, außerhalb dieses Datensatzes. Ministerkabinette sind nicht quantifiziert: die Quelle nennt nur eine ungefähre Spanne pro Kabinett, keine summierbare Gesamtzahl. Zudem wurden 2026 die getrennten Bereiche Welzijn, Gezondheids- en woonzorg und Sociale bescherming zu einem einzigen Zorg-Bereich verschmolzen, sodass Pflegeausgaben nicht Code für Code mit 2025 vergleichbar sind.",
  },
  wallonia: {
    EN: "The largest division, DO17, bundles local authorities, social action and health, and runs to roughly 45–48% of the budget. It cannot be split at division level, so cross-region comparisons of local-government spending understate Wallonia. The gap between commitment and payment in the Secretariat-General is the Plan de relance multi-year payment schedule, not an error.",
    FR: "La plus grande division, DO17, regroupe pouvoirs locaux, action sociale et santé, et représente environ 45 à 48 % du budget. Elle n'est pas séparable au niveau des divisions : les comparaisons interrégionales des dépenses en pouvoirs locaux sous-estiment donc la Wallonie. L'écart entre engagement et paiement au Secrétariat général correspond à l'échéancier pluriannuel du Plan de relance, non à une erreur.",
    NL: "De grootste afdeling, DO17, bundelt lokale besturen, sociale actie en gezondheid en beslaat ongeveer 45 tot 48% van de begroting. Ze is niet te splitsen op afdelingsniveau, waardoor interregionale vergelijkingen van uitgaven aan lokale besturen Wallonië onderschatten. Het verschil tussen vastlegging en betaling bij het Secretariaat-generaal is het meerjarige betaalschema van het Plan de relance, geen fout.",
    DE: "Die größte Abteilung, DO17, vereint lokale Behörden, Sozialhilfe und Gesundheit und macht rund 45 bis 48 % des Haushalts aus. Sie lässt sich auf Abteilungsebene nicht aufteilen, weshalb regionsübergreifende Vergleiche der Kommunalausgaben Wallonien unterschätzen. Die Differenz zwischen Verpflichtung und Zahlung im Generalsekretariat ist der mehrjährige Zahlungsplan des Plan de relance, kein Fehler.",
  },
  brussels: {
    EN: "Brussels data is reported at mission level. No ministerial-cabinet line exists anywhere in the Brussels source, unlike Wallonia's DO02 and Flanders' VF-VO — that figure is absent, not zero. Two large missions are blended: Affaires intérieures mixes fire and security with local-government support, and Social–Santé is funded jointly by the three Community Commissions across health and social protection.",
    FR: "Les données bruxelloises sont rapportées au niveau des missions. Aucune ligne « cabinets ministériels » n'existe dans la source bruxelloise, contrairement à la DO02 wallonne et aux VF-VO flamands — ce chiffre est absent, pas nul. Deux grandes missions sont mixtes : Affaires intérieures mêle pompiers et sécurité au soutien aux pouvoirs locaux, et Social – Santé est financée conjointement par les trois Commissions communautaires, à cheval sur la santé et la protection sociale.",
    NL: "Brusselse data wordt op missieniveau gerapporteerd. Er bestaat nergens in de Brusselse bron een lijn voor ministeriële kabinetten, anders dan bij de Waalse DO02 en de Vlaamse VF-VO — dat cijfer ontbreekt, het is geen nul. Twee grote missies zijn gemengd: Affaires intérieures combineert brandweer en veiligheid met steun aan lokale besturen, en Social – Santé wordt samen gefinancierd door de drie Gemeenschapscommissies, over gezondheid en sociale bescherming heen.",
    DE: "Brüsseler Daten werden auf Missionsebene ausgewiesen. In der Brüsseler Quelle existiert nirgends eine Zeile für Ministerkabinette, anders als bei Walloniens DO02 und Flanderns VF-VO — dieser Wert fehlt, er ist nicht null. Zwei große Missionen sind vermischt: Affaires intérieures verbindet Feuerwehr und Sicherheit mit der Unterstützung lokaler Behörden, und Social – Santé wird von den drei Gemeinschaftskommissionen gemeinsam über Gesundheit und Sozialschutz hinweg finanziert.",
  },
};

// The authoritative 17 broad categories, taken from the source extract rather
// than the mockup's 8 illustrative ones. Keyed on the English name the API
// returns as `name_en`; unknown keys fall through to the English string, so a
// new category renders untranslated rather than blank.
const CATEGORY_NAMES: Record<string, Record<Exclude<Lang, "EN">, string>> = {
  "Culture, Youth, Sport & Media": {
    FR: "Culture, jeunesse, sport et médias",
    NL: "Cultuur, jeugd, sport en media",
    DE: "Kultur, Jugend, Sport und Medien",
  },
  Defence: { FR: "Défense", NL: "Defensie", DE: "Verteidigung" },
  "Economy, Employment, Innovation & Research (incl. Agriculture)": {
    FR: "Économie, emploi, innovation et recherche (agriculture incl.)",
    NL: "Economie, werk, innovatie en onderzoek (incl. landbouw)",
    DE: "Wirtschaft, Beschäftigung, Innovation und Forschung (einschl. Landwirtschaft)",
  },
  Education: { FR: "Éducation", NL: "Onderwijs", DE: "Bildung" },
  "Environment, Housing & Energy": {
    FR: "Environnement, logement et énergie",
    NL: "Leefmilieu, huisvesting en energie",
    DE: "Umwelt, Wohnen und Energie",
  },
  "Finance & Budget": {
    FR: "Finances et budget",
    NL: "Financiën en begroting",
    DE: "Finanzen und Haushalt",
  },
  "Foreign Affairs & International": {
    FR: "Affaires étrangères et international",
    NL: "Buitenlandse zaken en internationaal",
    DE: "Auswärtige und internationale Angelegenheiten",
  },
  "General Administration": {
    FR: "Administration générale",
    NL: "Algemeen bestuur",
    DE: "Allgemeine Verwaltung",
  },
  "Government Cabinet(s)": {
    FR: "Cabinets ministériels",
    NL: "Ministeriële kabinetten",
    DE: "Ministerkabinette",
  },
  "Health & Social Welfare/Care": {
    FR: "Santé et action sociale",
    NL: "Gezondheid en welzijn/zorg",
    DE: "Gesundheit und Soziales",
  },
  "Local Governments & Home Affairs": {
    FR: "Pouvoirs locaux et affaires intérieures",
    NL: "Lokale besturen en binnenlandse zaken",
    DE: "Lokale Verwaltung und Inneres",
  },
  "Mobility & Infrastructure": {
    FR: "Mobilité et infrastructures",
    NL: "Mobiliteit en infrastructuur",
    DE: "Mobilität und Infrastruktur",
  },
  "Parliament/Legislature": {
    FR: "Parlement",
    NL: "Parlement",
    DE: "Parlament",
  },
  "Provisions/Other": {
    FR: "Provisions et autres",
    NL: "Provisies en overige",
    DE: "Rückstellungen und Sonstiges",
  },
  "Support Services (personnel/digital/legal)": {
    FR: "Services de support (personnel/numérique/juridique)",
    NL: "Ondersteunende diensten (personeel/digitaal/juridisch)",
    DE: "Unterstützende Dienste (Personal/Digital/Recht)",
  },
  Tourism: { FR: "Tourisme", NL: "Toerisme", DE: "Tourismus" },
  "Unclassified / Not specified": {
    FR: "Non classé / non précisé",
    NL: "Niet geclassificeerd / niet gespecificeerd",
    DE: "Nicht klassifiziert / nicht angegeben",
  },
};

function categoryLabel(nameEn: string, lang: Lang): string {
  if (lang === "EN") return nameEn;
  return CATEGORY_NAMES[nameEn]?.[lang] ?? nameEn;
}

function t(key: UiKey, lang: Lang): string {
  return UI[key][lang];
}

function formatBillions(eur000: number): string {
  return `€${(eur000 / 1e6).toFixed(1)}bn`;
}

function formatPerCapita(value: number, lang: Lang): string {
  // en-BE gives the Belgian thousands separator (€11.700, not €11,700).
  return `€${Math.round(value).toLocaleString("en-BE")} ${t("perResident", lang)}`;
}

// The federal KPI card is already labelled "Per resident 2026", so it shows the
// bare amount without repeating the unit.
function formatPerCapitaValue(value: number): string {
  return `€${Math.round(value).toLocaleString("en-BE")}`;
}

// One bar per category, so rows are compact. Federal shows all 14 categories,
// so its canvas is sized from the row count rather than a fixed height.
function chartHeight(rowCount: number): number {
  return Math.max(320, rowCount * 38);
}

const EMPTY_SPEC: BarChartSpec = {
  labels: [],
  values: [],
  previousValues: [],
  color: "#000000",
  metric: "total",
  previousLabel: "2025",
};

const LABEL_MAX = 30;

function truncateLabel(label: string): string {
  return label.length > LABEL_MAX
    ? `${label.slice(0, LABEL_MAX - 1).trimEnd()}…`
    : label;
}

function formatPctChange(
  pct: number,
  lang: Lang
): { text: string; direction: "up" | "down" | "flat" } {
  const suffix = ` ${t("vs2025", lang)}`;
  if (pct > 0) return { text: `▲ +${pct.toFixed(1)}%${suffix}`, direction: "up" };
  if (pct < 0)
    return {
      text: `▼ ${Math.abs(pct).toFixed(1)}%${suffix}`,
      direction: "down",
    };
  return { text: `0.0%${suffix}`, direction: "flat" };
}

function lightenHex(hex: string, amount = 0.55): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}

function classifyProvince(name: string): RegionId {
  const n = name.toLowerCase();
  if (n.includes("brussels") || n.includes("bruxelles")) return "brussels";
  if (
    n.includes("antwerp") ||
    n.includes("limburg") ||
    n.includes("flemish") ||
    n.includes("vlaams") ||
    n.includes("west flanders") ||
    n.includes("west-vlaanderen") ||
    n.includes("east flanders") ||
    n.includes("oost-vlaanderen") ||
    n.includes("oost vlaanderen")
  ) {
    return "flanders";
  }
  return "wallonia";
}

function localizedName(names: RegionNames, lang: Lang): string {
  return names[lang] || names.EN;
}

function isDerivedPopulation(source: string): boolean {
  const s = source.toLowerCase();
  return s.includes("derived") || s.includes("sum of");
}

async function fetchRegionYear(
  region: ApiRegion,
  year: number,
  basis: Basis
): Promise<ExpenditureResult> {
  const res = await fetch(
    `/api/expenditure?region=${region}&year=${year}&basis=${basis}`
  );
  if (!res.ok) {
    throw new Error(`Failed to load ${region} ${year}`);
  }
  const data = await res.json();
  if (!data.results) {
    throw new Error(`No data for ${region} ${year}`);
  }
  return data.results as ExpenditureResult;
}

async function buildMapPaths(): Promise<MapPath[]> {
  const res = await fetch(TOPO_URL);
  if (!res.ok) {
    throw new Error(`Failed to load map (${res.status})`);
  }

  const topology = (await res.json()) as BelTopology;
  const collection = topology.objects.bel;
  if (!collection?.geometries?.length) {
    throw new Error("Map topology is missing region geometries");
  }

  const byRegion: Record<RegionId, GeometryObject[]> = {
    flanders: [],
    wallonia: [],
    brussels: [],
  };

  for (const geometry of collection.geometries) {
    const props = geometry.properties as { name?: string } | null;
    const name = props?.name ?? "";
    byRegion[classifyProvince(name)].push(geometry);
  }

  for (const id of REGIONS) {
    if (byRegion[id].length === 0) {
      throw new Error(`No map geometries classified as ${id}`);
    }
  }

  const allGeo = feature(topology, collection);
  const projection = geoMercator().fitSize([MAP_WIDTH, MAP_HEIGHT], allGeo);
  const path = geoPath(projection);

  return REGIONS.map((id) => {
    const merged = merge(
      topology,
      byRegion[id] as Parameters<typeof merge>[1]
    );
    const d = path(merged);
    if (!d) {
      throw new Error(`Could not project map path for ${id}`);
    }
    return { id, d };
  });
}

// Total is shown in € billions; per-resident in whole euros. Returns null when
// a population is missing so nothing is drawn instead of a misleading zero.
function metricValue(
  amountEur000: number,
  population: number | null,
  metric: Metric
): number | null {
  if (metric === "total") return amountEur000 / 1e6;
  if (!population) return null;
  return (amountEur000 * 1000) / population;
}

function formatMetric(value: number, metric: Metric): string {
  return metric === "total"
    ? `€${value.toFixed(2)}bn`
    : `€${Math.round(value).toLocaleString("en-BE")}`;
}

function formatAxisTick(value: number, metric: Metric): string {
  return metric === "total"
    ? `€${value}bn`
    : `€${Math.round(value).toLocaleString("en-BE")}`;
}

type BarChartSpec = {
  labels: string[];
  values: (number | null)[];
  previousValues: (number | null)[];
  color: string;
  metric: Metric;
  previousLabel: string;
};

// Draws last year's level as a vertical tick across each bar. The values are
// read through a getter at paint time, because Chart.js only accepts plugins at
// construction while the data behind them changes on every basis/metric switch.
function previousYearMarker(getSpec: () => BarChartSpec): Plugin<"bar"> {
  return {
    id: "previousYearMarker",
    afterDatasetsDraw(chart) {
      const { previousValues } = getSpec();
      const meta = chart.getDatasetMeta(0);
      const xScale = chart.scales.x;
      if (!xScale) return;

      const { ctx } = chart;
      ctx.save();
      ctx.strokeStyle = "#1b1b1e";
      ctx.lineWidth = 2;

      meta.data.forEach((bar, index) => {
        const previous = previousValues[index];
        if (previous == null) return;

        const x = xScale.getPixelForValue(previous);
        // Guard against a marker landing outside the plot area.
        if (x < xScale.left || x > xScale.right) return;

        const thickness =
          (bar as unknown as { height?: number }).height ?? 20;
        const half = thickness / 2 + 3;

        ctx.beginPath();
        ctx.moveTo(x, bar.y - half);
        ctx.lineTo(x, bar.y + half);
        ctx.stroke();
      });

      ctx.restore();
    },
  };
}

function syncBarChart(
  canvas: HTMLCanvasElement,
  chartRef: MutableRefObject<Chart<"bar"> | null>,
  specRef: MutableRefObject<BarChartSpec>,
  spec: BarChartSpec
) {
  // Keep the ref current before any draw: both the marker plugin and the
  // tooltip callbacks read from it rather than from a captured value.
  specRef.current = spec;

  // The canvas is unmounted and remounted whenever its containing block is
  // gated behind a loading flag (basis toggle on the regional side, repeat
  // visits on the federal side). Without this check, chartRef still points at
  // a Chart bound to the old detached canvas, so update() silently paints
  // into a canvas nobody can see and the visible one never gets a chart.
  if (chartRef.current && chartRef.current.canvas !== canvas) {
    chartRef.current.destroy();
    chartRef.current = null;
  }

  // The dataset only holds the current year, so the axis would otherwise scale
  // to 2026 alone and push a marker for any category that shrank off the end.
  const axisMax = Math.max(
    0,
    ...[...spec.values, ...spec.previousValues].filter(
      (v): v is number => v != null
    )
  );

  if (!chartRef.current) {
    chartRef.current = new Chart(canvas, {
      type: "bar",
      data: {
        labels: spec.labels,
        datasets: [
          {
            data: spec.values,
            backgroundColor: spec.color,
            borderWidth: 0,
            borderSkipped: false,
            barThickness: 22,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const current = specRef.current;
                const value =
                  typeof ctx.parsed.x === "number" ? ctx.parsed.x : null;
                return value == null
                  ? "2026: not reported"
                  : `2026: ${formatMetric(value, current.metric)}`;
              },
              // Last year's figure is not in the dataset, so it is surfaced
              // here rather than being readable only as a tick position.
              afterBody: (items) => {
                const current = specRef.current;
                const previous =
                  current.previousValues[items[0]?.dataIndex ?? -1];
                return previous == null
                  ? `${current.previousLabel}: not reported`
                  : `${current.previousLabel}: ${formatMetric(previous, current.metric)}`;
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            suggestedMax: axisMax,
            ticks: {
              callback: (value) =>
                formatAxisTick(Number(value), specRef.current.metric),
            },
            grid: { color: "rgba(0, 0, 0, 0.06)" },
          },
          y: {
            grid: { display: false },
            ticks: {
              autoSkip: false,
              // Real category names run up to 62 characters ("Economy,
              // Employment, Innovation & Research (incl. Agriculture)"), which
              // wraps badly on a horizontal bar axis. data.labels keeps the
              // full string, so tooltips are unaffected — only the axis is cut.
              callback(this: { getLabelForValue: (v: number) => string }, value) {
                return truncateLabel(this.getLabelForValue(Number(value)));
              },
            },
          },
        },
      },
      plugins: [previousYearMarker(() => specRef.current)],
    });
    return;
  }

  const chart = chartRef.current;
  chart.data.labels = spec.labels;
  chart.data.datasets[0].data = spec.values;
  chart.data.datasets[0].backgroundColor = spec.color;
  if (chart.options.scales?.x) {
    chart.options.scales.x.suggestedMax = axisMax;
  }
  chart.update();
}

// Pairs each current-year category with its previous-year counterpart by
// department_id, so a category absent from one year yields a null rather than
// silently shifting the pairing.
function buildChartRows(
  current: Department[],
  previous: Department[],
  population: number | null,
  populationPrev: number | null,
  metric: Metric
): ChartRow[] {
  const prevById = new Map(previous.map((d) => [d.department_id, d]));
  return current.map((dept) => {
    const prev = prevById.get(dept.department_id);
    return {
      id: dept.department_id,
      name: dept.name_en,
      incomplete: dept.incomplete || (prev?.incomplete ?? false),
      current: metricValue(dept.amount_eur_000, population, metric),
      previous: prev
        ? metricValue(prev.amount_eur_000, populationPrev, metric)
        : null,
    };
  });
}

function destroyChart(chartRef: MutableRefObject<Chart<"bar"> | null>) {
  chartRef.current?.destroy();
  chartRef.current = null;
}

export default function Dashboard() {
  const [lang, setLang] = useState<Lang>("EN");
  const [tier, setTier] = useState<Tier>("regional");
  const [basis, setBasis] = useState<Basis>("commitment");
  const [metric, setMetric] = useState<Metric>("total");
  // Mockup opens with Flanders selected rather than an empty breakdown.
  const [selectedRegion, setSelectedRegion] = useState<RegionId | null>(
    "flanders"
  );

  const [cards, setCards] = useState<RegionCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [federal, setFederal] = useState<FederalData | null>(null);
  const [federalLoading, setFederalLoading] = useState(false);
  const [federalError, setFederalError] = useState<string | null>(null);

  const [mapPaths, setMapPaths] = useState<MapPath[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(true);

  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<"bar"> | null>(null);
  const chartSpecRef = useRef<BarChartSpec>(EMPTY_SPEC);
  const federalChartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const federalChartRef = useRef<Chart<"bar"> | null>(null);
  const federalChartSpecRef = useRef<BarChartSpec>(EMPTY_SPEC);

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedRegion) ?? null,
    [cards, selectedRegion]
  );

  const topDepartments = useMemo(
    () => selectedCard?.departments.slice(0, 6) ?? [],
    [selectedCard]
  );

  const incompleteDepartments = useMemo(
    () => topDepartments.filter((dept) => dept.incomplete),
    [topDepartments]
  );

  // Federal is shown in full (14 categories, flat distribution) rather than
  // sliced to six — a top-6 cut hides most of the federal picture.
  const federalTopDepartments = useMemo(
    () => federal?.departments ?? [],
    [federal]
  );

  const federalIncomplete = useMemo(
    () => federalTopDepartments.filter((dept) => dept.incomplete),
    [federalTopDepartments]
  );

  const federalChange = useMemo(
    () =>
      federal?.pctChange != null
        ? formatPctChange(federal.pctChange, lang)
        : null,
    [federal, lang]
  );

  const federalChangeClass =
    federalChange?.direction === "up"
      ? styles.changeUp
      : federalChange?.direction === "down"
        ? styles.changeDown
        : styles.changeFlat;

  const colorById = useMemo(() => {
    const map = new Map<RegionId, string>();
    for (const card of cards) {
      map.set(card.id, card.heraldicColor);
    }
    return map;
  }, [cards]);

  useEffect(() => {
    let cancelled = false;

    async function loadRegional() {
      setLoading(true);
      setError(null);

      try {
        const results = await Promise.all(
          REGIONS.flatMap((region) => [
            fetchRegionYear(region, 2026, basis),
            fetchRegionYear(region, 2025, basis),
          ])
        );

        if (cancelled) return;

        const next: RegionCardData[] = REGIONS.map((id, i) => {
          const current = results[i * 2];
          const previous = results[i * 2 + 1];
          const pctChange =
            previous.total_amount_eur_000 !== 0
              ? ((current.total_amount_eur_000 - previous.total_amount_eur_000) /
                  previous.total_amount_eur_000) *
                100
              : null;

          return {
            id,
            names: current.region_names,
            heraldicColor: current.heraldic_color,
            totalEur000: current.total_amount_eur_000,
            perCapitaEur: current.per_capita_eur,
            pctChange,
            departments: current.by_department ?? [],
            departmentsPrev: previous.by_department ?? [],
            population: current.population,
            populationPrev: previous.population,
          };
        });

        setCards(next);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load expenditure data"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRegional();
    return () => {
      cancelled = true;
    };
  }, [basis]);

  useEffect(() => {
    if (tier !== "federal") return;

    let cancelled = false;

    async function loadFederal() {
      setFederalLoading(true);
      setFederalError(null);

      try {
        // Federal is payment-basis only — every commitment figure in the source
        // extract is "n/q", so the basis toggle is deliberately not offered here.
        const [result, previous] = await Promise.all([
          fetchRegionYear("federal", 2026, "payment"),
          fetchRegionYear("federal", 2025, "payment"),
        ]);
        if (cancelled) return;

        const prevTotal = previous.total_amount_eur_000;
        setFederal({
          names: result.region_names,
          heraldicColor: result.heraldic_color,
          totalEur000: result.total_amount_eur_000,
          prevTotalEur000: prevTotal,
          pctChange:
            prevTotal !== 0
              ? ((result.total_amount_eur_000 - prevTotal) / prevTotal) * 100
              : null,
          perCapitaEur: result.per_capita_eur,
          populationSource: result.population_source,
          departments: result.by_department ?? [],
          departmentsPrev: previous.by_department ?? [],
          population: result.population,
          populationPrev: previous.population,
        });
      } catch (err) {
        if (!cancelled) {
          setFederalError(
            err instanceof Error
              ? err.message
              : "Failed to load expenditure data"
          );
        }
      } finally {
        if (!cancelled) setFederalLoading(false);
      }
    }

    loadFederal();
    return () => {
      cancelled = true;
    };
  }, [tier]);

  useEffect(() => {
    let cancelled = false;

    async function loadMap() {
      setMapLoading(true);
      setMapError(null);
      try {
        const paths = await buildMapPaths();
        if (!cancelled) setMapPaths(paths);
      } catch (err) {
        if (!cancelled) {
          setMapError(
            err instanceof Error ? err.message : "Map unavailable."
          );
        }
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    }

    loadMap();
    return () => {
      cancelled = true;
    };
  }, []);

  const regionalRows = useMemo<ChartRow[]>(
    () =>
      selectedCard
        ? buildChartRows(
            topDepartments,
            selectedCard.departmentsPrev,
            selectedCard.population,
            selectedCard.populationPrev,
            metric
          )
        : [],
    [selectedCard, topDepartments, metric]
  );

  const federalRows = useMemo<ChartRow[]>(
    () =>
      federal
        ? buildChartRows(
            federalTopDepartments,
            federal.departmentsPrev,
            federal.population,
            federal.populationPrev,
            metric
          )
        : [],
    [federal, federalTopDepartments, metric]
  );

  useEffect(() => {
    if (tier !== "regional" || !selectedCard || !chartCanvasRef.current) {
      return;
    }

    syncBarChart(chartCanvasRef.current, chartRef, chartSpecRef, {
      labels: regionalRows.map((row) => {
        const name = categoryLabel(row.name, lang);
        return row.incomplete ? `${name} ⚠` : name;
      }),
      values: regionalRows.map((row) => row.current),
      previousValues: regionalRows.map((row) => row.previous),
      color: selectedCard.heraldicColor,
      metric,
      previousLabel: t("year2025", lang),
    });
  }, [tier, selectedCard, regionalRows, lang, metric]);

  useEffect(() => {
    if (tier !== "federal" || !federal || !federalChartCanvasRef.current) {
      return;
    }

    syncBarChart(
      federalChartCanvasRef.current,
      federalChartRef,
      federalChartSpecRef,
      {
        labels: federalRows.map((row) => {
          const name = categoryLabel(row.name, lang);
          return row.incomplete ? `${name} ⚠` : name;
        }),
        values: federalRows.map((row) => row.current),
        previousValues: federalRows.map((row) => row.previous),
        color: federal.heraldicColor,
        metric,
        previousLabel: t("year2025", lang),
      }
    );
  }, [tier, federal, federalRows, lang, metric]);

  useEffect(() => {
    if (tier !== "regional") {
      destroyChart(chartRef);
    }
    if (tier !== "federal") {
      destroyChart(federalChartRef);
    }
  }, [tier]);

  useEffect(() => {
    return () => {
      destroyChart(chartRef);
      destroyChart(federalChartRef);
    };
  }, []);

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className={styles.appTitle}>
          {BRAND}
          <span className={styles.appTitleSuffix}>{t("dashLabel", lang)}</span>
        </h1>
        <div className={styles.headerControls}>
          <div className={styles.tierSwitcher} role="group" aria-label="Tier">
            <button
              type="button"
              className={`${styles.tierButton}${tier === "regional" ? ` ${styles.tierButtonActive}` : ""}`}
              onClick={() => setTier("regional")}
              aria-pressed={tier === "regional"}
            >
              {t("regional", lang)}
            </button>
            <button
              type="button"
              className={`${styles.tierButton}${tier === "federal" ? ` ${styles.tierButtonActive}` : ""}`}
              onClick={() => setTier("federal")}
              aria-pressed={tier === "federal"}
            >
              {t("federal", lang)}
            </button>
          </div>
          <div
            className={styles.langSwitcher}
            role="group"
            aria-label="Language"
          >
            {LANGS.map((code) => (
              <button
                key={code}
                type="button"
                className={`${styles.langButton}${lang === code ? ` ${styles.langButtonActive}` : ""}`}
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className={styles.regionalDivider} aria-hidden />

      {tier === "regional" && (
        <section className={styles.section}>
          <div className={styles.sectionControls}>
            <p className={styles.subcaption}>{t("subcaption", lang)}</p>
            <div className={styles.basisToggle} role="group" aria-label="Basis">
              <button
                type="button"
                className={`${styles.basisButton}${basis === "commitment" ? ` ${styles.basisButtonActive}` : ""}`}
                onClick={() => setBasis("commitment")}
                aria-pressed={basis === "commitment"}
              >
                {t("commitment", lang)}
              </button>
              <button
                type="button"
                className={`${styles.basisButton}${basis === "payment" ? ` ${styles.basisButtonActive}` : ""}`}
                onClick={() => setBasis("payment")}
                aria-pressed={basis === "payment"}
              >
                {t("payment", lang)}
              </button>
            </div>
          </div>

          {loading && <p className={styles.status}>{t("loading", lang)}</p>}
          {error && <p className={styles.error}>{error}</p>}

          {!loading && !error && (
            <>
              <div className={styles.grid}>
                {cards.map((card) => {
                  const change =
                    card.pctChange != null
                      ? formatPctChange(card.pctChange, lang)
                      : null;
                  const selected = selectedRegion === card.id;
                  const changeClass =
                    change?.direction === "up"
                      ? styles.changeUp
                      : change?.direction === "down"
                        ? styles.changeDown
                        : styles.changeFlat;
                  const name = localizedName(card.names, lang);

                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`${styles.card}${selected ? ` ${styles.cardSelected}` : ""}`}
                      onClick={() => setSelectedRegion(card.id)}
                      aria-pressed={selected}
                    >
                      <div className={styles.cardHeader}>
                        <span
                          className={styles.swatch}
                          style={
                            {
                              "--heraldic": card.heraldicColor,
                            } as CSSProperties
                          }
                          aria-hidden
                        />
                        <span className={styles.regionName}>{name}</span>
                      </div>
                      <p className={styles.total}>
                        {formatBillions(card.totalEur000)}
                      </p>
                      {change && <p className={changeClass}>{change.text}</p>}
                      {card.perCapitaEur != null && (
                        <p className={styles.perCapita}>
                          {formatPerCapita(card.perCapitaEur, lang)}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className={styles.regionalDivider} aria-hidden />

              <section
                className={styles.mapSection}
                aria-label={t("mapListAria", lang)}
              >
                <div className={styles.mapPanel}>
                  {mapLoading && (
                    <p className={styles.status}>{t("loadingMap", lang)}</p>
                  )}
                  {mapError && (
                    <p className={styles.mapFallback}>
                      {t("mapUnavailable", lang)} {mapError}
                    </p>
                  )}
                  {!mapLoading && !mapError && (
                    <svg
                      className={styles.mapSvg}
                      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                      role="img"
                      aria-label={t("mapAria", lang)}
                    >
                      {mapPaths.map((regionPath) => {
                        const card = cards.find((c) => c.id === regionPath.id);
                        const color =
                          colorById.get(regionPath.id) ?? "#9a968c";
                        const selected = selectedRegion === regionPath.id;
                        const fill = selected ? color : lightenHex(color);
                        const label = card
                          ? localizedName(card.names, lang)
                          : regionPath.id;

                        return (
                          <path
                            key={regionPath.id}
                            d={regionPath.d}
                            className={`${styles.mapRegion}${selected ? ` ${styles.mapRegionSelected}` : ""}`}
                            style={{ fill }}
                            onClick={() => setSelectedRegion(regionPath.id)}
                          >
                            <title>{label}</title>
                          </path>
                        );
                      })}
                    </svg>
                  )}
                </div>

                <ul className={styles.regionList}>
                  {cards.map((card) => {
                    const selected = selectedRegion === card.id;
                    const name = localizedName(card.names, lang);
                    return (
                      <li key={card.id}>
                        <button
                          type="button"
                          className={`${styles.regionListItem}${selected ? ` ${styles.regionListItemSelected}` : ""}`}
                          onClick={() => setSelectedRegion(card.id)}
                          aria-pressed={selected}
                        >
                          <span
                            className={styles.swatch}
                            style={
                              {
                                "--heraldic": card.heraldicColor,
                              } as CSSProperties
                            }
                            aria-hidden
                          />
                          <span className={styles.regionListName}>{name}</span>
                          <span className={styles.regionListTotal}>
                            {formatBillions(card.totalEur000)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <p className={styles.hint}>{t("hint", lang)}</p>

              {selectedCard && (
                <>
                  <div className={styles.regionalDivider} aria-hidden />

                  <section
                    className={styles.chartSection}
                    aria-label={t("chartAria", lang)}
                  >
                    <div className={styles.chartHeader}>
                      <h2 className={styles.chartTitle}>
                        {localizedName(selectedCard.names, lang)} —{" "}
                        {t("topCategories", lang)}
                      </h2>
                      <div
                        className={styles.metricToggle}
                        role="group"
                        aria-label="Metric"
                      >
                        <button
                          type="button"
                          className={`${styles.basisButton}${metric === "total" ? ` ${styles.basisButtonActive}` : ""}`}
                          onClick={() => setMetric("total")}
                          aria-pressed={metric === "total"}
                        >
                          {t("metricTotal", lang)}
                        </button>
                        <button
                          type="button"
                          className={`${styles.basisButton}${metric === "perCapita" ? ` ${styles.basisButtonActive}` : ""}`}
                          onClick={() => setMetric("perCapita")}
                          aria-pressed={metric === "perCapita"}
                        >
                          {t("metricPerCapita", lang)}
                        </button>
                      </div>
                    </div>

                    <ul className={styles.chartLegend}>
                      <li>
                        <span
                          className={styles.swatch}
                          style={
                            {
                              "--heraldic": selectedCard.heraldicColor,
                            } as CSSProperties
                          }
                          aria-hidden
                        />
                        {t("year2026", lang)}
                      </li>
                      <li>
                        <span className={styles.legendTick} aria-hidden />
                        {t("previousLevel", lang)}
                      </li>
                    </ul>

                    <div
                      className={styles.chartWrap}
                      style={{ height: chartHeight(regionalRows.length) }}
                    >
                      <canvas ref={chartCanvasRef} />
                    </div>
                    {incompleteDepartments.length > 0 && (
                      <ul className={styles.partialList}>
                        {incompleteDepartments.map((dept) => (
                          <li
                            key={dept.department_id}
                            className={styles.partialItem}
                            title={t("partialTitle", lang)}
                          >
                            <span className={styles.partialBadge} aria-hidden>
                              ⚠
                            </span>
                            <span>{categoryLabel(dept.name_en, lang)}</span>
                            <span className={styles.partialTag}>
                              {t("partialData", lang)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <aside className={styles.caveatBox}>
                    <h3 className={styles.caveatHeading}>
                      {t("readWithCare", lang)}
                    </h3>
                    <p className={styles.caveatBody}>
                      {CAVEATS[selectedCard.id][lang]}
                    </p>
                  </aside>
                </>
              )}
            </>
          )}
        </section>
      )}

      {tier === "federal" && (
        <section className={styles.section}>
          <div className={styles.sectionControls}>
            <p className={styles.subcaption}>
              {t("subcaption", lang)} · {t("paymentBasisOnly", lang)}
            </p>
          </div>

          {federalLoading && (
            <p className={styles.status}>{t("loading", lang)}</p>
          )}
          {federalError && <p className={styles.error}>{federalError}</p>}
          {!federalLoading && !federalError && federal && (
            <div className={styles.federalSection}>
              <div className={styles.grid}>
                <div className={styles.kpiCard}>
                  <div className={styles.cardHeader}>
                    <span
                      className={styles.swatch}
                      style={
                        {
                          "--heraldic": federal.heraldicColor,
                        } as CSSProperties
                      }
                      aria-hidden
                    />
                    <span className={styles.regionName}>
                      {t("fedExpenditure2025", lang)}
                    </span>
                  </div>
                  <p className={styles.total}>
                    {formatBillions(federal.prevTotalEur000)}
                  </p>
                </div>

                <div className={styles.kpiCard}>
                  <div className={styles.cardHeader}>
                    <span
                      className={styles.swatch}
                      style={
                        {
                          "--heraldic": federal.heraldicColor,
                        } as CSSProperties
                      }
                      aria-hidden
                    />
                    <span className={styles.regionName}>
                      {t("fedExpenditure2026", lang)}
                    </span>
                  </div>
                  <p className={styles.total}>
                    {formatBillions(federal.totalEur000)}
                  </p>
                  {federalChange && (
                    <p className={federalChangeClass}>{federalChange.text}</p>
                  )}
                </div>

                <div className={styles.kpiCard}>
                  <div className={styles.cardHeader}>
                    <span className={styles.regionName}>
                      {t("perResident2026", lang)}
                    </span>
                  </div>
                  <p className={styles.total}>
                    {federal.perCapitaEur != null
                      ? formatPerCapitaValue(federal.perCapitaEur)
                      : "—"}
                  </p>
                  {isDerivedPopulation(federal.populationSource) && (
                    <p className={styles.derivedNote}>
                      {t("derivedPopulation", lang)}
                    </p>
                  )}
                </div>
              </div>

              <div className={styles.regionalDividerInset} aria-hidden />

              <section
                className={styles.chartSection}
                aria-label={t("chartAria", lang)}
              >
                <div className={styles.chartHeader}>
                  <h2 className={styles.chartTitle}>
                    {localizedName(federal.names, lang)} —{" "}
                    {t("allCategories", lang)}
                  </h2>
                  <div
                    className={styles.metricToggle}
                    role="group"
                    aria-label="Metric"
                  >
                    <button
                      type="button"
                      className={`${styles.basisButton}${metric === "total" ? ` ${styles.basisButtonActive}` : ""}`}
                      onClick={() => setMetric("total")}
                      aria-pressed={metric === "total"}
                    >
                      {t("metricTotal", lang)}
                    </button>
                    <button
                      type="button"
                      className={`${styles.basisButton}${metric === "perCapita" ? ` ${styles.basisButtonActive}` : ""}`}
                      onClick={() => setMetric("perCapita")}
                      aria-pressed={metric === "perCapita"}
                    >
                      {t("metricPerCapita", lang)}
                    </button>
                  </div>
                </div>

                <ul className={styles.chartLegend}>
                  <li>
                    <span
                      className={styles.swatch}
                      style={
                        {
                          "--heraldic": federal.heraldicColor,
                        } as CSSProperties
                      }
                      aria-hidden
                    />
                    {t("year2026", lang)}
                  </li>
                  <li>
                    <span className={styles.legendTick} aria-hidden />
                    {t("previousLevel", lang)}
                  </li>
                </ul>

                <div
                  className={styles.chartWrap}
                  style={{ height: chartHeight(federalRows.length) }}
                >
                  <canvas ref={federalChartCanvasRef} />
                </div>
                {federalIncomplete.length > 0 && (
                  <ul className={styles.partialList}>
                    {federalIncomplete.map((dept) => (
                      <li
                        key={dept.department_id}
                        className={styles.partialItem}
                        title={t("partialTitle", lang)}
                      >
                        <span className={styles.partialBadge} aria-hidden>
                          ⚠
                        </span>
                        <span>{categoryLabel(dept.name_en, lang)}</span>
                        <span className={styles.partialTag}>
                          {t("partialData", lang)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </section>
      )}

      <div className={styles.regionalDivider} aria-hidden />

      <footer className={styles.footer}>
        <p className={styles.footerText}>{t("footer", lang)}</p>
      </footer>
    </div>
  );
}
