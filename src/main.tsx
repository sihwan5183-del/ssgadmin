import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// HTTPS 강제 리다이렉트 (localhost 제외)
if (
  typeof window !== "undefined" &&
  window.location.protocol === "http:" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1"
) {
  window.location.replace(
    "https://" +
      window.location.host +
      window.location.pathname +
      window.location.search +
      window.location.hash,
  );
}

createRoot(document.getElementById("root")!).render(<App />);
