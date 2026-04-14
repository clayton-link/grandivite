import { adminDb } from "./adminDb.js";

// Fire-and-forget audit writer — never blocks a save operation
export async function writeAudit(actorEmail, action, targetType, targetId, payload) {
  try {
    await adminDb.writeAuditEntry(actorEmail, action, targetType, targetId, payload);
  } catch (_) {
    // Intentionally swallowed — audit failure must never surface to user
  }
}

// Admin-specific color tokens (extends main app C object)
export const AdminC = {
  sidebar:        "#1E3A2F",
  sidebarHover:   "rgba(255,255,255,0.08)",
  sidebarActive:  "rgba(255,255,255,0.14)",
  sidebarText:    "#A8C4BC",
  sidebarTextActive: "#FFFFFF",
  sidebarBorder:  "rgba(255,255,255,0.1)",
  headerBg:       "#FFFFFF",
  rowHover:       "#F9F5F0",
  tagOwner:       "#3B82F6",
  tagAdmin:       "#8B5CF6",
  tagEditor:      "#F59E0B",
  tagViewer:      "#6B7280",
};

// 12 preset colors for the group color picker
export const COLOR_PRESETS = [
  "#2C4A3E", "#E8936A", "#8B6F47", "#5B8A7A",
  "#C46B3A", "#6B5B8A", "#3B82F6", "#EF4444",
  "#10B981", "#F59E0B", "#EC4899", "#6366F1",
];

// Format ISO timestamp to readable string
export function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

// Role badge style
export function roleBadgeStyle(role) {
  const colors = {
    owner:  { bg: "#EFF6FF", color: AdminC.tagOwner,  border: "#BFDBFE" },
    admin:  { bg: "#F5F3FF", color: AdminC.tagAdmin,  border: "#DDD6FE" },
    editor: { bg: "#FFFBEB", color: AdminC.tagEditor, border: "#FDE68A" },
    viewer: { bg: "#F9FAFB", color: AdminC.tagViewer, border: "#E5E7EB" },
  };
  const c = colors[role] || colors.viewer;
  return { backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}`,
    borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, display: "inline-block" };
}
