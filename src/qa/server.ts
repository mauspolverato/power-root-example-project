import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
};

/** Minimal static file server for previewing and testing generated sites locally. */
export function serveDir(root: string, port = 0): Promise<{ server: Server; url: string }> {
  const base = path.resolve(root);
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    let file = path.resolve(base, `.${urlPath}`);
    if (!file.startsWith(base)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!existsSync(file)) {
      res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) =>
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, url: `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : port}` });
    }),
  );
}
