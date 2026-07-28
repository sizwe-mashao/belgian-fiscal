"use client";

import { useState, type FormEvent } from "react";
import { useLanguage, type Lang } from "@/components/LanguageContext";
import type { AskResponse, AskSuccess, QueryPlan, ResultRow } from "@/lib/explorer/types";
import styles from "./DataExplorer.module.css";

const UI = {
  title: {
    EN: "Data Explorer",
    FR: "Explorateur de données",
    NL: "Dataverkenner",
    DE: "Datenexplorer",
  },
  coverage: {
    EN: "Ask a question about the 2025–2026 expenditure budgets of the three regions and the federal government. Every figure is computed from the dataset, never written by a language model.",
    FR: "Posez une question sur les budgets de dépenses 2025-2026 des trois régions et du fédéral. Chaque chiffre est calculé à partir du jeu de données, jamais rédigé par un modèle de langage.",
    NL: "Stel een vraag over de uitgavenbegrotingen 2025-2026 van de drie gewesten en de federale overheid. Elk cijfer wordt berekend uit de dataset, nooit geschreven door een taalmodel.",
    DE: "Stellen Sie eine Frage zu den Ausgabenhaushalten 2025-2026 der drei Regionen und des Bundes. Jede Zahl wird aus dem Datensatz berechnet, nie von einem Sprachmodell geschrieben.",
  },
  experimental: {
    EN: "This feature is experimental, and questions can only be asked in English for now.",
    FR: "Cette fonctionnalité est expérimentale, et les questions ne peuvent être posées qu'en anglais pour le moment.",
    NL: "Deze functie is experimenteel en vragen kunnen voorlopig alleen in het Engels worden gesteld.",
    DE: "Diese Funktion ist experimentell, und Fragen können vorerst nur auf Englisch gestellt werden.",
  },
  inputLabel: {
    EN: "Your question, in English",
    FR: "Votre question, en anglais",
    NL: "Uw vraag, in het Engels",
    DE: "Ihre Frage, auf Englisch",
  },
  placeholder: {
    EN: "What does Flanders spend on education?",
    FR: "What does Flanders spend on education?",
    NL: "What does Flanders spend on education?",
    DE: "What does Flanders spend on education?",
  },
  ask: { EN: "Ask", FR: "Demander", NL: "Vraag", DE: "Fragen" },
  asking: {
    EN: "Asking…",
    FR: "En cours…",
    NL: "Bezig…",
    DE: "Läuft…",
  },
  examples: {
    EN: "TRY ONE OF THESE",
    FR: "ESSAYEZ CECI",
    NL: "PROBEER DIT",
    DE: "PROBIEREN SIE DIES",
  },
  noNarrative: {
    EN: "Narrative unavailable — the figures below are computed directly from the dataset.",
    FR: "Texte indisponible — les chiffres ci-dessous sont calculés directement à partir du jeu de données.",
    NL: "Tekst niet beschikbaar — de cijfers hieronder zijn rechtstreeks uit de dataset berekend.",
    DE: "Text nicht verfügbar — die Zahlen unten werden direkt aus dem Datensatz berechnet.",
  },
  incomplete: {
    EN: "⚠ Some contributing lines are not quantified in the source, so this is a partial sum.",
    FR: "⚠ Certaines lignes ne sont pas quantifiées dans la source : il s'agit d'une somme partielle.",
    NL: "⚠ Sommige onderliggende lijnen zijn niet gekwantificeerd in de bron; dit is een deelsom.",
    DE: "⚠ Einige zugrunde liegende Zeilen sind in der Quelle nicht quantifiziert; dies ist eine Teilsumme.",
  },
  showPlan: {
    EN: "How I answered this",
    FR: "Comment j'ai répondu",
    NL: "Hoe ik dit beantwoordde",
    DE: "Wie ich das beantwortet habe",
  },
  hidePlan: {
    EN: "Hide",
    FR: "Masquer",
    NL: "Verbergen",
    DE: "Ausblenden",
  },
  networkError: {
    EN: "Network error — please try again.",
    FR: "Erreur réseau — veuillez réessayer.",
    NL: "Netwerkfout — probeer het opnieuw.",
    DE: "Netzwerkfehler — bitte erneut versuchen.",
  },
  planOperation: {
    EN: "operation",
    FR: "opération",
    NL: "bewerking",
    DE: "Operation",
  },
  planEntity: {
    EN: "entity",
    FR: "entité",
    NL: "entiteit",
    DE: "Einheit",
  },
  planCategory: {
    EN: "category",
    FR: "catégorie",
    NL: "categorie",
    DE: "Kategorie",
  },
  planYear: { EN: "year", FR: "année", NL: "jaar", DE: "Jahr" },
  planBasis: { EN: "basis", FR: "base", NL: "basis", DE: "Basis" },
  planMetric: {
    EN: "metric",
    FR: "mesure",
    NL: "maat",
    DE: "Größe",
  },
  wholeBudget: {
    EN: "whole budget",
    FR: "budget total",
    NL: "volledige begroting",
    DE: "Gesamthaushalt",
  },
} as const;

