import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import multer from "multer";
import { Server as SocketIOServer } from "socket.io";
import csv from "csv-parser";
import pino from "pino";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  WAMessageKey,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import fs from "fs";
import { Readable } from "stream";
import { Boom } from "@hapi/boom";

// Types
type MessageStatus = "pending" | "sending" | "sent" | "error";
type SessionStatus = "processing" | "completed" | "error";
interface ContactRow {
  id: number;
  nome?: string;
  telefone: string;
  mensagem: string;
  status: MessageStatus;
  error: string | null;
  timestamp: string | null;
}
interface SessionSummary {
  id: string;
  fileName: string;
  uploadDate: string;
  totalContacts: number;
  sent: number;
  failed: number;
  status: SessionStatus;
}
interface DelayConfig {
  delaySeconds: number;
  variation: number;
  errorPenalty: number;
  description?: string;
}
interface StatusSnapshot {
  connected: boolean;
  ready: boolean;
  hasQr: boolean;
  clientInfo?: { wid?: string; pushname?: string } | null;
  instanceInitialized?: boolean;
}

// Logger
const logger = pino({ level: "info" });

// Env/config
const PORT = Number(process.env.PORT || 3001);
const CORS_ORIGINS = (
  process.env.CORS_ORIGINS ||
  "http://localhost:3000,http://localhost:3002,http://localhost:5173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const AUTH_STATE_DIR = process.env.AUTH_STATE_DIR || "auth_info_baileys";

// Delay manager
let delayConfig: DelayConfig = buildDelayConfig(
  Number(process.env.DELAY_SECONDS || 3)
);
function buildDelayConfig(base: number): DelayConfig {
  const clamped = Math.max(0, Math.min(300, base));
  const variation = Math.min(3, clamped * 0.5);
  return {
    delaySeconds: clamped,
    variation,
    errorPenalty: 2,
    description: `${clamped}s base, ±${variation}s variação, +2s por erro`,
  };
}
function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
function humanDelay(consecutiveErrors: number) {
  const base = Math.max(1, delayConfig.delaySeconds);
  const jitter = (Math.random() * 2 - 1) * delayConfig.variation; // ±variation
  const penalty = consecutiveErrors >= 3 ? delayConfig.errorPenalty : 0;
  return (base + jitter + penalty) * 1000;
}

// Phone helpers
function normalizeBrazilPhoneToJid(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return null;
  // Accept 10-11 (local) or 13 (with country). Always convert to 55 + area + number
  let withCountry = digits;
  if (digits.length === 10 || digits.length === 11) {
    withCountry = "55" + digits;
  }
  if (withCountry.length === 12) {
    // if missing 9th digit for mobile, accept as-is (some landlines)
  }
  if (withCountry.length !== 12 && withCountry.length !== 13) return null;
  return withCountry + "@c.us";
}

// In-memory state
let io: SocketIOServer;
let lastQr: string | null = null;
let sock: WASocket | null = null;
let isReady = false;
let clientInfo: { wid?: string; pushname?: string } | null = null;
const history: SessionSummary[] = [];

// WhatsApp (Baileys) setup
async function initWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_STATE_DIR);
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    auth: state,
    // printQRInTerminal deprecated; QR é enviado via evento connection.update
    logger: pino({ level: "warn" }),
    markOnlineOnConnect: false,
    version,
    browser: ["Mac OS", "Safari", "13.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update as any;
    if (qr) {
      lastQr = qr;
      io?.emit("qrCode", { qr });
    }
    if (connection === "open") {
      isReady = true;
      lastQr = null;
      try {
        const me = sock?.user;
        clientInfo = { wid: me?.id, pushname: me?.name };
      } catch {}
      io?.emit("whatsappReady", { connected: true });
      logger.info("✅ WhatsApp conectado");
    } else if (connection === "close") {
      isReady = false;
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output
        ?.statusCode;
      const errMessage = (lastDisconnect?.error as any)?.message;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      io?.emit("whatsappDisconnected", {
        reason: String(statusCode || "unknown"),
      });
      logger.warn({ statusCode, errMessage }, "🔌 Conexão encerrada");
      if (shouldReconnect) {
        await initWhatsApp();
      }
    }
  });
}

