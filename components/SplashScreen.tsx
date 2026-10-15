import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { CLUB_LOGO_IMAGE } from "../lib/branding";

const PRIMARY = "#123D66";
const SECONDARY = "#087FE5";
const ACCENT = "#009B72";
const PAGE_BG = "#F2F6FB";

export const SPLASH_MIN_DURATION_MS = 2300;

/**
 * Écran de lancement : logo, nom du club animés et ligne de chargement.
 * Affiché au démarrage jusqu'à la fin du chargement initial (voir _layout).
 */
export default function SplashScreen() {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;
  const zoom = useRef(new Animated.Value(0.9)).current;
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 650,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 650,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(zoom, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(bar, {
        toValue: 1,
        duration: SPLASH_MIN_DURATION_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  }, [fade, rise, zoom, bar]);

  const barWidth = bar.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.screen}>
      <View style={styles.background} pointerEvents="none">
        <View style={styles.orbTop} />
        <View style={styles.orbBottom} />
      </View>
      <Animated.View
        style={[styles.brand, { opacity: fade, transform: [{ translateY: rise }] }]}
      >
        <Animated.View style={{ transform: [{ scale: zoom }] }}>
          <Image
            source={CLUB_LOGO_IMAGE}
            style={styles.logo}
            accessibilityLabel="Logo ECONEXUS"
          />
        </Animated.View>
        <Text style={styles.name}>ECONEXUS</Text>
        <View style={styles.subRow}>
          <View style={styles.rule} />
          <Text style={styles.sub}>CLUB ÉTUDIANT</Text>
          <View style={styles.rule} />
        </View>
        <Text style={styles.tagline}>
          Économie • International • Durabilité • Opportunités
        </Text>
      </Animated.View>
      <View style={styles.loader}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: barWidth }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PAGE_BG,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  background: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  orbTop: {
    position: "absolute",
    top: -110,
    right: -110,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(8, 127, 229, 0.07)",
  },
  orbBottom: {
    position: "absolute",
    bottom: -120,
    left: -120,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(0, 155, 114, 0.06)",
  },
  brand: {
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
  },
  logo: {
    width: 168,
    height: 96,
    resizeMode: "contain",
    marginBottom: 18,
  },
  name: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 4,
    color: PRIMARY,
    textAlign: "center",
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    width: "100%",
  },
  rule: { flex: 1, height: 1, backgroundColor: PRIMARY, opacity: 0.4 },
  sub: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 4,
    color: PRIMARY,
  },
  tagline: {
    fontSize: 12,
    color: ACCENT,
    fontWeight: "600",
    marginTop: 10,
    textAlign: "center",
  },
  loader: {
    marginTop: 52,
    width: 180,
    alignItems: "center",
  },
  track: {
    width: "100%",
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D9E4F1",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: SECONDARY,
  },
});
