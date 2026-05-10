import { createServer, type Server } from "node:http";
import type { MemoryStore } from "../types";
import { renderPage } from "./page";
import { renderClientScript } from "./client";
import { handleApi, type UiDeps } from "./api";

export async function startUiServer(port: number, store: MemoryStore, deps: UiDeps): Promise<Server> {
  const server = createServer((req, res) => {
    const u = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    const data = handleApi(u, deps);
    if (data) {
      res.setHeader("content-type", "application/json");
      res.setHeader("cache-control", "no-store");
      res.end(JSON.stringify(data));
      return;
    }
    if (u.pathname === "/ui.js") {
      res.setHeader("content-type", "application/javascript; charset=utf-8");
      res.setHeader("cache-control", "no-store");
      res.end(renderClientScript());
      return;
    }
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(renderPage(store));
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", () => resolve()));
  return server;
}
