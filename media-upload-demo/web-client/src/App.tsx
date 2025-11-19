import React, { useEffect, useState, useRef } from "react";

const App: React.FC = () => {
  const [videos, setVideos] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const previewTimers = useRef<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/videos")
      .then((res) => res.json())
      .then((data) => setVideos(data))
      .catch((err) => console.error("Failed to load videos", err));
  }, []);

  const handleHover = (id: string) => {
    const videoEl = document.getElementById(id) as HTMLVideoElement | null;
    if (!videoEl) return;
    videoEl.currentTime = 0;
    videoEl.muted = true;
    videoEl.play().catch(() => {});
    // stop after 10 seconds
    const t = window.setTimeout(() => {
      videoEl.pause();
      videoEl.currentTime = 0;
    }, 10000);
    previewTimers.current[id] = t;
  };

  const handleLeave = (id: string) => {
    const videoEl = document.getElementById(id) as HTMLVideoElement | null;
    if (!videoEl) return;
    videoEl.pause();
    videoEl.currentTime = 0;
    const t = previewTimers.current[id];
    if (t) window.clearTimeout(t);
  };

  return (
    <div style={{ padding: "1rem", fontFamily: "system-ui" }}>
      <h1>Media Upload Consumer</h1>
      <p>
        Hover to preview first 10 seconds. Click to play the full video
        below.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "1rem",
        }}
      >
        {videos.map((name) => {
          const id = `preview-${name}`;
          return (
            <div
              key={name}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 8,
                cursor: "pointer",
              }}
              onMouseEnter={() => handleHover(id)}
              onMouseLeave={() => handleLeave(id)}
              onClick={() => setSelected(name)}
            >
              <video
                id={id}
                style={{ width: "100%", borderRadius: 4 }}
                src={`/videos/${encodeURIComponent(name)}`}
              />
              <div style={{ marginTop: 8, fontSize: 14 }}>{name}</div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Now Playing: {selected}</h2>
          <video
            style={{ width: "100%", maxWidth: 800 }}
            controls
            src={`/videos/${encodeURIComponent(selected)}`}
          />
        </div>
      )}
    </div>
  );
};

export default App;
