// 请求模块：解析 HTTP 请求、调用判定模块、通过存储模块落盘。
// 不包含业务规则本身——规则全部在 rules.js。
import {
  STAGES,
  TURBIDITY,
  DRYNESS,
  LEVELS,
  MIN_WATER_CHANGES,
  RuleError,
  createItem,
  applyTest,
  applyWash,
  applyVerification,
  applyRequisition,
  applyReturn,
  applyPatch,
  summarizeItem,
  computeStats,
  buildResume,
} from "./rules.js";
import { readItems, persistItems } from "./storage.js";

export async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

export function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

export async function handleError(res, error) {
  if (error instanceof RuleError) return send(res, error.status, { error: error.code, message: error.message });
  if (error instanceof SyntaxError) return send(res, 400, { error: "bad_json", message: "请求体不是合法 JSON" });
  send(res, 500, { error: "internal_error", message: error.message });
}

async function mutate(mutator) {
  const items = await readItems();
  const result = mutator(items);
  await persistItems(items);
  return result;
}

const findItem = (items, key) => {
  const item = items.find((x) => x.id === key || x.code === key);
  if (!item) throw new RuleError(404, "item_not_found", "未找到该墨锭");
  return item;
};

export const routes = {
  meta: () => ({
    stages: STAGES,
    turbidity: TURBIDITY,
    dryness: DRYNESS,
    levels: LEVELS,
    minWaterChanges: MIN_WATER_CHANGES,
  }),

  list: async () => (await readItems()).map(summarizeItem),

  stats: async () => computeStats(await readItems()),

  detail: async (key) => {
    const item = findItem(await readItems(), key);
    return { ...item, resume: buildResume(item) };
  },

  create: async (input) =>
    mutate((items) => {
      if (items.some((x) => x.code === String(input.code ?? "").trim())) {
        throw new RuleError(409, "code_duplicate", "墨锭编号已存在");
      }
      const item = createItem(input);
      items.unshift(item);
      return item;
    }),

  test: async (key, input) =>
    mutate((items) => {
      const item = findItem(items, key);
      applyTest(item, input);
      return item;
    }),

  wash: async (key, input) =>
    mutate((items) => {
      const item = findItem(items, key);
      return applyWash(item, input);
    }),

  verify: async (key, input) =>
    mutate((items) => {
      const item = findItem(items, key);
      return applyVerification(item, input);
    }),

  requisition: async (key, input) =>
    mutate((items) => {
      const item = findItem(items, key);
      applyRequisition(item, input);
      return { holder: item.holder, status: item.status };
    }),

  "requisition-return": async (key) =>
    mutate((items) => {
      const item = findItem(items, key);
      applyReturn(item);
      return { status: item.status };
    }),

  patch: async (key, patch) =>
    mutate((items) => {
      const item = findItem(items, key);
      const changed = applyPatch(item, patch || {});
      return { changed: changed.map((c) => c.label), status: item.status };
    }),
};