async function restartWhatsApp(keepAuth = true) {
  try {
    sock?.end?.(new Boom("restart"));
  } catch {}
  if (!keepAuth) {
    // Clear auth state dir by re-initializing empty state next run (user should remove dir externally if needed)
    // Here we just re-init; Baileys will overwrite.
  }
  await initWhatsApp();
}

// Express + Socket.io
const app = express();
// CORS para frontend local (inclui 5173 por padrão)
app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
// Preflight
app.options("*", cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(express.json());
const server = http.createServer(app);
io = new SocketIOServer(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  },
});

// Graceful shutdown for hot-reload/watchers
function gracefulShutdown() {
  try {
    sock?.end?.(new Boom("shutdown"));
  } catch {}
  try {
    server.close(() => {
      logger.info("HTTP server fechado");
      process.exit(0);
    });
  } catch {}
}
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
process.on("SIGUSR2", gracefulShutdown);

// Upload handler
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Helpers
function statusSnapshot(): StatusSnapshot & { qr?: string | null } {
  return {
    connected: isReady,
    ready: isReady,
    hasQr: !!lastQr,
    clientInfo,
    instanceInitialized: !!sock,
    qr: lastQr,
  };
}

// Routes
app.get("/status", (_req, res) => {
  res.json({
    success: true,
    data: statusSnapshot(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/qr", (_req, res) => {
  const snap = statusSnapshot();
  res.json({
    success: true,
    data: {
      qr: snap.qr || "",
      connected: snap.ready,
      hasQr: !!snap.qr,
      ready: snap.ready,
    },
  });
});

app.get("/debug", (_req, res) => {
  const snap = statusSnapshot();
  res.json({
    success: true,
    data: {
      qrCodeString: snap.qr ? "Presente" : "Ausente",
      qrLength: snap.qr?.length || 0,
      isClientReady: snap.ready,
      clientExists: !!sock,
      clientState: snap.clientInfo || null,
    },
  });
});

app.post("/restart", async (_req, res) => {
  await restartWhatsApp(true);
  res.json({
    success: true,
    data: { restarting: true },
    message: "Cliente WhatsApp sendo reiniciado",
  });
});

app.post("/clean-session", async (_req, res) => {
  try {
    if (fs.existsSync(AUTH_STATE_DIR)) {
      fs.rmSync(AUTH_STATE_DIR, { recursive: true, force: true });
    }
  } catch (e) {
    logger.warn(
      { err: (e as any)?.message },
      "Falha ao remover AUTH_STATE_DIR"
    );
  }
  await restartWhatsApp(false);
  res.json({
    success: true,
    data: { sessionCleaned: true },
    message: "Sessão limpa e cliente reiniciado",
  });
});

app.post("/configure-delay", (req, res) => {
  const base = Number(req.body?.delaySeconds);
  if (Number.isNaN(base) || base < 0 || base > 300) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_DELAY",
        message: "delaySeconds deve estar entre 0 e 300",
      },
    });
  }
  delayConfig = buildDelayConfig(base);
  res.json({
    success: true,
    data: delayConfig,
    message: `Delay configurado para ${base} segundos`,
  });
});

app.get("/delay-config", (_req, res) => {
  res.json({
    success: true,
    data: {
      ...delayConfig,
      description: `${delayConfig.delaySeconds}s base, ±${delayConfig.variation}s variação, +${delayConfig.errorPenalty}s por erro`,
    },
  });
});

