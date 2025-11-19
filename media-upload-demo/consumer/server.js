// consumer/server.js
const path = require("path");
const fs = require("fs");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const express = require("express");
const cors = require("cors");

// ---- config from env / CLI ----
const GRPC_PORT = process.env.GRPC_PORT || "50051";
const HTTP_PORT = parseInt(process.env.HTTP_PORT || "4000", 10);

// q - max queue length (leaky bucket)
const MAX_QUEUE = parseInt(process.env.Q || "5", 10);
// c - number of consumer "threads" (we just treat it as max concurrent saves)
const MAX_CONCURRENT_SAVES = parseInt(process.env.C || "2", 10);

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// In-memory queue + concurrency limiter
let queueLength = 0;
let activeSaves = 0;

const packageDef = protoLoader.loadSync(
  path.join(__dirname, "..", "proto", "media.proto"),
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
);
const mediaProto = grpc.loadPackageDefinition(packageDef).media;

// Handle UploadVideo RPC
function uploadVideo(call, callback) {
  const { producerId, filename, data } = call.request;

  if (queueLength >= MAX_QUEUE) {
    console.log(
      `[CONSUMER] Dropping video from ${producerId} – queue is full (${queueLength}/${MAX_QUEUE})`
    );
    return callback(null, {
      status: "DROPPED",
      message: "Queue full – video dropped by leaky bucket policy",
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

      callback(null, {
        status: "OK",
        message: "Video saved: " + safeName,
      });

      // Try to drain queue if more uploads are waiting in gRPC handlers
    });
  };

  if (activeSaves < MAX_CONCURRENT_SAVES) {
    save();
  } else {
    // Simple "delay" to simulate queued processing
    setTimeout(save, 10);
  }
}

function startGrpcServer() {
  const server = new grpc.Server();
  server.addService(mediaProto.MediaUploadService.service, { UploadVideo: uploadVideo });
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

  // List uploaded videos
  app.get("/api/videos", (req, res) => {
    fs.readdir(UPLOAD_DIR, (err, files) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to list videos" });
      }
      // Only return video-like files
      const videos = files.filter((f) =>
        f.match(/\.(mp4|webm|ogg|mov|m4v)$/i)
      );
      res.json(videos);
    });
  });

  // Serve the actual video files
  app.use("/videos", express.static(UPLOAD_DIR));

  app.listen(HTTP_PORT, () => {
    console.log(`[CONSUMER] HTTP API listening on http://localhost:${HTTP_PORT}`);
  });
}

startGrpcServer();
startHttpServer();
