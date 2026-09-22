// 存储模块：只负责数据文件的读写与结构迁移，不含任何业务判定。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const dbPath = join(__dirname, "data", "ink-stick-testing.json");

export const seed = {
  items: [
    {
      id: "IS-001",
      code: "IS-001",
      smokeSource: "黄山松烟",
      glueRatio: "7.5%",
      ageYears: 8,
      storage: "恒湿柜B",
      status: "已试磨",
      activeReviewId: null,
      logs: [
        { at: "2026-06-10", step: "建档", note: "创建墨锭" },
        { at: "2026-06-11", step: "试磨", note: "宣纸20滴水，出墨快，评分86", score: 86 }
      ],
      tests: [
        { at: "2026-06-11", paper: "宣纸", water: "20滴", speed: "快", colorLayer: "清透", sediment: "无", score: 86 }
      ],
      washes: [],
      reviews: [],
      requisitions: []
    },
    {
      id: "IS-002",
      code: "IS-002",
      smokeSource: "桐油烟",
      glueRatio: "8%",
      ageYears: 3,
      storage: "试样盒C",
      status: "待试磨",
      activeReviewId: null,
      logs: [{ at: "2026-06-12", step: "建档", note: "创建墨锭" }],
      tests: [],
      washes: [],
      reviews: [],
      requisitions: []
    }
  ]
};

const arrays = ["logs", "tests", "washes", "reviews", "requisitions"];

// 把旧版本数据补齐为新结构；幂等，返回是否发生过迁移。
export function migrate(db) {
  let changed = false;
  if (!db || !Array.isArray(db.items)) {
    db.items = [];
    changed = true;
  }
  for (const item of db.items) {
    if (!item.id) {
      item.id = item.code || `IS-${Date.now()}`;
      changed = true;
    }
    for (const key of arrays) {
      if (!Array.isArray(item[key])) {
        item[key] = [];
        changed = true;
      }
    }
    if (item.activeReviewId === undefined) {
      item.activeReviewId = null;
      changed = true;
    }
    // 旧版「重点观察」并入磨后流程的起点「已试磨」。
    if (item.status === "重点观察") {
      item.status = "已试磨";
      item.logs.push({ at: new Date().toISOString(), step: "状态迁移", note: "旧状态「重点观察」并入「已试磨」，等待洗养" });
      changed = true;
    }
  }
  return changed;
}

export async function loadDb() {
  if (!existsSync(dbPath)) {
    await mkdir(dirname(dbPath), { recursive: true });
    await writeFile(dbPath, JSON.stringify(seed, null, 2));
    return structuredClone(seed);
  }
  const db = JSON.parse(await readFile(dbPath, "utf8"));
  if (migrate(db)) await writeFile(dbPath, JSON.stringify(db, null, 2));
  return db;
}

export async function saveDb(db) {
  await writeFile(dbPath, JSON.stringify(db, null, 2));
}
