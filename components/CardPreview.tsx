import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { CLUB_LOGO_IMAGE } from "../lib/branding";

interface CardPreviewProps {
  firstName: string;
  lastName: string;
  role: string;
  badgeStatus: string;
  validityYear: string;
  photoBase64: string | null;
  /** Quand défini, un appui sur la photo rouvre la galerie (recadrage). */
  onPhotoPress?: () => void;
}

const NAVY = "#0F3B66";
const EMERALD = "#059669";
const SLATE = "#0F172A";

/**
 * Aperçu visuel fidèle de la carte CR80 (85.6 × 54 mm, paysage).
 * Ratio conservé via aspectRatio = 85.6 / 54 ≈ 1.585.
 */
export default function CardPreview({
  firstName,
  lastName,
  role,
  badgeStatus,
  validityYear,
  photoBase64,
  onPhotoPress,
}: CardPreviewProps) {
  const fullName =
    `${firstName.trim()} ${lastName.trim()}`.trim() || "PRÉNOM NOM";
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

  return (
    <View style={styles.shadow}>
      <View style={styles.card} testID="card-preview">
        {/* Header */}
        <View style={styles.top}>
          <Image
            source={CLUB_LOGO_IMAGE}
            style={styles.logo}
            accessibilityLabel="Logo du club"
          />
          <View style={styles.club}>
            <Text style={styles.clubName}>ECONEXUS</Text>
            <View style={styles.clubSub}>
              <View style={styles.rule} />
              <Text style={styles.clubSubText}>CLUB ÉTUDIANT</Text>
              <View style={styles.rule} />
            </View>
            <Text style={styles.tagline} numberOfLines={2}>
              Économie • International • Durabilité • Opportunités
            </Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          <Pressable
            style={styles.photoWrap}
            onPress={onPhotoPress}
            disabled={!onPhotoPress}
            accessibilityLabel="Photo du membre — toucher pour recadrer"
          >
            {photoBase64 ? (
              <Image
                key={photoBase64.slice(0, 64)}
                source={{ uri: photoBase64 }}
                style={styles.photo}
              />
            ) : (
              <View style={[styles.photo, styles.photoFallback]}>
                <Text style={styles.fallbackInitials}>{initials || "—"}</Text>
              </View>
            )}
          </Pressable>
          <View style={styles.infos}>
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {badgeStatus || "MEMBRE DU BUREAU"}
              </Text>
            </View>
            <Text style={styles.label}>PRÉNOM & NOM :</Text>
            <Text style={styles.value} numberOfLines={2}>
              {fullName}
            </Text>
            <Text style={[styles.label, styles.labelGap]}>FILIERE :</Text>
            <Text style={styles.valueRole} numberOfLines={2}>
              {role || "Secrétaire Générale"}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.validity}>
            VALIDE POUR L'ANNÉE : {validityYear || "2026/2027"}
          </Text>
          <View style={styles.splitbar}>
            <View style={styles.splitNavy} />
            <View style={styles.splitEmerald} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    borderRadius: 12,
    // Ombre portée (natif + web)
    shadowColor: "#0F3B66",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  card: {
    width: "100%",
    aspectRatio: 85.6 / 54,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  logo: {
    width: 100,
    height: 62,
    resizeMode: "contain",
  },
  club: { flex: 1, minWidth: 0 },
  clubName: {
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: 2,
    color: NAVY,
    lineHeight: 22,
  },
  clubSub: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  rule: { flex: 1, height: 1, backgroundColor: NAVY, opacity: 0.55 },
  clubSubText: {
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: "700",
    color: NAVY,
  },
  tagline: {
    marginTop: 3,
    fontSize: 8.5,
    lineHeight: 11,
    color: EMERALD,
    fontWeight: "600",
  },
  body: { flexDirection: "row", gap: 12, paddingHorizontal: 12, flex: 1 },
  photoWrap: { width: 92, justifyContent: "flex-start" },
  photo: {
    width: 92,
    height: 112,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: NAVY,
    backgroundColor: "#E2E8F0",
    resizeMode: "cover",
  },
  photoFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DBEAFE",
  },
  fallbackInitials: { fontSize: 26, fontWeight: "800", color: NAVY },
  infos: { flex: 1, minWidth: 0, justifyContent: "flex-start" },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: EMERALD,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 7,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  label: { fontSize: 9, letterSpacing: 1, fontWeight: "700", color: "#64748B" },
  labelGap: { marginTop: 6 },
  value: { fontSize: 17, fontWeight: "800", color: NAVY, lineHeight: 20 },
  valueRole: { fontSize: 15, fontWeight: "700", color: SLATE, lineHeight: 18 },
  footer: { marginTop: 4 },
  validity: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    color: NAVY,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  splitbar: { flexDirection: "row", height: 11 },
  splitNavy: { flex: 60, backgroundColor: NAVY },
  splitEmerald: { flex: 40, backgroundColor: EMERALD },
});
