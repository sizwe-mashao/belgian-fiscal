"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage, type Lang } from "./LanguageContext";
import styles from "./Homepage.module.css";

/**
 * Where the one live article lives. This route does not exist yet — create
 * `app/articles/flemish-education-line/page.tsx` (or change this constant) or
 * the featured card will 404.
 */
const FEATURED_HREF = "/articles/flemish-education-line";

type ArticleStatus = "live" | "soon";

type Article = {
  id: string;
  status: ArticleStatus;
  tone: "gold" | "rust" | "blue";
  tag: Record<Lang, string>;
  title: Record<Lang, string>;
  standfirst: Record<Lang, string>;
  href?: string;
};

// Only `status: "live"` articles are clickable. Adding the next article is a
// matter of flipping its status and giving it an href — the "All articles" link
// and the card styling both follow from this list.
const ARTICLES: Article[] = [
  {
    id: "flemish-education-line",
    status: "live",
    tone: "gold",
    href: FEATURED_HREF,
    tag: {
      EN: "Education",
      FR: "Éducation",
      NL: "Onderwijs",
      DE: "Bildung",
    },
    title: {
      EN: "Flanders budgets €16.8bn for education. Wallonia has no line at all. Neither is a mistake.",
      FR: "La Flandre budgète 16,8 Mds € pour l'éducation. La Wallonie n'a aucune ligne. Aucune erreur.",
      NL: "Vlaanderen begroot €16,8 mrd voor onderwijs. Wallonië heeft geen enkele lijn. Geen van beide is een fout.",
      DE: "Flandern budgetiert 16,8 Mrd. € für Bildung. Wallonien hat überhaupt keine Zeile. Beides ist kein Fehler.",
    },
    standfirst: {
      EN: "Why community competencies make regional budgets hard to compare.",
      FR: "Pourquoi les compétences communautaires compliquent la comparaison des budgets régionaux.",
      NL: "Waarom gemeenschapsbevoegdheden regionale begrotingen moeilijk vergelijkbaar maken.",
      DE: "Warum Gemeinschaftskompetenzen den Vergleich regionaler Haushalte erschweren.",
    },
  },
  {
    id: "commitment-vs-payment",
    status: "soon",
    tone: "rust",
    tag: {
      EN: "Methodology",
      FR: "Méthodologie",
      NL: "Methode",
      DE: "Methodik",
    },
    title: {
      EN: "Commitment vs payment: Belgium's two-track budgets, explained",
      FR: "Engagement vs paiement : les budgets à deux vitesses de la Belgique, expliqués",
      NL: "Vastlegging vs betaling: de tweesporenbegroting van België uitgelegd",
      DE: "Verpflichtung vs. Zahlung: Belgiens Zweispur-Haushalte erklärt",
    },
    standfirst: {
      EN: "Brussels commits less in 2026 — but pays out more. How to read both columns.",
      FR: "Bruxelles engage moins en 2026 — mais paie davantage. Comment lire les deux colonnes.",
      NL: "Brussel legt in 2026 minder vast — maar betaalt meer uit. Zo leest u beide kolommen.",
      DE: "Brüssel verpflichtet 2026 weniger — zahlt aber mehr aus. So lesen Sie beide Spalten.",
    },
  },
  {
    id: "per-capita-map",
    status: "soon",
    tone: "blue",
    tag: {
      EN: "Per resident",
      FR: "Par habitant",
      NL: "Per inwoner",
      DE: "Pro Einwohner",
    },
    title: {
      EN: "What does your region spend on you? Per-resident budgets, mapped",
      FR: "Combien votre région dépense-t-elle pour vous ? Les budgets par habitant, cartographiés",
      NL: "Wat geeft uw gewest aan u uit? Budgetten per inwoner, in kaart gebracht",
      DE: "Was gibt Ihre Region für Sie aus? Pro-Kopf-Budgets auf der Karte",
    },
    standfirst: {
      EN: "In preparation.",
      FR: "En préparation.",
      NL: "In voorbereiding.",
      DE: "In Vorbereitung.",
    },
  },
];

