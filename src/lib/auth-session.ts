export type AppUserRole = "admin" | "teacher" | "parent" | "professor" | "projectmanager";

export interface AuthSession {
  userId: string;
  userRole: AppUserRole;
  remember: boolean;
  expiresAt: number;
  homePath?: "/parent" | "/teacher" | "/backend";
}

const SESSION_KEY = "ai4autism.auth.session";
const LEGACY_USER_ID_KEY = "userId";
const LEGACY_USER_ROLE_KEY = "userRole";

const ONE_HOUR_MS = 60 * 60 * 1000;
const REMEMBER_TTL_MS = 30 * 24 * ONE_HOUR_MS;
const SHORT_TTL_MS = 12 * ONE_HOUR_MS;

function isBrowser() {
  return typeof window !== "undefined";
}

export function setAuthSession(input: {
  userId: string;
  userRole: AppUserRole;
  remember?: boolean;
  homePath?: "/parent" | "/teacher" | "/backend";
}) {
  if (!isBrowser()) return;

  const remember = input.remember ?? true;
  const expiresAt = Date.now() + (remember ? REMEMBER_TTL_MS : SHORT_TTL_MS);

  const session: AuthSession = {
    userId: input.userId,
    userRole: input.userRole,
    remember,
    expiresAt,
    homePath: input.homePath,
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(LEGACY_USER_ID_KEY, session.userId);
  localStorage.setItem(LEGACY_USER_ROLE_KEY, session.userRole);
}

export function clearAuthSession() {
  if (!isBrowser()) return;

  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_USER_ID_KEY);
  localStorage.removeItem(LEGACY_USER_ROLE_KEY);
}

export function getAuthSession(): AuthSession | null {
  if (!isBrowser()) return null;

  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    const legacyUserId = localStorage.getItem(LEGACY_USER_ID_KEY);
    const legacyRole = localStorage.getItem(LEGACY_USER_ROLE_KEY) as AppUserRole | null;
    if (!legacyUserId || !legacyRole) return null;

    // Backward-compatible migration for old localStorage format.
    setAuthSession({ userId: legacyUserId, userRole: legacyRole, remember: true });
    return getAuthSession();
  }

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed.userId || !parsed.userRole || !parsed.expiresAt) {
      clearAuthSession();
      return null;
    }

    if (Date.now() > parsed.expiresAt) {
      clearAuthSession();
      return null;
    }

    // Keep legacy keys in sync with pages that still read them directly.
    localStorage.setItem(LEGACY_USER_ID_KEY, parsed.userId);
    localStorage.setItem(LEGACY_USER_ROLE_KEY, parsed.userRole);

    return parsed;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function routeForRole(role: AppUserRole): "/parent" | "/teacher" | "/backend" {
  if (role === "admin" || role === "professor" || role === "projectmanager") return "/backend";
  return role === "parent" ? "/parent" : "/teacher";
}

export function routeForSession(session: AuthSession): "/parent" | "/teacher" | "/backend" {
  if (session.homePath) return session.homePath;
  return routeForRole(session.userRole);
}
