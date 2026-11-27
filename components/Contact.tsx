"use client";

import { useState, type FormEvent } from "react";
import { useLanguage, type Lang } from "@/components/LanguageContext";
import styles from "./Contact.module.css";

type Topic = "general" | "data-error";
type Status = "idle" | "sending" | "sent" | "error";
type FieldError = "invalid_name" | "invalid_email" | "invalid_message";

const UI = {
  title: { EN: "Contact", FR: "Contact", NL: "Contact", DE: "Kontakt" },
  aboutHeading: {
    EN: "About this project",
    FR: "À propos du projet",
    NL: "Over dit project",
    DE: "Über dieses Projekt",
  },
  about: {
    EN: "openbudgets.be is an independent, non-partisan project. It brings the federal and regional budgets of Belgium into one comparable view, so anyone can see what each level of government spends and on what.",
    FR: "openbudgets.be est un projet indépendant et non partisan. Il réunit les budgets fédéral et régionaux de la Belgique dans une vue comparable, afin que chacun puisse voir ce que chaque niveau de pouvoir dépense, et pour quoi.",
    NL: "openbudgets.be is een onafhankelijk, partijpolitiek neutraal project. Het brengt de federale en gewestelijke begrotingen van België samen in één vergelijkbaar overzicht, zodat iedereen kan zien wat elk bestuursniveau uitgeeft en waaraan.",
    DE: "openbudgets.be ist ein unabhängiges, überparteiliches Projekt. Es bringt die föderalen und regionalen Haushalte Belgiens in eine vergleichbare Übersicht, damit jeder sehen kann, was jede Regierungsebene ausgibt und wofür.",
  },
  errorsHeading: {
    EN: "Spotted a data error?",
    FR: "Une erreur dans les données ?",
    NL: "Een fout in de data gezien?",
    DE: "Einen Datenfehler entdeckt?",
  },
  errors: {
    EN: "Every figure comes from the official budget documents, mapped into 17 COFOG categories. If an amount looks wrong or a line seems to sit in the wrong category, tell us which region, year and category, and where you saw it.",
    FR: "Chaque chiffre provient des documents budgétaires officiels, classés en 17 catégories COFOG. Si un montant semble erroné ou si une ligne paraît mal classée, indiquez-nous la région, l'année, la catégorie et l'endroit où vous l'avez vu.",
    NL: "Elk cijfer komt uit de officiële begrotingsdocumenten, ingedeeld in 17 COFOG-categorieën. Lijkt een bedrag fout of staat een lijn in de verkeerde categorie, laat ons dan weten welk gewest, jaar en welke categorie het betreft, en waar u het zag.",
    DE: "Jede Zahl stammt aus den offiziellen Haushaltsdokumenten und ist 17 COFOG-Kategorien zugeordnet. Wenn ein Betrag falsch wirkt oder eine Zeile in der falschen Kategorie zu stehen scheint, nennen Sie uns Region, Jahr, Kategorie und wo Sie es gesehen haben.",
  },
  formHeading: {
    EN: "Send a message",
    FR: "Envoyer un message",
    NL: "Stuur een bericht",
    DE: "Nachricht senden",
  },
  name: { EN: "Name", FR: "Nom", NL: "Naam", DE: "Name" },
  email: { EN: "Email", FR: "E-mail", NL: "E-mail", DE: "E-Mail" },
  topic: { EN: "Topic", FR: "Sujet", NL: "Onderwerp", DE: "Thema" },
  topicGeneral: {
    EN: "General question",
    FR: "Question générale",
    NL: "Algemene vraag",
    DE: "Allgemeine Frage",
  },
  topicDataError: {
    EN: "Report a data error",
    FR: "Signaler une erreur de données",
    NL: "Een datafout melden",
    DE: "Datenfehler melden",
  },
  message: { EN: "Message", FR: "Message", NL: "Bericht", DE: "Nachricht" },
  send: { EN: "Send", FR: "Envoyer", NL: "Versturen", DE: "Senden" },
  sending: { EN: "Sending…", FR: "Envoi…", NL: "Bezig…", DE: "Wird gesendet…" },
  privacy: {
    EN: "We store your name, email and message only so we can reply. Nothing else is collected.",
    FR: "Nous conservons votre nom, votre e-mail et votre message uniquement pour vous répondre. Rien d'autre n'est collecté.",
    NL: "We bewaren uw naam, e-mail en bericht alleen om te kunnen antwoorden. Er wordt niets anders verzameld.",
    DE: "Wir speichern Ihren Namen, Ihre E-Mail und Ihre Nachricht nur, um antworten zu können. Sonst wird nichts erfasst.",
  },
  sent: {
    EN: "Thank you — your message has been sent.",
    FR: "Merci — votre message a bien été envoyé.",
    NL: "Bedankt — uw bericht is verzonden.",
    DE: "Danke — Ihre Nachricht wurde gesendet.",
  },
  sendAnother: {
    EN: "Send another message",
    FR: "Envoyer un autre message",
    NL: "Nog een bericht sturen",
    DE: "Weitere Nachricht senden",
  },
  failed: {
    EN: "Your message could not be sent. Please try again later.",
    FR: "Votre message n'a pas pu être envoyé. Veuillez réessayer plus tard.",
    NL: "Uw bericht kon niet worden verzonden. Probeer het later opnieuw.",
    DE: "Ihre Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.",
  },
} satisfies Record<string, Record<Lang, string>>;

