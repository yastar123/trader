import { useEffect, useState } from "react";

export type DemoSession = {
  name: string;
  email: string;
  accountId: string;
  accountType: "Raw Spread" | "Standard";
  currency: "USD" | "IDR";
  timezone: string;
  leverage?: number;
  loggedIn: boolean;
  balance?: number;
};

export const DEFAULT_SESSION: DemoSession = {
  name: "Raka Pratama",
  email: "raka.pratama@ictrading.id",
  accountId: "IC-884210",
  accountType: "Raw Spread",
  currency: "USD",
  timezone: "Asia/Jakarta (WIB)",
  leverage: 500,
  loggedIn: true,
  balance: 24510,
};

let currentSession: DemoSession = { ...DEFAULT_SESSION };
let hydratedFromApi = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function saveDemoSession(partial: Partial<DemoSession>) {
  currentSession = {
    ...currentSession,
    ...partial,
    name: partial.name?.trim() ? partial.name.trim() : currentSession.name,
    email: partial.email?.trim() ? partial.email.trim() : currentSession.email,
    loggedIn: true,
  };
  notifyListeners();
}

export async function syncLoginWithExpress(payload: {
  email?: string;
  name?: string;
  isRegister?: boolean;
}) {
  try {
    const endpoint = payload.isRegister ? "/api/auth/register" : "/api/auth/login";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: payload.email, name: payload.name }),
    });
    if (res.ok) {
      const data = (await res.json()) as DemoSession;
      currentSession = data;
      notifyListeners();
      return;
    }
  } catch {
    // Fallback to in-memory update if API unavailable
  }
  saveDemoSession(payload);
}

export async function syncProfileWithExpress(partial: Partial<DemoSession>) {
  saveDemoSession(partial);
  try {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    });
    if (res.ok) {
      const data = (await res.json()) as DemoSession;
      currentSession = data;
      notifyListeners();
    }
  } catch {
    // Keep in-memory update
  }
}

export function clearDemoSession() {
  currentSession = { ...DEFAULT_SESSION, loggedIn: false };
  notifyListeners();
  void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}

export function readDemoSession(): DemoSession {
  return currentSession;
}

export function useDemoSession() {
  const [session, setSession] = useState<DemoSession>(readDemoSession);

  useEffect(() => {
    setSession(readDemoSession());
    const handleUpdate = () => setSession(readDemoSession());
    listeners.add(handleUpdate);

    if (!hydratedFromApi) {
      hydratedFromApi = true;
      void fetch("/api/session")
        .then((res) => (res.ok ? (res.json() as Promise<DemoSession>) : null))
        .then((data) => {
          if (data) {
            currentSession = data;
            notifyListeners();
          }
        })
        .catch(() => {});
    }

    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  return {
    session,
    updateSession: syncProfileWithExpress,
    logout: clearDemoSession,
  };
}

const sidebarCollapsedState: Record<"user" | "admin", boolean> = {
  user: false,
  admin: false,
};
const sidebarListeners = new Set<() => void>();

export function useSidebarCollapse(scope: "user" | "admin") {
  const [collapsed, setCollapsed] = useState<boolean>(() => sidebarCollapsedState[scope]);

  useEffect(() => {
    setCollapsed(sidebarCollapsedState[scope]);
    const sync = () => setCollapsed(sidebarCollapsedState[scope]);
    sidebarListeners.add(sync);
    return () => {
      sidebarListeners.delete(sync);
    };
  }, [scope]);

  function toggleCollapsed() {
    sidebarCollapsedState[scope] = !sidebarCollapsedState[scope];
    for (const listener of sidebarListeners) listener();
  }

  return { collapsed, toggleCollapsed };
}
