import { create } from "zustand";

export interface SshHost {
  id: string;
  name: string;
  user: string;
  host: string;
  port: number;
}

export interface RecentSsh {
  user: string;
  host: string;
  port: number;
  connectedAt: string; // ISO string
}

const SAVED_KEY  = "ncp_ssh_saved";
const RECENT_KEY = "ncp_ssh_recent";
const MAX_RECENT = 8;

function loadSaved(): SshHost[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]"); } catch { return []; }
}
function loadRecent(): RecentSsh[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; }
}
function persist(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

interface SshStore {
  saved:  SshHost[];
  recent: RecentSsh[];
  addSaved:    (host: Omit<SshHost, "id">) => void;
  removeSaved: (id: string) => void;
  addRecent:   (entry: Omit<RecentSsh, "connectedAt">) => void;
  clearRecent: () => void;
}

export const useSshStore = create<SshStore>((set, get) => ({
  saved:  loadSaved(),
  recent: loadRecent(),

  addSaved: (host) => {
    const entry: SshHost = { ...host, id: `${Date.now()}` };
    const updated = [...get().saved, entry];
    persist(SAVED_KEY, updated);
    set({ saved: updated });
  },

  removeSaved: (id) => {
    const updated = get().saved.filter((h) => h.id !== id);
    persist(SAVED_KEY, updated);
    set({ saved: updated });
  },

  addRecent: ({ user, host, port }) => {
    const entry: RecentSsh = { user, host, port, connectedAt: new Date().toISOString() };
    // Remove duplicate if same user@host:port exists
    const filtered = get().recent.filter(
      (r) => !(r.user === user && r.host === host && r.port === port)
    );
    const updated = [entry, ...filtered].slice(0, MAX_RECENT);
    persist(RECENT_KEY, updated);
    set({ recent: updated });
  },

  clearRecent: () => {
    persist(RECENT_KEY, []);
    set({ recent: [] });
  },
}));
