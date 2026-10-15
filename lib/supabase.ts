import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { storageGet, storageSet } from "./storage";

/**
 * Couche d'accès aux données — Supabase (PostgreSQL) avec repli local.
 *
 * Si EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY sont absents,
 * toutes les opérations basculent automatiquement sur AsyncStorage afin que
 * le panneau reste utilisable en démonstration hors-ligne.
 */

// ---------------------------------------------------------------------------
// Types partagés
// ---------------------------------------------------------------------------

export interface MemberRecord {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  badge_status: string;
  validity_year: string;
  photo_base64: string | null;
  created_at: string;
}

export interface MemberInput {
  first_name: string;
  last_name: string;
  role: string;
  badge_status: string;
  validity_year: string;
  photo_base64: string | null;
}

// ---------------------------------------------------------------------------
// Configuration Supabase
// ---------------------------------------------------------------------------

const SUPABASE_URL: string =
  (process.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined)?.trim() ?? "";
const SUPABASE_ANON_KEY: string =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined)?.trim() ??
  "";

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

let cachedClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}

// ---------------------------------------------------------------------------
// Repli local (AsyncStorage)
// ---------------------------------------------------------------------------

const LOCAL_MEMBERS_KEY = "econexus_members_cards_local_v1";
const LOCAL_PASSKEY_KEY = "econexus_local_passkeys_v1";
const FALLBACK_TEST_PASSKEY = "ECONEXUS-2026";

