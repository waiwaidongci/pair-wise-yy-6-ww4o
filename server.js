// HTTP 入口：仅做路由分发。请求解析在 src/api.js，业务判定在 src/rules.js，存取在 src/storage.js。
import http from "node:http";
import { readBody, send, handleError, routes } from "./src/api.js";
import { page } from "./src/page.js";

const port = Number(process.env.PORT || 3037);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const { pathname } = url;

    if (req.method === "GET" && pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(page());
    }
    if (req.method === "GET" && pathname === "/api/meta") return send(res, 200, routes.meta());
    if (req.method === "GET" && pathname === "/api/items") return send(res, 200, await routes.list());
    if (req.method === "POST" && pathname === "/api/items") return send(res, 201, await routes.create(await readBody(req)));
    if (req.method === "GET" && pathname === "/api/stats") return send(res, 200, await routes.stats());

    const one = pathname.match(/^\/api\/items\/([^/]+)$/);
    if (one && req.method === "GET") return send(res, 200, await routes.detail(decodeURIComponent(one[1])));
    if (one && req.method === "PATCH") return send(res, 200, await routes.patch(decodeURIComponent(one[1]), await readBody(req)));

    const sub = pathname.match(/^\/api\/items\/([^/]+)\/(tests|wash-sheets|verifications|requisition)$/);
    if (sub) {
      const key = decodeURIComponent(sub[1]);
      const resource = sub[2];
      if (resource === "tests" && req.method === "POST") return send(res, 201, await routes.test(key, await readBody(req)));
      if (resource === "wash-sheets" && req.method === "POST") return send(res, 201, await routes.wash(key, await readBody(req)));
      if (resource === "verifications" && req.method === "POST") return send(res, 201, await routes.verify(key, await readBody(req)));
      if (resource === "requisition" && req.method === "POST") return send(res, 201, await routes.requisition(key, await readBody(req)));
      if (resource === "requisition" && req.method === "DELETE") return send(res, 200, await routes["requisition-return"](key));
    }

    send(res, 404, { error: "not_found", message: "接口不存在" });
  } catch (error) {
    await handleError(res, error);
  }
});

server.listen(port, () => console.log("磨后洗养与入库核验台 listening on http://localhost:" + port));