// CSV -> send messages
app.post("/send", upload.single("file"), async (req, res) => {
  if (!isReady || !sock) {
    return res.status(400).json({
      success: false,
      error: {
        code: "CLIENT_NOT_READY",
        message: "WhatsApp não está conectado. Escaneie o QR Code primeiro.",
      },
    });
  }
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: {
        code: "FILE_NOT_PROVIDED",
        message: "Nenhum arquivo CSV foi enviado",
      },
    });
  }
  const sessionId = String(Date.now());
  const contacts: ContactRow[] = [];
  try {
    // Parse CSV from buffer
    const rows: any[] = await new Promise((resolve, reject) => {
      const results: any[] = [];
      const readable = Readable.from([req.file!.buffer]);
      readable
        .pipe(csv())
        .on("data", (data: any) => results.push(data))
        .on("end", () => resolve(results))
        .on("error", (err: any) => reject(err));
    });

    rows.forEach((row, idx) => {
      contacts.push({
        id: idx,
        nome: (row.nome || row.name || "").toString(),
        telefone: (row.telefone || row.phone || "").toString(),
        mensagem: (row.mensagem || row.message || "").toString(),
        status: "pending",
        error: null,
        timestamp: null,
      });
    });
  } catch (e: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "CSV_PARSE_ERROR",
        message: e?.message || "Erro ao processar CSV",
      },
    });
  }

  if (contacts.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: "CSV_EMPTY", message: "Arquivo CSV vazio" },
    });
  }

  io.emit("messageSession", { sessionId, contacts, total: contacts.length });

  // Start async sending
  (async () => {
    let sent = 0;
    let failed = 0;
    let consecutiveErrors = 0;
    for (const c of contacts) {
      c.status = "sending";
      io.emit("messageUpdate", {
        sessionId,
        contactId: c.id,
        status: c.status,
        error: null,
        timestamp: new Date().toISOString(),
      });

      const jid = normalizeBrazilPhoneToJid(c.telefone);
      if (!jid) {
        c.status = "error";
        c.error = "INVALID_PHONE_NUMBER";
        c.timestamp = new Date().toISOString();
        failed++;
        consecutiveErrors++;
        io.emit("messageUpdate", {
          sessionId,
          contactId: c.id,
          status: c.status,
          error: c.error,
          timestamp: c.timestamp,
        });
        await sleep(humanDelay(consecutiveErrors));
        continue;
      }
      try {
        const msg = (c.mensagem || "").toString();
        await sock!.sendMessage(jid, { text: msg });
        c.status = "sent";
        c.error = null;
        c.timestamp = new Date().toISOString();
        sent++;
        consecutiveErrors = 0;
        io.emit("messageUpdate", {
          sessionId,
          contactId: c.id,
          status: c.status,
          error: null,
          timestamp: c.timestamp,
        });
      } catch (e: any) {
        c.status = "error";
        c.error = "MESSAGE_SEND_ERROR";
        c.timestamp = new Date().toISOString();
        failed++;
        consecutiveErrors++;
        io.emit("messageUpdate", {
          sessionId,
          contactId: c.id,
          status: c.status,
          error: c.error,
          timestamp: c.timestamp,
        });
      }
      await sleep(humanDelay(consecutiveErrors));
    }

    history.unshift({
      id: sessionId,
      fileName: req.file!.originalname,
      uploadDate: new Date().toISOString(),
      totalContacts: contacts.length,
      sent,
      failed,
      status: "completed",
    });
    while (history.length > 10) history.pop();
    io.emit("sessionComplete", {
      sessionId,
      results: { total: contacts.length, sent, failed },
    });
  })().catch((e) => logger.error(e));

  res.json({
    success: true,
    data: { sessionId, total: contacts.length, sent: 0, failed: 0 },
    message: `Processamento iniciado para ${contacts.length} contatos`,
  });
});

app.get("/history", (_req, res) => {
  res.json({ success: true, data: history });
});

