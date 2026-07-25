"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature, merge } from "topojson-client";
import type { Topology, GeometryCollection, GeometryObject } from "topojson-specification";
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

type MapPath = {
  id: RegionId;
  d: string;
};

type BelTopology = Topology<{ bel: GeometryCollection }>;

const REGIONS: RegionId[] = ["flanders", "wallonia", "brussels"];
const BASIS = "commitment";
const TOPO_URL =
  "https://cdn.jsdelivr.net/npm/datamaps@0.5.10/src/js/data/bel.topo.json";
const MAP_WIDTH = 480;
const MAP_HEIGHT = 400;

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

export default function Dashboard() {
  const [selectedRegion, setSelectedRegion] = useState<RegionId | null>(null);
  const [cards, setCards] = useState<RegionCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapPaths, setMapPaths] = useState<MapPath[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(true);

  const colorById = useMemo(() => {
    const map = new Map<RegionId, string>();
    for (const card of cards) {
      map.set(card.id, card.heraldicColor);
    }
    return map;
  }, [cards]);

  const nameById = useMemo(() => {
    const map = new Map<RegionId, string>();
    for (const card of cards) {
      map.set(card.id, card.name);
    }
    return map;
  }, [cards]);

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
            err instanceof Error ? err.message : "Failed to load map"
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

  return (
    <div className={styles.dashboard}>
      {loading && <p className={styles.status}>Loading…</p>}
      {error && <p className={styles.error}>{error}</p>}
      {!loading && !error && (
        <>
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

          <section className={styles.mapSection} aria-label="Region map and list">
            <div className={styles.mapPanel}>
              {mapLoading && <p className={styles.status}>Loading map…</p>}
              {mapError && (
                <p className={styles.mapFallback}>
                  Map unavailable. {mapError}
                </p>
              )}
              {!mapLoading && !mapError && (
                <svg
                  className={styles.mapSvg}
                  viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                  role="img"
                  aria-label="Interactive map of Belgian regions"
                >
                  {mapPaths.map((regionPath) => {
                    const color =
                      colorById.get(regionPath.id) ?? "#9a968c";
                    const selected = selectedRegion === regionPath.id;
                    const fill = selected ? color : lightenHex(color);
                    const label =
                      nameById.get(regionPath.id) ?? regionPath.id;

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
                      <span className={styles.regionListName}>{card.name}</span>
                      <span className={styles.regionListTotal}>
                        {formatBillions(card.totalEur000)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <p className={styles.hint}>
            Click a region on the map or in the list to update the breakdown
            below.
          </p>
        </>
      )}
    </div>
  );
}
