// 判定模块：洗养、复核、入库、领用管控与履历聚合的全部业务规则。
// 不接触文件系统，输入输出均为纯数据，便于与请求层、存储层解耦。

export const stages = ["待试磨", "已试磨", "待复核", "待复洗", "已入库"];
export const statLabels = ["待试磨", "已试磨", "待复核", "待复洗", "已入库", "可入库", "暂停领用"];

export const turbidityOptions = ["清澈", "微浑", "浑浊"];
export const drynessOptions = ["干透", "表面微湿", "边角余湿"];
export const gradeOptions = ["一级", "二级", "三级"];
export const minWaterChanges = 3;

export class DomainError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const nowIso = () => new Date().toISOString();
let seq = 0;
const genId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

function text(input, key, label) {
  const value = String(input?.[key] ?? "").trim();
  if (!value) throw new DomainError("missing_field", `请填写${label}`);
  return value;
}
function integer(input, key, label) {
  const value = Number(input?.[key]);
  if (!Number.isFinite(value) || value < 0) throw new DomainError("invalid_field", `${label}必须为非负数字`);
  return Math.round(value);
}
function oneOf(input, key, label, options) {
  const value = String(input?.[key] ?? "").trim();
  if (!options.includes(value)) throw new DomainError("invalid_field", `${label}必须是：${options.join("、")}`);
  return value;
}
function pushLog(item, step, note, extra = {}) {
  item.logs.push({ at: nowIso(), step, note, ...extra });
}
function findItem(db, idOrCode) {
  const item = db.items.find((x) => x.id === idOrCode || x.code === idOrCode);
  if (!item) throw new DomainError("item_not_found", "墨锭不存在", 404);
  return item;
}

// ---------- 建档 ----------
export function createItem(db, input) {
  const code = text(input, "code", "墨锭编号");
  if (db.items.some((x) => x.code === code)) throw new DomainError("duplicate_code", "墨锭编号已存在", 409);
  const status = String(input.status || "待试磨").trim();
  if (status !== "待试磨" && status !== "已试磨") {
    throw new DomainError("invalid_status", "建档状态只能是「待试磨」或「已试磨」");
  }
  const item = {
    id: genId("IS"),
    code,
    smokeSource: text(input, "smokeSource", "烟料来源"),
    glueRatio: text(input, "glueRatio", "胶料比例"),
    ageYears: integer(input, "ageYears", "存放年限"),
    storage: text(input, "storage", "存放位置"),
    status,
    activeReviewId: null,
    logs: [],
    tests: [],
    washes: [],
    reviews: [],
    requisitions: []
  };
  pushLog(item, "建档", `创建墨锭，初始状态${status}`);
  db.items.unshift(item);
  return item;
}

// ---------- 试磨 ----------
export function addTest(db, idOrCode, input) {
  const item = findItem(db, idOrCode);
  if (item.status !== "待试磨" && item.status !== "已试磨") {
    throw new DomainError("status_not_allowed", `当前状态「${item.status}」不能录入试磨记录`, 409);
  }
  const test = {
    id: genId("T"),
    at: nowIso(),
    paper: String(input.paper || "").trim(),
    water: String(input.water || "").trim(),
    speed: String(input.speed || "").trim(),
    colorLayer: String(input.colorLayer || "").trim(),
    sediment: String(input.sediment || "").trim(),
    score: integer(input, "score", "评分")
  };
  item.tests.push(test);
  item.status = "已试磨";
  pushLog(item, "试磨", `${test.paper || "试纸"}，评分${test.score}`, { score: test.score });
  return item;
}

