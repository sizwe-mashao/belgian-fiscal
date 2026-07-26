import { NextRequest, NextResponse } from "next/server";
import { attachAbsence } from "@/lib/explorer/absence";
import { execute } from "@/lib/explorer/executor";
import { fetchPlanData } from "@/lib/explorer/fetch";
import { matchQuestion } from "@/lib/explorer/matcher";
import { writeNarrative } from "@/lib/explorer/narrative";
import { validatePlan } from "@/lib/explorer/validator";
import type { AskError, AskSuccess } from "@/lib/explorer/types";

/**
 * POST /api/ask
 * Body: { question: string }
 *
 * Pipeline: matcher → validator → fetch → execute → absence → narrative.
 * Stages 1–4 are deterministic. Narrative is best-effort and may be omitted.
 */
export async function POST(request: NextRequest) {
  let body: { question?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON with a question string." } satisfies AskError,
      { status: 400 }
    );
  }

  const question =
    typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json(
      { error: "no question provided" } satisfies AskError,
      { status: 400 }
    );
  }

  const matched = matchQuestion(question);
  if (!matched.ok) {
    return NextResponse.json(
      { error: matched.error } satisfies AskError,
      { status: 400 }
    );
  }

  const validated = validatePlan(matched.plan);
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error } satisfies AskError,
      { status: 400 }
    );
  }

  const plan = validated.plan;

  try {
    const { rows, populations, deptNames } = await fetchPlanData(plan);
    let result = execute(plan, rows, populations, deptNames);
    result = attachAbsence(result, plan, rows, deptNames);

    const response: AskSuccess = { ...result };
    const narrative = await writeNarrative(question, response);
    if (narrative) response.narrative = narrative;

    return NextResponse.json(response);
  } catch (err) {
    console.error("Error answering question:", err);
    return NextResponse.json(
      {
        error: "Failed to query expenditure data. Check server logs.",
      } satisfies AskError,
      { status: 500 }
    );
  }
}