function t(key: keyof typeof UI, lang: Lang): string {
  return UI[key][lang];
}

/**
 * Questions are English-only, so the examples stay in English regardless of the
 * page language. The fourth is deliberately a question the tool will refuse:
 * Wallonia has no education line because it is a community competence, and
 * showing that refusal is the point.
 */
const EXAMPLES = [
  "What does Flanders spend on education?",
  "Compare health spending across the regions",
  "How did Brussels mobility change since 2025?",
  "What does Wallonia spend on education?",
];

function formatEuros(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `€${(value / 1e9).toFixed(1)}bn`;
  if (abs >= 1e6) return `€${(value / 1e6).toFixed(1)}m`;
  return `€${Math.round(value).toLocaleString("en-BE")}`;
}

function formatPerCapita(value: number): string {
  return `€${Math.round(value).toLocaleString("en-BE")}`;
}

/** The figure a row displays depends on which metric was asked for. */
function rowValue(row: ResultRow, plan: QueryPlan): number | null {
  if (plan.metric === "perCapita") return row.per_capita_eur ?? null;
  return row.amount_eur;
}

function formatValue(value: number, plan: QueryPlan): string {
  return plan.metric === "perCapita"
    ? formatPerCapita(value)
    : formatEuros(value);
}

function planSummary(plan: QueryPlan, lang: Lang) {
  return [
    [t("planOperation", lang), plan.operation],
    [t("planEntity", lang), plan.entities.join(", ")],
    [t("planCategory", lang), plan.category ?? t("wholeBudget", lang)],
    [
      t("planYear", lang),
      plan.compareYear ? `${plan.compareYear} → ${plan.year}` : String(plan.year),
    ],
    [t("planBasis", lang), plan.basis],
    [t("planMetric", lang), plan.metric],
  ] as const;
}

