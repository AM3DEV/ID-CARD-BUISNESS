import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { MemberRecord } from "../lib/supabase";

interface MembersTableProps {
  members: MemberRecord[];
  loading: boolean;
  generatingId: string | null;
  onPdf: (member: MemberRecord) => void;
  onEdit: (member: MemberRecord) => void;
  onDelete: (member: MemberRecord) => void;
  onPrintAll: () => void;
  onRefresh: () => void;
}

const NAVY = "#0F3B66";
const EMERALD = "#059669";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/**
 * Tableau des membres sauvegardés : recherche, PDF, modification, suppression,
 * impression groupée A4.
 */
export default function MembersTable({
  members,
  loading,
  generatingId,
  onPdf,
  onEdit,
  onDelete,
  onPrintAll,
  onRefresh,
}: MembersTableProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      `${m.first_name} ${m.last_name} ${m.role} ${m.badge_status} ${m.validity_year}`
        .toLowerCase()
        .includes(q)
    );
  }, [members, query]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Membres enregistrés — Tableau</Text>
          <Text style={styles.subtitle}>
            {members.length} carte(s) sauvegardée(s) dans la base
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.btn, styles.btnEmerald]}
            onPress={onPrintAll}
            disabled={members.length === 0}
          >
            <Text style={styles.btnText}>
              Imprimer tout le tableau (Grille A4)
            </Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={onRefresh}>
            <Text style={styles.btnGhostText}>Actualiser</Text>
          </Pressable>
        </View>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Rechercher un membre (nom, rôle, statut…)"
        placeholderTextColor="#94A3B8"
        value={query}
        onChangeText={setQuery}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={NAVY} />
          <Text style={styles.muted}>Chargement des membres…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>
            {members.length === 0
              ? "Aucune carte sauvegardée pour le moment. Remplissez le formulaire puis cliquez sur « Générer PDF & Sauvegarder »."
              : "Aucun membre ne correspond à la recherche."}
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={styles.table}>
            <View style={[styles.row, styles.rowHead]}>
              <Text style={[styles.cell, styles.cPhoto]}>Photo</Text>
              <Text style={[styles.cell, styles.cName]}>Prénom & Nom</Text>
              <Text style={[styles.cell, styles.cRole]}>Rôle</Text>
              <Text style={[styles.cell, styles.cStatus]}>Statut</Text>
              <Text style={[styles.cell, styles.cYear]}>Année</Text>
              <Text style={[styles.cell, styles.cDate]}>Date d'ajout</Text>
              <Text style={[styles.cell, styles.cActions]}>Actions</Text>
            </View>
            {filtered.map((m) => (
              <View key={m.id} style={styles.row}>
                <View style={[styles.cell, styles.cPhoto]}>
                  {m.photo_base64 ? (
                    <Image
                      source={{ uri: m.photo_base64 }}
                      style={styles.thumb}
                    />
                  ) : (
                    <View style={[styles.thumb, styles.thumbFallback]}>
                      <Text style={styles.thumbText}>
                        {(m.first_name.charAt(0) + m.last_name.charAt(0)).toUpperCase() ||
                          "—"}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.cell, styles.cName, styles.strong]}>
                  {m.first_name} {m.last_name}
                </Text>
                <Text style={[styles.cell, styles.cRole]}>{m.role}</Text>
                <Text style={[styles.cell, styles.cStatus]}>
                  <Text style={styles.pill}>{m.badge_status}</Text>
                </Text>
                <Text style={[styles.cell, styles.cYear]}>
                  {m.validity_year}
                </Text>
                <Text style={[styles.cell, styles.cDate]}>
                  {formatDate(m.created_at)}
                </Text>
                <View style={[styles.cell, styles.cActions, styles.actions]}>
                  <Pressable
                    style={[styles.miniBtn, styles.miniPdf]}
                    onPress={() => onPdf(m)}
                    disabled={generatingId === m.id}
                  >
                    <Text style={styles.miniText}>
                      {generatingId === m.id ? "…" : "📄 PDF"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.miniBtn, styles.miniEdit]}
                    onPress={() => onEdit(m)}
                  >
                    <Text style={styles.miniText}>✏️ Modifier</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.miniBtn, styles.miniDelete]}
                    onPress={() => onDelete(m)}
                  >
                    <Text style={styles.miniText}>🗑️ Supprimer</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  headerLeft: { flex: 1, minWidth: 220 },
  title: { fontSize: 18, fontWeight: "800", color: NAVY },
  subtitle: { fontSize: 12, color: "#64748B", marginTop: 2 },
  headerActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 9 },
  btnEmerald: { backgroundColor: EMERALD },
  btnGhost: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: NAVY,
  },
  btnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
  btnGhostText: { color: NAVY, fontWeight: "800", fontSize: 13 },
  search: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
    marginBottom: 10,
  },
  center: { paddingVertical: 28, alignItems: "center", gap: 8 },
  muted: { color: "#64748B", fontSize: 13, textAlign: "center" },
  table: { minWidth: 860 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 8,
  },
  rowHead: {
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  cell: { fontSize: 13, color: "#0F172A", paddingHorizontal: 6 },
  cPhoto: { width: 70 },
  cName: { width: 170 },
  cRole: { width: 180 },
  cStatus: { width: 170 },
  cYear: { width: 100 },
  cDate: { width: 110 },
  cActions: { width: 300, flexGrow: 1 },
  strong: { fontWeight: "800", color: NAVY },
  pill: {
    backgroundColor: "#D1FAE5",
    color: "#065F46",
    fontWeight: "800",
    fontSize: 11,
  },
  thumb: { width: 40, height: 48, borderRadius: 6, backgroundColor: "#E2E8F0" },
  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DBEAFE",
  },
  thumbText: { fontWeight: "800", color: NAVY, fontSize: 13 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  miniBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7 },
  miniPdf: { backgroundColor: NAVY },
  miniEdit: { backgroundColor: "#F59E0B" },
  miniDelete: { backgroundColor: "#DC2626" },
  miniText: { color: "#FFFFFF", fontWeight: "800", fontSize: 12 },
});