const UI = {
  badge: {
    EN: "INDEPENDENT · EST. 2026",
    FR: "INDÉPENDANT · FONDÉ EN 2026",
    NL: "ONAFHANKELIJK · OPGERICHT IN 2026",
    DE: "UNABHÄNGIG · GEGRÜNDET 2026",
  },
  heroLead: {
    EN: "Belgium's public money, drawn in",
    FR: "L'argent public belge, dessiné en",
    NL: "Belgisch overheidsgeld, getekend in",
    DE: "Belgiens öffentliche Gelder, dargestellt in",
  },
  heroEmphasis: {
    EN: "clear lines.",
    FR: "lignes claires.",
    NL: "klare lijnen.",
    DE: "klaren Linien.",
  },
  heroBody: {
    EN: "flows through Belgium's three regional governments in 2026. We track where it goes, question how it is spent, and put the data in your hands — free, open, and in every national language.",
    FR: "transitent par les trois gouvernements régionaux belges en 2026. Nous suivons cet argent, questionnons son usage, et mettons les données entre vos mains — gratuit, ouvert, dans chaque langue nationale.",
    NL: "stroomt in 2026 door de drie Belgische gewesten. Wij volgen waar het geld heen gaat, bevragen hoe het wordt besteed, en leggen de data in uw handen — gratis, open, in elke landstaal.",
    DE: "fließen 2026 durch die drei belgischen Regionen. Wir verfolgen, wohin das Geld geht, hinterfragen seine Verwendung und legen die Daten in Ihre Hände — kostenlos, offen, in jeder Landessprache.",
  },
  ctaPrimary: {
    EN: "Explore the data",
    FR: "Explorer les données",
    NL: "Verken de data",
    DE: "Daten erkunden",
  },
  ctaSecondary: {
    EN: "Read the analysis",
    FR: "Lire l'analyse",
    NL: "Lees de analyse",
    DE: "Analyse lesen",
  },
  howItWorks: {
    EN: "HOW IT WORKS",
    FR: "COMMENT ÇA MARCHE",
    NL: "HOE HET WERKT",
    DE: "WIE ES FUNKTIONIERT",
  },
  step1Title: {
    EN: "The article",
    FR: "L'article",
    NL: "Het artikel",
    DE: "Der Artikel",
  },
  step1Body: {
    EN: "Analysis that connects budget lines to daily life — written for citizens, not accountants.",
    FR: "Des analyses qui relient les lignes budgétaires à la vie quotidienne — écrites pour les citoyens, pas pour les comptables.",
    NL: "Analyses die begrotingslijnen koppelen aan het dagelijks leven — geschreven voor burgers, niet voor boekhouders.",
    DE: "Analysen, die Haushaltsposten mit dem Alltag verknüpfen — geschrieben für Bürger, nicht für Buchhalter.",
  },
  step2Title: {
    EN: "The dashboard",
    FR: "Le tableau de bord",
    NL: "Het dashboard",
    DE: "Das Dashboard",
  },
  step2Body: {
    EN: "Federal and regional spending, side by side, updated from official budget releases.",
    FR: "Dépenses fédérales et régionales, côte à côte, mises à jour selon les publications budgétaires officielles.",
    NL: "Federale en regionale uitgaven, naast elkaar, bijgewerkt op basis van officiële begrotingspublicaties.",
    DE: "Bundes- und Regionalausgaben nebeneinander, aktualisiert anhand offizieller Haushaltsveröffentlichungen.",
  },
  step3Title: {
    EN: "The dataset",
    FR: "Le jeu de données",
    NL: "De dataset",
    DE: "Der Datensatz",
  },
  step3Body: {
    EN: "Downloadable tables and methodology notes so you can verify every claim we make.",
    FR: "Tableaux téléchargeables et notes méthodologiques pour vérifier chacune de nos affirmations.",
    NL: "Downloadbare tabellen en methodenota's zodat u elke bewering kunt controleren.",
    DE: "Herunterladbare Tabellen und Methodikhinweise, damit Sie jede Aussage überprüfen können.",
  },
  latest: {
    EN: "Latest analysis",
    FR: "Dernières analyses",
    NL: "Laatste analyses",
    DE: "Neueste Analysen",
  },
  allArticles: {
    EN: "All articles →",
    FR: "Tous les articles →",
    NL: "Alle artikels →",
    DE: "Alle Artikel →",
  },
  comingSoon: {
    EN: "Coming soon",
    FR: "Bientôt disponible",
    NL: "Binnenkort",
    DE: "Demnächst",
  },
  footerData: {
    EN: "Data: official 2025–2026 expenditure budgets (Flanders · Wallonia · Brussels-Capital · federal)",
    FR: "Données : budgets de dépenses officiels 2025-2026 (Flandre · Wallonie · Bruxelles-Capitale · fédéral)",
    NL: "Data: officiële uitgavenbegrotingen 2025-2026 (Vlaanderen · Wallonië · Brussels Hoofdstedelijk Gewest · federaal)",
    DE: "Daten: offizielle Ausgabenhaushalte 2025-2026 (Flandern · Wallonien · Region Brüssel-Hauptstadt · Bund)",
  },
  footerLinks: {
    EN: "Methodology · Contact",
    FR: "Méthodologie · Contact",
    NL: "Methode · Contact",
    DE: "Methodik · Kontakt",
  },
} as const;

