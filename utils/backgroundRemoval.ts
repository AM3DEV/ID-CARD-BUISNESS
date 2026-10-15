import { Platform } from "react-native";

/**
 * Suppression d'arrière-plan en 3 niveaux (Web ET Mobile) :
 *
 *  1. **Haute qualité — remove.bg** (si `EXPO_PUBLIC_REMOVEBG_API_KEY`
 *     est renseignée) : la référence pour les portraits, ~50 images/mois
 *     gratuites. Fonctionne sur le Web et en natif.
 *  2. **Haute qualité GRATUITE — Hugging Face RMBG-2.0** (si
 *     `EXPO_PUBLIC_HF_TOKEN` est renseigné, compte gratuit, sans carte) :
 *     modèle de pointe, quota gratuit généreux. Web uniquement.
 *  3. **Repli local gratuit** (Web uniquement) : IA embarquée dans le
 *     navigateur, illimitée, sans clé.
 *
 * Retourne `null` si tout échoue (ou si rien n'est disponible) : l'appelant
 * conserve alors la photo originale.
 */

export type BgRemovalProgress = (
  phase: "api" | "hf" | "model" | "processing",
  ratio: number
) => void;

const REMOVEBG_KEY: string =
  (process.env.EXPO_PUBLIC_REMOVEBG_API_KEY as string | undefined)?.trim() ??
  "";
const REMOVEBG_URL = "https://api.remove.bg/v1.0/removebg";

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Conversion de l'image impossible"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

