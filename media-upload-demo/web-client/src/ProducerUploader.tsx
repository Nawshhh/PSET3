import React, { useState } from "react";

const ProducerUploader: React.FC = () => {
  const [producerPort, setProducerPort] = useState("3001");
  const [status, setStatus] = useState("");

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("Uploading…");

    const formData = new FormData(e.currentTarget);
    const file = formData.get("video") as File;

    if (!file) {
      setStatus("No file selected.");
      return;
    }

    try {
      const res = await fetch(`http://localhost:${producerPort}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.status === "OK") {
        setStatus("Upload successful!");
      } else if (data.status === "DUPLICATE") {
        setStatus("Duplicate video detected.");
      } else if (data.status === "QUEUE_FULL") {
        setStatus("Consumer queue is full. Try later.");
      } else {
        setStatus(data.message || "Upload failed.");
      }
    } catch (err) {
      console.error(err);
      setStatus("Network error.");
    }
  };

  return (
    <div style={{
      padding: "1rem",
      background: "rgba(0,0,0,0.2)",
      borderRadius: "12px",
      marginBottom: "1.5rem"
    }}>
      <h2>Simulate Producer Upload</h2>

      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Send as Producer:
        <select
          style={{ marginLeft: "0.5rem" }}
          value={producerPort}
          onChange={(e) => setProducerPort(e.target.value)}
        >
          <option value="3001">Producer 1 (port 3001)</option>
          <option value="3002">Producer 2 (port 3002)</option>
          <option value="3003">Producer 3 (port 3003)</option>
        </select>
      </label>

      <form onSubmit={handleUpload}>
        <input type="file" name="video" accept="video/*" required />
        <button type="submit" style={{ marginLeft: "1rem" }}>
          Upload to Producer
        </button>
      </form>

      <div style={{ marginTop: "1rem" }}>{status}</div>
    </div>
  );
};

export default ProducerUploader;