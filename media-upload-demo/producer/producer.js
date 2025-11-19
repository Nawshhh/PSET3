// producer/producer.js
const path = require("path");
const fs = require("fs");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

// ---- config ----
// p - number of producer "threads"/instances
const P = parseInt(process.env.P || "1", 10);
const GRPC_ADDR = process.env.GRPC_ADDR || "localhost:50051";

const FOLDERS_ROOT = path.join(__dirname, "folders"); // folders/producer1, producer2, ...

const packageDef = protoLoader.loadSync(
  path.join(__dirname, "..", "proto", "media.proto"),
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
);
const mediaProto = grpc.loadPackageDefinition(packageDef).media;

const client = new mediaProto.MediaUploadService(
  GRPC_ADDR,
  grpc.credentials.createInsecure()
);

function uploadFile(producerId, filePath, filename) {
  const data = fs.readFileSync(filePath);
  return new Promise((resolve) => {
    client.UploadVideo(
      { producerId, filename, data },
      (err, response) => {
        if (err) {
          console.error(
            `[PRODUCER ${producerId}] Error uploading ${filename}:`,
            err.message
          );
        } else {
          console.log(
            `[PRODUCER ${producerId}] Uploaded ${filename} -> ${response.status}: ${response.message}`
          );
        }
        resolve();
      }
    );
  });
}

async function runProducerInstance(index) {
  const producerId = `producer${index}`;
  const folder = path.join(FOLDERS_ROOT, producerId);

  if (!fs.existsSync(folder)) {
    console.warn(
      `[PRODUCER ${producerId}] Folder ${folder} does not exist, skipping`
    );
    return;
  }

  const files = fs.readdirSync(folder).filter((f) =>
    f.match(/\.(mp4|webm|ogg|mov|m4v)$/i)
  );

  console.log(
    `[PRODUCER ${producerId}] Found ${files.length} video(s) to upload`
  );

  for (const filename of files) {
    const filePath = path.join(folder, filename);
    await uploadFile(producerId, filePath, filename);
  }
}

async function main() {
  const producers = [];
  for (let i = 1; i <= P; i++) {
    producers.push(runProducerInstance(i));
  }
  await Promise.all(producers);
  console.log("[PRODUCER] All producers done");
}

main();