const FIELD_ERRORS: Record<FieldError, Record<Lang, string>> = {
  invalid_name: {
    EN: "Please enter your name.",
    FR: "Veuillez indiquer votre nom.",
    NL: "Vul uw naam in.",
    DE: "Bitte geben Sie Ihren Namen ein.",
  },
  invalid_email: {
    EN: "Please enter a valid email address.",
    FR: "Veuillez indiquer une adresse e-mail valide.",
    NL: "Vul een geldig e-mailadres in.",
    DE: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
  },
  invalid_message: {
    EN: "Please write a message of at least 10 characters.",
    FR: "Veuillez écrire un message d'au moins 10 caractères.",
    NL: "Schrijf een bericht van minstens 10 tekens.",
    DE: "Bitte schreiben Sie eine Nachricht mit mindestens 10 Zeichen.",
  },
};

function isFieldError(value: unknown): value is FieldError {
  return typeof value === "string" && value in FIELD_ERRORS;
}

export default function Contact() {
  const { lang } = useLanguage();
  const t = (key: keyof typeof UI) => UI[key][lang];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<Topic>("general");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [fieldError, setFieldError] = useState<FieldError | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setFieldError(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, topic, message, lang, website }),
      });
      const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        setStatus("sent");
        setName("");
        setEmail("");
        setTopic("general");
        setMessage("");
        return;
      }
      if (isFieldError(data.error)) {
        setFieldError(data.error);
        setStatus("idle");
        return;
      }
      setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  const sending = status === "sending";

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <section className={styles.intro}>
          <h1 className={styles.title}>{t("title")}</h1>

          <h2 className={styles.heading}>{t("aboutHeading")}</h2>
          <p className={styles.text}>{t("about")}</p>

          <h2 className={styles.heading}>{t("errorsHeading")}</h2>
          <p className={styles.text}>{t("errors")}</p>
        </section>

        <div className={styles.divider} />

        <section className={styles.formSection}>
          <h2 className={styles.heading}>{t("formHeading")}</h2>

          {status === "sent" ? (
            <div className={styles.success} role="status">
              <p>{t("sent")}</p>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => setStatus("idle")}
              >
                {t("sendAnother")}
              </button>
            </div>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.row}>
                <label className={styles.field}>
                  <span className={styles.label}>{t("name")}</span>
                  <input
                    className={styles.input}
                    type="text"
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={sending}
                    aria-invalid={fieldError === "invalid_name" || undefined}
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>{t("email")}</span>
                  <input
                    className={styles.input}
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    maxLength={200}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={sending}
                    aria-invalid={fieldError === "invalid_email" || undefined}
                  />
                </label>
              </div>

              <label className={styles.field}>
                <span className={styles.label}>{t("topic")}</span>
                <select
                  className={styles.input}
                  name="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as Topic)}
                  disabled={sending}
                >
                  <option value="general">{t("topicGeneral")}</option>
                  <option value="data-error">{t("topicDataError")}</option>
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>{t("message")}</span>
                <textarea
                  className={`${styles.input} ${styles.textarea}`}
                  name="message"
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={sending}
                  aria-invalid={fieldError === "invalid_message" || undefined}
                />
              </label>

              {/* Honeypot: hidden from people and screen readers, filled by bots. */}
              <div className={styles.honeypot} aria-hidden="true">
                <label>
                  Website
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </label>
              </div>

              {fieldError && (
                <p className={styles.error} role="alert">
                  {FIELD_ERRORS[fieldError][lang]}
                </p>
              )}
              {status === "error" && (
                <p className={styles.error} role="alert">
                  {t("failed")}
                </p>
              )}

              <div className={styles.actions}>
                <button className={styles.button} type="submit" disabled={sending}>
                  {sending ? t("sending") : t("send")}
                </button>
                <p className={styles.privacy}>{t("privacy")}</p>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