function makeLocalId(): string {
  return `local-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

async function readLocalMembers(): Promise<MemberRecord[]> {
  try {
    const raw = await storageGet(LOCAL_MEMBERS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as MemberRecord[];
  } catch {
    return [];
  }
}

async function writeLocalMembers(members: MemberRecord[]): Promise<void> {
  await storageSet(LOCAL_MEMBERS_KEY, JSON.stringify(members));
}

function sortByNewest(members: MemberRecord[]): MemberRecord[] {
  return [...members].sort((a, b) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? "")
  );
}

// ---------------------------------------------------------------------------
// Passkeys
// ---------------------------------------------------------------------------

/**
 * Vérifie un passkey contre la table `access_passkeys`
 * (passkey_code == code ET is_active == true) et retourne le nom du
 * propriétaire pour pré-remplir le formulaire.
 * Repli local : accepte le passkey de test par défaut + ceux déjà validés.
 */
export interface PasskeyCheck {
  ok: boolean;
  label: string | null;
  firstName: string | null;
  lastName: string | null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export async function verifyPasskey(code: string): Promise<PasskeyCheck> {
  const normalized = code.trim();
  if (normalized.length === 0)
    return { ok: false, label: null, firstName: null, lastName: null };

  const client = getSupabase();
  if (!client) {
    try {
      const knownRaw = await storageGet(LOCAL_PASSKEY_KEY);
      const known: string[] = knownRaw ? (JSON.parse(knownRaw) as string[]) : [];
      if (
        normalized === FALLBACK_TEST_PASSKEY ||
        known.includes(normalized)
      ) {
        return {
          ok: true,
          label: "Session locale (hors-ligne)",
          firstName: null,
          lastName: null,
        };
      }
    } catch {
      // ignore — retomber sur le test ci-dessous
    }
    if (normalized === FALLBACK_TEST_PASSKEY) {
      return {
        ok: true,
        label: "Session locale (hors-ligne)",
        firstName: null,
        lastName: null,
      };
    }
    return { ok: false, label: null, firstName: null, lastName: null };
  }

  const baseQuery = () =>
    client
      .from("access_passkeys")
      .select("id,label,is_active,first_name,last_name")
      .eq("passkey_code", normalized)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

  const first = await baseQuery();
  let row: Record<string, unknown> | null =
    (first.data as Record<string, unknown> | null) ?? null;
  let failed = first.error !== null;

  // Base pas encore migrée (colonnes first_name/last_name absentes) :
  // on retente sans ces colonnes au lieu de bloquer la connexion.
  if (first.error && /first_name|last_name|column/i.test(first.error.message)) {
    const retry = await client
      .from("access_passkeys")
      .select("id,label,is_active")
      .eq("passkey_code", normalized)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    row = (retry.data as Record<string, unknown> | null) ?? null;
    failed = retry.error !== null;
  }

  if (failed || !row) {
    return { ok: false, label: null, firstName: null, lastName: null };
  }
  const label = asNullableString(row["label"]);

  // Mémorise le passkey valide pour le mode hors-ligne ultérieur.
  try {
    const knownRaw = await storageGet(LOCAL_PASSKEY_KEY);
    const known: string[] = knownRaw ? (JSON.parse(knownRaw) as string[]) : [];
    if (!known.includes(normalized)) {
      known.push(normalized);
      await storageSet(LOCAL_PASSKEY_KEY, JSON.stringify(known));
    }
  } catch {
    // non bloquant
  }

  return {
    ok: true,
    label,
    firstName: asNullableString(row["first_name"]),
    lastName: asNullableString(row["last_name"]),
  };
}

// ---------------------------------------------------------------------------
// Membres (members_cards)
// ---------------------------------------------------------------------------

export async function fetchMembers(): Promise<MemberRecord[]> {
  const client = getSupabase();
  if (!client) {
    return sortByNewest(await readLocalMembers());
  }
  try {
    const { data, error } = await client
      .from("members_cards")
      .select(
        "id,first_name,last_name,role,badge_status,validity_year,photo_base64,created_at"
      )
      .order("created_at", { ascending: false });
    if (error) {
      return sortByNewest(await readLocalMembers());
    }
    return (data ?? []) as MemberRecord[];
  } catch {
    return sortByNewest(await readLocalMembers());
  }
}

export async function saveMember(
  input: MemberInput,
  editingId: string | null
): Promise<MemberRecord> {
  const payload = {
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    role: input.role.trim(),
    badge_status: input.badge_status.trim() || "MEMBRE DU BUREAU",
    validity_year: input.validity_year.trim() || "2026/2027",
    photo_base64: input.photo_base64,
  };

  const client = getSupabase();
  if (!client) {
    const members = await readLocalMembers();
    if (editingId) {
      const idx = members.findIndex((m) => m.id === editingId);
      if (idx >= 0) {
        const updated: MemberRecord = {
          ...members[idx],
          ...payload,
        };
        members[idx] = updated;
        await writeLocalMembers(members);
        return updated;
      }
    }
    const created: MemberRecord = {
      id: makeLocalId(),
      ...payload,
      created_at: new Date().toISOString(),
    };
    members.unshift(created);
    await writeLocalMembers(members);
    return created;
  }

  try {
    if (editingId && !editingId.startsWith("local-")) {
      const { data, error } = await client
        .from("members_cards")
        .update(payload)
        .eq("id", editingId)
        .select(
          "id,first_name,last_name,role,badge_status,validity_year,photo_base64,created_at"
        )
        .single();
      if (error) throw error;
      return data as MemberRecord;
    }
    // Si l'édition portait sur une ligne locale, on la supprime du cache
    // local puis on insère la version à jour dans Supabase.
    if (editingId && editingId.startsWith("local-")) {
      const members = await readLocalMembers();
      await writeLocalMembers(members.filter((m) => m.id !== editingId));
    }
    const { data, error } = await client
      .from("members_cards")
      .insert(payload)
      .select(
        "id,first_name,last_name,role,badge_status,validity_year,photo_base64,created_at"
      )
      .single();
    if (error) throw error;
    return data as MemberRecord;
  } catch {
    // Repli : persiste localement pour ne jamais perdre la saisie.
    const members = await readLocalMembers();
    if (editingId) {
      const idx = members.findIndex((m) => m.id === editingId);
      if (idx >= 0) {
        const updated: MemberRecord = { ...members[idx], ...payload };
        members[idx] = updated;
        await writeLocalMembers(members);
        return updated;
      }
    }
    const created: MemberRecord = {
      id: makeLocalId(),
      ...payload,
      created_at: new Date().toISOString(),
    };
    members.unshift(created);
    await writeLocalMembers(members);
    return created;
  }
}

export async function deleteMember(id: string): Promise<void> {
  const client = getSupabase();
  if (id.startsWith("local-") || !client) {
    const members = await readLocalMembers();
    await writeLocalMembers(members.filter((m) => m.id !== id));
    if (client && !id.startsWith("local-")) {
      try {
        await client.from("members_cards").delete().eq("id", id);
      } catch {
        // déjà supprimé localement, rien à faire
      }
    }
    return;
  }
  try {
    const { error } = await client.from("members_cards").delete().eq("id", id);
    if (error) throw error;
  } catch {
    const members = await readLocalMembers();
    await writeLocalMembers(members.filter((m) => m.id !== id));
  }
}
