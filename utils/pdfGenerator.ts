import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  FALLBACK_LOGO_DATA_URI,
  getBundledLogoDataUri,
} from "../lib/branding";

/**
 * Génération PDF — carte CR80 (85.6mm × 54mm paysage) + grille A4.
 * Web : impression via iframe cachée (l'utilisateur choisit « Enregistrer en PDF »).
 * Natif : expo-print → fichier PDF → expo-sharing.
 */

export interface MemberCardData {
  firstName: string;
  lastName: string;
  role: string;
  badgeStatus: string;
  validityYear: string;
  photoBase64: string | null;
  logoBase64?: string | null;
}

export const NAVY = "#0F3B66";
export const EMERALD = "#059669";
export const SLATE = "#0F172A";

/** Logo ECONEXUS par défaut (secours SVG si le logo packagé est illisible). */
export const DEFAULT_LOGO_DATA_URI: string = FALLBACK_LOGO_DATA_URI;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function photoBlock(photo: string | null, fullName: string): string {
  if (photo) {
    return `<img class="photo" src="${photo}" alt="${escapeHtml(fullName)}" />`;
  }
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
  return `<div class="photo photo-fallback"><span>${escapeHtml(initials || "—")}</span></div>`;
}

function cardInnerHtml(card: MemberCardData): string {
  const fullName = `${card.firstName} ${card.lastName}`.trim() || "—";
  const logo = card.logoBase64 ?? DEFAULT_LOGO_DATA_URI;
  return `
    <div class="card-top">
      <img class="logo" src="${logo}" alt="Logo ECONEXUS" />
      <div class="club">
        <div class="club-name">ECONEXUS</div>
        <div class="club-sub"><span class="rule"></span><span>CLUB ÉTUDIANT</span><span class="rule"></span></div>
        <div class="tagline">Économie • International • Durabilité • Opportunités</div>
      </div>
    </div>
    <div class="card-body">
      <div class="photo-wrap">${photoBlock(card.photoBase64, fullName)}</div>
      <div class="infos">
        <div class="badge">${escapeHtml(card.badgeStatus || "MEMBRE DU BUREAU")}</div>
        <div class="field">
          <div class="label">PRÉNOM &amp; NOM :</div>
          <div class="value">${escapeHtml(fullName)}</div>
        </div>
        <div class="field">
          <div class="label">RÔLE :</div>
          <div class="value value-role">${escapeHtml(card.role || "—")}</div>
        </div>
      </div>
    </div>
    <div class="card-footer">
      <div class="validity">VALIDE POUR L'ANNÉE : ${escapeHtml(card.validityYear || "2026/2027")}</div>
      <div class="splitbar"><span class="navy"></span><span class="emerald"></span></div>
    </div>`;
}

