/**
 * Shared Recharts tooltip style — light, readable, with soft shadow.
 * Import and spread into every <Tooltip contentStyle={...} /> across the app.
 */
export const TOOLTIP_STYLE: React.CSSProperties = {
  background: "hsl(0 0% 100% / 0.96)",
  color: "#374151",
  border: "1px solid hsl(0 0% 88%)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "0 4px 20px hsl(0 0% 0% / 0.10)",
  padding: "8px 12px",
};

import type React from "react";