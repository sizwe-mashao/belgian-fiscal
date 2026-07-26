import type { AskSuccess } from "./types";

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent`;

/**
 * Gemini writes prose around an already-computed result. It must never invent
 * figures or explain absences — those are deterministic and supplied.
 *
 * Uses the v1 endpoint (no responseMimeType). Returns null on any failure so
 * the route can still render figures and caveats.
 */
export async function writeNarrative(
  question: string,
  result: AskSuccess
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  // Absences are authored text — do not ask the model to reason about them.
  if (result.empty && result.absence) {
    return null;
  }

  const payload = {
    plan: result.plan,
    rows: result.rows,
    caveats: result.caveats,
    incomplete: result.incomplete,
    absence: result.absence ?? null,
  };

  const prompt = [
    "You write short plain-English answers about Belgian public expenditure.",
    "Describe only what is in the supplied JSON. Do not add figures, context, causes or comparisons that are not present.",
    "Do not explain why data is missing. If an absence explanation is supplied, reproduce its substance or defer to it — never reason independently about Belgian competences.",
    "Surface any supplied caveat rather than presenting the figure alone.",
    "Two or three sentences. No preamble, no markdown fences.",
    "",
    `Original question: ${question}`,
    "",
    `Computed result (JSON): ${JSON.stringify(payload)}`,
  ].join("\n");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);

    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 280,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.error("Gemini error:", res.status, await res.text());
      return null;
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    return text || null;
  } catch (err) {
    console.error("Gemini request failed:", err);
    return null;
  }
}
