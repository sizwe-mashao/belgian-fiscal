"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LANGS, useLanguage, type Lang } from "./LanguageContext";
import styles from "./SiteHeader.module.css";

type NavItem = {
  href: string;
  label: Record<Lang, string>;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: {
      EN: "Dashboard",
      FR: "Tableau de bord",
      NL: "Dashboard",
      DE: "Dashboard",
    },
  },
  {
    href: "/data",
    label: {
      EN: "Data Explorer",
      FR: "Explorateur de données",
      NL: "Dataverkenner",
      DE: "Datenexplorer",
    },
  },
  {
    href: "/articles",
    label: {
      EN: "Articles",
      FR: "Articles",
      NL: "Artikels",
      DE: "Artikel",
    },
  },
  {
    href: "/methodology",
    label: {
      EN: "Methodology",
      FR: "Méthodologie",
      NL: "Methode",
      DE: "Methodik",
    },
  },
  {
    href: "/contact",
    label: {
      EN: "Contact",
      FR: "Contact",
      NL: "Contact",
      DE: "Kontakt",
    },
  },
];

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
