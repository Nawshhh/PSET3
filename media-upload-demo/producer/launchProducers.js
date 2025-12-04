// producer/launchProducers.js
const { spawn } = require("child_process");
const path = require("path");
require("dotenv").config();

// P = number of producer instances (your "p" parameter)
// you can pass it either as env var P or as CLI arg: node launchProducers.js 3
const P = parseInt(process.env.P || process.argv[2] || "1", 10);

// base HTTP port for producer servers
// producer1 -> BASE_PORT, producer2 -> BASE_PORT+1, etc.
const BASE_PORT = parseInt(process.env.BASE_PORT || "3001", 10);

// address of consumer gRPC server
const GRPC_ADDR = process.env.GRPC_ADDR || "localhost:50051";

if (Number.isNaN(P) || P <= 0) {
  console.error("Invalid P. Usage: P=3 node launchProducers.js OR node launchProducers.js 3");
  process.exit(1);
}

console.log(
  `[LAUNCHER] Starting ${P} producer server instance(s). ` +
    `Base port=${BASE_PORT}, consumer=${GRPC_ADDR}`
);

for (let i = 1; i <= P; i++) {
  const port = BASE_PORT + (i - 1);
  const producerId = `producer${i}`;

  const child = spawn(process.execPath, ["server.js"], {
    cwd: __dirname,
    env: {
      ...process.env,
      PRODUCER_ID: producerId,
      PORT: String(port),
      GRPC_ADDR,
    },
    stdio: ["ignore", "inherit", "inherit"],
  });

  console.log(
    `[LAUNCHER] Started ${producerId} on http://localhost:${port} (pid=${child.pid})`
  );
}
