import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  createWeaponDataSourceReader,
  WEAPON_DATA_SOURCE_FILES,
  WeaponDataSourceError,
  type WeaponDataSourceKind,
} from "./source-reader";

type Rows = Record<string, unknown>;

const defaultRows: Record<WeaponDataSourceKind, Rows> = {
  "numerical-lc": {
    "120300110_1": {
      id: 120300110,
      Level: 1,
      Settlements: [
        {
          TagName: "Settlement.Damage.Weapon",
          UnknownSettlementField: { keep: true },
        },
      ],
      UnknownTopLevel: { nested: [1, 2, 3] },
    },
    "120300111_1": { id: 120300111, Level: 1, marker: "lc-hit" },
    "120300112_1": { id: 120300112, Level: 1, marker: "explosion" },
    "777_1": { id: 777, Level: 1, marker: "lc-only" },
    "legacy-row_1": { id: 999, Level: 2, marker: "identity-mismatch" },
  },
  "numerical-td": {
    "120300110_1": { id: 120300110, Level: 1, marker: "td" },
  },
  asc: {
    "143": { ASCTypeID: "143", FireIntervalBase: 0.33, UnknownAsc: true },
    "184": { ASCTypeID: "184", FireIntervalBase: 0.75 },
  },
  feel: {
    "143": { WeaponFeelParamID: "143", WeaponChangeClipTimeBase: 2.1 },
    "184": { WeaponFeelParamID: "184", WeaponChangeClipTimeBase: 2.4 },
  },
  item: {
    "20103000010": {
      ItemID: 20103000010,
      ModelID: 20003000011,
      AccuracyInt: 77,
    },
    "20103000011": {
      ItemID: 20103000011,
      ModelID: 20003000011,
      AccuracyInt: 78,
    },
    "20106000003": {
      ItemID: 20106000003,
      ModelID: 20006000003,
    },
    "20106000005": {
      ItemID: 20106000005,
      ModelID: 20006000003,
    },
    "20106000006": {
      ItemID: 20106000006,
      ModelID: 20006000003,
    },
  },
  prototype: {
    "飓风之龙": {
      PrototypeID: "20003000011",
      Mode: 0,
      ASCTypeID: "143",
      NumericalID: 120300110,
      ExplosionNumericalID: 0,
    },
    "飓风之龙-龙炎": {
      PrototypeID: "20003000011",
      Mode: 1,
      ASCTypeID: "184",
      NumericalID: 120300111,
      ExplosionNumericalID: 120300112,
    },
    "冲突-A": {
      PrototypeID: "20013000050",
      Mode: 0,
      ASCTypeID: "143",
      NumericalID: 120300110,
    },
    "冲突-B": {
      PrototypeID: "20013000050",
      Mode: 0,
      ASCTypeID: "184",
      NumericalID: 120300111,
    },
  },
  "skill-pve": {
    "5100101_1": {
      SkillID: 5100101,
      Level: 1,
      ChargeNeedTime: 45,
      SkillCount: 1,
      Parameters: [{ Name: "Unknown", Value: "kept" }],
    },
  },
  "gp-active-skill": {
    "5004901": {
      AbilityID: 5004901,
      CooldownDuration: 30,
      MaxChargeStackCount: 1,
    },
    "5000501": {
      AbilityID: 5004701,
      CooldownDuration: 15,
      MaxChargeStackCount: 1,
    },
  },
};

function writeSource(root: string, kind: WeaponDataSourceKind, value: unknown): void {
  const filePath = path.join(
    root,
    ...WEAPON_DATA_SOURCE_FILES[kind].split("/"),
  );
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value), "utf8");
}

