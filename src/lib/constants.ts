export const DEFAULT_ADMIN_USER_IDS = ["PH_admin", "GV_admin"];

export const ADMIN_USER_IDS = new Set([
  ...DEFAULT_ADMIN_USER_IDS,
  ...(process.env.NEXT_PUBLIC_ADMIN_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
]);

export function isAdminId(userId: string): boolean {
  return ADMIN_USER_IDS.has(userId);
}
