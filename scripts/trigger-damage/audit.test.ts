import assert from "node:assert/strict";
import test from "node:test";
import { numericalRows, verifyReviewedExecution } from "./audit";

test("完整展开元素伤害组，保留非规范表行身份而不把后缀当作等级", () => {
  assert.deepEqual(numericalRows("11010046-50"), [
    "11010046_1", "11010047_1", "11010048_1", "11010049_1", "11010050_1",
  ]);
  assert.deepEqual(numericalRows("11010133 / 11010134"), ["11010133_1", "11010134_1"]);
  assert.deepEqual(numericalRows("11010053_2"), ["11010053_2"]);
  assert.deepEqual(numericalRows("11010105-11010108"), ["11010105_1", "11010106_1", "11010107_1", "11010108_1"]);
});

test("只有明确缺失执行或未实现条目免于行核验，格式错误不能静默漏审", () => {
  assert.deepEqual(numericalRows("执行资产已移除"), []);
  assert.deepEqual(numericalRows("-"), []);
  assert.throws(() => numericalRows("11010133 / typo"), /Invalid Numerical reference/);
  assert.throws(() => numericalRows("11010108-05"), /Invalid Numerical range/);
});

test("相同伤害数值不能让变化的执行资产或区域配置自动获得发布资格", () => {
  const reviewed = [{ path: "Abilities/MGE.uasset", sha256: "old" }, { path: "AIBehavior/Zone.json", sha256: "zone" }];
  assert.doesNotThrow(() => verifyReviewedExecution(reviewed, reviewed));
  assert.throws(() => verifyReviewedExecution([{ ...reviewed[0], sha256: "new" }], reviewed), /Re-review/);
  assert.throws(() => verifyReviewedExecution([{ ...reviewed[1], sha256: "changed-zone" }], reviewed), /Re-review/);
  assert.throws(() => verifyReviewedExecution([{ path: "Abilities/unreviewed.uasset", sha256: "new" }], reviewed), /Re-review/);
});
