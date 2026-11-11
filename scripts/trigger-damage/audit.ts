import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { TRIGGER_DAMAGE_GROUPS, type TriggerDamageEntry } from "../../lib/trigger-damage";
import { getHealthSettlementDefinition, isWeaponHealthSettlementType } from "../../lib/weapon-health-settlement";
import { checkCatalog, readCatalog, sha256 } from "../overlimit/catalog";

// Row names are authoritative: 11010053_2 / _3 have different raw IDs, both Level=1.
export function numericalRows(reference: string): string[] {
  if (reference === "-" || reference === "执行资产已移除") return [];
  return reference.split(/\s*\/\s*/).flatMap(part => {
    if (/^\d+_\d+$/.test(part)) return [part];
    if (/^\d+$/.test(part)) return [`${part}_1`];
    const range = /^(\d+)-(\d+)$/.exec(part);
    assert.ok(range, `Invalid Numerical reference: ${part}`);
    const start = Number(range[1]);
    const end = Number(range[2].length < range[1].length
      ? range[1].slice(0, -range[2].length) + range[2] : range[2]);
    assert.ok(end >= start && end - start < 100, `Invalid Numerical range: ${part}`);
    return Array.from({ length: end - start + 1 }, (_, index) => `${start + index}_1`);
  });
}

type Row = {
  id: number; Level: number; HpCalScale: number; HpCalBase: number;
  ToughnessBase: number; ToughnessScale: number; ElementType: string;
  bEnableCriticalDamage: boolean; EnableWeaknessDamage: boolean; WeaknessDamageAddScale: number;
  Settlements: { TagName: string }[];
};
const elements: Record<string, string> = {
  Kinetic: "物理", Fire: "火焰", Cryo: "寒冷", Shock: "电弧", Corossive: "腐蚀", Normal: "物理",
};
const exclusions: Record<string, string> = {
  "11010051_1": "已有明确赛季天赋归属：破次数盾产生爆炸；不作为无归属插件配置重复收录",
  "11010061_1": "回能设计的零伤害行，HpCalScale/HpCalBase 均为零；未形成独立伤害证据",
  "11010130_1": "明确标记占位符，没有可发布的技能身份或执行引用",
  "11010138_1": "流体护盾击退：HpCalScale/HpCalBase 均为零；破韧不等于生命伤害",
};
const round = (value: number) => Math.round(value * 100_000) / 100_000;

export function verifyReviewedExecution(
  files: { path: string; sha256: string }[], reviewed: { path: string; sha256: string }[],
) {
  const hashes = new Map(reviewed.map(file => [file.path, file.sha256]));
  for (const file of files) {
    if (file.path.startsWith("DataTables/numerical_config_")) continue;
    assert.equal(file.sha256, hashes.get(file.path), `Re-review changed execution evidence: ${file.path}`);
  }
}

function verifyEntry(entry: TriggerDamageEntry, rows: Row[]) {
  for (const row of rows) {
    const health = row.Settlements.map(tag => tag.TagName).find(tag => tag.startsWith("Numerical.SettlementType.Health."))?.split(".").at(-1);
    assert.ok(health && isWeaponHealthSettlementType(health), `${entry.name}: unknown settlement`);
    const label = getHealthSettlementDefinition(health).label;
    assert.equal(entry.damageType, health === "WeaponDamage" ? "武器伤害" : label, `${entry.name}: settlement`);
    assert.equal(entry.critical, row.bEnableCriticalDamage, `${entry.name}: critical`);
    assert.equal(entry.weakpoint, row.EnableWeaknessDamage, `${entry.name}: weakpoint`);
    assert.equal(Number(entry.toughness), round(row.ToughnessBase + row.ToughnessScale * 500), `${entry.name}: toughness`);
    if (rows.length === 1) {
      assert.equal(entry.element, elements[row.ElementType.split("_").at(-1)!], `${entry.name}: element`);
    }
    // Indirect / custom settlements receive damage from execution; never treat that input as Attack=500.
    if (health === "CustomDamage") {
      assert.ok(entry.pending && /输入/.test(entry.damageValue), `${entry.name}: custom settlement needs its uncertainty`);
    } else if (health === "IndirectDamage") {
      assert.ok(entry.damageValue.includes(`${round(row.HpCalScale * 100)}%`), `${entry.name}: input coefficient`);
    } else {
      const shown = entry.damageValue.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      assert.ok(shown.includes(round(row.HpCalScale * 500 + row.HpCalBase)), `${entry.name}: base damage`);
    }
  }
}

