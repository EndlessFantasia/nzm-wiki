/** Compatibility CLI for reviewed perk-only migrations. Prefer content-version promote. */
import { parseArgs } from "node:util";
import path from "node:path";
import { planPerkPromotion, applyPerkPromotion } from "./promotion";

const { values } = parseArgs({ options: {
  "content-root": { type: "string" }, archive: { type: "string" },
  baseline: { type: "string" }, season: { type: "string" }, write: { type: "boolean" },
} });
try {
  if (!values["content-root"] || !values.archive || !values.baseline || !values.season) {
    throw new Error("Usage: promote-release.ts --content-root PATH --archive PATH --baseline PATH --season ID [--write]");
  }
  const plan = planPerkPromotion({ root: process.cwd(), contentRoot: path.resolve(values["content-root"]),
    archive: path.resolve(values.archive), baseline: path.resolve(values.baseline), season: values.season });
  console.log(JSON.stringify({ write: Boolean(values.write), ...plan }, null, 2));
  if (plan.conflicts.length) throw new Error(plan.conflicts.join("\n"));
  if (values.write) applyPerkPromotion(process.cwd(), plan);
} catch (error) { console.error(error); process.exitCode = 1; }
