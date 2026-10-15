import { create } from "zustand";
import { storageGet, storageRemove, storageSet } from "../lib/storage";
import type { MemberRecord } from "../lib/supabase";

const SESSION_KEY = "econexus_passkey_session_v1";

export interface CardFormState {
  firstName: string;
  lastName: string;
  role: string;
  badgeStatus: string;
  validityYear: string;
  photoBase64: string | null;
  editingId: string | null;
}

interface AppState {
  // Auth
  isAuthenticated: boolean;
  passkeyLabel: string | null;
  passkeyFirstName: string | null;
  passkeyLastName: string | null;
  authReady: boolean;
  login: (
    label: string | null,
    firstName?: string | null,
    lastName?: string | null
  ) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;

  // Formulaire éditeur
  form: CardFormState;
  setFormField: <K extends keyof CardFormState>(
    key: K,
    value: CardFormState[K]
  ) => void;
  loadMemberIntoForm: (member: MemberRecord) => void;
  resetForm: () => void;

  // Tableau des membres
  members: MemberRecord[];
  membersLoading: boolean;
  setMembers: (members: MemberRecord[]) => void;
  upsertMember: (member: MemberRecord) => void;
  removeMember: (id: string) => void;
  setMembersLoading: (loading: boolean) => void;
}

export const DEFAULT_BADGE_STATUS = "MEMBRE DU BUREAU";
export const DEFAULT_VALIDITY_YEAR = "2026/2027";

const initialForm: CardFormState = {
  firstName: "",
  lastName: "",
  role: "",
  badgeStatus: DEFAULT_BADGE_STATUS,
  validityYear: DEFAULT_VALIDITY_YEAR,
  photoBase64: null,
  editingId: null,
};

export const useAppStore = create<AppState>()((set) => ({
  isAuthenticated: false,
  passkeyLabel: null,
  passkeyFirstName: null,
  passkeyLastName: null,
  authReady: false,

  login: async (label, firstName = null, lastName = null) => {
    try {
      await storageSet(
        SESSION_KEY,
        JSON.stringify({
          authenticated: true,
          label,
          firstName,
          lastName,
          at: Date.now(),
        })
      );
    } catch {
      // le stockage persistant est un bonus, pas un blocage
    }
    set({
      isAuthenticated: true,
      passkeyLabel: label,
      passkeyFirstName: firstName,
      passkeyLastName: lastName,
    });
  },

  logout: async () => {
    try {
      await storageRemove(SESSION_KEY);
    } catch {
      // ignore
    }
    set({
      isAuthenticated: false,
      passkeyLabel: null,
      passkeyFirstName: null,
      passkeyLastName: null,
    });
  },

  restoreSession: async () => {
    try {
      const raw = await storageGet(SESSION_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          (parsed as { authenticated?: unknown }).authenticated === true
        ) {
          const session = parsed as {
            label?: unknown;
            firstName?: unknown;
            lastName?: unknown;
          };
          set({
            isAuthenticated: true,
            passkeyLabel:
              typeof session.label === "string" ? session.label : null,
            passkeyFirstName:
              typeof session.firstName === "string" ? session.firstName : null,
            passkeyLastName:
              typeof session.lastName === "string" ? session.lastName : null,
            authReady: true,
          });
          return;
        }
      }
    } catch {
      // session illisible → rester déconnecté
    }
    set({
      isAuthenticated: false,
      passkeyLabel: null,
      passkeyFirstName: null,
      passkeyLastName: null,
      authReady: true,
    });
  },

  form: initialForm,

  setFormField: (key, value) =>
    set((state) => ({ form: { ...state.form, [key]: value } })),

  loadMemberIntoForm: (member) =>
    set((state) => ({
      form: {
        ...state.form,
        firstName: member.first_name,
        lastName: member.last_name,
        role: member.role,
        badgeStatus: member.badge_status,
        validityYear: member.validity_year,
        photoBase64: member.photo_base64,
        editingId: member.id,
      },
    })),

  resetForm: () => set({ form: { ...initialForm } }),

  members: [],
  membersLoading: false,

  setMembers: (members) => set({ members }),

  upsertMember: (member) =>
    set((state) => {
      const idx = state.members.findIndex((m) => m.id === member.id);
      if (idx >= 0) {
        const next = [...state.members];
        next[idx] = member;
        return { members: next };
      }
      return { members: [member, ...state.members] };
    }),

  removeMember: (id) =>
    set((state) => ({ members: state.members.filter((m) => m.id !== id) })),

  setMembersLoading: (loading) => set({ membersLoading: loading }),
}));
