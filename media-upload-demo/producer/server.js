// producer/server.js
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

// ---- config ----
const PRODUCER_ID = process.env.PRODUCER_ID || "producer1";
const GRPC_ADDR = process.env.GRPC_ADDR || "localhost:50051";
const HTTP_PORT = parseInt(process.env.PORT || "3000", 10);

// max file size (MB) for upload validation
const MAX_FILE_MB = parseInt(process.env.MAX_FILE_MB || "50", 10);
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// max gRPC message size (MB)
const MAX_GRPC_MB = parseInt(process.env.MAX_GRPC_MB || "300", 10);
const GRPC_BYTES = MAX_GRPC_MB * 1024 * 1024;

// ---- per-producer local folder (for spec: separate folder per thread) ----
const FOLDERS_ROOT = path.join(__dirname, "folders");
const PRODUCER_FOLDER = path.join(FOLDERS_ROOT, PRODUCER_ID);

// ensure root + per-producer folder exist
if (!fs.existsSync(FOLDERS_ROOT)) {
  fs.mkdirSync(FOLDERS_ROOT, { recursive: true });
}
if (!fs.existsSync(PRODUCER_FOLDER)) {
  fs.mkdirSync(PRODUCER_FOLDER, { recursive: true });
  console.log(
    `[PRODUCER ${PRODUCER_ID}] Created local folder: ${PRODUCER_FOLDER}`
  );
} else {
  console.log(
    `[PRODUCER ${PRODUCER_ID}] Using existing local folder: ${PRODUCER_FOLDER}`
  );
}

// ---- gRPC setup ----
const packageDef = protoLoader.loadSync(
  path.join(__dirname, "..", "proto", "media.proto"),
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
);
const mediaProto = grpc.loadPackageDefinition(packageDef).media;

const client = new mediaProto.MediaUploadService(
  GRPC_ADDR,
  grpc.credentials.createInsecure(),
  {
    "grpc.max_receive_message_length": GRPC_BYTES,
    "grpc.max_send_message_length": GRPC_BYTES,
  }
);


// ---- express + multer ----
const app = express();
app.use(cors());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

// simple upload page
app.get("/", (req, res) => {
  res.send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${PRODUCER_ID} Upload</title>
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; padding: 1.5rem; }
          .status { margin-top: 1rem; }
          .status.ok { color: #1a7f37; }
          .status.error { color: #b91c1c; }
          code { background: #e5e7eb; padding: 0 4px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>${PRODUCER_ID} Upload</h1>
        <p>
          This producer stores its local videos in:<br/>
          <code>${PRODUCER_FOLDER}</code><br/>
          Max file size: ${MAX_FILE_MB} MB
        </p>
        <form id="uploadForm">
          <input type="file" name="video" accept="video/*" required />
          <button type="submit">Upload to Consumer</button>
        </form>
        <div id="status" class="status"></div>

        <script>
          const form = document.getElementById('uploadForm');
          const statusEl = document.getElementById('status');

          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            statusEl.textContent = 'Uploading...';
            statusEl.className = 'status';

            const formData = new FormData(form);

            try {
              const res = await fetch('/upload', {
                method: 'POST',
                body: formData
              });
              let data = {};
              try { data = await res.json(); } catch (_) {}

              if (!res.ok) {
                statusEl.textContent = data.error || 'Upload failed';
                statusEl.className = 'status error';
                return;
              }

              if (data.status === 'OK') {
                statusEl.textContent = data.message || 'Upload successful!';
                statusEl.className = 'status ok';
              } else if (data.status === 'QUEUE_FULL') {
                statusEl.textContent = 'Queue is full on consumer. Please try again later.';
                statusEl.className = 'status error';
              } else if (data.status === 'DUPLICATE') {
                statusEl.textContent = data.message || 'Duplicate video – upload skipped.';
                statusEl.className = 'status error';
              } else {
                statusEl.textContent = data.message || 'Upload failed.';
                statusEl.className = 'status error';
              }
            } catch (err) {
              console.error(err);
              statusEl.textContent = 'Network error while uploading.';
              statusEl.className = 'status error';
            }
          });
        </script>
      </body>
    </html>
  `);
});

// /upload: save to local producer folder THEN forward via gRPC
app.post("/upload", (req, res) => {
  upload.single("video")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ error: `File too large. Max size is ${MAX_FILE_MB} MB.` });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      console.error("[PRODUCER] Upload middleware error:", err);
      return res.status(500).json({ error: "Upload failed." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Missing 'video' file field" });
    }

    if (req.file.size > MAX_FILE_BYTES) {
      return res
        .status(400)
        .json({ error: `File too large. Max size is ${MAX_FILE_MB} MB.` });
    }

    const filename = req.file.originalname;
    const buffer = req.file.buffer;

    // Save a local copy for this producer instance
    const localPath = path.join(PRODUCER_FOLDER, filename);
    fs.writeFile(localPath, buffer, (writeErr) => {
      if (writeErr) {
        console.error(
          `[PRODUCER ${PRODUCER_ID}] Failed to save local copy:`,
          writeErr
        );
      } else {
        console.log(
          `[PRODUCER ${PRODUCER_ID}] Saved local copy to ${localPath}`
        );
      }

      // Forward to consumer via gRPC (still using buffer)
      client.UploadVideo(
        { producerId: PRODUCER_ID, filename, data: buffer },
        (grpcErr, response) => {
          if (grpcErr) {
            console.error(
              `[PRODUCER ${PRODUCER_ID}] gRPC error:`,
              grpcErr.message
            );
            return res
              .status(500)
              .json({ error: "Failed to upload to consumer" });
          }

          console.log(
            `[PRODUCER ${PRODUCER_ID}] Uploaded ${filename} -> ${response.status}: ${response.message}`
          );
          res.json(response);
        }
      );
    });
  });
});

app.listen(HTTP_PORT, () => {
  console.log(
    `[PRODUCER ${PRODUCER_ID}] HTTP server listening on http://localhost:${HTTP_PORT} (forwarding to ${GRPC_ADDR})`
  );
});
