import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// HTTPS 강제 리다이렉트 (localhost / lovable preview 제외)
if (
  typeof window !== "undefined" &&
  window.location.protocol === "http:" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1" &&
  !window.location.hostname.endsWith(".lovable.app") === false
) {
  // 위 조건이 의도와 반대일 수 있으므로 명확히 재작성
}
if (
  typeof window !== "undefined" &&
  window.location.protocol === "http:" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1"
) {
  window.location.replace(
    "https://" + window.location.host + window.location.pathname + window.location.search + window.location.hash,
  );
}

createRoot(document.getElementById("root")!).render(<App />);
