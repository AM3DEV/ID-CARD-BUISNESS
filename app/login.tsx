import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CLUB_LOGO_IMAGE } from "../lib/branding";
import { verifyPasskey } from "../lib/supabase";
import { useAppStore } from "../store/useAppStore";

const PRIMARY = "#123D66";
const SECONDARY = "#087FE5";
const ACCENT = "#009B72";
const PAGE_BG = "#F2F6FB";
const INK = "#12233A";
const SLATE = "#5B6B7F";
const BORDER = "#E1E8F1";
const INPUT_BG = "#F7FAFD";
const INPUT_BORDER = "#D5DEE9";
const ERROR = "#DC2626";

/**
 * Écran de connexion — passkey uniquement (ni e-mail, ni identifiant).
 */
export default function LoginScreen() {
  const router = useRouter();
  const login = useAppStore((s) => s.login);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  const [passkey, setPasskey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const insets = useSafeAreaInsets();

  async function handleLogin(): Promise<void> {
    const code = passkey.trim();
    if (code.length === 0) {
      setError("Veuillez saisir votre passkey.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await verifyPasskey(code);
      if (result.ok) {
        await login(result.label, result.firstName, result.lastName);
        router.replace("/");
      } else {
        setError("Passkey invalide ou expiré");
      }
    } catch {
      setError("Passkey invalide ou expiré");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.background} pointerEvents="none">
        <View style={styles.orbTop} />
        <View style={styles.orbBottom} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(
              insets.top,
              Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 24 : 24
            ),
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Image
            source={CLUB_LOGO_IMAGE}
            style={styles.logo}
            accessibilityLabel="Logo ECONEXUS"
          />
          <Text style={styles.brand}>ECONEXUS - CLUB ÉTUDIANT</Text>
          <Text style={styles.tagline}>
            Économie • International • Durabilité • Opportunités
          </Text>

          <Text style={styles.heading}>Accès au panneau</Text>
          <Text style={styles.hint}>
            Saisissez le passkey fourni par l'administration du club.
          </Text>

          <Text style={styles.fieldLabel}>Passkey d'accès</Text>
          <TextInput
            style={[
              styles.input,
              focused && !error && styles.inputFocused,
              error && styles.inputError,
            ]}
            value={passkey}
            onChangeText={(v) => {
              setPasskey(v);
              if (error) setError(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder=" ex. ECONEXUS-2026"
            placeholderTextColor="#9AA7B8"
            secureTextEntry
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
            onSubmitEditing={() => void handleLogin()}
            returnKeyType="go"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && !loading && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
            onPress={() => void handleLogin()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Se connecter</Text>
            )}
          </Pressable>

          {isAuthenticated ? (
            <Pressable
              style={styles.linkBtn}
              onPress={() => router.replace("/")}
            >
              <Text style={styles.linkText}>
                Session déjà active — ouvrir le panneau →
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.divider} />
          <Text style={styles.foot}>
            Accès réservé aux membres autorisés du bureau.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAGE_BG },
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
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingTop:
      Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 24 : 24,
  },
  card: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 26,
    paddingTop: 30,
    paddingBottom: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: PRIMARY,
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  logo: {
    width: 148,
    height: 84,
    resizeMode: "contain",
    marginBottom: 14,
  },
  brand: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: PRIMARY,
    textAlign: "center",
  },
  tagline: {
    fontSize: 11.5,
    color: ACCENT,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  heading: {
    fontSize: 22,
    fontWeight: "800",
    color: INK,
    marginTop: 22,
    textAlign: "center",
  },
  hint: {
    fontSize: 13.5,
    lineHeight: 19,
    color: SLATE,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  fieldLabel: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: SLATE,
    marginBottom: 8,
  },
  input: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: INPUT_BORDER,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    letterSpacing: 1,
    color: INK,
    backgroundColor: INPUT_BG,
  },
  inputFocused: {
    borderColor: SECONDARY,
    backgroundColor: "#FFFFFF",
    shadowColor: SECONDARY,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  inputError: {
    borderColor: ERROR,
    backgroundColor: "#FEF3F2",
  },
  error: {
    marginTop: 10,
    color: ERROR,
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },
  button: {
    marginTop: 18,
    width: "100%",
    minHeight: 54,
    justifyContent: "center",
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  buttonPressed: {
    backgroundColor: "#0C2E50",
  },
  buttonDisabled: { opacity: 0.75 },
  buttonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  linkBtn: { marginTop: 14, padding: 6 },
  linkText: { color: ACCENT, fontWeight: "700", fontSize: 13.5 },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: BORDER,
    marginTop: 18,
    marginBottom: 14,
  },
  foot: {
    fontSize: 12,
    color: "#8A94A6",
    textAlign: "center",
    lineHeight: 17,
  },
});
