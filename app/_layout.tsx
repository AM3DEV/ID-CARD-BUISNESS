import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import SplashScreen, {
  SPLASH_MIN_DURATION_MS,
} from "../components/SplashScreen";
import { useAppStore } from "../store/useAppStore";

/**
 * Layout racine — restaure la session passkey puis protège les routes :
 * non authentifié → /login · authentifié sur /login → /.
 */
export default function RootLayout() {
  const authReady = useAppStore((s) => s.authReady);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const restoreSession = useAppStore((s) => s.restoreSession);
  const segments = useSegments();
  const router = useRouter();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const timer = setTimeout(
      () => setMinTimeElapsed(true),
      SPLASH_MIN_DURATION_MS
    );
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const inLogin = segments[0] === "login";
    if (!isAuthenticated && !inLogin) {
      router.replace("/login");
    } else if (isAuthenticated && inLogin) {
      router.replace("/");
    }
  }, [authReady, isAuthenticated, segments, router]);

  if (!authReady || !minTimeElapsed) {
    return (
      <SafeAreaProvider>
        <SplashScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#F1F5F9" },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
      </Stack>
    </SafeAreaProvider>
  );
}