function createFixture(
  context: TestContext,
  overrides: Partial<Record<WeaponDataSourceKind, Rows>> = {},
) {
  const root = mkdtempSync(path.join(tmpdir(), "weapon-data-reader-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  for (const kind of Object.keys(WEAPON_DATA_SOURCE_FILES) as WeaponDataSourceKind[]) {
    writeSource(root, kind, [{ Rows: overrides[kind] ?? defaultRows[kind] }]);
  }
  return {
    root,
    reader: createWeaponDataSourceReader({ contentRoot: root }),
  };
}

function captureSourceError(action: () => unknown): WeaponDataSourceError {
  try {
    action();
  } catch (error) {
    assert.ok(error instanceof WeaponDataSourceError);
    return error;
  }
  assert.fail("expected WeaponDataSourceError");
}

test("精确读取八类来源并完整保留未知原始字段", (context) => {
  const { reader } = createFixture(context);
  const numerical = reader.getNumerical({ table: "lc", id: 120300110, level: 1 });

  assert.equal(numerical.key, "lc:120300110_1");
  assert.equal(numerical.kind, "numerical-lc");
  assert.deepEqual(numerical.raw.Settlements, [
    {
      TagName: "Settlement.Damage.Weapon",
      UnknownSettlementField: { keep: true },
    },
  ]);
  assert.deepEqual(numerical.raw.UnknownTopLevel, { nested: [1, 2, 3] });
  assert.ok(Object.isFrozen(numerical.raw));
  assert.ok(Object.isFrozen(numerical.raw.Settlements));

  assert.equal(reader.getAsc("143").raw.UnknownAsc, true);
  assert.equal(reader.getFeel("143").rowName, "143");
  assert.equal(reader.getItem("20103000010").raw.AccuracyInt, 77);
  assert.equal(reader.getPrototype({ prototypeId: "20003000011", mode: 0 }).rowName, "飓风之龙");
  assert.ok(
    reader
      .getNumericalRows("lc")
      .some((row) => row.key === "lc:120300110_1" && row.table === "lc"),
  );
  assert.deepEqual(
    reader.getPrototypeRows("20003000011").map((row) => row.rowName),
    ["飓风之龙", "飓风之龙-龙炎"],
  );
  assert.deepEqual(
    reader.getWeaponPveSkill({ skillId: 5100101, level: 1 }).raw.Parameters,
    [{ Name: "Unknown", Value: "kept" }],
  );
  assert.equal(reader.getGpActiveSkill(5004901).raw.CooldownDuration, 30);
});

test("纯白至上多 Item 候选保持候选集合并允许显式精确选择", (context) => {
  const { reader } = createFixture(context);
  assert.deepEqual(
    reader.findItemsByPrototypeId("20006000003").map((item) => item.key),
    ["20106000003", "20106000005", "20106000006"],
  );
  assert.equal(reader.getItem("20106000005").key, "20106000005");
});

test("PVE 技能身份严格校验，GP 使用 rowName 并保留 AbilityID 差异诊断", (context) => {
  const { reader } = createFixture(context);
  assert.equal(
    reader.getWeaponPveSkill({ skillId: 5100101, level: 1 }).key,
    "5100101_1",
  );
  assert.equal(reader.getGpActiveSkill(5000501).raw.AbilityID, 5004701);
  assert.deepEqual(reader.getGpActiveSkillDiagnostics(), [
    {
      code: "GP_ACTIVE_SKILL_IDENTITY_MISMATCH",
      kind: "gp-active-skill",
      sourcePath: "DataTables/GPActiveSkillDataTable.json",
      rowName: "5000501",
      rawAbilityId: 5004701,
    },
  ]);

  const invalidPve = createFixture(context, {
    "skill-pve": {
      alias: { SkillID: 5100101, Level: 1 },
    },
  });
  const error = captureSourceError(() =>
    invalidPve.reader.getWeaponPveSkill({ skillId: 5100101, level: 1 }),
  );
  assert.equal(error.code, "KEY_MISMATCH");
  assert.match(error.message, /SkillConfigTable_Weapon_PVE\.json/);
});

test("LC 和 TD 同 ID 保持隔离，禁止跨表回退", (context) => {
  const { reader } = createFixture(context);
  assert.equal(
    reader.getNumerical({ table: "lc", id: 120300110, level: 1 }).raw.UnknownTopLevel !== undefined,
    true,
  );
  assert.equal(
    reader.getNumerical({ table: "td", id: 120300110, level: 1 }).raw.marker,
    "td",
  );

  const error = captureSourceError(() =>
    reader.getNumerical({ table: "td", id: 777, level: 1 }),
  );
  assert.equal(error.code, "TABLE_MISMATCH");
  assert.equal(error.kind, "numerical-td");
  assert.match(error.message, /TD_numerical_config_composite\.json/);
  assert.match(error.message, /td:777_1/);
});

test("Numerical 使用 Unreal rowName，行内身份差异只产生诊断", (context) => {
  const { reader } = createFixture(context);
  const diagnostics = reader.getNumericalDiagnostics("lc");
  const mismatch = diagnostics.find((item) => item.rowName === "legacy-row_1");

  assert.ok(mismatch);
  assert.equal(mismatch.expectedRowName, "999_2");
  assert.equal(mismatch.rawId, 999);
  assert.equal(mismatch.rawLevel, 2);
});

test("飓风之龙 Prototype 链路校验 Numerical、ASC 和默认 Feel", (context) => {
  const { reader } = createFixture(context);
  const mode0 = reader.validatePrototypeLink({
    prototypeId: "20003000011",
    mode: 0,
    numerical: { table: "lc", id: 120300110, level: 1 },
    ascTypeId: "143",
  });
  const mode1 = reader.validatePrototypeLink({
    prototypeId: "20003000011",
    mode: 1,
    numerical: { table: "lc", id: 120300111, level: 1 },
    ascTypeId: "184",
  });
  const explosion = reader.validatePrototypeLink({
    prototypeId: "20003000011",
    mode: 1,
    numerical: { table: "lc", id: 120300112, level: 1 },
  });

  assert.equal(mode0.numericalField, "NumericalID");
  assert.equal(mode0.asc?.rowName, "143");
  assert.equal(mode0.feel?.rowName, "143");
  assert.equal(mode1.asc?.rowName, "184");
  assert.equal(mode1.feel?.rowName, "184");
  assert.equal(explosion.numericalField, "ExplosionNumericalID");
  assert.equal(explosion.asc, undefined);
});

test("Prototype 重复组合保留候选并要求 rowName 消歧", (context) => {
  const { reader } = createFixture(context);
  const candidates = reader.getPrototypeCandidates("20013000050", 0);
  assert.deepEqual(
    candidates.map((candidate) => candidate.rowName),
    ["冲突-A", "冲突-B"],
  );

  const error = captureSourceError(() =>
    reader.getPrototype({ prototypeId: "20013000050", mode: 0 }),
  );
  assert.equal(error.code, "AMBIGUOUS_KEY");
  assert.deepEqual(error.candidates, ["冲突-A", "冲突-B"]);
  assert.match(error.message, /20013000050:0/);

  assert.equal(
    reader.getPrototype({
      prototypeId: "20013000050",
      mode: 0,
      rowName: "冲突-B",
    }).raw.ASCTypeID,
    "184",
  );
});

test("Item 精确读取与 Prototype 候选查询保持分离", (context) => {
  const { reader } = createFixture(context);
  assert.equal(reader.getItem("20103000010").rowName, "20103000010");
  assert.deepEqual(
    reader.findItemsByPrototypeId("20003000011").map((item) => item.rowName),
    ["20103000010", "20103000011"],
  );
  assert.equal(reader.findItemsByPrototypeId("999").length, 0);
});

test("文件、JSON、包装和 Row 错误带来源上下文", (context) => {
  const missing = createFixture(context);
  const ascPath = path.join(
    missing.root,
    ...WEAPON_DATA_SOURCE_FILES.asc.split("/"),
  );
  rmSync(ascPath);
  let error = captureSourceError(() => missing.reader.getAsc("143"));
  assert.equal(error.code, "FILE_NOT_FOUND");
  assert.match(error.message, /asc.*attr_weapon_asc\.json/);

  const invalidJson = createFixture(context);
  const feelPath = path.join(
    invalidJson.root,
    ...WEAPON_DATA_SOURCE_FILES.feel.split("/"),
  );
  writeFileSync(feelPath, "{", "utf8");
  error = captureSourceError(() => invalidJson.reader.getFeel("143"));
  assert.equal(error.code, "INVALID_JSON");
  assert.match(error.message, /feel.*WeaponFeelParamTable\.json/);

  const invalidWrapper = createFixture(context);
  writeSource(invalidWrapper.root, "item", { Rows: {} });
  error = captureSourceError(() => invalidWrapper.reader.getItem("1"));
  assert.equal(error.code, "INVALID_WRAPPER");

  const invalidRow = createFixture(context, { asc: { "143": null } });
  error = captureSourceError(() => invalidRow.reader.getAsc("143"));
  assert.equal(error.code, "INVALID_ROW");
  assert.equal(error.key, "143");
});

test("身份冲突、缺失引用和 Prototype 关系错误不会被吞掉", (context) => {
  const duplicate = createFixture(context, {
    asc: {
      "143": { ASCTypeID: "143" },
      alias: { ASCTypeID: "143" },
    },
  });
  let error = captureSourceError(() => duplicate.reader.getAsc("143"));
  assert.equal(error.code, "DUPLICATE_KEY");

  const keyMismatch = createFixture(context, {
    feel: { alias: { WeaponFeelParamID: "143" } },
  });
  error = captureSourceError(() => keyMismatch.reader.getFeel("143"));
  assert.equal(error.code, "KEY_MISMATCH");
  assert.match(error.message, /alias/);

  const fixture = createFixture(context);
  error = captureSourceError(() => fixture.reader.getFeel("999"));
  assert.equal(error.code, "NOT_FOUND");
  assert.match(error.message, /feel.*key=999/);

  error = captureSourceError(() =>
    fixture.reader.validatePrototypeLink({
      prototypeId: "20003000011",
      mode: 0,
      numerical: { table: "lc", id: 120300111, level: 1 },
      ascTypeId: "143",
    }),
  );
  assert.equal(error.code, "PROTOTYPE_LINK_MISMATCH");

  error = captureSourceError(() =>
    fixture.reader.validatePrototypeLink({
      prototypeId: "20003000011",
      mode: 0,
      numerical: { table: "lc", id: 120300110, level: 1 },
      ascTypeId: "184",
    }),
  );
  assert.equal(error.code, "PROTOTYPE_LINK_MISMATCH");
});
