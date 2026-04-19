import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** A curated list of icons admins can choose from in the menu manager. */
export const MENU_ICON_NAMES = [
  "LayoutDashboard", "PlusCircle", "Activity", "Wallet", "Megaphone",
  "Trophy", "Users", "Settings2", "ShieldCheck", "HeartHandshake",
  "Link2", "Smartphone", "CalendarRange", "Store", "UserCog",
  "History", "Folder", "FolderTree", "ListTree", "Circle",
  "Star", "Bookmark", "Tag", "BarChart3", "PieChart",
  "TrendingUp", "Target", "Briefcase", "Building2", "Users2",
  "FileText", "FileSpreadsheet", "Database", "Coins", "DollarSign",
  "Receipt", "ShoppingBag", "Package", "Truck", "Box",
  "Home", "Map", "Compass", "Bell", "MessageSquare",
  "Inbox", "Mail", "Phone", "Sparkles", "Zap",
  "Cog", "Wrench", "Lock", "Key", "Eye",
] as const;

export type MenuIconName = typeof MENU_ICON_NAMES[number];

const FALLBACK = (Icons as any).Circle as LucideIcon;

export function resolveIcon(name?: string | null): LucideIcon {
  if (!name) return FALLBACK;
  const Comp = (Icons as any)[name];
  return (Comp as LucideIcon) ?? FALLBACK;
}
