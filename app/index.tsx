import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CardPreview from "../components/CardPreview";
import MembersTable from "../components/MembersTable";
import BackgroundRemovalModal from "../components/BackgroundRemovalModal";
import PhotoCropper from "../components/PhotoCropper";
import { CLUB_LOGO_IMAGE } from "../lib/branding";
import {
  deleteMember,
  fetchMembers,
  saveMember,
  type MemberRecord,
} from "../lib/supabase";
import { useAppStore } from "../store/useAppStore";
import { pickImageAsBase64, pickImageUri } from "../utils/imageToBase64";
import { removePhotoBackground } from "../utils/backgroundRemoval";
import {
  printA4GridPDF,
  printSingleCardPDF,
  type MemberCardData,
} from "../utils/pdfGenerator";

const NAVY = "#0F3B66";
const EMERALD = "#059669";

/**
 * Tableau de bord protégé : éditeur + aperçu CR80 + tableau des membres.
 */
export default function DashboardScreen() {
  const router = useRouter();
  const logout = useAppStore((s) => s.logout);
  const passkeyLabel = useAppStore((s) => s.passkeyLabel);
  const ownerFirstName = useAppStore((s) => s.passkeyFirstName);
  const ownerLastName = useAppStore((s) => s.passkeyLastName);
  const form = useAppStore((s) => s.form);
  const setFormField = useAppStore((s) => s.setFormField);
  const loadMemberIntoForm = useAppStore((s) => s.loadMemberIntoForm);
  const resetForm = useAppStore((s) => s.resetForm);
  const members = useAppStore((s) => s.members);
  const setMembers = useAppStore((s) => s.setMembers);
  const upsertMember = useAppStore((s) => s.upsertMember);
  const removeMember = useAppStore((s) => s.removeMember);
  const membersLoading = useAppStore((s) => s.membersLoading);
  const setMembersLoading = useAppStore((s) => s.setMembersLoading);

  const [busy, setBusy] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropperVisible, setCropperVisible] = useState(false);
  const [bgVisible, setBgVisible] = useState(false);
  const [bgProgress, setBgProgress] = useState(0);
  const [bgPhase, setBgPhase] = useState("");
  const bgSkipRef = useRef(false);
  const bgOriginalRef = useRef<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [printingAll, setPrintingAll] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const ownerAutoFilledRef = useRef(false);
  const insets = useSafeAreaInsets();

  const refreshMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const rows = await fetchMembers();
      setMembers(rows);
    } finally {
      setMembersLoading(false);
    }
  }, [setMembers, setMembersLoading]);

  useEffect(() => {
    void refreshMembers();
  }, [refreshMembers]);

  // Pré-remplit Prénom/Nom avec le propriétaire du passkey (une seule fois,
  // sans écraser la saisie en cours ni une fiche en édition).
  useEffect(() => {
    if (ownerAutoFilledRef.current || form.editingId !== null) return;
    if (!ownerFirstName && !ownerLastName) return;
    if (ownerFirstName && form.firstName.trim().length === 0) {
      setFormField("firstName", ownerFirstName);
    }
    if (ownerLastName && form.lastName.trim().length === 0) {
      setFormField("lastName", ownerLastName);
    }
    ownerAutoFilledRef.current = true;
  }, [
    ownerFirstName,
    ownerLastName,
    form.editingId,
    form.firstName,
    form.lastName,
    setFormField,
  ]);

  function toCardData(
    firstName: string,
    lastName: string,
    role: string,
    badgeStatus: string,
    validityYear: string,
    photoBase64: string | null
  ): MemberCardData {
    return {
      firstName,
      lastName,
      role,
      badgeStatus,
      validityYear,
      photoBase64,
    };
  }

  function memberToCard(m: MemberRecord): MemberCardData {
    return toCardData(
      m.first_name,
      m.last_name,
      m.role,
      m.badge_status,
      m.validity_year,
      m.photo_base64
    );
  }

  async function handleLogout(): Promise<void> {
    await logout();
    router.replace("/login");
  }

  /** Lance la suppression d'arrière-plan (Web) avec barre de progression. */
  async function runBackgroundRemoval(original: string): Promise<void> {
    bgSkipRef.current = false;
    bgOriginalRef.current = original;
    setBgProgress(0);
    setBgPhase("Préparation du modèle IA…");
    setBgVisible(true);
    let result: string | null = null;
    try {
      result = await removePhotoBackground(original, (phase, ratio) => {
        if (bgSkipRef.current) return;
        if (phase === "api") {
          setBgPhase("Suppression haute qualité…");
          setBgProgress((p) => Math.max(p, ratio));
        } else if (phase === "hf") {
          setBgPhase("Détourage IA haute qualité (gratuit)…");
          setBgProgress((p) => Math.max(p, ratio));
        } else if (phase === "model") {
          setBgPhase("Téléchargement du modèle IA…");
          setBgProgress((p) => Math.max(p, ratio * 0.9));
        } else {
          setBgPhase("Suppression de l'arrière-plan…");
          setBgProgress(1);
        }
      });
    } catch {
      result = null;
    }
    if (bgSkipRef.current) return;
    setFormField("photoBase64", result ?? original);
    if (result) setNotice(null);
    setBgVisible(false);
  }

  function handleSkipBackground(): void {
    bgSkipRef.current = true;
    if (bgOriginalRef.current) {
      setFormField("photoBase64", bgOriginalRef.current);
      setNotice(null);
    }
    setBgVisible(false);
  }

  async function handlePickPhoto(): Promise<void> {
    setPickingPhoto(true);
    try {
      // Web : pas d'éditeur système → galerie puis recadrage intégré.
      if (Platform.OS === "web") {
        const picked = await pickImageUri();
        if (!picked.cancelled && picked.uri) {
          setCropSource(picked.uri);
          setCropperVisible(true);
          setNotice(null);
        }
        return;
      }
      const picked = await pickImageAsBase64();
      if (!picked.cancelled) {
        if (picked.dataUri) {
          setFormField("photoBase64", picked.dataUri);
          setNotice(null);
        } else {
          setNotice({
            kind: "error",
            text: "La photo n'a pas pu être traitée, réessayez avec une autre image.",
          });
        }
      }
    } catch (e) {
      setNotice({
        kind: "error",
        text: e instanceof Error ? e.message : "Sélection de la photo impossible.",
      });
    } finally {
      setPickingPhoto(false);
    }
  }

  async function handleGenerate(): Promise<void> {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.role.trim()) {
      setNotice({
        kind: "error",
        text: "Veuillez remplir le Prénom, le Nom et le Rôle avant de générer.",
      });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const saved = await saveMember(
        {
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          role: form.role.trim(),
          badge_status: form.badgeStatus.trim() || "MEMBRE DU BUREAU",
          validity_year: form.validityYear.trim() || "2026/2027",
          photo_base64: form.photoBase64,
        },
        form.editingId
      );
      upsertMember(saved);
      const wasEditing = form.editingId !== null;
      await printSingleCardPDF(
        toCardData(
          saved.first_name,
          saved.last_name,
          saved.role,
          saved.badge_status,
          saved.validity_year,
          saved.photo_base64
        )
      );
      resetForm();
      setNotice({
        kind: "success",
        text: wasEditing
          ? `Carte de ${saved.first_name} ${saved.last_name} mise à jour, tableau actualisé, PDF téléchargé.`
          : `Carte de ${saved.first_name} ${saved.last_name} sauvegardée en base, tableau actualisé, PDF téléchargé.`,
      });
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (e) {
      setNotice({
        kind: "error",
        text:
          e instanceof Error
            ? e.message
            : "Échec de la sauvegarde / génération du PDF.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handlePdf(member: MemberRecord): Promise<void> {
    setGeneratingId(member.id);
    try {
      await printSingleCardPDF(memberToCard(member));
    } finally {
      setGeneratingId(null);
    }
  }

  function handleEdit(member: MemberRecord): void {
    loadMemberIntoForm(member);
    setNotice({
      kind: "info",
      text: `Modification de ${member.first_name} ${member.last_name} — ajustez puis cliquez sur « Générer PDF & Sauvegarder ».`,
    });
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function handleDelete(member: MemberRecord): void {
    const label = `${member.first_name} ${member.last_name}`;
    const doDelete = async () => {
      await deleteMember(member.id);
      removeMember(member.id);
      if (form.editingId === member.id) resetForm();
      setNotice({ kind: "success", text: `Carte de ${label} supprimée.` });
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Supprimer la carte de ${label} ?`)) {
        void doDelete();
      }
      return;
    }
    Alert.alert("Supprimer", `Supprimer la carte de ${label} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => void doDelete(),
      },
    ]);
  }

  async function handlePrintAll(): Promise<void> {
    if (members.length === 0 || printingAll) return;
    setPrintingAll(true);
    try {
      await printA4GridPDF(members.map(memberToCard));
    } finally {
      setPrintingAll(false);
    }
  }

  const isEditing = form.editingId !== null;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: 48 + insets.bottom,
        },
      ]}
    >
      <View style={styles.page}>
        {/* Barre d'en-tête */}
        <View style={styles.topbar}>
          <View style={styles.brandRow}>
            <Image
              source={CLUB_LOGO_IMAGE}
              style={styles.topLogo}
              accessibilityLabel="Logo ECONEXUS"
            />
            <View style={styles.titleCol}>
              <Text style={styles.brand}>ECONEXUS — Studio Cartes ID</Text>
              <View style={styles.sessionRow}>
                <View style={styles.statusDot} />
                <Text style={styles.session}>
                  {ownerFirstName || ownerLastName
                    ? `Connecté : ${[ownerFirstName, ownerLastName]
                        .filter(Boolean)
                        .join(" ")}`
                    : passkeyLabel
                      ? `Session : ${passkeyLabel}`
                      : "Session active"}
                </Text>
              </View>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.logoutBtn,
              pressed && styles.logoutBtnPressed,
            ]}
            onPress={() => void handleLogout()}
          >
            <Text style={styles.logoutText}>Déconnexion</Text>
          </Pressable>
        </View>

        {notice ? (
          <View
            style={[
              styles.notice,
              notice.kind === "success" && styles.noticeSuccess,
              notice.kind === "error" && styles.noticeError,
              notice.kind === "info" && styles.noticeInfo,
            ]}
          >
            <Text style={styles.noticeText}>{notice.text}</Text>
          </View>
        ) : null}

        {/* Studio : formulaire + aperçu */}
        <View style={styles.studio}>
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>
              {isEditing ? "Modifier la carte" : "Nouvelle carte — Éditeur"}
            </Text>

            <Text style={styles.label}>Prénom</Text>
            <TextInput
              style={styles.input}
              value={form.firstName}
              onChangeText={(v) => setFormField("firstName", v)}
              placeholder="Amina"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Nom</Text>
            <TextInput
              style={styles.input}
              value={form.lastName}
              onChangeText={(v) => setFormField("lastName", v)}
              placeholder="Benjeloun"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Filiere</Text>
            <TextInput
              style={styles.input}
              value={form.role}
              onChangeText={(v) => setFormField("role", v)}
              placeholder="Secrétaire Générale"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Rôle</Text>
            <TextInput
              style={styles.input}
              value={form.badgeStatus}
              onChangeText={(v) => setFormField("badgeStatus", v)}
              placeholder="MEMBRE DU BUREAU"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Année de validité</Text>
            <TextInput
              style={styles.input}
              value={form.validityYear}
              onChangeText={(v) => setFormField("validityYear", v)}
              placeholder="2026/2027"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Photo du membre</Text>
            <View style={styles.mediaRow}>
              <Pressable
                onPress={() => void handlePickPhoto()}
                disabled={pickingPhoto}
                accessibilityLabel="Photo du membre — toucher pour recadrer"
              >
                {form.photoBase64 ? (
                  <Image
                    source={{ uri: form.photoBase64 }}
                    style={styles.mediaThumb}
                  />
                ) : (
                  <View style={[styles.mediaThumb, styles.mediaEmpty]}>
                    <Text style={styles.mediaEmptyText}>Aucune</Text>
                  </View>
                )}
              </Pressable>
              <View style={styles.mediaBtns}>
                <Pressable
                  style={styles.pickBtn}
                  onPress={() => void handlePickPhoto()}
                  disabled={pickingPhoto}
                >
                  <Text style={styles.pickBtnText}>
                    {pickingPhoto
                      ? "Chargement…"
                      : form.photoBase64
                        ? "Changer la photo"
                        : "Choisir une photo"}
                  </Text>
                </Pressable>
                {form.photoBase64 ? (
                  <Pressable
                    style={styles.clearBtn}
                    onPress={() => setFormField("photoBase64", null)}
                  >
                    <Text style={styles.clearText}>Retirer</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <Pressable
              style={[styles.generateBtn, busy && styles.generateBusy]}
              onPress={() => void handleGenerate()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.generateText}>
                  {isEditing
                    ? "Mettre à jour & Télécharger le PDF"
                    : "Générer PDF & Sauvegarder"}
                </Text>
              )}
            </Pressable>

            {isEditing ? (
              <Pressable
                style={styles.resetBtn}
                onPress={() => {
                  resetForm();
                  setNotice(null);
                }}
              >
                <Text style={styles.resetText}>
                  Annuler la modification (nouvelle carte)
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.previewCard}>
            <Text style={styles.sectionTitle}>Aperçu en direct — CR80</Text>
            <Text style={styles.previewHint}>
              Format horizontal 85,6 mm × 54 mm
            </Text>
            <CardPreview
              firstName={form.firstName}
              lastName={form.lastName}
              role={form.role}
              badgeStatus={form.badgeStatus}
              validityYear={form.validityYear}
              photoBase64={form.photoBase64}
              onPhotoPress={() => void handlePickPhoto()}
            />
          </View>
        </View>

        {/* Tableau des membres */}
        <MembersTable
          members={members}
          loading={membersLoading}
          generatingId={printingAll ? "__all__" : generatingId}
          onPdf={(m) => void handlePdf(m)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onPrintAll={() => void handlePrintAll()}
          onRefresh={() => void refreshMembers()}
        />

        {/* Éditeur de recadrage (Web) */}
        <PhotoCropper
          visible={cropperVisible}
          imageUri={cropSource}
          onCancel={() => {
            setCropperVisible(false);
            setCropSource(null);
          }}
          onDone={(dataUri) => {
            setCropperVisible(false);
            setCropSource(null);
            void runBackgroundRemoval(dataUri);
          }}
        />

        {/* Suppression d'arrière-plan (Web) */}
        <BackgroundRemovalModal
          visible={bgVisible}
          progress={bgProgress}
          phaseLabel={bgPhase}
          onSkip={handleSkipBackground}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F1F5F9" },
  content: { alignItems: "center", padding: 16, paddingBottom: 48 },
  page: { width: "100%", maxWidth: 1180, gap: 16 },
  topbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E1E8F1",
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#123D66",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  brand: { color: "#123D66", fontSize: 18, fontWeight: "800" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  titleCol: { flex: 1, flexShrink: 1 },
  topLogo: {
    width: 72,
    height: 44,
    resizeMode: "contain",
  },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#009B72",
  },
  session: { color: "#5B6B7F", fontSize: 12.5, fontWeight: "600" },
  logoutBtn: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 16,
    paddingVertical: 11,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 12,
  },
  logoutBtnPressed: { backgroundColor: "#FEE2E2" },
  logoutText: { color: "#DC2626", fontWeight: "800", fontSize: 13.5 },
  notice: { borderRadius: 10, padding: 12 },
  noticeSuccess: { backgroundColor: "#D1FAE5" },
  noticeError: { backgroundColor: "#FEE2E2" },
  noticeInfo: { backgroundColor: "#DBEAFE" },
  noticeText: { fontSize: 13, fontWeight: "600", color: "#0F172A" },
  studio: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "flex-start",
  },
  formCard: {
    flex: 1,
    minWidth: 300,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  previewCard: {
    flex: 1.2,
    minWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "stretch",
  },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: NAVY },
  previewHint: { fontSize: 12, color: "#64748B", marginTop: 2, marginBottom: 12 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "#475569",
    marginTop: 12,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  mediaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  mediaThumb: { width: 56, height: 68, borderRadius: 8 },
  mediaEmpty: {
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaEmptyText: { color: "#64748B", fontSize: 11, fontWeight: "700" },
  mediaBtns: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pickBtn: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: NAVY,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 9,
  },
  pickBtnText: { color: NAVY, fontWeight: "800", fontSize: 13 },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 9 },
  clearText: { color: "#DC2626", fontWeight: "700", fontSize: 13 },
  generateBtn: {
    marginTop: 18,
    backgroundColor: EMERALD,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
  },
  generateBusy: { opacity: 0.75 },
  generateText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  resetBtn: { marginTop: 10, alignItems: "center", padding: 8 },
  resetText: { color: NAVY, fontWeight: "700", fontSize: 13 },
});
