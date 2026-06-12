import http from "node:http";
import { createReviewStateApi } from "./reviewStateApi.mjs";

const port = Number(process.env.PORT || process.env.REVIEW_STATE_PORT || 4174);
const host = process.env.HOST || "127.0.0.1";
const api = createReviewStateApi();

const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/api/review-state")) {
    api.handle(req, res);
    return;
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(port, host, () => {
  console.log(`Melwater review-state API listening on http://${host}:${port}/api/review-state`);
});
