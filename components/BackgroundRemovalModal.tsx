import { Modal, StyleSheet, Text, Pressable, View } from "react-native";

interface BackgroundRemovalModalProps {
  visible: boolean;
  /** 0 → 1 (progression monotone). */
  progress: number;
  phaseLabel: string;
  onSkip: () => void;
}

/**
 * Barre de progression de la suppression d'arrière-plan :
 * modèle IA téléchargé une fois, puis détourage.
 */
export default function BackgroundRemovalModal({
  visible,
  progress,
  phaseLabel,
  onSkip,
}: BackgroundRemovalModalProps) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Suppression de l'arrière-plan</Text>
          <Text style={styles.phase}>{phaseLabel}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.pct}>{pct} %</Text>
          <Pressable style={styles.skipBtn} onPress={onSkip}>
            <Text style={styles.skipText}>Garder la photo originale</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E1E8F1",
  },
  title: { fontSize: 17, fontWeight: "800", color: "#123D66" },
  phase: {
    fontSize: 13,
    color: "#5B6B7F",
    marginTop: 6,
    marginBottom: 14,
    textAlign: "center",
  },
  track: {
    width: "100%",
    height: 10,
    borderRadius: 5,
    backgroundColor: "#D9E4F1",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: "#087FE5",
  },
  pct: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "800",
    color: "#123D66",
  },
  skipBtn: { marginTop: 12, padding: 8 },
  skipText: { color: "#087FE5", fontWeight: "700", fontSize: 13.5 },
});
