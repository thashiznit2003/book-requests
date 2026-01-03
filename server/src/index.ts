import cors from "cors";
import express from "express";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import axios from "axios";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { addBook, searchBooks } from "./readarrClient.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");

app.use(pinoHttp({ logger }));
app.use(express.json({ limit: "1mb" }));

const corsOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!process.env.NODE_ENV || process.env.NODE_ENV !== "production") {
  corsOrigins.push("http://localhost:5173");
}

if (corsOrigins.length) {
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true
    })
  );
}

app.use((req, res, next) => {
  if (!config.auth) {
    return next();
  }

  const header = req.header("authorization") || "";
  let authorized = false;

  if (header.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const password = decoded.split(":").slice(1).join(":");
    authorized = password === config.auth;
  } else if (header.startsWith("Bearer ")) {
    authorized = header.slice(7).trim() === config.auth;
  } else if (header.trim() === config.auth) {
    authorized = true;
  }

  if (!authorized) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/search", async (req, res, next) => {
  const term = String(req.query.term || "").trim();
  if (!term) {
    return res.status(400).json({ error: "Missing search term." });
  }

  try {
    const items = await searchBooks(config.ebooks, config.audio, term);
    return res.json({ items });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/request/ebook", async (req, res, next) => {
  const book = req.body?.book;
  if (!book) {
    return res.status(400).json({ error: "Missing book payload." });
  }

  try {
    await addBook(config.ebooks, book);
    return res.json({ status: "ok" });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/request/audiobook", async (req, res, next) => {
  const book = req.body?.book;
  if (!book) {
    return res.status(400).json({ error: "Missing book payload." });
  }

  try {
    await addBook(config.audio, book);
    return res.json({ status: "ok" });
  } catch (error) {
    return next(error);
  }
});

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));

  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use(
  (
    error: unknown,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error({ err: error }, "request_failed");

    let status = 500;
    let message = "Unexpected error.";

    if (axios.isAxiosError(error)) {
      status = error.response?.status || 502;
      if (error.code === "ECONNREFUSED") {
        message = "Unable to reach Readarr. Check the base URL and network.";
      } else if (status === 401 || status === 403) {
        message = "Readarr rejected the API key.";
      } else {
        const data = error.response?.data as
          | { message?: string; error?: string }
          | undefined;
        message =
          data?.message || data?.error || error.message || "Readarr error.";
      }
    } else if (error instanceof Error) {
      message = error.message;
    }

    res.status(status).json({ error: message });
  }
);

app.listen(config.port, () => {
  logger.info({ port: config.port }, "server_listening");
});
