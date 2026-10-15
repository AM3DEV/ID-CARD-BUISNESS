import { Image, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { SaveFormat, manipulateAsync } from "expo-image-manipulator";

/**
 * Sélectionne une image (portrait / logo) et la convertit en data URI Base64
 * pour stockage en base et rendu PDF fiable.
 */

const MAX_DATA_URI_CHARS = 1_800_000;

function guessMime(uri: string): string {
  const lower = uri.toLowerCase().split("?")[0];
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function blobToDataUri(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

async function uriToDataUriViaFetch(uri: string): Promise<string | null> {
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    const dataUri = await blobToDataUri(blob);
    return dataUri.length <= MAX_DATA_URI_CHARS ? dataUri : null;
  } catch {
    return null;
  }
}

async function uriToDataUriViaFileSystem(uri: string): Promise<string | null> {
  try {
    const legacy = FileSystem as unknown as {
      readAsStringAsync?: (
        uri: string,
        opts?: { encoding?: string }
      ) => Promise<string>;
      EncodingType?: { Base64?: string };
    };
    if (typeof legacy.readAsStringAsync !== "function") return null;
    const encoding =
      legacy.EncodingType?.Base64 ?? ("Base64" as unknown as string);
    const base64 = await legacy.readAsStringAsync(uri, {
      encoding: encoding as string,
    });
    const dataUri = `data:${guessMime(uri)};base64,${base64}`;
    return dataUri.length <= MAX_DATA_URI_CHARS ? dataUri : null;
  } catch {
    return null;
  }
}

export async function assetToDataUri(
  asset: ImagePicker.ImagePickerAsset
): Promise<string | null> {
  if (asset.base64) {
    const mime = asset.mimeType ?? guessMime(asset.uri);
    const dataUri = `data:${mime};base64,${asset.base64}`;
    if (dataUri.length <= MAX_DATA_URI_CHARS) return dataUri;
  }
  return await uriToDataUriWithCompress(asset.uri);
}

/** Convertit une URI (fichier local, blob web…) en data URI, avec compression. */
export async function uriToDataUriWithCompress(
  uri: string
): Promise<string | null> {
  let direct: string | null = null;
  if (Platform.OS === "web") {
    direct = await uriToDataUriViaFetch(uri);
  } else {
    direct = await uriToDataUriViaFileSystem(uri);
    if (!direct) direct = await uriToDataUriViaFetch(uri);
  }
  if (direct) return direct;
  // Image trop lourde : compression automatique par paliers décroissants.
  return await compressImageToFit(uri);
}

/** Paliers de compression (largeur max + qualité JPEG) essayés dans l'ordre. */
const COMPRESS_STEPS = [
  { width: 1000, compress: 0.7 },
  { width: 800, compress: 0.6 },
  { width: 600, compress: 0.5 },
  { width: 450, compress: 0.45 },
] as const;

async function compressImageToFit(uri: string): Promise<string | null> {
  for (const step of COMPRESS_STEPS) {
    try {
      const result = await manipulateAsync(
        uri,
        [{ resize: { width: step.width } }],
        { compress: step.compress, format: SaveFormat.JPEG, base64: true }
      );
      if (result.base64) {
        const dataUri = `data:image/jpeg;base64,${result.base64}`;
        if (dataUri.length <= MAX_DATA_URI_CHARS) return dataUri;
      }
    } catch {
      // palier suivant
    }
  }
  return null;
}

export interface PickedImage {
  dataUri: string | null;
  cancelled: boolean;
}

/** Ouvre la galerie et retourne la data URI (null si trop lourde / échec). */
export async function pickImageAsBase64(): Promise<PickedImage> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Permission d'accès aux photos refusée");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [3, 4],
    quality: 0.7,
    base64: true,
  });
  if (result.canceled || result.assets.length === 0) {
    return { dataUri: null, cancelled: true };
  }
  const dataUri = await assetToDataUri(result.assets[0]);
  return { dataUri, cancelled: false };
}

/**
 * Ouvre la galerie et retourne l'URI brute (sans éditeur système) —
 * utilisée sur le Web où l'éditeur natif n'existe pas : l'image passe
 * ensuite par l'éditeur de recadrage intégré (PhotoCropper).
 */
export async function pickImageUri(): Promise<{
  uri: string | null;
  cancelled: boolean;
}> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Permission d'accès aux photos refusée");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 1,
  });
  if (result.canceled || result.assets.length === 0) {
    return { uri: null, cancelled: true };
  }
  return { uri: result.assets[0].uri, cancelled: false };
}

/** Dimensions intrinsèques d'une image (fichier local ou blob web). */
export function getImageSize(
  uri: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => {
        if (width > 0 && height > 0) resolve({ width, height });
        else reject(new Error("Dimensions d'image illisibles"));
      },
      () =>
        reject(
          new Error(
            "Impossible de lire cette image."
          )
        )
    );
  });
}

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** Applique un recadrage puis convertit en data URI (avec compression). */
export async function cropImageToDataUri(
  uri: string,
  rect: CropRect
): Promise<string | null> {
  try {
    const cropped = await manipulateAsync(uri, [{ crop: rect }], {
      compress: 1,
      format: SaveFormat.JPEG,
    });
    return await uriToDataUriWithCompress(cropped.uri);
  } catch {
    return null;
  }
}
