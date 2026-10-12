/** Compatibility CLI for shared source migration after reviewed catalog activation. */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { parseModifierProviderRegistry } from "../../lib/modifier-provider-registry";
import { readCatalog } from "../overlimit/catalog";
import { planSharedPromotion, applySharedPromotion, readPromotionProviders } from "./shared-promotion";

const { values } = parseArgs({ options: {
  season: { type: "string" }, "overlimit-providers": { type: "string" },
  "perk-providers": { type: "string" }, write: { type: "boolean" },
} });
try {
  if (!values.season || !values["overlimit-providers"]) throw new Error(
    "Usage: promote-shared.ts --season ID --overlimit-providers PATH [--perk-providers PATH] [--write]",
  );
  const root = process.cwd();
  const priority = parseModifierProviderRegistry(JSON.parse(fs.readFileSync("data/modifier-providers.json", "utf8"))).evidencePriority;
  const read = (file: string) => readPromotionProviders(file, priority);
  const catalog = readCatalog(path.join(root, "data/overlimit/current.json"));
  if (catalog.season.status !== "current") throw new Error("Activate a reviewed official catalog first");
  const plan = planSharedPromotion(root, values.season, catalog, read(values["overlimit-providers"]),
    values["perk-providers"] ? read(values["perk-providers"]) : undefined);
  console.log(JSON.stringify({ write: Boolean(values.write), providers: plan.registry.providers.length,
    exclusions: plan.registry.exclusions.length, promotedKeys: plan.promotedKeys }, null, 2));
  if (values.write) applySharedPromotion(root, plan);
} catch (error) { console.error(error); process.exitCode = 1; }
