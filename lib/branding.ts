import { Platform } from "react-native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import ClubLogoImage from "../assets/icon.png";

/**
 * Identité visuelle ECONEXUS centralisée.
 *
 * - `CLUB_LOGO_IMAGE` : logo du business (`assets/icon.png`) pour l'UI.
 *   Pour changer de logo, remplacez simplement ce fichier (même nom) —
 *   l'app ET les PDF suivent automatiquement.
 * - `getBundledLogoDataUri()` : le même logo converti en data URI Base64
 *   pour un rendu PDF 100 % fiable (le HTML imprimé ne peut pas toujours
 *   charger les assets packagés, surtout en mode hors-ligne).
 */

export const CLUB_NAME = "ECONEXUS";
export const CLUB_SUBTITLE = "CLUB ÉTUDIANT";
export const CLUB_TAGLINE =
  "Économie • International • Durabilité • Opportunités";

/** Source d'image packagée utilisable directement dans `<Image source={...} />`. */
export const CLUB_LOGO_IMAGE = ClubLogoImage;

/** Secours (SVG inline) si l'asset packagé est illisible. */
export const FALLBACK_LOGO_DATA_URI: string =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">` +
      `<circle cx="48" cy="48" r="46" fill="#059669"/>` +
      `<circle cx="48" cy="48" r="46" fill="none" stroke="#0F3B66" stroke-width="4"/>` +
      `<text x="48" y="62" font-family="Arial,sans-serif" font-size="44" font-weight="bold" fill="#FFFFFF" text-anchor="middle">E</text>` +
      `</svg>`
  );

let cachedLogoDataUri: string | null = null;

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du logo impossible"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

async function nativeAssetToDataUri(localUri: string): Promise<string | null> {
  try {
    const legacy = FileSystem as unknown as {
      readAsStringAsync?: (
        uri: string,
        opts?: { encoding?: string }
      ) => Promise<string>;
    };
    if (typeof legacy.readAsStringAsync !== "function") return null;
    const base64 = await legacy.readAsStringAsync(localUri, {
      encoding: "Base64",
    });
    return `data:image/png;base64,${base64}`;
  } catch {
    return null;
  }
}

/** Retourne le logo packagé en data URI PNG (mémorisé après le 1er appel). */
export async function getBundledLogoDataUri(): Promise<string> {
  if (cachedLogoDataUri) return cachedLogoDataUri;
  try {
    const asset = Asset.fromModule(ClubLogoImage);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) throw new Error("URI du logo indisponible");
    if (Platform.OS === "web") {
      const res = await fetch(uri);
      cachedLogoDataUri = await blobToDataUri(await res.blob());
    } else {
      cachedLogoDataUri =
        (await nativeAssetToDataUri(uri)) ?? FALLBACK_LOGO_DATA_URI;
    }
  } catch {
    cachedLogoDataUri = FALLBACK_LOGO_DATA_URI;
  }
  return cachedLogoDataUri;
}

/**
 * Logo effectif pour le PDF : la surcharge choisie dans l'éditeur gagne,
 * sinon le logo packagé du club.
 */
export async function resolvePdfLogo(
  override: string | null | undefined
): Promise<string> {
  if (override) return override;
  return getBundledLogoDataUri();
}
