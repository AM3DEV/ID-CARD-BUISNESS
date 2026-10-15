import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Stockage persistant à l'épreuve des pannes natives.
 *
 * Si AsyncStorage lève (module natif absent, quota dépassé, …), on bascule
 * sur un cache mémoire : l'application continue de fonctionner au lieu
 * de planter avec « Native module is null ».
 */

const memoryCache = new Map<string, string>();

export async function storageGet(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return memoryCache.get(key) ?? null;
  }
}

export async function storageSet(key: string, value: string): Promise<void> {
  memoryCache.set(key, value);
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // repli mémoire déjà enregistré ci-dessus
  }
}

export async function storageRemove(key: string): Promise<void> {
  memoryCache.delete(key);
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // déjà supprimé du repli mémoire ci-dessus
  }
}
