import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";

export const SecurityWatermark = () => {
  const { user, profileName } = useAuth();
  const [ip, setIp] = useState("…");
  const now = new Date().toLocaleString("ko-KR", { hour12: false });

  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then((d) => setIp(d.ip))
      .catch(() => setIp("N/A"));
  }, []);

  if (!user) return null;

  const text = `${profileName ?? user.email?.split("@")[0] ?? "user"} · ${user.id.slice(0, 8)} · ${now} · ${ip}`;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden select-none"
      aria-hidden="true"
      style={{ opacity: 0.04 }}
    >
      <div className="w-[200%] h-[200%] -rotate-[25deg] -translate-x-1/4 -translate-y-1/4 flex flex-wrap gap-y-24 gap-x-16">
        {Array.from({ length: 60 }).map((_, i) => (
          <span
            key={i}
            className="text-foreground text-[13px] font-mono whitespace-nowrap"
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
};