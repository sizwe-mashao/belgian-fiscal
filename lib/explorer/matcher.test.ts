/**
 * Plain Node script — no test framework. Run with:
 *   npx tsx lib/explorer/matcher.test.ts
 */

import { matchQuestion } from "./matcher";
import type { QueryPlan } from "./types";

type Expect = {
  ok: true;
  plan: Partial<QueryPlan>;
} | {
  ok: false;
};

let passed = 0;
let failed = 0;

function samePlan(actual: QueryPlan, expected: Partial<QueryPlan>): string[] {
  const diffs: string[] = [];
  for (const [key, value] of Object.entries(expected) as [keyof QueryPlan, unknown][]) {
    const got = actual[key];
    if (Array.isArray(value)) {
      const a = got as unknown[];
      if (
        !Array.isArray(a) ||
        a.length !== value.length ||
        value.some((v, i) => v !== a[i])
      ) {
        diffs.push(`${key}: got ${JSON.stringify(got)}, expected ${JSON.stringify(value)}`);
      }
    } else if (got !== value) {
      diffs.push(`${key}: got ${JSON.stringify(got)}, expected ${JSON.stringify(value)}`);
    }
  }
  return diffs;
}

function test(input: string, expected: Expect) {
  const result = matchQuestion(input);
  if (expected.ok === false) {
    if (result.ok === false) {
      passed += 1;
      console.log(`PASS  ${JSON.stringify(input)} → ok: false`);
      return;
    }
    failed += 1;
    console.log(`FAIL  ${JSON.stringify(input)}`);
    console.log(`      expected ok: false, got plan ${JSON.stringify(result.plan)}`);
    return;
  }

  if (!result.ok) {
    failed += 1;
    console.log(`FAIL  ${JSON.stringify(input)}`);
    console.log(`      expected plan, got ok: false (${result.error})`);
    return;
  }

  const diffs = samePlan(result.plan, expected.plan);
  if (diffs.length === 0) {
    passed += 1;
    console.log(`PASS  ${JSON.stringify(input)}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${JSON.stringify(input)}`);
  for (const d of diffs) console.log(`      ${d}`);
  console.log(`      full plan: ${JSON.stringify(result.plan)}`);
}

test("What does Flanders spend on education?", {
  ok: true,
  plan: {
    operation: "total",
    entities: ["flanders"],
    category: "Education",
    year: 2026,
    basis: "commitment",
    metric: "total",
  },
});

test("What does Wallonia spend on education?", {
  ok: true,
  plan: {
    operation: "total",
    entities: ["wallonia"],
    category: "Education",
  },
});

test("Compare health spending across the regions", {
  ok: true,
  plan: {
    operation: "compare",
    entities: ["flanders", "wallonia", "brussels"],
    category: "Health & Social Welfare/Care",
  },
});

test("How did Brussels mobility change since 2025?", {
  ok: true,
  plan: {
    operation: "change",
    entities: ["brussels"],
    category: "Mobility & Infrastructure",
    year: 2026,
    compareYear: 2025,
  },
});

test("What share of Flanders' budget is education?", {
  ok: true,
  plan: {
    operation: "share",
    entities: ["flanders"],
    category: "Education",
  },
});

test("Wallonia's biggest spending areas", {
  ok: true,
  plan: {
    operation: "rank",
    entities: ["wallonia"],
    category: null,
    limit: 6,
  },
});

test("What does Brussels spend on?", {
  ok: true,
  plan: {
    operation: "breakdown",
    entities: ["brussels"],
    category: null,
  },
});

test("Flanders spending per resident in 2025", {
  ok: true,
  plan: {
    metric: "perCapita",
    year: 2025,
    entities: ["flanders"],
  },
});

test("What did Brussels pay out in 2026?", {
  ok: true,
  plan: {
    basis: "payment",
    entities: ["brussels"],
    year: 2026,
  },
});

test("What does Wallonia spend on local government?", {
  ok: true,
  plan: {
    category: "Local Governments & Home Affairs",
    entities: ["wallonia"],
  },
});

test("Public transport in Brussels", {
  ok: true,
  plan: {
    category: "Mobility & Infrastructure",
    entities: ["brussels"],
  },
});

test("asdfghjkl", { ok: false });

test("What does Belgium spend?", { ok: false });

test("", { ok: false });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