/** Appel remove.bg : image_file_b64 → PNG détouré (402 = quota épuisé). */
async function removeWithApi(
  dataUri: string,
  onProgress?: BgRemovalProgress
): Promise<string> {
  const comma = dataUri.indexOf(",");
  const base64 = comma >= 0 ? dataUri.slice(comma + 1) : dataUri;
  if (base64.length === 0) throw new Error("empty image");

  const form = new FormData();
  form.append("image_file_b64", base64);
  form.append("size", "auto");

  // remove.bg ne renvoie pas de progression : on anime jusqu'à 90 %.
  let shown = 0;
  const timer = setInterval(() => {
    shown = Math.min(0.9, shown + 0.04);
    onProgress?.("api", shown);
  }, 250);
  try {
    const res = await fetch(REMOVEBG_URL, {
      method: "POST",
      headers: { "X-Api-Key": REMOVEBG_KEY },
      body: form,
    });
    if (!res.ok) throw new Error(`remove.bg: ${res.status}`);
    const blob = await res.blob();
    onProgress?.("api", 1);
    return await blobToDataUri(blob);
  } finally {
    clearInterval(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Niveau 2 : Hugging Face RMBG-2.0 — haute qualité, 100 % gratuit.    */
/* ------------------------------------------------------------------ */

const HF_TOKEN: string =
  (process.env.EXPO_PUBLIC_HF_TOKEN as string | undefined)?.trim() ?? "";
const HF_URLS = [
  "https://router.huggingface.co/hf-inference/models/briaai/RMBG-2.0",
  "https://api-inference.huggingface.co/models/briaai/RMBG-2.0",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Lecture de l'image impossible"));
    img.src = src;
  });
}

/** Applique le masque comme canal alpha (destination-in) → PNG détouré. */
async function applyMask(
  originalDataUri: string,
  maskDataUri: string
): Promise<string> {
  const [img, mask] = await Promise.all([
    loadHtmlImage(originalDataUri),
    loadHtmlImage(maskDataUri),
  ]);
  const scale = Math.min(
    1,
    1024 / Math.max(img.naturalWidth, img.naturalHeight)
  );
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponible");
  ctx.drawImage(img, 0, 0, w, h);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(mask, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) throw new Error("export canvas impossible");
  return await blobToDataUri(blob);
}

interface HfSegment {
  label?: unknown;
  score?: unknown;
  mask?: unknown;
}

/** Appel HF avec réessais si le modèle démarre à froid (503 + estimated_time). */
async function removeWithHF(
  dataUri: string,
  onProgress?: BgRemovalProgress
): Promise<string> {
  if (typeof document === "undefined") throw new Error("web only");
  const comma = dataUri.indexOf(",");
  const base64 = comma >= 0 ? dataUri.slice(comma + 1) : dataUri;
  if (base64.length === 0) throw new Error("empty image");
  const bytes = base64ToBytes(base64);
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const body = new Blob([copy], { type: "image/jpeg" });

  let shown = 0;
  const timer = setInterval(() => {
    shown = Math.min(0.9, shown + 0.03);
    onProgress?.("hf", shown);
  }, 400);
  try {
    let lastError: unknown = null;
    for (const url of HF_URLS) {
      for (let attempt = 0; attempt < 5; attempt++) {
        let res: Response;
        try {
          res = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${HF_TOKEN}`,
              "Content-Type": "image/jpeg",
            },
            body,
          });
        } catch (e) {
          lastError = e;
          break;
        }
        if (res.status === 503) {
          // Modèle en démarrage à froid : attendre puis réessayer.
          let wait = 9000;
          try {
            const info: unknown = await res.json();
            const eta =
              typeof info === "object" && info !== null
                ? (info as { estimated_time?: unknown }).estimated_time
                : null;
            if (typeof eta === "number" && eta > 0) {
              wait = Math.min(20000, Math.ceil(eta * 1000) + 2000);
            }
          } catch {
            // garder l'attente par défaut
          }
          await sleep(wait);
          continue;
        }
        if (!res.ok) {
          lastError = new Error(`huggingface: ${res.status}`);
          break;
        }
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.startsWith("image/")) {
          // Le modèle renvoie directement l'image détourée.
          onProgress?.("hf", 1);
          return await blobToDataUri(await res.blob());
        }
        const segments: unknown = await res.json();
        if (!Array.isArray(segments) || segments.length === 0) {
          throw new Error("réponse HF vide");
        }
        let best: HfSegment | null = null;
        for (const seg of segments as HfSegment[]) {
          const score =
            typeof seg.score === "number" ? seg.score : -1;
          const bestScore =
            best && typeof best.score === "number" ? best.score : -1;
          if (typeof seg.mask === "string" && score >= bestScore) {
            best = seg;
          }
        }
        if (!best || typeof best.mask !== "string") {
          throw new Error("masque HF introuvable");
        }
        onProgress?.("hf", 1);
        return await applyMask(dataUri, best.mask as string);
      }
      // Échec sur cette URL (404, 401, quota…) → essayer l'URL suivante.
    }
    throw lastError instanceof Error ? lastError : new Error("hf failed");
  } finally {
    clearInterval(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Niveau 3 : bibliothèque IA chargée depuis un CDN ESM au besoin.     */
/* ------------------------------------------------------------------ */

interface LocalBgModule {
  removeBackground: (
    source: Blob,
    config?: {
      output?: { format?: string; quality?: number };
      progress?: (key: string, current: number, total: number) => void;
    }
  ) => Promise<Blob>;
}

/** CDN ESM essayés dans l'ordre (le 2ᵉ sert de secours). */
const CDN_URLS = [
  "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm",
  "https://esm.sh/@imgly/background-removal@1.7.0",
];

let cachedModule: LocalBgModule | null = null;

async function loadLocalModule(): Promise<LocalBgModule> {
  if (cachedModule) return cachedModule;
  // `new Function` : import ESM natif du navigateur, invisible pour Metro.
  let lastError: unknown = null;
  for (const url of CDN_URLS) {
    try {
      const importer = new Function(
        `return import(${JSON.stringify(url)});`
      ) as () => Promise<unknown>;
      const mod = (await importer()) as {
        removeBackground?: unknown;
      };
      if (mod && typeof mod.removeBackground === "function") {
        cachedModule = mod as unknown as LocalBgModule;
        return cachedModule;
      }
      throw new Error(`Module invalide : ${url}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("load failed");
}

async function removeLocally(
  dataUri: string,
  onProgress?: BgRemovalProgress
): Promise<string | null> {
  if (Platform.OS !== "web") return null;
  try {
    const input = await (await fetch(dataUri)).blob();
    const { removeBackground } = await loadLocalModule();
    let maxRatio = 0;
    const output = await removeBackground(input, {
      output: { format: "image/png", quality: 0.8 },
      progress: (_key: string, current: number, total: number) => {
        if (!onProgress || total <= 0) return;
        maxRatio = Math.max(maxRatio, Math.min(1, current / total));
        onProgress("model", maxRatio);
      },
    });
    onProgress?.("processing", 1);
    return await blobToDataUri(output);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */

export async function removePhotoBackground(
  dataUri: string,
  onProgress?: BgRemovalProgress
): Promise<string | null> {
  // Niveau 1 : haute qualité (clé configurée, toutes plateformes).
  if (REMOVEBG_KEY.length > 0) {
    try {
      return await removeWithApi(dataUri, onProgress);
    } catch {
      // quota épuisé / clé invalide / réseau → repli local ci-dessous.
    }
  }
  // Niveau 2 : haute qualité GRATUITE (token configuré, Web).
  if (HF_TOKEN.length > 0 && Platform.OS === "web") {
    try {
      return await removeWithHF(dataUri, onProgress);
    } catch {
      // quota / token / réseau → repli local ci-dessous.
    }
  }
  // Niveau 3 : IA locale gratuite (Web uniquement).
  return await removeLocally(dataUri, onProgress);
}
