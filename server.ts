/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Full-Stack App Server Configuration
 * 
 * Combines Express server, Vite middleware (for active frontend editing),
 * and a robust WebSocket server pointing client feeds directly towards
 * our isolated yoga session pipeline.
 */

import express from "express";
import { createServer as createHttpServer } from "http";
import { WebSocketServer } from "ws";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createYogaAgentSession } from "./server/yoga_agent";

// Load environment variables (e.g. GEMINI_API_KEY)
dotenv.config();

const app = express();
const port = 3000; // Port 3000 is the ONLY externally accessible port inside the workspace proxy
const isProd = process.env.NODE_ENV === "production" || fs.existsSync(path.join(process.cwd(), "dist"));

app.use(express.json());

// API health and check endpoints
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    environment: isProd ? "production" : "development",
    geminiKeyDetected: !!process.env.GEMINI_API_KEY,
  });
});

// Setup standard HTTP Server
const httpServer = createHttpServer(app);

// Setup standard WebSocket Server for low-latency yoga audio & camera feeds
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", async (clientWs, request) => {
  console.log(`[Server] New WebSocket connection request received from client: ${request.url}`);
  
  const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
  
  if (url.pathname === "/api/live-yoga") {
    // Read optional configurations passed by client query params
    const model = url.searchParams.get("model") || "gemini-3.1-flash-live-preview"; // Let us use gemini-3.1-flash-live-preview or gemini-2.5-flash as core
    const voice = url.searchParams.get("voice") || "Puck";
    
    // Create the isolated yoga session
    await createYogaAgentSession({
      clientWs,
      modelName: model,
      voiceName: voice,
    });
  } else {
    clientWs.close(4004, "Not Found");
  }
});

// Upgrade incoming HTTP requests containing a WebSocket upgrade header
httpServer.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
  
  if (url.pathname === "/api/live-yoga") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

/**
 * Configure standard UI delivery middlewares (Vite Dev Server vs Static Production bundle)
 */
async function startServer() {
  if (!isProd) {
    console.log("[Server] Booting in Development Mode. Initializing Vite middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    
    app.use(vite.middlewares);
  } else {
    console.log("[Server] Booting in Production Mode. Serving static build assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`[Server] Ready & Listening on http://0.0.0.0:${port}`);
    console.log(`[Server] WebSocket path available at ws://0.0.0.0:${port}/api/live-yoga`);
  });
}

startServer().catch((error) => {
  console.error("[Server] Fatal error during startup:", error);
});
