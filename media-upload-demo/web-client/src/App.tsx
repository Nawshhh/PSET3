import React, { useEffect, useState, useRef } from "react";

const App: React.FC = () => {
  const [videos, setVideos] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const previewTimers = useRef<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/videos")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch videos");
        return res.json();
      })
      .then((data) => {
        setVideos(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load videos", err);
        setError("Could not load videos from the consumer.");
        setLoading(false);
      });
  }, []);

  const handleHover = (id: string) => {
    const videoEl = document.getElementById(id) as HTMLVideoElement | null;
    if (!videoEl) return;
    videoEl.currentTime = 0;
    videoEl.muted = true;
    videoEl.play().catch(() => {});
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
    <div
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: 0,
        background:
          "radial-gradient(circle at top, #1e293b 0, #020617 45%, #020617 100%)",
        color: "#e5e7eb",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Top bar */}
      <header
        style={{
          padding: "1rem 2rem",
          borderBottom: "1px solid rgba(148, 163, 184, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backdropFilter: "blur(6px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "1.5rem",
              fontWeight: 600,
              letterSpacing: "0.03em",
            }}
          >
            Media Upload Consumer
          </h1>
          <p
            style={{
              margin: "0.25rem 0 0",
              fontSize: "0.85rem",
              color: "#9ca3af",
            }}
          >
            Hover to preview ~10 seconds. Click to play the full video.
          </p>
        </div>
        <div
          style={{
            fontSize: "0.8rem",
            color: "#9ca3af",
            textAlign: "right",
          }}
        >
          <div>Consumer Window</div>
          <div>Videos: {videos.length}</div>
        </div>
      </header>

      {/* Main content */}
      <main
        style={{
          maxWidth: "1120px",
          margin: "0 auto",
          padding: "1.5rem 1.5rem 3rem",
        }}
      >
        {/* Status / error */}
        {loading && (
          <div
            style={{
              marginBottom: "1.5rem",
              padding: "0.75rem 1rem",
              borderRadius: 999,
              backgroundColor: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(148, 163, 184, 0.4)",
              fontSize: "0.9rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "999px",
                border: "2px solid #22c55e",
                borderTopColor: "transparent",
                animation: "spin 0.7s linear infinite",
              }}
            />
            Loading videos from consumer…
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: "1.5rem",
              padding: "0.75rem 1rem",
              borderRadius: 12,
              backgroundColor: "rgba(127, 29, 29, 0.2)",
              border: "1px solid rgba(220, 38, 38, 0.6)",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && videos.length === 0 && (
          <div
            style={{
              marginTop: "2rem",
              padding: "2rem",
              borderRadius: 16,
              border: "1px dashed rgba(148, 163, 184, 0.5)",
              background:
                "linear-gradient(to bottom right, rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.6))",
              textAlign: "center",
            }}
          >
            <h2 style={{ marginBottom: "0.5rem", fontSize: "1.25rem" }}>
              No videos yet
            </h2>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#9ca3af" }}>
              Use the producer UI to upload a video to the consumer, then refresh this page.
            </p>
          </div>
        )}

        {/* Video grid */}
        {videos.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "1.25rem",
              marginTop: "1.25rem",
            }}
          >
            {videos.map((name) => {
              const id = `preview-${name}`;
              const isSelected = selected === name;
              return (
                <div
                  key={name}
                  style={{
                    position: "relative",
                    borderRadius: 16,
                    padding: 10,
                    cursor: "pointer",
                    background:
                      "linear-gradient(to bottom right, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.8))",
                    border: isSelected
                      ? "1px solid #38bdf8"
                      : "1px solid rgba(148, 163, 184, 0.5)",
                    boxShadow: isSelected
                      ? "0 0 0 1px rgba(56, 189, 248, 0.5), 0 18px 40px rgba(15, 23, 42, 0.7)"
                      : "0 18px 40px rgba(15, 23, 42, 0.85)",
                    transition:
                      "transform 0.15s ease-out, box-shadow 0.15s ease-out, border-color 0.15s ease-out",
                  }}
                  onMouseEnter={() => handleHover(id)}
                  onMouseLeave={() => handleLeave(id)}
                  onClick={() => setSelected(name)}
                >
                  <div
                    style={{
                      overflow: "hidden",
                      borderRadius: 12,
                      marginBottom: 8,
                    }}
                  >
                    <video
                      id={id}
                      style={{
                        width: "100%",
                        display: "block",
                        borderRadius: 12,
                        transform: "scale(1.01)",
                      }}
                      src={`/videos/${encodeURIComponent(name)}`}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "#cbd5f5",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={name}
                  >
                    {name}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: "0.75rem",
                      color: "#6b7280",
                    }}
                  >
                    Hover for preview • Click to play
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Player */}
        {selected && (
          <section
            style={{
              marginTop: "2.5rem",
              padding: "1.5rem",
              borderRadius: 20,
              background:
                "linear-gradient(to bottom right, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.9))",
              border: "1px solid rgba(148, 163, 184, 0.6)",
              boxShadow: "0 20px 40px rgba(15, 23, 42, 0.9)",
            }}
          >
            <div
              style={{
                marginBottom: "0.75rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.1rem",
                  fontWeight: 500,
                  color: "#e5e7eb",
                }}
              >
                Now Playing
              </h2>
              <button
                onClick={() => setSelected(null)}
                style={{
                  border: "none",
                  borderRadius: 999,
                  padding: "0.25rem 0.7rem",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  backgroundColor: "rgba(15, 23, 42, 0.9)",
                  color: "#9ca3af",
                  borderColor: "rgba(148, 163, 184, 0.7)",
                  borderWidth: 1,
                  borderStyle: "solid",
                }}
              >
                Clear
              </button>
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                color: "#9ca3af",
                marginBottom: "0.75rem",
                wordBreak: "break-all",
              }}
            >
              {selected}
            </div>
            <video
              style={{
                width: "100%",
                maxWidth: 900,
                borderRadius: 16,
                outline: "none",
              }}
              controls
              src={`/videos/${encodeURIComponent(selected)}`}
            />
          </section>
        )}
      </main>
    </div>
  );
};

export default App;
