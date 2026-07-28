"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LANGS, useLanguage, type Lang } from "./LanguageContext";
import styles from "./SiteHeader.module.css";

type NavItem = {
  href: string;
  label: Record<Lang, string>;
  /**
   * Routes that do not exist yet render as inert text rather than as links
   * into a 404. Flip to `true` (or drop the flag) when the page ships.
   */
  built: boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    built: true,
    label: {
      EN: "Dashboard",
      FR: "Tableau de bord",
      NL: "Dashboard",
      DE: "Dashboard",
    },
  },
  {
    href: "/data",
    built: true,
    label: {
      EN: "Data Explorer",
      FR: "Explorateur de données",
      NL: "Dataverkenner",
      DE: "Datenexplorer",
    },
  },
  {
    href: "/articles",
    built: false,
    label: {
      EN: "Articles",
      FR: "Articles",
      NL: "Artikels",
      DE: "Artikel",
    },
  },
  {
    href: "/methodology",
    built: false,
    label: {
      EN: "Methodology",
      FR: "Méthodologie",
      NL: "Methode",
      DE: "Methodik",
    },
  },
  {
    href: "/contact",
    built: false,
    label: {
      EN: "Contact",
      FR: "Contact",
      NL: "Contact",
      DE: "Kontakt",
    },
  },
];

const COMING_SOON: Record<Lang, string> = {
  EN: "coming soon",
  FR: "bientôt disponible",
  NL: "binnenkort",
  DE: "demnächst",
};

// Nested routes keep their parent marked, so /articles/some-slug still
// underlines "Articles".
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteHeader() {
  const { lang, setLang } = useLanguage();
  const pathname = usePathname() || "/";

  return (
    <header className={styles.bar}>
      <div className={styles.barInner}>
        {/* The brand is the home link — there is no separate Home nav item. */}
        <Link className={styles.brand} href="/">
          OpenBudgets<span className={styles.brandSuffix}>.BE</span>
        </Link>

        <nav className={styles.nav} aria-label="Main">
          <ul className={styles.navList}>
            {NAV_ITEMS.map((item) => {
              if (!item.built) {
                return (
                  <li key={item.href}>
                    {/* Deliberately not a link and not focusable: there is
                        nothing to open, so it stays out of the tab order.
                        The title gives sighted mouse users the reason, and the
                        visually hidden span gives screen readers the same. */}
                    <span
                      className={styles.navPending}
                      aria-disabled="true"
                      title={COMING_SOON[lang]}
                    >
                      {item.label[lang]}
                      <span className={styles.srOnly}>
                        {` (${COMING_SOON[lang]})`}
                      </span>
                    </span>
                  </li>
                );
              }

              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    className={`${styles.navLink}${active ? ` ${styles.navLinkActive}` : ""}`}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label[lang]}
                  </Link>
                </li>
              );
            })}
          </ul>

          <span
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
          </span>
        </nav>
      </div>

      <div className={styles.tricolour} aria-hidden />
    </header>
  );
}