// ---------- 洗养 ----------
// 换水次数不足（<3次）或擦干程度未达「干透」（仍见余湿）→ 待复洗，暂停领用。
export function addWash(db, idOrCode, input) {
  const item = findItem(db, idOrCode);
  if (item.status !== "已试磨" && item.status !== "待复洗") {
    throw new DomainError("status_not_allowed", `当前状态「${item.status}」不能提交洗养单`, 409);
  }
  const waterChanges = integer(input, "waterChanges", "换水次数");
  const turbidity = oneOf(input, "turbidity", "洗液浑浊度", turbidityOptions);
  const dryness = oneOf(input, "dryness", "擦干程度", drynessOptions);
  const caretaker = text(input, "caretaker", "养护人");
  const note = String(input.note || "").trim();

  const waterOk = waterChanges >= minWaterChanges;
  const dryOk = dryness === "干透";
  const passed = waterOk && dryOk;
  const reasons = [];
  if (!waterOk) reasons.push(`换水仅${waterChanges}次（不足${minWaterChanges}次）`);
  if (!dryOk) reasons.push(`擦干程度「${dryness}」，仍见余湿`);

  const wash = {
    id: genId("W"),
    at: nowIso(),
    waterChanges,
    turbidity,
    dryness,
    caretaker,
    note,
    passed,
    failReason: reasons.join("；")
  };
  item.washes.push(wash);
  item.status = passed ? "待复核" : "待复洗";
  pushLog(
    item,
    "洗养",
    passed
      ? `换水${waterChanges}次、${turbidity}、${dryness}，养护人${caretaker}，送复核`
      : `换水${waterChanges}次、${turbidity}、${dryness}，养护人${caretaker}；${wash.failReason}，转入待复洗`,
    { washId: wash.id }
  );
  return item;
}

// ---------- 复核入库 ----------
// 复核须换人：初检人与复检人不得同一人；两次检查级别差不超过一级才准入库。
export function addReview(db, idOrCode, input) {
  const item = findItem(db, idOrCode);
  if (item.status !== "待复核" && item.status !== "已入库") {
    throw new DomainError("status_not_allowed", `当前状态「${item.status}」不能提交复核单`, 409);
  }
  const firstInspector = text(input, "firstInspector", "初检人");
  const secondInspector = text(input, "secondInspector", "复检人");
  if (firstInspector === secondInspector) {
    throw new DomainError("same_inspector", "复核须换人，初检人与复检人不能为同一人", 409);
  }
  const firstGrade = oneOf(input, "firstGrade", "初检级别", gradeOptions);
  const secondGrade = oneOf(input, "secondGrade", "复检级别", gradeOptions);
  const diff = Math.abs(gradeOptions.indexOf(firstGrade) - gradeOptions.indexOf(secondGrade));
  if (diff > 1) throw new DomainError("grade_gap_too_large", `两次检查级别差为${diff}级，超过一级，不准入库`, 409);

  const review = {
    id: genId("R"),
    at: nowIso(),
    firstInspector,
    firstGrade,
    secondInspector,
    secondGrade,
    gradeDiff: diff,
    note: String(input.note || "").trim(),
    valid: true,
    invalidatedAt: null,
    invalidateReason: null
  };
  item.reviews.push(review);
  item.status = "已入库";
  item.activeReviewId = review.id;
  pushLog(
    item,
    "复核入库",
    `初检${firstGrade}（${firstInspector}）/复检${secondGrade}（${secondInspector}），级别差${diff}级，准予入库`,
    { reviewId: review.id }
  );
  return item;
}

// ---------- 档案变更 ----------
// 烟料来源或胶料比例变更后，原入库结论失效但保留旧单，也不计入可入库数量。
export function editItem(db, idOrCode, input) {
  const item = findItem(db, idOrCode);
  const patch = {};
  if (input.smokeSource !== undefined) patch.smokeSource = text(input, "smokeSource", "烟料来源");
  if (input.glueRatio !== undefined) patch.glueRatio = text(input, "glueRatio", "胶料比例");
  if (input.storage !== undefined) patch.storage = text(input, "storage", "存放位置");
  if (input.ageYears !== undefined && String(input.ageYears).trim() !== "") {
    patch.ageYears = integer(input, "ageYears", "存放年限");
  }

  const formulaChanged =
    (patch.smokeSource !== undefined && patch.smokeSource !== item.smokeSource) ||
    (patch.glueRatio !== undefined && patch.glueRatio !== item.glueRatio);
  const changes = [];
  for (const [key, label] of [["smokeSource", "烟料来源"], ["glueRatio", "胶料比例"], ["ageYears", "存放年限"], ["storage", "存放位置"]]) {
    if (patch[key] !== undefined && patch[key] !== item[key]) {
      changes.push(`${label}：${item[key]} → ${patch[key]}`);
    }
  }
  Object.assign(item, patch);
  if (!changes.length) return item;

  if (formulaChanged) {
    const active = item.reviews.find((r) => r.id === item.activeReviewId && r.valid);
    if (active) {
      active.valid = false;
      active.invalidatedAt = nowIso();
      active.invalidateReason = "烟料来源/胶料比例变更";
      item.activeReviewId = null;
    }
    if (item.status === "已入库") item.status = "待复核";
    pushLog(item, "档案变更", `${changes.join("；")}。原入库结论失效，旧单保留，须重新复核`);
  } else {
    pushLog(item, "档案变更", changes.join("；"));
  }
  return item;
}