// Helper pages for quick usage
app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>WhatsApp Disparo • Status</title>
      <style>
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; margin: 24px; line-height: 1.5; }
        code { background: #f2f4f7; padding: 2px 6px; border-radius: 4px; }
        a { color: #0b5fff; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>WhatsApp Disparo</h1>
      <p>Servidor está em execução na porta <code>${PORT}</code>.</p>
      <ul>
        <li><a href="/status">/status</a> — status atual</li>
        <li><a href="/qr">/qr</a> — QR em JSON</li>
        <li><a href="/qr-page">/qr-page</a> — página do QR</li>
        <li><a href="/history">/history</a> — histórico</li>
      </ul>
    </body>
  </html>`);
});

app.get("/qr-page", (_req, res) => {
  res.type("html").send(`<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>QR Code • WhatsApp Disparo</title>
      <script src="/socket.io/socket.io.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
      <style>
        body { display: grid; place-items: center; min-height: 100svh; margin: 0; font-family: ui-sans-serif, system-ui; background: #0b1220; color: #eaeef6; }
        .card { background: #111827; border: 1px solid #1f2937; padding: 24px; border-radius: 12px; width: min(420px, 92vw); box-shadow: 0 10px 30px rgba(0,0,0,.35); }
        h1 { font-size: 18px; margin: 0 0 16px; }
        #qr { width: 100%; aspect-ratio: 1/1; background: #0b1220; display: grid; place-items: center; border-radius: 8px; }
        #status { font-size: 14px; opacity: .8; margin-top: 12px; }
        canvas, img { max-width: 100%; height: auto; }
        button { margin-top: 12px; background: #0b5fff; color: white; border: 0; border-radius: 8px; padding: 10px 14px; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Escaneie o QR Code</h1>
        <div id="qr"><span>Carregando QR...</span></div>
        <div id="status">Aguardando QR do servidor...</div>
        <button id="refresh">Atualizar</button>
      </div>
      <script>
        const qrEl = document.getElementById('qr');
        const statusEl = document.getElementById('status');
        const refreshBtn = document.getElementById('refresh');

        function renderQR(data) {
          qrEl.innerHTML = '';
          if (!data || !data.qr) {
            statusEl.textContent = 'Sem QR disponível. Se já conectou, aguarde ficar pronto.';
            return;
          }
          const canvas = document.createElement('canvas');
          qrEl.appendChild(canvas);
          QRCode.toCanvas(canvas, data.qr, { width: qrEl.clientWidth - 8, margin: 1 }, (err) => {
            if (err) {
              statusEl.textContent = 'Falha ao renderizar QR: ' + err.message;
            } else {
              statusEl.textContent = 'QR atualizado. Escaneie com o WhatsApp.';
            }
          });
        }

        async function fetchQR() {
          try {
            const res = await fetch('/qr');
            const json = await res.json();
            const data = json.data || {};
            if (data.ready) {
              statusEl.textContent = 'WhatsApp conectado!';
              qrEl.innerHTML = '';
              const ok = document.createElement('div');
              ok.textContent = '✅ Conectado';
              qrEl.appendChild(ok);
            } else {
              renderQR(data);
            }
          } catch (e) {
            statusEl.textContent = 'Erro ao buscar QR: ' + (e && e.message || e);
          }
        }

        const socket = io({ transports: ['websocket'] });
        socket.on('qrCode', ({ qr }) => {
          renderQR({ qr });
        });
        socket.on('whatsappReady', () => {
          statusEl.textContent = 'WhatsApp conectado!';
          qrEl.innerHTML = '';
          const ok = document.createElement('div');
          ok.textContent = '✅ Conectado';
          qrEl.appendChild(ok);
        });
        socket.on('whatsappDisconnected', ({ reason }) => {
          statusEl.textContent = 'Desconectado: ' + reason;
        });

        refreshBtn.addEventListener('click', fetchQR);
        fetchQR();
      </script>
    </body>
  </html>`);
});

// Start
(async () => {
  await initWhatsApp();
  server.listen(PORT, () => {
    logger.info(`HTTP server on :${PORT}`);
  });
})();
