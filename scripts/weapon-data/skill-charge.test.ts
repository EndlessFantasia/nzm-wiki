import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import matter from "gray-matter";
import { parseWeaponDataLock } from "../../lib/weapon-data-lock";
import { createWeaponResolver } from "../../lib/weapon-resolver";
import { getActiveSkillDisplay, toWeaponDetailData } from "../../lib/weapon-consumers";
import {
  createWeaponDataSourceReader,
  WEAPON_DATA_SOURCE_FILES,
  type WeaponDataSourceKind,
} from "./source-reader";
import {
  auditActiveSkillReference,
  resolveActiveSkillCharge,
  WeaponSkillChargeError,
} from "./skill-charge";

type Rows = Record<string, unknown>;

const skillRows: Partial<Record<WeaponDataSourceKind, Rows>> = {
  "skill-pve": {
    "5100101_1": {
      SkillID: 5100101,
      Level: 1,
      ChargeNeedTime: 45,
      SkillCount: 1,
    },
    "5101601_1": {
      SkillID: 5101601,
      Level: 1,
      ChargeNeedTime: 50,
      SkillCount: 2,
    },
    "5101501_1": {
      SkillID: 5101501,
      Level: 1,
      ChargeNeedTime: 25,
      SkillCount: 1,
    },
  },
  "gp-active-skill": {
    "5100101": {
      AbilityID: 5100101,
      CooldownDuration: 35,
      MaxChargeStackCount: 3,
    },
    "5101601": {
      AbilityID: 5101601,
      CooldownDuration: 25,
      MaxChargeStackCount: 1,
    },
    "5101501": {
      AbilityID: 5101501,
      CooldownDuration: 50,
      MaxChargeStackCount: 1,
    },
    "5004901": {
      AbilityID: 5004901,
      CooldownDuration: 30,
      MaxChargeStackCount: 1,
    },
    "5003101": {
      AbilityID: 5003101,
      CooldownDuration: 0,
      MaxChargeStackCount: 1,
    },
    "5102501": {
      AbilityID: 5102501,
      CooldownDuration: 0,
      MaxChargeStackCount: 1,
    },
  },
  prototype: {
    "暗夜之殇_": {
      PrototypeID: "20007000004",
      Mode: 0,
      ActiveSkillID: 5100101,
    },
    "钢铁轰鸣_": {
      PrototypeID: "20016000004",
      Mode: 0,
      ActiveSkillID: 5101601,
    },
    "飓风之龙_0": {
      PrototypeID: "20003000011",
      Mode: 0,
      ActiveSkillID: 5101501,
    },
  },
  item: {
    "20116000004": {
      ItemID: 20116000004,
      ModelID: 20016000004,
      Active_Skill_Detail: "5101901",
    },
    "20103000010": {
      ItemID: 20103000010,
      ModelID: 20003000011,
      Active_Skill_Detail: "5101501",
    },
    "20103000011": {
      ItemID: 20103000011,
      ModelID: 20003000011,
      Active_Skill_Detail: "5101501",
    },
  },
};

