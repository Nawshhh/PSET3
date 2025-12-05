# Media Upload Demo  
### Multi-Producer -> Single-Consumer Upload System  
**Node.js + gRPC + Express + React (Vite)**

This project simulates a multi-producer media upload pipeline using gRPC:

- **Producers**
  - Multiple producer servers, each running on its own port  
  - Each producer has its own folder  
  - Uploads videos to a consumer using gRPC  

- **Consumer**
  - Receives uploads and saves videos to disk  
  - Enforces a bounded queue (`Q`)  
  - Uses worker threads (`C`) to process uploads  
  - Returns responses: `OK`, `QUEUE_FULL`, `DUPLICATE`  

- **Web Client (React + Vite)**
  - Displays uploaded videos  
  - Hover previews the first 10 seconds  
  - Clicking plays the full video  

---

## Folder Structure

```
media-upload-demo/
│
├── proto/
│   └── media.proto
│
├── consumer/
│   ├── server.js
│   ├── uploads/
│   ├── package.json
│   └── package-lock.json
│
├── producer/
│   ├── launchProducers.js
│   ├── server.js
│   ├── .env
│   ├── folders/
│   ├── package.json
│   └── package-lock.json
│
└── web-client/
    ├── index.html
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        └── ProducerUploader.tsx
```

---

## Requirements

- Node.js 18 or higher  
- NPM  
- Works on Mac, Windows, or mixed machine environments  

Check version:

```
node -v
npm -v
```

---

# 1. Running the Consumer (gRPC + HTTP)

Install dependencies:

```
cd media-upload-demo/consumer
npm install
```

### Run the consumer with queue and worker parameters

**macOS / Linux**

```
Q=5 C=2 MAX_GRPC_MB=300 node server.js
```

**Windows PowerShell**

```
$env:Q=5
$env:C=2
$env:MAX_GRPC_MB=300
node server.js
```

You should see:

```
[CONSUMER] gRPC server listening on port 50051
[CONSUMER] HTTP API listening on port 4000
```

Leave this terminal running.

---

# 2. Running the Web Client (React + Vite)

Open a new terminal:

```
cd media-upload-demo/web-client
npm install
npm run dev
```

Web UI is available at:

```
http://localhost:5173
```

This page displays uploaded videos, previews, and full playback.

---

# 3. Producer Configuration (`.env`)

Inside `media-upload-demo/producer/.env`:

```
P=4
GRPC_ADDR=127.0.0.1:50051
MAX_FILE_MB=300
MAX_GRPC_MB=300
BASE_PORT=3001
```

Explanation:

- `P=4` creates 4 producer servers.  
- Server ports:

  - Producer1 -> http://localhost:3001  
  - Producer2 -> http://localhost:3002  
  - Producer3 -> http://localhost:3003  
  - Producer4 -> http://localhost:3004  

- Producer folders are created automatically:

  - `folders/producer1/`
  - `folders/producer2/`
  - ...

---

# 4. Running the Producers

Install dependencies:

```
cd media-upload-demo/producer
npm install
```

Launch all producers:

```
node launchProducers.js
```

You should see:

```
[LAUNCHER] Starting 4 producer server instance(s)
[LAUNCHER] producer1 running at http://localhost:3001
[LAUNCHER] producer2 running at http://localhost:3002
[LAUNCHER] producer3 running at http://localhost:3003
[LAUNCHER] producer4 running at http://localhost:3004
```

Each producer page contains an upload form.

---

# 5. Uploading Videos

Open the producer pages:

- http://localhost:3001  
- http://localhost:3002  
- http://localhost:3003  
- http://localhost:3004  

Upload results may show:

- Upload successful  
- Duplicate video  
- Queue is full  

---

# 6. Testing Queue and Worker Limits

Example consumer settings:

```
Q=2
C=1
```

Expected behavior:

- First upload -> accepted  
- Second upload -> accepted  
- Third upload -> rejected (`QUEUE_FULL`)  
- Fourth upload -> rejected  

Consumer logs:

```
[CONSUMER] Enqueued ...
[CONSUMER] Enqueued ...
[CONSUMER] Rejecting ... queue FULL
```

Producer UI shows:

```
Queue is full on consumer. Please try again later.
```

---

# 7. Running Across Two Machines (LAN)

## Consumer on macOS

```
cd media-upload-demo/consumer
Q=2 C=1 node server.js
```

Find macOS IP:

```
ipconfig getifaddr en0
```

Example IP:

```
192.168.1.10
```

## Producer `.env` on Windows

```
GRPC_ADDR=192.168.1.10:50051
```

Run:

```
cd media-upload-demo/producer
node launchProducers.js
```

---

# System Overview

1. Producer uploads a file via the `/upload` HTTP endpoint  
2. Producer sends file bytes via gRPC to the consumer  
3. Consumer saves file or rejects if duplicate / queue full  
4. Consumer returns `OK`, `DUPLICATE`, or `QUEUE_FULL`  
5. Producer UI displays the result  
6. React UI displays all uploaded videos  
