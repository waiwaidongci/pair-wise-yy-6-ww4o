// 存储模块：只负责 JSON 文件的读写、种子数据与结构兼容，不做业务判定。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "./rules.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.INK_DB_PATH || join(__dirname, "..", "data", "ink-stick-testing.json");

const seed = {
  items: [
    {
      code: "IS-001",
      smokeSource: "黄山松烟",
      glueRatio: "7.5%",
      ageYears: 8,
      storage: "恒湿柜B",
      status: "已入库",
      logs: [
        { at: "2026-06-11T02:10:00.000Z", step: "建档", note: "墨锭建档，进入待试磨" },
        { at: "2026-06-11T03:30:00.000Z", step: "试磨", note: "宣纸20滴水，出墨快，评分86，磨后转入待洗养" },
        { at: "2026-06-12T01:00:00.000Z", step: "洗养", note: "第1张洗养单：换水3次、洗液清澈、擦干干透、养护人周叔 → 通过" },
        { at: "2026-06-12T05:00:00.000Z", step: "入库核验", note: "初检一级（周叔）/ 复核一级（吴婶），级别差0级 → 准入库" },
      ],
      tests: [{ at: "2026-06-11T03:30:00.000Z", paper: "宣纸", water: "20滴", speed: "快", colorLayer: "层次分明", sediment: "少", score: 86 }],
      washSheets: [
        { id: "W-seed-1", at: "2026-06-12T01:00:00.000Z", seq: 1, waterChanges: 3, turbidity: "清澈", dryness: "干透", keeper: "周叔", result: "通过", reasons: [] },
      ],
      verifications: [
        {
          id: "V-seed-1",
          at: "2026-06-12T05:00:00.000Z",
          firstLevel: "一级",
          firstChecker: "周叔",
          reviewLevel: "一级",
          reviewer: "吴婶",
          gap: 0,
          result: "准入库",
          reasons: [],
          voided: false,
          voidedAt: null,
          voidReason: null,
        },
      ],
      holder: null,
      heldFrom: null,
    },
    {
      code: "IS-002",
      smokeSource: "桐油烟",
      glueRatio: "8%",
      ageYears: 3,
      storage: "试样盒C",
      status: "待复洗",
      logs: [
        { at: "2026-06-20T08:00:00.000Z", step: "建档", note: "墨锭建档，进入待试磨" },
        { at: "2026-06-21T03:50:00.000Z", step: "试磨", note: "棉连纸18滴水，评分79，磨后转入待洗养" },
        { at: "2026-06-22T02:00:00.000Z", step: "洗养", note: "第1张洗养单：换水2次、洗液微浑、擦干余湿、养护人吴婶 → 待复洗（换水2次，不足3次；擦干程度为余湿，仍见余湿）" },
      ],
      tests: [{ at: "2026-06-21T03:50:00.000Z", paper: "棉连纸", water: "18滴", speed: "中", colorLayer: "偏暖", sediment: "少", score: 79 }],
      washSheets: [
        {
          id: "W-seed-2",
          at: "2026-06-22T02:00:00.000Z",
          seq: 1,
          waterChanges: 2,
          turbidity: "微浑",
          dryness: "余湿",
          keeper: "吴婶",
          result: "待复洗",
          reasons: ["换水2次，不足3次", "擦干程度为余湿，仍见余湿"],
        },
      ],
      verifications: [],
      holder: null,
      heldFrom: null,
    },
    {
      code: "IS-003",
      smokeSource: "油烟",
      glueRatio: "7%",
      ageYears: 5,
      storage: "恒湿柜A",
      status: "结论失效",
      logs: [
        { at: "2026-05-02T01:00:00.000Z", step: "建档", note: "墨锭建档，进入待试磨" },
        { at: "2026-05-03T01:00:00.000Z", step: "试磨", note: "皮纸22滴水，评分88，磨后转入待洗养" },
        { at: "2026-05-04T01:00:00.000Z", step: "洗养", note: "第1张洗养单：换水3次、洗液清澈、擦干干透、养护人郑伯 → 通过" },
        { at: "2026-05-04T06:00:00.000Z", step: "入库核验", note: "初检二级（郑伯）/ 复核一级（吴婶），级别差1级 → 准入库" },
        { at: "2026-09-15T03:00:00.000Z", step: "档案变更", note: "烟料来源由「油烟」变更为「桐油烟」" },
        { at: "2026-09-15T03:00:00.000Z", step: "结论失效", note: "因烟料来源变更，原入库结论失效；旧洗养单与核验单保留备查，且不计入可入库数量，须重新核验" },
      ],
      tests: [{ at: "2026-05-03T01:00:00.000Z", paper: "皮纸", water: "22滴", speed: "快", colorLayer: "乌亮", sediment: "少", score: 88 }],
      washSheets: [
        { id: "W-seed-3", at: "2026-05-04T01:00:00.000Z", seq: 1, waterChanges: 3, turbidity: "清澈", dryness: "干透", keeper: "郑伯", result: "通过", reasons: [] },
      ],
      verifications: [
        {
          id: "V-seed-3",
          at: "2026-05-04T06:00:00.000Z",
          firstLevel: "二级",
          firstChecker: "郑伯",
          reviewLevel: "一级",
          reviewer: "吴婶",
          gap: 1,
          result: "准入库",
          reasons: [],
          voided: true,
          voidedAt: "2026-09-15T03:00:00.000Z",
          voidReason: "烟料来源变更",
        },
      ],
      holder: null,
      heldFrom: null,
    },
    {
      code: "IS-004",
      smokeSource: "松烟",
      glueRatio: "9%",
      ageYears: 1,
      storage: "晾架D",
      status: "待洗养",
      logs: [
        { at: "2026-09-18T02:00:00.000Z", step: "建档", note: "墨锭建档，进入待试磨" },
        { at: "2026-09-20T07:20:00.000Z", step: "试磨", note: "竹纸15滴水，评分82，磨后转入待洗养" },
      ],
      tests: [{ at: "2026-09-20T07:20:00.000Z", paper: "竹纸", water: "15滴", speed: "中", colorLayer: "偏冷", sediment: "中", score: 82 }],
      washSheets: [],
      verifications: [],
      holder: null,
      heldFrom: null,
    },
    {
      code: "IS-005",
      smokeSource: "漆烟",
      glueRatio: "7.5%",
      ageYears: 6,
      storage: "试样盒A",
      status: "待试磨",
      logs: [{ at: "2026-09-21T01:00:00.000Z", step: "建档", note: "墨锭建档，进入待试磨" }],
      tests: [],
      washSheets: [],
      verifications: [],
      holder: null,
      heldFrom: null,
    },
  ],
};

export async function loadDb() {
  if (!existsSync(dbPath)) {
    await mkdir(dirname(dbPath), { recursive: true });
    await writeFile(dbPath, JSON.stringify(seed, null, 2));
  }
  const raw = JSON.parse(await readFile(dbPath, "utf8"));
  return migrate(raw);
}

export async function saveDb(db) {
  await writeFile(dbPath, JSON.stringify(db, null, 2));
}

// 请求模块通过这两个函数访问数据，业务判定不直接碰文件。
export async function readItems() {
  return (await loadDb()).items;
}
export async function persistItems(items) {
  await saveDb({ items });
}