type UiKey = keyof typeof UI;

function t(key: UiKey, lang: Lang): string {
  return UI[key][lang];
}

const TAGS: Record<Lang, string[]> = {
  EN: [
    "Flanders budget 2026",
    "Brussels mobility",
    "Wallonia health & social",
    "Spending per resident",
  ],
  FR: [
    "Budget Flandre 2026",
    "Mobilité Bruxelles",
    "Wallonie santé et social",
    "Dépenses par habitant",
  ],
  NL: [
    "Vlaamse begroting 2026",
    "Mobiliteit Brussel",
    "Wallonië zorg en welzijn",
    "Uitgaven per inwoner",
  ],
  DE: [
    "Haushalt Flandern 2026",
    "Mobilität Brüssel",
    "Wallonien Gesundheit & Soziales",
    "Ausgaben pro Einwohner",
  ],
};

const REGIONAL_IDS = ["flanders", "wallonia", "brussels"];

type ApiResult = {
  region_id: string;
  total_amount_eur_000: number;
};

/**
 * The hero figure is read from the API rather than hardcoded, so it cannot go
 * stale against the seeded data. Falls back to null on failure — the sentence
 * still reads, just without the number highlighted.
 */
function useRegionalTotal(): number | null {
  const [totalEur000, setTotalEur000] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          "/api/expenditure?region=all&year=2026&basis=commitment"
        );
        if (!res.ok) return;
        const data = await res.json();
        const results: ApiResult[] = Array.isArray(data.results)
          ? data.results
          : [];
        // Federal is excluded: the hero sentence is about the three regions.
        const sum = results
          .filter((r) => REGIONAL_IDS.includes(r.region_id))
          .reduce((acc, r) => acc + r.total_amount_eur_000, 0);
        if (!cancelled && sum > 0) setTotalEur000(sum);
      } catch {
        // Leave the figure unset; the hero copy degrades gracefully.
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return totalEur000;
}

// Belgium writes decimals with a comma in FR/NL/DE and puts the € after the
// amount; English keeps the symbol in front.
function formatHeroAmount(eur000: number, lang: Lang): string {
  const billions = (eur000 / 1e6).toFixed(1);
  if (lang === "EN") return `€${billions} billion`;
  const local = billions.replace(".", ",");
  if (lang === "FR") return `${local} milliards €`;
  if (lang === "NL") return `${local} miljard €`;
  return `${local} Milliarden €`;
}

