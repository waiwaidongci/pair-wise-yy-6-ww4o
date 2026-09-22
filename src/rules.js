// 判定模块：纯业务规则，不接触 HTTP 请求与文件存储。
// 墨锭生命周期：
// 待试磨 →(试磨)→ 待洗养 →(洗养单)→ 待核验 / 待复洗
// 待复洗 →(复洗单)→ 待核验 / 待复洗（待复洗期间暂停领用）
// 待核验 / 结论失效 →(入库核验)→ 已入库（换人复核且级别差≤1）
// 已入库 →(领用)→ 已领用 →(归还) 恢复原状态；烟料或胶料变更则原入库结论失效

export const STAGES = ["待试磨", "待洗养", "待复洗", "待核验", "结论失效", "已入库", "已领用"];
export const STAT_KEYS = [...STAGES, "可入库数量"];
export const TURBIDITY = ["清澈", "微浑", "浑浊"];
export const DRYNESS = ["干透", "表干", "余湿"];
export const LEVELS = ["一级", "二级", "三级", "四级"];
export const MIN_WATER_CHANGES = 3;

const LEGACY_STATUS = { "已试磨": "待洗养", "重点观察": "待洗养" };

export class RuleError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function newId(prefix) {
  return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
const now = () => new Date().toISOString();
const clean = (value) => String(value ?? "").trim();
function pushLog(item, step, note) {
  item.logs.push({ at: now(), step, note });
}

// ---- 存储层结构兼容：旧版“试磨室”数据迁移到洗养核验流程 ----
export function migrate(db) {
  db.items = (db.items || []).map((raw) => {
    const item = {
      holder: null,
      heldFrom: null,
      tests: [],
      washSheets: [],
      verifications: [],
      logs: [],
      ...raw,
    };
    if (!item.id) item.id = item.code || newId("IS");
    if (LEGACY_STATUS[item.status] || !STAGES.includes(item.status)) {
      item.status = LEGACY_STATUS[item.status] || "待试磨";
    }
    return item;
  });
  return db;
}

// ---- 建档 ----
export function createItem(input) {
  const code = clean(input.code);
  if (!code) throw new RuleError(400, "code_required", "墨锭编号必填");
  const item = {
    id: newId("IS"),
    code,
    smokeSource: clean(input.smokeSource),
    glueRatio: clean(input.glueRatio),
    ageYears: Number(input.ageYears) || 0,
    storage: clean(input.storage),
    status: "待试磨",
    holder: null,
    heldFrom: null,
    logs: [],
    tests: [],
    washSheets: [],
    verifications: [],
  };
  pushLog(item, "建档", "墨锭建档，进入待试磨");
  return item;
}

// ---- 试磨 ----
export function applyTest(item, input) {
  if (!["待试磨", "已领用"].includes(item.status)) {
    throw new RuleError(409, "bad_status", `${item.status}状态不能登记试磨`);
  }
  const score = Number(input.score);
  if (!Number.isFinite(score)) throw new RuleError(400, "score_required", "评分必须是数字");
  const test = {
    at: now(),
    paper: clean(input.paper),
    water: clean(input.water),
    speed: clean(input.speed),
    colorLayer: clean(input.colorLayer),
    sediment: clean(input.sediment),
    score,
  };
  item.tests.push(test);
  item.status = "待洗养";
  item.holder = null;
  item.heldFrom = null;
  pushLog(item, "试磨", `${test.paper || "试纸"}，加水${test.water || "未记"}，评分${score}，磨后转入待洗养`);
  return test;
}

// ---- 洗养单判定：换水不足或仍见余湿 → 待复洗 ----
export function evaluateWash(input) {
  const waterChanges = Math.trunc(Number(input.waterChanges));
  const keeper = clean(input.keeper);
  const reasons = [];
  if (!Number.isFinite(waterChanges) || waterChanges < 0) {
    reasons.push("换水次数未填写");
  } else if (waterChanges < MIN_WATER_CHANGES) {
    reasons.push(`换水${waterChanges}次，不足${MIN_WATER_CHANGES}次`);
  }
  if (input.dryness === "余湿") reasons.push("擦干程度为余湿，仍见余湿");
  return {
    waterChanges: Number.isFinite(waterChanges) ? waterChanges : 0,
    turbidity: input.turbidity,
    dryness: input.dryness,
    keeper,
    ok: reasons.length === 0,
    reasons,
  };
}

export function applyWash(item, input) {
  if (!["待洗养", "待复洗"].includes(item.status)) {
    throw new RuleError(409, "bad_status", `${item.status}状态不能提交洗养单`);
  }
  if (!TURBIDITY.includes(input.turbidity)) {
    throw new RuleError(400, "bad_turbidity", "洗液浑浊度取值无效");
  }
  if (!DRYNESS.includes(input.dryness)) {
    throw new RuleError(400, "bad_dryness", "擦干程度取值无效");
  }
  const verdict = evaluateWash(input);
  if (!verdict.keeper) throw new RuleError(400, "keeper_required", "养护人必填");
  const sheet = {
    id: newId("W"),
    at: now(),
    seq: item.washSheets.length + 1,
    waterChanges: verdict.waterChanges,
    turbidity: verdict.turbidity,
    dryness: verdict.dryness,
    keeper: verdict.keeper,
    result: verdict.ok ? "通过" : "待复洗",
    reasons: verdict.reasons,
  };
  item.washSheets.push(sheet);
  item.status = verdict.ok ? "待核验" : "待复洗";
  pushLog(
    item,
    "洗养",
    `第${sheet.seq}张洗养单：换水${sheet.waterChanges}次、洗液${sheet.turbidity}、擦干${sheet.dryness}、养护人${sheet.keeper} → ${sheet.result}${
      verdict.reasons.length ? "（" + verdict.reasons.join("；") + "）" : ""
    }`
  );
  return sheet;
}

// ---- 入库核验：复核须换人，两次检查级别差不超过一级 ----
export function effectiveVerification(item) {
  return item.verifications.length ? item.verifications[item.verifications.length - 1] : null;
}

export function evaluateVerification(input) {
  const i1 = LEVELS.indexOf(input.firstLevel);
  const i2 = LEVELS.indexOf(input.reviewLevel);
  const firstChecker = clean(input.firstChecker);
  const reviewer = clean(input.reviewer);
  const reasons = [];
  if (!firstChecker || !reviewer) reasons.push("初检人与复核人均须填写");
  if (firstChecker && reviewer && firstChecker === reviewer) reasons.push("复核须换人，复核人不能与初检人为同一人");
  const gap = i1 >= 0 && i2 >= 0 ? Math.abs(i1 - i2) : null;
  if (gap !== null && gap > 1) reasons.push(`两次检查级别差为${gap}级，超过一级`);
  return { firstChecker, reviewer, gap, ok: reasons.length === 0 && i1 >= 0 && i2 >= 0, reasons };
}

export function applyVerification(item, input) {
  if (!["待核验", "结论失效"].includes(item.status)) {
    throw new RuleError(409, "bad_status", `${item.status}状态不能提交入库核验`);
  }
  if (!LEVELS.includes(input.firstLevel) || !LEVELS.includes(input.reviewLevel)) {
    throw new RuleError(400, "bad_level", "检查级别取值无效");
  }
  const verdict = evaluateVerification(input);
  const record = {
    id: newId("V"),
    at: now(),
    firstLevel: input.firstLevel,
    firstChecker: verdict.firstChecker,
    reviewLevel: input.reviewLevel,
    reviewer: verdict.reviewer,
    gap: verdict.gap,
    result: verdict.ok ? "准入库" : "驳回",
    reasons: verdict.reasons,
    voided: false,
    voidedAt: null,
    voidReason: null,
  };
  item.verifications.push(record);
  if (verdict.ok) {
    item.status = "已入库";
    item.holder = null;
    item.heldFrom = null;
    pushLog(item, "入库核验", `初检${record.firstLevel}（${record.firstChecker}）/ 复核${record.reviewLevel}（${record.reviewer}），级别差${record.gap}级 → 准入库`);
  } else {
    pushLog(item, "入库核验", `核验驳回：${record.reasons.join("；")}，维持${item.status}`);
  }
  return record;
}

// ---- 领用 / 归还：待复洗暂停领用 ----
export function applyRequisition(item, input) {
  const holder = clean(input.holder);
  if (!holder) throw new RuleError(400, "holder_required", "领用人必填");
  if (item.status === "已领用") throw new RuleError(409, "already_out", `该墨锭已由${item.holder}领用，尚未归还`);
  if (item.status === "待复洗") {
    throw new RuleError(403, "paused_requisition", "待复洗墨锭暂停领用，复洗通过后方可领用");
  }
  item.heldFrom = item.status;
  item.holder = holder;
  item.status = "已领用";
  pushLog(item, "领用", `${holder}领用，领用前状态：${item.heldFrom}`);
  return holder;
}

export function applyReturn(item) {
  if (item.status !== "已领用") throw new RuleError(409, "bad_status", "未处于领用状态，无需归还");
  const restored = STAGES.includes(item.heldFrom) ? item.heldFrom : "待试磨";
  pushLog(item, "归还", `${item.holder}归还，恢复为${restored}`);
  item.status = restored;
  item.holder = null;
  item.heldFrom = null;
}

// ---- 烟料来源 / 胶料比例变更：原入库结论失效，旧单保留 ----
const PATCHABLE = { smokeSource: "烟料来源", glueRatio: "胶料比例", storage: "存放位置", ageYears: "存放年限" };

export function applyPatch(item, patch) {
  const changed = [];
  for (const key of Object.keys(PATCHABLE)) {
    if (!(key in patch)) continue;
    let next = patch[key];
    if (key === "ageYears") next = Number(next) || 0;
    else next = clean(next);
    if (next !== item[key]) {
      changed.push({ key, label: PATCHABLE[key], from: item[key], to: next });
      item[key] = next;
    }
  }
  const compositionChanged = changed.some((c) => c.key === "smokeSource" || c.key === "glueRatio");
  for (const c of changed) pushLog(item, "档案变更", `${c.label}由「${c.from || "未填"}」变更为「${c.to || "未填"}」`);

  if (compositionChanged && item.status === "已入库") {
    const verdict = effectiveVerification(item);
    const reason = changed.filter((c) => c.key === "smokeSource" || c.key === "glueRatio").map((c) => c.label + "变更").join("、");
    if (verdict && verdict.result === "准入库" && !verdict.voided) {
      verdict.voided = true;
      verdict.voidedAt = now();
      verdict.voidReason = reason;
    }
    item.status = "结论失效";
    pushLog(item, "结论失效", `因${reason}，原入库结论失效；旧洗养单与核验单保留备查，且不计入可入库数量，须重新核验`);
  }
  return changed;
}

// ---- 列表投影 / 统计 / 单锭履历 ----
export function isStockable(item) {
  const v = effectiveVerification(item);
  return item.status === "已入库" && !!v && v.result === "准入库" && !v.voided;
}

export function summarizeItem(item) {
  return {
    id: item.id,
    code: item.code,
    smokeSource: item.smokeSource,
    glueRatio: item.glueRatio,
    ageYears: item.ageYears,
    storage: item.storage,
    status: item.status,
    holder: item.holder,
    washCount: item.washSheets.length,
    latestWash: item.washSheets.length ? item.washSheets[item.washSheets.length - 1] : null,
    rejectedCount: item.verifications.filter((v) => v.result === "驳回").length,
    effectiveVerification: effectiveVerification(item),
    requisitionPaused: item.status === "待复洗",
    stockable: isStockable(item),
  };
}

export function computeStats(items) {
  const stats = Object.fromEntries(STAGES.map((s) => [s, 0]));
  for (const item of items) if (stats[item.status] !== undefined) stats[item.status] += 1;
  stats["可入库数量"] = items.filter(isStockable).length;
  return stats;
}

export function buildResume(item) {
  const entries = [];
  for (const log of item.logs) {
    const tone = log.step === "结论失效" ? "fail" : log.note.includes("待复洗") || log.note.includes("驳回") ? "fail" : "plain";
    entries.push({ at: log.at, title: log.step, detail: log.note, tone });
  }
  for (const t of item.tests) {
    entries.push({ at: t.at, title: "试磨记录", detail: `${t.paper || "试纸"} · 加水${t.water || "未记"} · 出墨${t.speed || "未记"} · ${t.colorLayer || "墨色未记"} · 沉淀${t.sediment || "未记"} · 评分${t.score}`, tone: "plain" });
  }
  for (const w of item.washSheets) {
    entries.push({
      at: w.at,
      title: `第${w.seq}张洗养单`,
      detail: `换水${w.waterChanges}次 · 洗液${w.turbidity} · 擦干${w.dryness} · 养护人${w.keeper} · ${w.result}${w.reasons.length ? "（" + w.reasons.join("；") + "）" : ""}`,
      tone: w.result === "通过" ? "ok" : "fail",
    });
  }
  for (const v of item.verifications) {
    const tag = v.voided ? ` · <b class="warn">旧单已失效（${v.voidReason || "烟胶变更"}，${v.voidedAt || ""}）</b>` : "";
    entries.push({
      at: v.at,
      title: "入库核验单" + (v.voided ? "（已作废保留）" : ""),
      detail: `初检${v.firstLevel}（${v.firstChecker}）/ 复核${v.reviewLevel}（${v.reviewer}）· 级别差${v.gap}级 · ${v.result}${v.reasons.length ? "（" + v.reasons.join("；") + "）" : ""}${tag}`,
      tone: v.voided ? "fail" : v.result === "准入库" ? "ok" : "fail",
    });
  }
  return entries.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}