export default function DataExplorer() {
  const { lang } = useLanguage();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPlan, setShowPlan] = useState(false);

  async function ask(raw: string) {
    const q = raw.trim();
    if (!q || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setShowPlan(false);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data: AskResponse = await res.json();
      if ("error" in data) setError(data.error);
      else setResult(data);
    } catch {
      setError(t("networkError", lang));
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    ask(question);
  }

  function onPill(example: string) {
    setQuestion(example);
    ask(example);
  }

  const rows = result?.rows ?? [];
  const plan = result?.plan;
  // A single row reads better as one large figure than as a one-bar chart.
  const single = rows.length === 1 && plan ? rows[0] : null;
  const maxValue = plan
    ? Math.max(...rows.map((r) => rowValue(r, plan) ?? 0), 0)
    : 0;

  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        <section className={styles.intro}>
          <h1 className={styles.title}>{t("title", lang)}</h1>
          <p className={styles.coverage}>{t("coverage", lang)}</p>
          <p className={styles.experimental}>{t("experimental", lang)}</p>
        </section>

        <div className={styles.divider} aria-hidden />

        <section className={styles.askSection}>
          <form className={styles.askForm} onSubmit={onSubmit}>
            <label className={styles.srOnly} htmlFor="explorer-question">
              {t("inputLabel", lang)}
            </label>
            <input
              id="explorer-question"
              className={styles.input}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t("placeholder", lang)}
              disabled={loading}
              lang="en"
              autoComplete="off"
            />
            <button
              type="submit"
              className={styles.askButton}
              disabled={loading || !question.trim()}
            >
              {loading ? t("asking", lang) : t("ask", lang)}
            </button>
          </form>

          <p className={styles.examplesLabel}>{t("examples", lang)}</p>
          <ul className={styles.pills}>
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  className={styles.pill}
                  onClick={() => onPill(example)}
                  disabled={loading}
                  lang="en"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {error && (
          <>
            <div className={styles.divider} aria-hidden />
            <div className={styles.errorBlock}>
              <p className={styles.errorText}>{error}</p>
            </div>
          </>
        )}

        {result && plan && (
          <>
            <div className={styles.divider} aria-hidden />
            <div className={styles.results}>
              {result.narrative ? (
                <p className={styles.narrative}>{result.narrative}</p>
              ) : (
                !result.absence && (
                  <p className={styles.narrativeMuted}>
                    {t("noNarrative", lang)}
                  </p>
                )
              )}

              {/* When a plan returns nothing, the explanation IS the answer, so
                  it leads rather than sitting in a footnote. */}
              {result.absence && (
                <div className={styles.absenceBlock}>
                  <p className={styles.absenceText}>{result.absence.reason}</p>
                </div>
              )}

              {single && (
                <div className={styles.singleFigure}>
                  <p className={styles.figureLabel}>{single.label}</p>
                  <p className={styles.figureValue}>
                    {single.share_pct != null
                      ? `${single.share_pct.toFixed(1)}%`
                      : (() => {
                          const v = rowValue(single, plan);
                          return v == null ? "—" : formatValue(v, plan);
                        })()}
                  </p>
                  {single.delta_pct != null &&
                    single.previous_amount_eur != null && (
                      <p className={styles.figureDelta}>
                        {single.delta_pct >= 0 ? "▲ +" : "▼ "}
                        {Math.abs(single.delta_pct).toFixed(1)}%{" "}
                        <span className={styles.figurePrev}>
                          (
                          {formatValue(
                            plan.metric === "perCapita"
                              ? (single.previous_per_capita_eur ?? 0)
                              : single.previous_amount_eur,
                            plan
                          )}{" "}
                          → {plan.compareYear ? `${plan.year}` : ""})
                        </span>
                      </p>
                    )}
                </div>
              )}

              {!single && rows.length > 0 && (
                <ul className={styles.bars}>
                  {rows.map((row) => {
                    const value = rowValue(row, plan);
                    const width =
                      value != null && maxValue > 0
                        ? (value / maxValue) * 100
                        : 0;
                    return (
                      <li className={styles.barRow} key={row.label}>
                        <span className={styles.barLabel} title={row.label}>
                          {row.label}
                          {row.incomplete ? " ⚠" : ""}
                        </span>
                        <span className={styles.barTrack}>
                          <span
                            className={styles.barFill}
                            style={{ width: `${width}%` }}
                          />
                        </span>
                        <span className={styles.barValue}>
                          {value == null ? "—" : formatValue(value, plan)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {result.incomplete && (
                <p className={styles.incompleteNote}>{t("incomplete", lang)}</p>
              )}

              {/* Caveats change what a figure means, so they are never quieter
                  than the figure itself. */}
              {result.caveats.length > 0 && (
                <div className={styles.caveatBlock}>
                  {result.caveats.map((caveat) => (
                    <p className={styles.caveatText} key={caveat}>
                      {caveat}
                    </p>
                  ))}
                </div>
              )}

              <div className={styles.planToggle}>
                <button
                  type="button"
                  className={styles.planButton}
                  onClick={() => setShowPlan((s) => !s)}
                  aria-expanded={showPlan}
                >
                  {showPlan ? t("hidePlan", lang) : t("showPlan", lang)}
                </button>

                {showPlan && (
                  <dl className={styles.planList}>
                    {planSummary(plan, lang).map(([label, value]) => (
                      <div className={styles.planItem} key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
