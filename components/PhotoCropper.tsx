import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  cropImageToDataUri,
  getImageSize,
  type CropRect,
} from "../utils/imageToBase64";

interface PhotoCropperProps {
  visible: boolean;
  imageUri: string | null;
  onCancel: () => void;
  onDone: (dataUri: string) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

interface Dims {
  width: number;
  height: number;
}

/**
 * Éditeur de recadrage intégré (surtout pour le Web, sans éditeur natif) :
 * cadre 3:4 fixe, glisser pour positionner, +/− pour zoomer.
 */
export default function PhotoCropper({
  visible,
  imageUri,
  onCancel,
  onDone,
}: PhotoCropperProps) {
  const { width: winWidth } = useWindowDimensions();
  const frameWidth = Math.min(300, Math.max(220, winWidth - 96));
  const frameHeight = (frameWidth * 4) / 3;

  const [dims, setDims] = useState<Dims | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [applying, setApplying] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);

  const dimsRef = useRef<Dims | null>(null);
  dimsRef.current = dims;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const gestureRef = useRef({ baseX: 0, baseY: 0 });

  function coverScale(d: Dims): number {
    return Math.max(frameWidth / d.width, frameHeight / d.height);
  }

  function clampOffset(x: number, y: number, z: number, d: Dims) {
    const s = coverScale(d) * z;
    const minX = Math.min(0, frameWidth - d.width * s);
    const minY = Math.min(0, frameHeight - d.height * s);
    return {
      x: Math.min(0, Math.max(minX, x)),
      y: Math.min(0, Math.max(minY, y)),
    };
  }

  // (Re)charge l'image à chaque ouverture.
  useEffect(() => {
    if (!visible || !imageUri) return;
    let alive = true;
    setLoading(true);
    setDims(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setCropError(null);
    getImageSize(imageUri)
      .then((d) => {
        if (!alive) return;
        setDims(d);
        const s0 = Math.max(frameWidth / d.width, frameHeight / d.height);
        setOffset({
          x: (frameWidth - d.width * s0) / 2,
          y: (frameHeight - d.height * s0) / 2,
        });
      })
      .catch(() => {
        if (alive) setCropError("Impossible de lire cette image.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [visible, imageUri, frameWidth, frameHeight]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          gestureRef.current = {
            baseX: offsetRef.current.x,
            baseY: offsetRef.current.y,
          };
        },
        onPanResponderMove: (_, gesture) => {
          const d = dimsRef.current;
          if (!d) return;
          const next = {
            x: gestureRef.current.baseX + gesture.dx,
            y: gestureRef.current.baseY + gesture.dy,
          };
          const clamped = {
            x: Math.min(
              0,
              Math.max(
                Math.min(
                  0,
                  frameWidth -
                    d.width *
                      (Math.max(frameWidth / d.width, frameHeight / d.height) *
                        zoomRef.current)
                ),
                next.x
              )
            ),
            y: Math.min(
              0,
              Math.max(
                Math.min(
                  0,
                  frameHeight -
                    d.height *
                      (Math.max(frameWidth / d.width, frameHeight / d.height) *
                        zoomRef.current)
                ),
                next.y
              )
            ),
          };
          setOffset(clamped);
        },
      }),
    [frameWidth, frameHeight]
  );

  function changeZoom(next: number) {
    const d = dimsRef.current;
    const z =
      Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)) * 10) / 10;
    setZoom(z);
    if (d) {
      setOffset((prev) => {
        const s = coverScale(d) * z;
        const minX = Math.min(0, frameWidth - d.width * s);
        const minY = Math.min(0, frameHeight - d.height * s);
        return {
          x: Math.min(0, Math.max(minX, prev.x)),
          y: Math.min(0, Math.max(minY, prev.y)),
        };
      });
    }
  }

  async function handleApply() {
    if (!imageUri || !dims) return;
    setApplying(true);
    setCropError(null);
    try {
      const s = coverScale(dims) * zoom;
      const originX = Math.max(
        0,
        Math.min(dims.width - 1, Math.round(-offset.x / s))
      );
      const originY = Math.max(
        0,
        Math.min(dims.height - 1, Math.round(-offset.y / s))
      );
      const width = Math.max(
        1,
        Math.min(Math.round(frameWidth / s), dims.width - originX)
      );
      const height = Math.max(
        1,
        Math.min(Math.round(frameHeight / s), dims.height - originY)
      );
      const rect: CropRect = { originX, originY, width, height };
      const dataUri = await cropImageToDataUri(imageUri, rect);
      if (!dataUri) throw new Error("crop failed");
      onDone(dataUri);
    } catch {
      setCropError("Le recadrage a échoué, réessayez.");
    } finally {
      setApplying(false);
    }
  }

  const displayScale = dims ? coverScale(dims) * zoom : 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Recadrer la photo</Text>
          <Text style={styles.hint}>
            Glissez l'image pour la positionner, utilisez + / − pour zoomer.
          </Text>

          <View
            style={[
              styles.frame,
              { width: frameWidth, height: frameHeight },
            ]}
            {...panResponder.panHandlers}
          >
            {loading || !dims || !imageUri ? (
              <View style={styles.frameLoading}>
                <ActivityIndicator size="large" color="#123D66" />
              </View>
            ) : (
              <Image
                source={{ uri: imageUri }}
                style={{
                  width: dims.width * displayScale,
                  height: dims.height * displayScale,
                  transform: [
                    { translateX: offset.x },
                    { translateY: offset.y },
                  ],
                }}
              />
            )}
          </View>

          <View style={styles.zoomRow}>
            <Pressable
              style={styles.zoomBtn}
              onPress={() => changeZoom(zoom - 0.25)}
              disabled={loading || !dims}
              accessibilityLabel="Réduire le zoom"
            >
              <Text style={styles.zoomBtnText}>−</Text>
            </Pressable>
            <Text style={styles.zoomLabel}>{Math.round(zoom * 100)} %</Text>
            <Pressable
              style={styles.zoomBtn}
              onPress={() => changeZoom(zoom + 0.25)}
              disabled={loading || !dims}
              accessibilityLabel="Augmenter le zoom"
            >
              <Text style={styles.zoomBtnText}>+</Text>
            </Pressable>
          </View>

          {cropError ? <Text style={styles.error}>{cropError}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.btnGhost]}
              onPress={onCancel}
              disabled={applying}
            >
              <Text style={styles.btnGhostText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[
                styles.btn,
                styles.btnPrimary,
                (applying || loading || !dims) && styles.btnDisabled,
              ]}
              onPress={() => void handleApply()}
              disabled={applying || loading || !dims}
            >
              {applying ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.btnPrimaryText}>Appliquer</Text>
              )}
            </Pressable>
          </View>
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
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E1E8F1",
  },
  title: { fontSize: 18, fontWeight: "800", color: "#123D66" },
  hint: {
    fontSize: 12.5,
    color: "#5B6B7F",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  frame: {
    backgroundColor: "#0F172A",
    borderRadius: 10,
    overflow: "hidden",
  },
  frameLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 14,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#123D66",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomBtnText: { fontSize: 22, fontWeight: "800", color: "#123D66" },
  zoomLabel: { fontSize: 14, fontWeight: "800", color: "#123D66", minWidth: 52, textAlign: "center" },
  error: {
    marginTop: 10,
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    width: "100%",
  },
  btn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhost: { backgroundColor: "#F1F5F9" },
  btnGhostText: { color: "#123D66", fontWeight: "800", fontSize: 15 },
  btnPrimary: { backgroundColor: "#123D66" },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
});