function main() {
  const { values } = parseArgs({ options: {
    "content-root": { type: "string" }, "output-directory": { type: "string" },
    "reviewed-at": { type: "string" }, "prepare-overlimit": { type: "boolean", default: false },
  } });
  assert.ok(values["content-root"] && values["output-directory"] && values["reviewed-at"],
    "Specify --content-root, --output-directory and --reviewed-at");
  assert.match(values["reviewed-at"], /^\d{4}-\d{2}-\d{2}$/);
  const root = path.resolve(values["content-root"]);
  const output = path.resolve(values["output-directory"]);
  const relative = path.relative(path.resolve("MD/_local"), output);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "Output belongs in MD/_local");
  const files: { path: string; sha256: string }[] = [];
  function table(file: string): Record<string, Row> {
    const bytes = fs.readFileSync(path.join(root, file));
    files.push({ path: file, sha256: sha256(bytes) });
    const exports = JSON.parse(bytes.toString("utf8")) as { Rows?: Record<string, Row> }[];
    const tables = exports.filter(item => item.Rows);
    assert.equal(tables.length, 1, `Ambiguous table: ${file}`);
    return tables[0].Rows!;
  }
  const composite = table("DataTables/numerical_config_composite.json");
  // The historical thrown gun row exists only in equip; do not silently fall back for other rows.
  const equip = table("DataTables/numerical_config_equip.json");
  const covered = new Set<string>();
  const records = Object.entries(TRIGGER_DAMAGE_GROUPS).flatMap(([group, entries]) =>
    (entries as readonly TriggerDamageEntry[]).map(entry => {
      const keys = numericalRows(entry.numericalId);
      const rows = keys.map(key => {
        covered.add(key);
        const raw = (key === "1400110101_1" ? equip : composite)[key];
        assert.ok(raw, `${entry.name}: missing Numerical row ${key}`);
        assert.equal(raw.Level, 1, `${entry.name}: level changed`);
        return raw;
      });
      verifyEntry(entry, rows);
      return { group, entry, rows: keys.map((key, index) => {
        const row = rows[index];
        return { key, id: row.id, Level: row.Level, HpCalScale: row.HpCalScale, HpCalBase: row.HpCalBase,
          ToughnessBase: row.ToughnessBase, ToughnessScale: row.ToughnessScale,
          ElementType: row.ElementType, bEnableCriticalDamage: row.bEnableCriticalDamage,
          EnableWeaknessDamage: row.EnableWeaknessDamage, WeaknessDamageAddScale: row.WeaknessDamageAddScale,
          Settlements: row.Settlements };
      }) };
    }));
  // Every generic BD/S4 damage row is accounted for, including non-canonical row names.
  for (const [key, row] of Object.entries(composite)) {
    if (row.id < 11010000 || row.id > 11010149 || row.Level !== 1 ||
        !row.Settlements.some(tag => /\.Health\.\w*Damage$/.test(tag.TagName))) continue;
    assert.ok(covered.has(key) || exclusions[key], `Unreviewed generic trigger row: ${key}`);
  }
  // Selected local assets only. The available pak profile is an older build and is not a fallback.
  for (const file of [
    "Abilities/Build/CBT3/Perk04/MGE_1316219001", "Abilities/Build/CBT3/Perk03/MGE_1315237001",
    "Abilities/Build/CBT3/Perk04/MGE_1316218001", "Abilities/Build/CBT3/Perk04/MGE_1316220001",
    "Abilities/Build/CBT3/Perk03/MGE_1315250001", "Abilities/Build/CBT3/Perk04/MGE_1317129001",
    "Abilities/Build/CBT3/Perk04/MGE_1317110001", "Abilities/Build/CBT3/Perk02/MGE_1317042221",
    "Abilities/Build/CBT3/Perk02/MGE_1316212001", "Abilities/Build/RoguePerk/S3/MGE_1378030230",
    "Abilities/Build/RoguePerk/S3/MGE_1378030260",
    "Abilities/Build/CBT3/Perk02/MGE_1316210001", "Abilities/Build/CBT3/Perk02/MGE_1316211001",
    "Abilities/Build/CBT3/Perk02/MGE_1316213001", "Abilities/Build/CBT3/Perk02/MGE_1317229001",
    "Abilities/Build/CBT3/Perk02/MGE_1317232001", "Abilities/Build/CBT3/Perk02/MGE_1317234001",
  ].flatMap(asset => [`${asset}.uasset`, `${asset}.uexp`]).concat([
    "AIBehavior/BaseAIBluprints/DataConfig/DataTable/DT_EffectZone.json",
    "DataTables/NZAOEGlobalConfigTable.json",
    "Abilities/MGE/BP_MGE_ISMProjectile_Base.json", "Abilities/MGE/BP_Projectile_Normal_Base.json",
    "Abilities/Build/CBT3/Perk02/BP_Projectile_MGE_1316210001.json",
    "Abilities/Build/CBT3/Perk02/BP_Projectile_MGE_1317229001.json",
    "Abilities/Build/CBT3/Perk02/BP_Projectile_MGE_1316212001.json",
    "Abilities/Build/CBT3/Perk02/BP_Projectile_MGE_1316213001.json",
  ])) files.push({ path: file, sha256: sha256(fs.readFileSync(path.join(root, file))) });
  const evidence = { schemaVersion: 1, reviewedAt: values["reviewed-at"],
    contentRoot: path.relative(process.cwd(), root).replaceAll("\\", "/"),
    basis: "Numerical fields audited for all catalog rows. Execution chains and remaining gaps: docs/architecture/trigger-damage-evidence.md. A configuration row is not proof of release or execution.",
    files, exclusions, records };
  const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
  const evidenceBytes = serialize(evidence);
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, "evidence.json"), evidenceBytes);
  if (values["prepare-overlimit"]) {
    // Matching Numerical fields cannot approve changed bytecode, CDOs or AOE/zone configuration.
    const reviewed = JSON.parse(fs.readFileSync("scripts/trigger-damage/current-evidence.json", "utf8")) as {
      files: { path: string; sha256: string }[];
    };
    verifyReviewedExecution(files, reviewed.files);
    const catalog = readCatalog("data/overlimit/current.json");
    assert.equal(path.resolve(catalog.provenance.contentRoot), root, "Review the catalog source before switching Content versions");
    const cardIds = new Set(catalog.cards.map(card => card.id));
    // Only explicit reviewed card IDs qualify; names and ordinary perk ItemIDs are never fallback keys.
    for (const { entry } of records) {
      if (!entry.overlimitId) continue;
      assert.ok(cardIds.has(entry.overlimitId), `Card outside current pool: ${entry.overlimitId}`);
      const card = catalog.cards.find(candidate => candidate.id === entry.overlimitId)!;
      assert.equal(card.name, entry.name, `Card identity changed: ${entry.overlimitId}`);
      catalog.independentDamage[entry.overlimitId] = [entry];
      if (entry.pending) card.verification = { status: "partial", note: entry.pending };
      else if (["1317240001", "20703040528", "20703040472"].includes(entry.overlimitId)) delete card.verification;
      else if (entry.overlimitId === "20703040478") card.verification = {
        status: "partial", note: "基础伤害与虚拟枪引用已核验；实际弱点倍率仍缺关联武器覆写证据。",
      };
      else if (["1317229001", "1317232001", "1317234001"].includes(entry.overlimitId)) card.verification = {
        status: "partial", note: "已沿投射物或父类配置收录独立伤害；父类内部执行未重新展开。",
      };
    }
    const sniper = catalog.bonds?.find(bond => bond.name === "狙击")?.effects.find(effect => effect.count === 4);
    assert.ok(sniper, "Re-review the current bond pool");
    sniper.description = "受到伤害，或5米内怪物数达到5个时，产生1000%攻击力的范围爆炸伤害并击飞，配置冷却20秒。";
    catalog.season.updatedAt = values["reviewed-at"];
    const evidencePath = "scripts/trigger-damage/current-evidence.json";
    catalog.provenance.files = catalog.provenance.files.filter(file => file.path !== evidencePath);
    catalog.provenance.files.push({ path: evidencePath, sha256: sha256(evidenceBytes) });
    checkCatalog(catalog, process.cwd());
    const catalogBytes = serialize(catalog);
    fs.writeFileSync(path.join(output, "catalog.json"), catalogBytes);
    fs.writeFileSync(path.join(output, "review.json"), serialize({ status: "approved",
      catalogSha256: sha256(catalogBytes), basis: evidence.basis }));
  }
  console.log(`Audited ${records.length} entries / ${covered.size} Numerical rows; candidate: ${output}`);
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/trigger-damage/audit.ts")) main();
