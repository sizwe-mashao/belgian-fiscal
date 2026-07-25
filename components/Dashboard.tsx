"use client";

import { useEffect, useState, type CSSProperties } from "react";
import styles from "./Dashboard.module.css";

export type RegionId = "flanders" | "wallonia" | "brussels";

type ExpenditureResult = {
  region_id: string;
  region_names: { EN: string; FR: string; NL: string; DE: string };
  heraldic_color: string;
  total_amount_eur_000: number;
  per_capita_eur: number;
};

type RegionCardData = {
  id: RegionId;
  name: string;
  heraldicColor: string;
  totalEur000: number;
  perCapitaEur: number;
  pctChange: number | null;
};

const REGIONS: RegionId[] = ["flanders", "wallonia", "brussels"];
const BASIS = "commitment";

function formatBillions(eur000: number): string {
  return `€${(eur000 / 1e6).toFixed(1)}bn`;
}

function formatPerCapita(value: number): string {
  return `€${value.toLocaleString("en-US")} per resident`;
}

function formatPctChange(pct: number): {
  text: string;
  direction: "up" | "down" | "flat";
} {
  if (pct > 0) return { text: `▲ ${pct.toFixed(1)}%`, direction: "up" };
  if (pct < 0) return { text: `▼ ${Math.abs(pct).toFixed(1)}%`, direction: "down" };
  return { text: "0.0%", direction: "flat" };
}

async function fetchRegionYear(
  region: RegionId,
  year: number
): Promise<ExpenditureResult> {
  const res = await fetch(
    `/api/expenditure?region=${region}&year=${year}&basis=${BASIS}`
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

export default function Dashboard() {
  const [selectedRegion, setSelectedRegion] = useState<RegionId | null>(null);
  const [cards, setCards] = useState<RegionCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const results = await Promise.all(
          REGIONS.flatMap((region) => [
            fetchRegionYear(region, 2026),
            fetchRegionYear(region, 2025),
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
            name: current.region_names.EN,
            heraldicColor: current.heraldic_color,
            totalEur000: current.total_amount_eur_000,
            perCapitaEur: current.per_capita_eur,
            pctChange,
          };
        });

        setCards(next);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load expenditure data"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.dashboard}>
      {loading && <p className={styles.status}>Loading…</p>}
      {error && <p className={styles.error}>{error}</p>}
      {!loading && !error && (
        <div className={styles.grid}>
          {cards.map((card) => {
            const change =
              card.pctChange != null ? formatPctChange(card.pctChange) : null;
            const selected = selectedRegion === card.id;
            const changeClass =
              change?.direction === "up"
                ? styles.changeUp
                : change?.direction === "down"
                  ? styles.changeDown
                  : styles.changeFlat;

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
                  <span className={styles.regionName}>{card.name}</span>
                </div>
                <p className={styles.total}>
                  {formatBillions(card.totalEur000)}
                </p>
                {change && <p className={changeClass}>{change.text}</p>}
                <p className={styles.perCapita}>
                  {formatPerCapita(card.perCapitaEur)}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