const CARD_CSS = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: ${SLATE}; }
  .card { width: 85.6mm; height: 54mm; background: #FFFFFF; border-radius: 2.2mm; overflow: hidden;
    display: flex; flex-direction: column; position: relative; }
  .card-top { display: flex; align-items: center; gap: 2.6mm; padding: 2.4mm 3mm 1.6mm 3mm; }
  .logo { height: 15mm; width: auto; max-width: 33mm; object-fit: contain; flex-shrink: 0; }
  .club { flex: 1; min-width: 0; }
  .club-name { font-size: 5.2mm; font-weight: 800; letter-spacing: 0.6mm; color: ${NAVY}; line-height: 1; }
  .club-sub { display: flex; align-items: center; gap: 1.4mm; margin-top: 1mm; font-size: 2.5mm;
    letter-spacing: 1.1mm; font-weight: 700; color: ${NAVY}; }
  .club-sub .rule { flex: 1; height: 0.35mm; background: ${NAVY}; opacity: 0.55; }
  .tagline { margin-top: 0.9mm; font-size: 2.15mm; color: ${EMERALD}; font-weight: 600; letter-spacing: 0.15mm; }
  .card-body { display: flex; gap: 3mm; padding: 0.6mm 3mm 0 3mm; flex: 1; min-height: 0; }
  .photo-wrap { width: 20mm; flex-shrink: 0; }
  .photo { width: 20mm; height: 24mm; object-fit: cover; border-radius: 1.4mm; border: 0.7mm solid ${NAVY}; display: block; background: #E2E8F0; }
  .photo-fallback { display: flex; align-items: center; justify-content: center; background: #DBEAFE; }
  .photo-fallback span { font-size: 6mm; font-weight: 800; color: ${NAVY}; }
  .infos { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-start; padding-top: 0.2mm; }
  .badge { align-self: flex-start; background: ${EMERALD}; color: #fff; font-size: 2.5mm; font-weight: 800;
    letter-spacing: 0.5mm; padding: 1.1mm 2.6mm; border-radius: 2mm; margin-bottom: 1.8mm; }
  .field { margin-bottom: 1.6mm; }
  .label { font-size: 2.3mm; letter-spacing: 0.4mm; font-weight: 700; color: #64748B; }
  .value { font-size: 4mm; font-weight: 800; color: ${NAVY}; line-height: 1.15; word-break: break-word; }
  .value-role { font-size: 3.3mm; color: ${SLATE}; }
  .card-footer { padding: 0 0 0 0; }
  .validity { text-align: center; font-size: 2.4mm; font-weight: 800; letter-spacing: 0.45mm; color: ${NAVY}; padding: 1mm 2mm 1.4mm 2mm; }
  .splitbar { display: flex; height: 2.6mm; }
  .splitbar .navy { flex: 60; background: ${NAVY}; }
  .splitbar .emerald { flex: 40; background: ${EMERALD}; }`;

/** Document HTML complet pour UNE carte CR80. */
export function buildSingleCardHtml(card: MemberCardData): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" />
<style>
  @page { size: 85.6mm 54mm landscape; margin: 0; }
  ${CARD_CSS}
  body { width: 85.6mm; height: 54mm; }
</style></head>
<body>
  <div class="card">${cardInnerHtml(card)}</div>
</body>
</html>`;
}

/** Document HTML A4 — grille de cartes CR80 (8 par page, pointillés de découpe). */
export function buildA4GridHtml(cards: MemberCardData[]): string {
  const tiles = cards
    .map(
      (c) =>
        `<div class="tile"><div class="crop"><div class="card">${cardInnerHtml(c)}</div></div></div>`
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" />
<style>
  @page { size: A4 landscape; margin: 8mm; }
  ${CARD_CSS}
  body { margin: 0; }
  .sheet { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5mm 4mm; }
  .tile { break-inside: avoid; page-break-inside: avoid; }
  .crop { border: 0.4mm dashed #94A3B8; padding: 1.5mm; border-radius: 2.5mm; }
  .crop .card { transform-origin: top left; }
  h1 { font-size: 14px; color: ${NAVY}; font-family: Arial, sans-serif; margin: 0 0 4mm 0; }
  .meta { font-size: 11px; color: #64748B; font-family: Arial, sans-serif; margin-bottom: 4mm; }
  @media print { h1.no-print, .meta.no-print { display: none; } }
</style></head>
<body>
  <h1 class="no-print">ECONEXUS — Planche A4 (${cards.length} carte(s))</h1>
  <div class="meta no-print">Impression : 8 cartes CR80 par page paysage, découpez le long des pointillés.</div>
  <div class="sheet">${tiles}</div>
</body>
</html>`;
}

function downloadHtmlOnWeb(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function printHtmlOnWeb(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    downloadHtmlOnWeb(html, "carte-econexus.html");
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }, 350);
}

function safeFileName(firstName: string, lastName: string): string {
  const base = `${firstName}-${lastName}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return base.length > 0 ? base : "membre";
}

/** Génère + télécharge/imprime UNE carte CR80 (avec le vrai logo du club). */
export async function printSingleCardPDF(card: MemberCardData): Promise<void> {
  const logo = card.logoBase64 ?? (await getBundledLogoDataUri());
  const html = buildSingleCardHtml({ ...card, logoBase64: logo });
  if (Platform.OS === "web") {
    printHtmlOnWeb(html);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `Carte ${card.firstName} ${card.lastName}`,
    });
  } else {
    await Print.printAsync({ html });
  }
}

/** Exporte TOUT le tableau en planche(s) A4 (8 cartes CR80 par page). */
export async function printA4GridPDF(cards: MemberCardData[]): Promise<void> {
  if (cards.length === 0) return;
  const bundledLogo = await getBundledLogoDataUri();
  const withLogos = cards.map((c) => ({
    ...c,
    logoBase64: c.logoBase64 ?? bundledLogo,
  }));
  const html = buildA4GridHtml(withLogos);
  if (Platform.OS === "web") {
    printHtmlOnWeb(html);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Planche A4 — cartes ECONEXUS",
    });
  } else {
    await Print.printAsync({ html });
  }
}

/** Télécharge le HTML de la carte (secours web si l'impression est bloquée). */
export function downloadSingleCardHtml(card: MemberCardData): void {
  const html = buildSingleCardHtml(card);
  downloadHtmlOnWeb(html, `carte-${safeFileName(card.firstName, card.lastName)}.html`);
}