export default function Homepage() {
  const { lang } = useLanguage();
  const totalEur000 = useRegionalTotal();

  const liveArticles = useMemo(
    () => ARTICLES.filter((a) => a.status === "live"),
    []
  );

  const heroAmount =
    totalEur000 != null ? formatHeroAmount(totalEur000, lang) : null;

  const featured = liveArticles[0];

  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        <section className={styles.hero}>
          <p className={styles.badge}>
            <span className={styles.badgeDot} aria-hidden />
            {t("badge", lang)}
          </p>

          <h1 className={styles.heroTitle}>
            {t("heroLead", lang)}{" "}
            <em className={styles.heroEmphasis}>{t("heroEmphasis", lang)}</em>
          </h1>

          <p className={styles.heroBody}>
            {heroAmount && (
              <span className={styles.heroAmount}>{heroAmount} </span>
            )}
            {t("heroBody", lang)}
          </p>

          <div className={styles.ctaRow}>
            <Link className={styles.ctaPrimary} href="/dashboard">
              {t("ctaPrimary", lang)}
            </Link>
            {featured?.href && (
              <Link className={styles.ctaSecondary} href={featured.href}>
                {t("ctaSecondary", lang)}
              </Link>
            )}
          </div>

          <ul className={styles.tagRow}>
            {TAGS[lang].map((tag) => (
              <li key={tag} className={styles.tag}>
                {tag}
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.divider} aria-hidden />

        <section className={styles.how}>
          <p className={styles.eyebrow}>{t("howItWorks", lang)}</p>
          {/* Numbered because these are a sequence: the article points at the
              dashboard, which is built from the dataset. */}
          <ol className={styles.steps}>
            <li className={styles.step}>
              <span className={`${styles.stepNumber} ${styles.gold}`}>01</span>
              <h2 className={styles.stepTitle}>{t("step1Title", lang)}</h2>
              <p className={styles.stepBody}>{t("step1Body", lang)}</p>
            </li>
            <li className={styles.step}>
              <span className={`${styles.stepNumber} ${styles.rust}`}>02</span>
              <h2 className={styles.stepTitle}>{t("step2Title", lang)}</h2>
              <p className={styles.stepBody}>{t("step2Body", lang)}</p>
            </li>
            <li className={styles.step}>
              <span className={`${styles.stepNumber} ${styles.blue}`}>03</span>
              <h2 className={styles.stepTitle}>{t("step3Title", lang)}</h2>
              <p className={styles.stepBody}>{t("step3Body", lang)}</p>
            </li>
          </ol>
        </section>

        <div className={styles.divider} aria-hidden />

        <section className={styles.latest}>
          <div className={styles.latestHead}>
            <h2 className={styles.latestTitle}>{t("latest", lang)}</h2>
            {/* Hidden while there is only one article — an index page of one
                is not worth a link. */}
            {liveArticles.length > 1 && (
              <Link className={styles.allArticles} href="/articles">
                {t("allArticles", lang)}
              </Link>
            )}
          </div>

          <ul className={styles.cardGrid}>
            {ARTICLES.map((article) => {
              const toneClass =
                article.tone === "gold"
                  ? styles.tagGold
                  : article.tone === "rust"
                    ? styles.tagRust
                    : styles.tagBlue;

              if (article.status === "live" && article.href) {
                return (
                  <li key={article.id}>
                    <Link className={styles.card} href={article.href}>
                      <span className={`${styles.cardTag} ${toneClass}`}>
                        {article.tag[lang]}
                      </span>
                      <h3 className={styles.cardTitle}>
                        {article.title[lang]}
                      </h3>
                      <p className={styles.cardStandfirst}>
                        {article.standfirst[lang]}
                      </p>
                    </Link>
                  </li>
                );
              }

              return (
                <li key={article.id}>
                  {/* Not a link and not focusable: there is nothing to open
                      yet, so it should not appear in the tab order. */}
                  <div className={styles.cardDisabled} aria-disabled="true">
                    <span className={`${styles.cardTag} ${styles.tagMuted}`}>
                      {t("comingSoon", lang)}
                    </span>
                    <h3 className={styles.cardTitle}>{article.title[lang]}</h3>
                    <p className={styles.cardStandfirst}>
                      {article.standfirst[lang]}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <div className={styles.divider} aria-hidden />

        <footer className={styles.footer}>
          <p className={styles.footerText}>{t("footerData", lang)}</p>
          <p className={styles.footerText}>{t("footerLinks", lang)}</p>
        </footer>
      </div>
    </div>
  );
}
