// 请求模块：HTTP 路由、请求体解析与响应。不含业务判定，判定一律走 rules.js。
import http from "node:http";
import { loadDb, saveDb } from "./store.js";
import {
  stages,
  turbidityOptions,
  drynessOptions,
  gradeOptions,
  minWaterChanges,
  DomainError,
  createItem,
  addTest,
  addWash,
  addReview,
  editItem,
  requisition,
  summarize,
  computeStats,
  buildHistory
} from "./rules.js";
import { renderPage } from "./view.js";

const port = Number(process.env.PORT || 3037);

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new DomainError("invalid_json", "请求体不是合法 JSON");
  }
}
function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}
function html(res, text) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(text);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const db = await loadDb();

    if (req.method === "GET" && url.pathname === "/") {
      return html(res, renderPage({ stages, turbidityOptions, drynessOptions, gradeOptions, minWaterChanges }));
    }

    // 列表：返回带派生标志的全量数据，页面列表/统计/履历共用同一数据源
    if (req.method === "GET" && url.pathname === "/api/items") {
      return send(res, 200, db.items.map(summarize));
    }

    // 统计：与列表同源计算，保证与列表计数一致
    if (req.method === "GET" && url.pathname === "/api/stats") {
      return send(res, 200, computeStats(db.items));
    }

    if (req.method === "POST" && url.pathname === "/api/items") {
      const item = createItem(db, await readBody(req));
      await saveDb(db);
      return send(res, 201, summarize(item));
    }

    const single = url.pathname.match(/^\/api\/items\/([^/]+)(\/(tests|washes|reviews|requisitions|history))?$/);
    if (single) {
      const [, rawId, , action] = single;
      const id = decodeURIComponent(rawId);

      // 单锭履历
      if (action === "history" && req.method === "GET") {
        const item = db.items.find((x) => x.id === id || x.code === id);
        if (!item) return send(res, 404, { error: "item_not_found" });
        return send(res, 200, { ...summarize(item), history: buildHistory(item) });
      }

      // 档案变更（烟料来源 / 胶料比例等）
      if (!action && req.method === "PATCH") {
        const item = editItem(db, id, await readBody(req));
        await saveDb(db);
        return send(res, 200, summarize(item));
      }

      if (action && req.method === "POST") {
        const input = await readBody(req);
        let item;
        if (action === "tests") item = addTest(db, id, input);
        else if (action === "washes") item = addWash(db, id, input);
        else if (action === "reviews") item = addReview(db, id, input);
        else if (action === "requisitions") item = requisition(db, id, input);
        await saveDb(db);
        return send(res, 201, summarize(item));
      }
    }

    return send(res, 404, { error: "not_found" });
  } catch (error) {
    if (error instanceof DomainError) return send(res, error.status, { error: error.code, message: error.message });
    send(res, 500, { error: "internal_error", message: error.message });
  }
});

server.listen(port, () => console.log("墨锭磨后洗养与入库核验台 listening on http://localhost:" + port));
