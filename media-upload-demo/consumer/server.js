// consumer/server.js
const path = require("path");
const fs = require("fs");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { spawn } = require("child_process");

const GRPC_PORT = process.env.GRPC_PORT || "50051";
const HTTP_PORT = parseInt(process.env.HTTP_PORT || "4000", 10);

const MAX_QUEUE = parseInt(process.env.Q || "5", 10);
const MAX_CONCURRENT_SAVES = parseInt(process.env.C || "2", 10);

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

let queueLength = 0;
let activeSaves = 0;

// duplicate detection: map hash -> filename
const seenHashes = new Map();

// load proto
const packageDef = protoLoader.loadSync(
  path.join(__dirname, "..", "proto", "media.proto"),
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
);
const mediaProto = grpc.loadPackageDefinition(packageDef).media;

/**
 * compress a video using ffmpeg.
 * Produces "<name>_compressed.ext" alongside the original.
 */
function compressVideo(inputPath) {
  const extMatch = inputPath.match(/\.[^\.]+$/);
  const ext = extMatch ? extMatch[0] : ".mp4";
  const outputPath = inputPath.replace(ext, `_compressed${ext}`);

  console.log("[CONSUMER] Starting compression:", inputPath, "->", outputPath);

  const ff = spawn("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-b:v",
    "1200k", // simple target bitrate
    outputPath,
  ]);

  ff.on("close", (code) => {
    if (code === 0) {
      console.log("[CONSUMER] Compression finished:", outputPath);
    } else {
      console.warn("[CONSUMER] Compression failed with code", code);
    }
  });
}

// gRPC handler
function uploadVideo(call, callback) {
  const { producerId, filename, data } = call.request;

  // BONUS: duplicate detection 
  const hash = crypto.createHash("sha256").update(data).digest("hex");
  if (seenHashes.has(hash)) {
    const original = seenHashes.get(hash);
    console.log(
      `[CONSUMER] Duplicate detected from ${producerId}: ${filename} (same as ${original})`
    );
    return callback(null, {
      status: "DUPLICATE",
      message: `Duplicate upload – already have ${original}`,
    });
  }

  // BONUS: queue-full notification 
  if (queueLength >= MAX_QUEUE) {
    console.log(
      `[CONSUMER] Rejecting video from ${producerId} – queue FULL (${queueLength}/${MAX_QUEUE})`
    );
    return callback(null, {
      status: "QUEUE_FULL",
      message: "Queue is full – please retry later",
    });
  }

  queueLength++;
  console.log(
    `[CONSUMER] Enqueued ${filename} from ${producerId}. queueLength=${queueLength}`
  );

  const save = () => {
    activeSaves++;

    const safeName = `${Date.now()}-${producerId}-${filename}`;
    const filePath = path.join(UPLOAD_DIR, safeName);

    fs.writeFile(filePath, data, (err) => {
      activeSaves--;
      queueLength--;

      if (err) {
        console.error("[CONSUMER] Failed to save file", err);
        return callback({
          code: grpc.status.INTERNAL,
          message: "Failed to save file",
        });
      }

      console.log(
        `[CONSUMER] Saved ${safeName}. queueLength=${queueLength}, activeSaves=${activeSaves}`
      );

      // remember hash AFTER successful write
      seenHashes.set(hash, safeName);

      // BONUS: compression 
      compressVideo(filePath);

      callback(null, {
        status: "OK",
        message: "Video saved: " + safeName,
      });
    });
  };

  if (activeSaves < MAX_CONCURRENT_SAVES) {
    save();
  } else {
    // tiny delay to simulate waiting in queue
    setTimeout(save, 10);
  }
}

function startGrpcServer() {
  const server = new grpc.Server();
  server.addService(mediaProto.MediaUploadService.service, {
    UploadVideo: uploadVideo,
  });
  server.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error("Failed to start gRPC server:", err);
        process.exit(1);
      }
      console.log(`[CONSUMER] gRPC server listening on ${port}`);
      server.start();
    }
  );
}

function startHttpServer() {
  const app = express();
  app.use(cors());

  // list uploaded videos (original + compressed)
  app.get("/api/videos", (req, res) => {
    fs.readdir(UPLOAD_DIR, (err, files) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to list videos" });
      }
      const videos = files.filter((f) =>
        f.match(/\.(mp4|webm|ogg|mov|m4v)$/i)
      );
      res.json(videos);
    });
  });

  app.use("/videos", express.static(UPLOAD_DIR));

  app.listen(HTTP_PORT, () => {
    console.log(
      `[CONSUMER] HTTP API listening on http://localhost:${HTTP_PORT}`
    );
  });
}

startGrpcServer();
startHttpServer();