// ---------- 领用 ----------
// 待复洗的墨锭暂停领用。
export function requisition(db, idOrCode, input) {
  const item = findItem(db, idOrCode);
  if (item.status === "待复洗") {
    throw new DomainError("requisition_held", "该墨锭处于待复洗，暂停领用", 409);
  }
  const borrower = text(input, "borrower", "领用人");
  const purpose = String(input.purpose || "").trim();
  const record = { id: genId("Q"), at: nowIso(), borrower, purpose };
  item.requisitions.push(record);
  pushLog(item, "领用", `领用人${borrower}${purpose ? "，用途：" + purpose : ""}`);
  return item;
}

// ---------- 汇总、统计与履历 ----------
export function summarize(item) {
  const activeReview = item.reviews.find((r) => r.id === item.activeReviewId && r.valid) || null;
  const latestWash = item.washes.length ? item.washes[item.washes.length - 1] : null;
  return {
    ...item,
    activeReview,
    latestWash,
    requisitionHeld: item.status === "待复洗",
    logCount:
      item.logs.length + item.tests.length + item.washes.length + item.reviews.length + item.requisitions.length
  };
}

export function computeStats(items) {
  const stats = Object.fromEntries(statLabels.map((label) => [label, 0]));
  for (const item of items) {
    if (stats[item.status] !== undefined) stats[item.status] += 1;
    if (item.reviews.some((r) => r.id === item.activeReviewId && r.valid)) stats["可入库"] += 1;
    if (item.status === "待复洗") stats["暂停领用"] += 1;
  }
  return stats;
}

// 单锭履历：各类单据与操作日志合并为同一条时间线，供页面与数据层共用。
export function buildHistory(item) {
  const entries = [];
  for (const log of item.logs) entries.push({ ...log, kind: "操作" });
  for (const t of item.tests) {
    entries.push({
      at: t.at,
      kind: "试磨单",
      refId: t.id,
      step: "试磨",
      note: `${t.paper || "试纸"} · ${t.water || "加水未记"} · 出墨${t.speed || "未记"} · ${t.colorLayer || ""} · 沉淀${t.sediment || "未记"} · 评分${t.score}`
    });
  }
  for (const w of item.washes) {
    entries.push({
      at: w.at,
      kind: w.passed ? "洗养单" : "洗养单（不合格）",
      refId: w.id,
      step: "洗养",
      note: `换水${w.waterChanges}次 · ${w.turbidity} · ${w.dryness} · 养护人${w.caretaker}${w.note ? " · " + w.note : ""}${w.passed ? "" : " · " + w.failReason}`
    });
  }
  for (const r of item.reviews) {
    const state = !r.valid ? "（已失效）" : "";
    entries.push({
      at: r.valid ? r.at : r.invalidatedAt || r.at,
      kind: r.valid ? "复核单" : "复核单（失效）",
      refId: r.id,
      step: "复核",
      note: `初检${r.firstGrade}·${r.firstInspector} / 复检${r.secondGrade}·${r.secondInspector}（级别差${r.gradeDiff}级）${state}${r.invalidateReason ? " · " + r.invalidateReason : ""}`,
      originalAt: r.at
    });
  }
  for (const q of item.requisitions) {
    entries.push({
      at: q.at,
      kind: "领用单",
      refId: q.id,
      step: "领用",
      note: `领用人${q.borrower}${q.purpose ? " · " + q.purpose : ""}`
    });
  }
  return entries.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
