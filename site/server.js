const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const siteDir = path.resolve(__dirname);
const releaseDir = path.resolve(__dirname, "..", "release");

function findInstaller() {
  try {
    return fs
      .readdirSync(releaseDir)
      .filter((name) => /^Anywhere AI-Setup-.+\.exe$/i.test(name))
      .map((name) => {
        const fullPath = path.join(releaseDir, name);
        return { name, fullPath, modified: fs.statSync(fullPath).mtimeMs };
      })
      .sort((a, b) => b.modified - a.modified)[0] || null;
  } catch {
    return null;
  }
}

const installer = findInstaller();
const installerPath = installer ? installer.fullPath : path.join(releaseDir, "Anywhere AI-Setup.exe");
const installerName = installer ? installer.name : path.basename(installerPath);
const counterFile = path.join(siteDir, "downloads.json");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT) || 4173;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

function readCounter() {
  try {
    const data = JSON.parse(fs.readFileSync(counterFile, "utf8"));
    return Number.isFinite(data.count) ? data.count : 0;
  } catch {
    return 0;
  }
}

function writeCounter(count) {
  fs.writeFileSync(counterFile, `${JSON.stringify({ count, updatedAt: new Date().toISOString() }, null, 2)}\n`);
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(message);
}

function serveDownload(request, response) {
  let stats;
  try {
    stats = fs.statSync(installerPath);
  } catch {
    sendText(response, 404, "Installer not found. Build it with npm run build:exe first.");
    return;
  }

  const size = stats.size;
  const commonHeaders = {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${installerName}"`,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  };

  if (request.method === "HEAD") {
    response.writeHead(200, { ...commonHeaders, "Content-Length": size });
    response.end();
    return;
  }

  let start = 0;
  let end = size - 1;
  let statusCode = 200;
  const range = request.headers.range;

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match && (match[1] || match[2])) {
      if (match[1]) {
        start = Number(match[1]);
        end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      } else {
        start = Math.max(size - Number(match[2]), 0);
      }
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
        response.writeHead(416, { "Content-Range": `bytes */${size}` });
        response.end();
        return;
      }
      statusCode = 206;
    }
  }

  const headers = { ...commonHeaders, "Content-Length": end - start + 1 };
  if (statusCode === 206) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;

  let count = readCounter();
  if (statusCode === 200 || start === 0) {
    count += 1;
    try {
      writeCounter(count);
    } catch (error) {
      console.error(`Could not save the download count: ${error.message}`);
    }
  }
  headers["X-Download-Count"] = String(count);

  response.writeHead(statusCode, headers);
  const stream = fs.createReadStream(installerPath, { start, end });
  stream.on("error", () => response.destroy());
  response.on("close", () => stream.destroy());
  stream.pipe(response);
}

function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    sendText(response, 400, "Bad request.");
    return;
  }

  const relativePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(siteDir, `.${relativePath}`);
  if (filePath !== siteDir && !filePath.startsWith(`${siteDir}${path.sep}`)) {
    sendText(response, 403, "Forbidden.");
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      sendText(response, 404, "Not found.");
      return;
    }

    const headers = {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": stats.size,
      "Cache-Control": "no-cache"
    };
    if (request.method === "HEAD") {
      response.writeHead(200, headers);
      response.end();
      return;
    }

    response.writeHead(200, headers);
    const stream = fs.createReadStream(filePath);
    stream.on("error", () => response.destroy());
    stream.pipe(response);
  });
}

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname;

  if (pathname === "/api/downloads") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }
    const count = readCounter();
    if (request.method === "HEAD") {
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end();
      return;
    }
    sendJson(response, 200, { count });
    return;
  }

  if (pathname === "/download") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }
    serveDownload(request, response);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    sendText(response, 405, "Method not allowed.");
    return;
  }

  serveStatic(request, response);
});

server.listen(port, host, () => {
  console.log(`Anywhere AI site running at http://${host}:${port}`);
  console.log(`Downloads are counted in ${counterFile}`);
  if (!fs.existsSync(installerPath)) {
    console.warn(`Installer not found at ${installerPath} — /download will return 404 until it exists.`);
  }
});
