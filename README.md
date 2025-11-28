# Media Upload Demo (Node + gRPC + React)

This is a simple multi-producer / single-consumer media upload system:

- **Producers** (Node) read video files from local folders and send them via **gRPC**.
- **Consumer** (Node) receives and stores videos on disk, enforcing a **bounded queue** (leaky bucket).
- **Web Client** (React + Vite) lists uploaded videos and:
  - Plays a **10s preview on hover**
  - Plays the **full video on click**
---

## Folder Structure

```text
media-upload-demo/
  proto/
    media.proto         # gRPC service + messages

  consumer/
    server.js           # gRPC + HTTP server
    uploads/            # uploaded videos are stored here

  producer/
    producer.js         # producer that uploads videos via gRPC
    folders/
      producer1/        # test videos for producer 1
      producer2/        # test videos for producer 2

  web-client/
    package.json
    tsconfig.json
    vite.config.ts
    index.html
    src/
      main.tsx
      App.tsx
```
---

## Instructions to Run

1. Install Node.js
```
node - v
npm -v
```
2. Set up the consumer (gRPC + HTTP)
```
cd media-upload-demo/consumer
npm init -y
npm install express cors @grpc/grpc-js @grpc/proto-loader
```
- on mac
  ```
  Q=5 C=2 node server.js
  ```
- on windows
  ```
  set Q=5
  set C=2
  node server.js

  ```
**Leave the terminal running** 

3. Set up Frontend (React + Vite) <br>
   on a **new terminal** set up:
   ```
   cd media-upload-demo/web-client
   npm install
   npm run dev
   ```
afterwards, click mo http://localhost:5173/

4. Prepare some test videos for the producer in either of the folders:
   ```
   media-upload-demo/producer/folders/producer1/
   media-upload-demo/producer/folders/producer2/

   ```
   They can even be the same file copied twice. Just make sure extension is `.mp4`, `.webm`, `.ogg`, `.mov`, or `.m4v`.

5. Set up the producer
   on a **new terminal** set up:
   ```
   cd media-upload-demo/producer
   npm init -y
   npm install @grpc/grpc-js @grpc/proto-loader

   ```
   Make sure the consumer is still running on port 50051.
   - on mac:
   ```
   P=2 GRPC_ADDR=localhost:50051 node producer.js
   ```
   - on windows (cmd):
   ```
   set P=2
   set GRPC_ADDR=localhost:50051
   node producer.js
   ```
   you should something like:
   ```
   [PRODUCER producer1] Found 2 video(s) to upload
   [PRODUCER producer1] Uploaded test1.mp4 -> OK: Video saved: ...
   [PRODUCER producer2] Uploaded test2.mp4 -> OK: Video saved: ...
   ```
6. After all is done and running, go to http://localhost:5173 and refresh. Everytie you upload something new, do Step 5 producer command. 