function createFixture(
  context: TestContext,
  overrides: Partial<Record<WeaponDataSourceKind, Rows>> = {},
) {
  const root = mkdtempSync(path.join(tmpdir(), "weapon-skill-charge-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));

  for (const kind of Object.keys(WEAPON_DATA_SOURCE_FILES) as WeaponDataSourceKind[]) {
    const filePath = path.join(
      root,
      ...WEAPON_DATA_SOURCE_FILES[kind].split("/"),
    );
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(
      filePath,
      JSON.stringify([{ Rows: overrides[kind] ?? skillRows[kind] ?? {} }]),
      "utf8",
    );
  }

  return createWeaponDataSourceReader({ contentRoot: root });
}

function captureChargeError(action: () => unknown): WeaponSkillChargeError {
  try {
    action();
  } catch (error) {
    assert.ok(error instanceof WeaponSkillChargeError);
    return error;
  }
  assert.fail("expected WeaponSkillChargeError");
}

test("PVE 整行优先，禁止混入 GP 的时间或层数", (context) => {
  const reader = createFixture(context);
  const darkNight = resolveActiveSkillCharge(reader, { skillId: 5100101 });
  const steel = resolveActiveSkillCharge(reader, { skillId: 5101601 });
  const hurricane = resolveActiveSkillCharge(reader, { skillId: 5101501 });

  assert.deepEqual(
    {
      chargeTime: darkNight.chargeTime,
      chargeCount: darkNight.chargeCount,
      source: darkNight.source,
      sourceKey: darkNight.sourceKey,
    },
    {
      chargeTime: 45,
      chargeCount: 1,
      source: "weapon_pve",
      sourceKey: "5100101_1",
    },
  );
  assert.equal(steel.chargeTime, 50);
  assert.equal(steel.chargeCount, 2);
  assert.equal(hurricane.chargeTime, 25);
  assert.equal(hurricane.source, "weapon_pve");
});

test("PVE 缺行时使用 GP，零值保持为有效结果", (context) => {
  const reader = createFixture(context);
  const vibration = resolveActiveSkillCharge(reader, { skillId: 5004901 });
  const springThunder = resolveActiveSkillCharge(reader, { skillId: 5003101 });
  const bronze = resolveActiveSkillCharge(reader, { skillId: 5102501 });

  assert.deepEqual(
    [vibration.chargeTime, vibration.chargeCount, vibration.source],
    [30, 1, "gp_fallback"],
  );
  assert.equal(springThunder.chargeTime, 0);
  assert.equal(springThunder.source, "gp_fallback");
  assert.equal(bronze.chargeTime, 0);
});

test("非法 PVE 行明确失败，不允许回退到 GP", (context) => {
  const reader = createFixture(context, {
    "skill-pve": {
      ...skillRows["skill-pve"],
      "5101501_1": {
        SkillID: 5101501,
        Level: 1,
        ChargeNeedTime: -1,
        SkillCount: 1,
      },
    },
  });
  const error = captureChargeError(() =>
    resolveActiveSkillCharge(reader, { skillId: 5101501 }),
  );

  assert.equal(error.code, "INVALID_SKILL_CHARGE_VALUE");
  assert.match(error.message, /ChargeNeedTime/);
  assert.match(error.message, /SkillConfigTable_Weapon_PVE\.json/);
});

test("缺少两张来源时报告全部尝试 key", (context) => {
  const reader = createFixture(context);
  const error = captureChargeError(() =>
    resolveActiveSkillCharge(reader, { skillId: 5999999 }),
  );

  assert.equal(error.code, "MISSING_SKILL_CHARGE_SOURCE");
  assert.deepEqual(error.attempts, [
    {
      kind: "skill-pve",
      sourcePath: "DataTables/SkillConfigTable_Weapon_PVE.json",
      key: "5999999_1",
    },
    {
      kind: "gp-active-skill",
      sourcePath: "DataTables/GPActiveSkillDataTable.json",
      key: "5999999",
    },
  ]);
  assert.match(error.message, /SkillConfigTable_Weapon_PVE\.json#5999999_1/);
  assert.match(error.message, /GPActiveSkillDataTable\.json#5999999/);
});

test("拒绝零技能 ID 和 Task 2.5 未定义的等级", (context) => {
  const reader = createFixture(context);
  assert.equal(
    captureChargeError(() =>
      resolveActiveSkillCharge(reader, { skillId: 0 }),
    ).code,
    "INVALID_SKILL_REFERENCE",
  );
  assert.equal(
    captureChargeError(() =>
      resolveActiveSkillCharge(reader, { skillId: 5100101, level: 2 }),
    ).code,
    "UNSUPPORTED_SKILL_LEVEL",
  );
});

test("审计报告 MDX/Prototype 和 Item/Prototype 差异但不改写 ID", (context) => {
  const reader = createFixture(context);
  const darkNight = auditActiveSkillReference(reader, {
    prototypeId: "20007000004",
    mdxActiveSkillId: 0,
  });
  const steel = auditActiveSkillReference(reader, {
    prototypeId: "20016000004",
    mdxActiveSkillId: 5101601,
  });
  const hurricane = auditActiveSkillReference(reader, {
    prototypeId: "20003000011",
    mdxActiveSkillId: 5101501,
  });

  assert.equal(darkNight.prototypeActiveSkillId, 5100101);
  assert.deepEqual(darkNight.issues[0], {
    code: "MDX_PROTOTYPE_SKILL_MISMATCH",
    severity: "error",
    mdxActiveSkillId: 0,
    prototypeActiveSkillId: 5100101,
  });
  assert.equal(steel.itemSelection, "model_id_candidate");
  assert.ok(
    steel.issues.some(
      (issue) => issue.code === "ITEM_PROTOTYPE_SKILL_MISMATCH",
    ),
  );
  assert.equal(hurricane.itemSelection, "ambiguous");
  assert.ok(
    hurricane.issues.some((issue) => issue.code === "ITEM_SKILL_AMBIGUOUS"),
  );
});

const realContentRoot = path.join(
  process.cwd(),
  "refs",
  "Exports",
  "NZM",
  "Content",
);
const weaponDirectory = path.join(process.cwd(), "data", "weapons");
const activeWeapons = readdirSync(weaponDirectory)
  .filter((fileName) => fileName.endsWith(".mdx"))
  .map((fileName) => ({ fileName, data: matter(readFileSync(path.join(weaponDirectory, fileName), "utf8")).data }))
  .filter(({ data }) => typeof data.active_skill_id === "number" && data.active_skill_id > 0);
const committedLock = parseWeaponDataLock(JSON.parse(readFileSync(path.join(process.cwd(), "data/weapon-data-lock.json"), "utf8")));
/** Locked rows deliberately differ from the export; see docs/standards/weapon-skills.md. */
const currentSkillCorrections = [
  { sourceKind: "skill-pve", sourceKey: "5104101_1", sourceField: "ChargeNeedTime", after: 30 },
] as const;

test("全部63把主动技能武器的LC/TD充能只由已提交Lock决定：59 PVE、4 GP", () => {
  const resolver = createWeaponResolver(committedLock);
  const counts = { weapon_pve: 0, gp_fallback: 0 };
  assert.equal(activeWeapons.length, 63);
  for (const { fileName, data } of activeWeapons) {
    const reference = committedLock.active_skills[`${data.active_skill_id}_1`];
    assert.ok(reference, fileName);
    counts[reference.source]++;
    const pve = reference.source === "weapon_pve";
    const row = committedLock.rows[pve ? "skill-pve" : "gp-active-skill"][reference.source_key].raw;
    for (const mode of ["lc", "td"] as const) {
      const weapon = toWeaponDetailData(resolver.resolveWeapon(data, { slug: fileName.slice(0, -4), expectedTable: mode }));
      assert.deepEqual(getActiveSkillDisplay(weapon.activeSkill), { cooldown: row[pve ? "ChargeNeedTime" : "CooldownDuration"], count: row[pve ? "SkillCount" : "MaxChargeStackCount"] }, `${fileName}/${mode}`);
    }
  }
  assert.deepEqual(counts, { weapon_pve: 59, gp_fallback: 4 });
});

test(
  "本地原表核验全部主动技能身份；仅同版本来源进行充能数值等价对比",
  { skip: !existsSync(realContentRoot) },
  (t) => {
    const reader = createWeaponDataSourceReader({ contentRoot: realContentRoot });
    const weapons = readdirSync(weaponDirectory)
      .filter((fileName) => fileName.endsWith(".mdx"))
      .map((fileName) => ({
        fileName,
        data: matter(
          readFileSync(path.join(weaponDirectory, fileName), "utf8"),
        ).data,
      }))
      .filter(({ data }) => typeof data.active_skill_id === "number" && data.active_skill_id > 0);

    const sourceCounts = { weapon_pve: 0, gp_fallback: 0 };
    const fallbackWeapons: Array<[string, number, number]> = [];
    const changedSources = new Set<string>();
    const liveHashes = new Map<string, string>();
    const referenceDifferences: Array<[string, number, number]> = [];

    for (const { fileName, data } of weapons) {
      const prototypeId = String(data.prototype_id);
      const candidates = reader.getPrototypeCandidates(prototypeId, 0);
      assert.equal(candidates.length, 1, `${fileName} Prototype Mode 0 不唯一`);
      const prototypeActiveSkillId = candidates[0].raw.ActiveSkillID;
      assert.equal(typeof prototypeActiveSkillId, "number");

      const resolved = resolveActiveSkillCharge(reader, {
        skillId: prototypeActiveSkillId as number,
      });
      sourceCounts[resolved.source] += 1;
      if (resolved.source === "gp_fallback") {
        fallbackWeapons.push([
          fileName,
          prototypeActiveSkillId as number,
          resolved.chargeTime,
        ]);
      }
      const reference = committedLock.active_skills[`${data.active_skill_id}_1`];
      const kind = reference.source === "weapon_pve" ? "skill-pve" : "gp-active-skill";
      const lockedRow = committedLock.rows[kind][reference.source_key];
      const metadata = lockedRow.source ?? committedLock.sources[kind];
      const sourcePath = path.join(realContentRoot, WEAPON_DATA_SOURCE_FILES[kind]);
      if (!liveHashes.has(sourcePath)) liveHashes.set(sourcePath, createHash("sha256").update(readFileSync(sourcePath)).digest("hex"));
      if (liveHashes.get(sourcePath) === metadata.sha256) {
        const chargeTimeField = kind === "skill-pve" ? "ChargeNeedTime" : "CooldownDuration";
        const correction = currentSkillCorrections.find((entry) => entry.sourceKind === kind && entry.sourceKey === reference.source_key && entry.sourceField === chargeTimeField);
        if (correction) assert.equal(lockedRow.raw[chargeTimeField], correction.after, fileName);
        else assert.equal(resolved.chargeTime, lockedRow.raw[chargeTimeField], fileName);
        assert.equal(resolved.chargeCount, lockedRow.raw[kind === "skill-pve" ? "SkillCount" : "MaxChargeStackCount"], fileName);
      } else changedSources.add(metadata.source_path);

      const audit = auditActiveSkillReference(reader, {
        prototypeId,
        mdxActiveSkillId: data.active_skill_id as number,
      });
      const mismatch = audit.issues.find(
        (issue) => issue.code === "MDX_PROTOTYPE_SKILL_MISMATCH",
      );
      if (mismatch?.code === "MDX_PROTOTYPE_SKILL_MISMATCH") {
        referenceDifferences.push([
          fileName,
          mismatch.mdxActiveSkillId,
          mismatch.prototypeActiveSkillId,
        ]);
      }
    }

    assert.equal(weapons.length, 63);
    assert.deepEqual(sourceCounts, { weapon_pve: 59, gp_fallback: 4 });
    assert.deepEqual(fallbackWeapons.sort(), [
      ["振弦.mdx", 5004901, 30],
      ["春雷震.mdx", 5003101, 0],
      ["火神炎帝.mdx", 5103601, 0],
      ["鬼铜蚀.mdx", 5102501, 0],
    ].sort());
    for (const source of changedSources) t.diagnostic(`本地来源已偏离提交Lock，未进行跨版本数值等价断言：${source}`);
    assert.deepEqual(referenceDifferences, []);

    const steel = auditActiveSkillReference(reader, {
      prototypeId: "20016000004",
      mdxActiveSkillId: 5101601,
    });
    assert.ok(
      steel.issues.some(
        (issue) =>
          issue.code === "ITEM_PROTOTYPE_SKILL_MISMATCH" &&
          issue.itemActiveSkillId === 5101901,
      ),
    );
    assert.equal(
      resolveActiveSkillCharge(reader, { skillId: 5101601 }).chargeTime,
      50,
    );
  },
);
