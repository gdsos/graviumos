import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { calculateLineItemTotal } from '../calculator';
import type {
  CostEstimateArea,
  CostEstimateLineItem,
  CostEstimateSummary,
} from '../types';

type Rgb = [number, number, number];

interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
}

interface DocumentOrganizationSettings {
  organizationName: string;
  addressLines: string[];
  email: string;
  phone: string;
  logoPath: string;
  fallbackLogoPath: string;
  signaturePath: string;
  invertLogoOnDark: boolean;
}

export interface CostEstimateExportPayload {
  projectName: string;
  clientName?: string;
  status: string;
  version: number;
  areas: CostEstimateArea[];
  lineItems: CostEstimateLineItem[];
  summary: CostEstimateSummary;
  preparedAt?: string;
}

const BRAND = {
  offWhite: [245, 245, 245] as Rgb,
  pearlBlack: [47, 47, 47] as Rgb,
  architectureGrey: [107, 106, 105] as Rgb,
  tropicalWoodBrown: [96, 59, 42] as Rgb,
  mutedOliveGreen: [85, 93, 58] as Rgb,
  black: [0, 0, 0] as Rgb,
  line: [218, 214, 210] as Rgb,
  softSurface: [250, 248, 245] as Rgb,
};

const DOCUMENT_SETTINGS_STORAGE_KEY = 'gravium-os-document-settings';
const DOCUMENT_TERMS_STORAGE_KEY = 'gravium-os-document-terms';

const DEFAULT_ORGANIZATION_SETTINGS: DocumentOrganizationSettings = {
  organizationName: 'GRAVIUM DESIGN STUDIO LLP',
  addressLines: ['<Address Line 1>', '<Address Line 2>'],
  email: '<Email>',
  phone: '<Phone>',
  logoPath: '/brand/Organization-Logo.png',
  fallbackLogoPath: '/Organization-Logo.png',
  signaturePath: '/brand/Authorized-Signature.png',
  invertLogoOnDark: true,
};

const DEFAULT_COST_ESTIMATE_TERMS = [
  'This estimate is prepared based on the currently approved design scope and available site information.',
  'Material, finish, brand, site condition, or scope changes may revise the final estimate.',
  'Work will begin only after written approval, contract confirmation, and agreed advance payment.',
  'Taxes, statutory charges, and payment terms are subject to the final approved contract.',
];

const PDF_RUPEE_FONT_FAMILY = 'GraviumRupeeFont';
const PDF_RUPEE_FONT_REGULAR_URL = '/fonts/Montserrat-Regular.ttf';
const PDF_RUPEE_FONT_MEDIUM_URL = '/fonts/Montserrat-Medium.ttf';
const PDF_RUPEE_FONT_BOLD_URL = '/fonts/Montserrat-Bold.ttf';
const RUPEE_SYMBOL = String.fromCharCode(0x20b9);

let activePdfHasRupeeFont = false;
let activePdfMoneyFontStyles = {
  normal: false,
  medium: false,
  bold: false,
};


function getOrganizationSettings(): DocumentOrganizationSettings {
  if (typeof window === 'undefined') return DEFAULT_ORGANIZATION_SETTINGS;

  try {
    const storedSettings = window.localStorage.getItem(DOCUMENT_SETTINGS_STORAGE_KEY);

    if (!storedSettings) return DEFAULT_ORGANIZATION_SETTINGS;

    const parsedSettings = JSON.parse(storedSettings) as Partial<DocumentOrganizationSettings>;

    return {
      organizationName:
        typeof parsedSettings.organizationName === 'string' &&
        parsedSettings.organizationName.trim()
          ? parsedSettings.organizationName.trim()
          : DEFAULT_ORGANIZATION_SETTINGS.organizationName,
      addressLines: Array.isArray(parsedSettings.addressLines)
        ? parsedSettings.addressLines
            .filter(line => typeof line === 'string' && line.trim())
            .map(line => line.trim())
        : DEFAULT_ORGANIZATION_SETTINGS.addressLines,
      email:
        typeof parsedSettings.email === 'string' && parsedSettings.email.trim()
          ? parsedSettings.email.trim()
          : DEFAULT_ORGANIZATION_SETTINGS.email,
      phone:
        typeof parsedSettings.phone === 'string' && parsedSettings.phone.trim()
          ? parsedSettings.phone.trim()
          : DEFAULT_ORGANIZATION_SETTINGS.phone,
      logoPath:
        typeof parsedSettings.logoPath === 'string' && parsedSettings.logoPath.trim()
          ? parsedSettings.logoPath.trim()
          : DEFAULT_ORGANIZATION_SETTINGS.logoPath,
      fallbackLogoPath:
        typeof parsedSettings.fallbackLogoPath === 'string' &&
        parsedSettings.fallbackLogoPath.trim()
          ? parsedSettings.fallbackLogoPath.trim()
          : DEFAULT_ORGANIZATION_SETTINGS.fallbackLogoPath,
      signaturePath:
        typeof parsedSettings.signaturePath === 'string' &&
        parsedSettings.signaturePath.trim()
          ? parsedSettings.signaturePath.trim()
          : DEFAULT_ORGANIZATION_SETTINGS.signaturePath,
      invertLogoOnDark:
        typeof parsedSettings.invertLogoOnDark === 'boolean'
          ? parsedSettings.invertLogoOnDark
          : DEFAULT_ORGANIZATION_SETTINGS.invertLogoOnDark,
    };
  } catch {
    return DEFAULT_ORGANIZATION_SETTINGS;
  }
}

function getDocumentTerms(documentType: 'cost-estimate') {
  if (typeof window === 'undefined') return DEFAULT_COST_ESTIMATE_TERMS;

  try {
    const storedTerms = window.localStorage.getItem(DOCUMENT_TERMS_STORAGE_KEY);

    if (!storedTerms) return DEFAULT_COST_ESTIMATE_TERMS;

    const parsedTerms = JSON.parse(storedTerms) as Record<string, unknown>;
    const terms = parsedTerms[documentType];

    if (!Array.isArray(terms)) return DEFAULT_COST_ESTIMATE_TERMS;

    const normalizedTerms = terms
      .filter(term => typeof term === 'string' && term.trim())
      .map(term => term.trim());

    return normalizedTerms.length > 0 ? normalizedTerms : DEFAULT_COST_ESTIMATE_TERMS;
  } catch {
    return DEFAULT_COST_ESTIMATE_TERMS;
  }
}

function formatPdfNumber(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.round(amount || 0));
}

function formatPdfMoney(amount: number) {
  const prefix = activePdfHasRupeeFont ? RUPEE_SYMBOL : 'Rs.';

  return `${prefix} ${formatPdfNumber(amount)}`;
}

async function fetchFontAsBase64(path: string) {
  if (typeof window === 'undefined') return undefined;

  const response = await fetch(path);

  if (!response.ok) return undefined;

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return window.btoa(binary);
}

async function registerRupeeFont(doc: jsPDF) {
  activePdfHasRupeeFont = false;
  activePdfMoneyFontStyles = {
    normal: false,
    medium: false,
    bold: false,
  };

  const fontVariants = [
    {
      url: PDF_RUPEE_FONT_REGULAR_URL,
      fileName: 'Montserrat-Regular.ttf',
      style: 'normal' as const,
    },
    {
      url: PDF_RUPEE_FONT_MEDIUM_URL,
      fileName: 'Montserrat-Medium.ttf',
      style: 'medium' as const,
    },
    {
      url: PDF_RUPEE_FONT_BOLD_URL,
      fileName: 'Montserrat-Bold.ttf',
      style: 'bold' as const,
    },
  ];

  for (const variant of fontVariants) {
    try {
      const fontBase64 = await fetchFontAsBase64(variant.url);

      if (!fontBase64) continue;

      doc.addFileToVFS(variant.fileName, fontBase64);
      doc.addFont(variant.fileName, PDF_RUPEE_FONT_FAMILY, variant.style);

      activePdfMoneyFontStyles[variant.style] = true;
    } catch (error) {
      console.error(`Failed to register ${variant.fileName}.`, error);
    }
  }

  activePdfHasRupeeFont =
    activePdfMoneyFontStyles.normal ||
    activePdfMoneyFontStyles.medium ||
    activePdfMoneyFontStyles.bold;
}

type MoneyFontStyle = 'normal' | 'medium' | 'bold';

function getMoneyFontFamily() {
  return activePdfHasRupeeFont ? PDF_RUPEE_FONT_FAMILY : 'helvetica';
}

function getMoneyFontStyle(style: MoneyFontStyle = 'normal') {
  if (!activePdfHasRupeeFont) return style === 'bold' ? 'bold' : 'normal';

  if (activePdfMoneyFontStyles[style]) return style;
  if (activePdfMoneyFontStyles.normal) return 'normal';
  if (activePdfMoneyFontStyles.medium) return 'medium';
  if (activePdfMoneyFontStyles.bold) return 'bold';

  return 'normal';
}

function setMoneyFont(doc: jsPDF, style: MoneyFontStyle = 'normal') {
  try {
    doc.setFont(getMoneyFontFamily(), getMoneyFontStyle(style));
  } catch {
    doc.setFont('helvetica', style === 'bold' ? 'bold' : 'normal');
  }
}

function drawMoneyValue(
  doc: jsPDF,
  amount: number,
  rightX: number,
  baselineY: number,
  color: Rgb = BRAND.black,
  fontSize = 8.2,
  style: MoneyFontStyle = 'normal'
) {
  doc.setTextColor(...color);
  doc.setFontSize(fontSize);
  setMoneyFont(doc, style);
  doc.text(formatPdfMoney(amount), rightX, baselineY, { align: 'right' });
  setFont(doc);
}

function sanitizeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 80) || 'cost-estimate'
  );
}

function buildFileName(payload: CostEstimateExportPayload) {
  return `${sanitizeFileName(payload.projectName)}-estimate-v${payload.version}.pdf`;
}

function getAreaName(areas: CostEstimateArea[], areaId: string) {
  return areas.find(area => area.id === areaId)?.name ?? 'Unassigned Area';
}

function getPreparedDate(value?: string) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString('en-IN');

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function setFont(doc: jsPDF, style: 'normal' | 'bold' = 'normal') {
  doc.setFont('helvetica', style);
}

function fitImageWithinBox(image: LoadedImage, boxWidth: number, boxHeight: number) {
  const ratio = Math.min(boxWidth / image.width, boxHeight / image.height);

  return {
    width: image.width * ratio,
    height: image.height * ratio,
  };
}

function loadPngImageFromPath(path: string, invert: boolean) {
  if (typeof document === 'undefined') return Promise.resolve(undefined);

  return new Promise<LoadedImage | undefined>(resolve => {
    const image = new Image();

    image.onload = () => {
      try {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        const canvas = document.createElement('canvas');

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');

        if (!context) {
          resolve(undefined);
          return;
        }

        context.drawImage(image, 0, 0, width, height);

        if (invert) {
          const imageData = context.getImageData(0, 0, width, height);

          for (let index = 0; index < imageData.data.length; index += 4) {
            if (imageData.data[index + 3] === 0) continue;

            imageData.data[index] = 255 - imageData.data[index];
            imageData.data[index + 1] = 255 - imageData.data[index + 1];
            imageData.data[index + 2] = 255 - imageData.data[index + 2];
          }

          context.putImageData(imageData, 0, 0);
        }

        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width,
          height,
        });
      } catch {
        resolve(undefined);
      }
    };

    image.onerror = () => resolve(undefined);
    image.src = `${path}${path.includes('?') ? '&' : '?'}v=${Date.now()}`;
  });
}

async function loadPngImage(paths: string[], invert: boolean) {
  for (const path of paths) {
    const image = await loadPngImageFromPath(path, invert);

    if (image) return image;
  }

  return undefined;
}

function drawHeader(
  doc: jsPDF,
  settings: DocumentOrganizationSettings,
  logo?: LoadedImage
) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...BRAND.pearlBlack);
  doc.rect(0, 0, pageWidth, 132, 'F');

  if (logo) {
    const headerHeight = 132;
    const logoMaxHeight = 36;
    const logoMaxWidth = 102;
    const logoLeftX = 36;
    const fittedLogo = fitImageWithinBox(logo, logoMaxWidth, logoMaxHeight);
    const logoX = logoLeftX;
    const logoY = (headerHeight - fittedLogo.height) / 2;

    doc.addImage(
      logo.dataUrl,
      'PNG',
      logoX,
      logoY,
      fittedLogo.width,
      fittedLogo.height
    );
  } else {
    setFont(doc, 'bold');
    doc.setTextColor(...BRAND.offWhite);
    doc.setFontSize(18);
    doc.text('GRAVIUM', 36, 68);
  }

  setFont(doc, 'bold');
  doc.setTextColor(...BRAND.offWhite);
  doc.setFontSize(17);
  doc.text('COST ESTIMATE', pageWidth / 2, 66, { align: 'center' });

  setFont(doc);
  doc.setFontSize(8);
  doc.text('INTERIOR DESIGN & EXECUTION', pageWidth / 2, 84, {
    align: 'center',
  });

  const infoRight = pageWidth - 36;
  let infoY = 38;

  setFont(doc, 'bold');
  doc.setFontSize(8.5);
  doc.text(settings.organizationName.toUpperCase(), infoRight, infoY, {
    align: 'right',
  });

  setFont(doc);
  doc.setFontSize(7.5);

  infoY += 16;

  const infoLines = [
    ...settings.addressLines,
    settings.email,
    settings.phone,
  ].filter(Boolean);

  infoLines.forEach(line => {
    doc.text(line, infoRight, infoY, {
      align: 'right',
      maxWidth: 170,
    });
    infoY += 11;
  });
}

function getCleanEstimateStatus(status: string) {
  const normalizedStatus = status
    .replace(/\s*-\s*v\d+.*$/i, '')
    .replace(/\s+active$/i, '')
    .trim();

  return normalizedStatus || status;
}

function drawProjectMeta(
  doc: jsPDF,
  payload: CostEstimateExportPayload,
  preparedDate: string
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentX = 36;
  const contentWidth = pageWidth - contentX * 2;
  const startY = 164;

  setFont(doc, 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...BRAND.pearlBlack);
  doc.text(payload.projectName || 'Cost Estimate', contentX, startY);

  doc.setDrawColor(...BRAND.line);
  doc.setFillColor(...BRAND.softSurface);
  doc.roundedRect(contentX, startY + 20, contentWidth, 58, 10, 10, 'FD');

  const metaItems = [
    ['Client', payload.clientName || 'Not assigned'],
    ['Status', getCleanEstimateStatus(payload.status)],
    ['Version', `v${payload.version}`],
    ['Prepared', preparedDate],
  ];

  metaItems.forEach(([label, value], index) => {
    const columnWidth = (contentWidth - 32) / 4;
    const x = contentX + 16 + index * columnWidth;

    setFont(doc);
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.architectureGrey);
    doc.text(label.toUpperCase(), x, startY + 42);

    setFont(doc, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND.black);
    doc.text(value, x, startY + 60, { maxWidth: columnWidth - 12 });
  });
}

function getLastAutoTableFinalY(doc: jsPDF) {
  return (
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? 236
  );
}

function ensureSpace(doc: jsPDF, requiredHeight: number, currentY: number) {
  const pageHeight = doc.internal.pageSize.getHeight();

  if (currentY + requiredHeight < pageHeight - 64) return currentY;

  doc.addPage('a4', 'portrait');

  return 54;
}

function drawSummaryAndSignatory(
  doc: jsPDF,
  payload: CostEstimateExportPayload,
  signature?: LoadedImage,
  startY?: number
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const y = ensureSpace(doc, 190, startY ?? 54);
  const contentX = 36;
  const contentWidth = pageWidth - contentX * 2;
  const summaryWidth = 226;
  const summaryX = pageWidth - contentX - summaryWidth;
  const signatoryX = contentX;
  const signatoryWidth = contentWidth - summaryWidth - 28;

  doc.setFillColor(...BRAND.softSurface);
  doc.setDrawColor(...BRAND.line);
  doc.roundedRect(summaryX, y, summaryWidth, 172, 12, 12, 'FD');

  setFont(doc, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.pearlBlack);
  doc.text('Estimate Summary', summaryX + 16, y + 24);

  const summaryRows = [
    ['Subtotal', payload.summary.cogsSubtotal],
    [
      `Service Charge (${payload.summary.serviceChargePercent}%)`,
      payload.summary.serviceChargeAmount,
    ],
    [
      `Misc Charge (${payload.summary.miscChargePercent}%)`,
      payload.summary.miscChargeAmount,
    ],
    ['Taxable Subtotal', payload.summary.taxableSubtotal],
    [`GST (${payload.summary.gstPercent}%)`, payload.summary.gstAmount],
    ['Grand Total', payload.summary.estimatedGrossRevenue],
  ];

  summaryRows.forEach(([label, value], index) => {
    const rowY = y + 48 + index * 18;
    const isTotal = index === summaryRows.length - 1;

    if (isTotal) {
      doc.setFillColor(...BRAND.tropicalWoodBrown);
      doc.roundedRect(summaryX + 10, rowY - 12, summaryWidth - 20, 18, 4, 4, 'F');
    }

    setFont(doc, isTotal ? 'bold' : 'normal');
    doc.setFontSize(isTotal ? 9.8 : 8.2);
    doc.setTextColor(...(isTotal ? BRAND.offWhite : BRAND.black));
    doc.text(String(label), summaryX + 16, rowY, { maxWidth: 120 });
    drawMoneyValue(
      doc,
      Number(value),
      summaryX + summaryWidth - 16,
      rowY,
      isTotal ? BRAND.offWhite : BRAND.black,
      isTotal ? 9.8 : 8.2,
      isTotal ? 'bold' : 'medium'
    );
  });

  doc.setFillColor(...BRAND.softSurface);
  doc.setDrawColor(...BRAND.line);
  doc.roundedRect(signatoryX, y, signatoryWidth, 172, 12, 12, 'FD');

  setFont(doc, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.pearlBlack);
  doc.text('Authorized Signatory', signatoryX + 16, y + 24);

  if (signature) {
    const signatureBoxWidth = Math.min(170, signatoryWidth - 32);
    const signatureBoxHeight = 74;
    const fittedSignature = fitImageWithinBox(
      signature,
      signatureBoxWidth,
      signatureBoxHeight
    );

    doc.addImage(
      signature.dataUrl,
      'PNG',
      signatoryX + 16,
      y + 42,
      fittedSignature.width,
      fittedSignature.height
    );
  } else {
    setFont(doc);
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND.architectureGrey);
    doc.text('Signature image not uploaded', signatoryX + 16, y + 72);
  }

  doc.setDrawColor(...BRAND.architectureGrey);
  doc.line(signatoryX + 16, y + 132, signatoryX + 184, y + 132);

  setFont(doc);
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.architectureGrey);
  doc.text('For GRAVIUM DESIGN STUDIO LLP', signatoryX + 16, y + 150);

  return y + 196;
}

function drawTermsSection(
  doc: jsPDF,
  terms: string[],
  startY: number
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = ensureSpace(doc, 140, startY);
  const contentX = 36;
  const contentWidth = pageWidth - contentX * 2;

  setFont(doc, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.pearlBlack);
  doc.text('Terms & Conditions', contentX, y);

  setFont(doc);
  doc.setFontSize(6.1);
  doc.setTextColor(...BRAND.architectureGrey);

  y += 16;

  terms.forEach((term, index) => {
    const wrappedText = doc.splitTextToSize(`${index + 1}. ${term}`, contentWidth);

    if (y + wrappedText.length * 6.8 > doc.internal.pageSize.getHeight() - 58) {
      doc.addPage('a4', 'portrait');
      y = 54;

      setFont(doc, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...BRAND.pearlBlack);
      doc.text('Terms & Conditions', contentX, y);

      setFont(doc);
      doc.setFontSize(6.1);
      doc.setTextColor(...BRAND.architectureGrey);
      y += 16;
    }

    doc.text(wrappedText, contentX, y, { lineHeightFactor: 1.05 });
    y += wrappedText.length * 6.8 + 3;
  });
}


function drawFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);

    doc.setDrawColor(...BRAND.line);
    doc.line(36, pageHeight - 42, pageWidth - 36, pageHeight - 42);

    setFont(doc);
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.architectureGrey);
    doc.text('Generated from Gravium OS', 36, pageHeight - 26);
    doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - 36, pageHeight - 26, {
      align: 'right',
    });
  }
}

export async function exportGraviumClassicCostEstimatePdf(payload: CostEstimateExportPayload) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  await registerRupeeFont(doc);

  const settings = getOrganizationSettings();
  const terms = getDocumentTerms('cost-estimate');
  const preparedDate = getPreparedDate(payload.preparedAt);
  const logo = await loadPngImage(
    [settings.logoPath, settings.fallbackLogoPath],
    settings.invertLogoOnDark
  );
  const signature = await loadPngImage([settings.signaturePath], false);

  drawHeader(doc, settings, logo);
  drawProjectMeta(doc, payload, preparedDate);

  const body =
    payload.lineItems.length > 0
      ? payload.lineItems.map((lineItem, index) => [
          String(index + 1),
          getAreaName(payload.areas, lineItem.areaId),
          lineItem.name,
          lineItem.description || '-',
          String(lineItem.quantity),
          lineItem.unitLabel,
          formatPdfMoney(lineItem.ratePerUnit),
          formatPdfMoney(calculateLineItemTotal(lineItem)),
        ])
      : [['-', '-', 'No line items added', '-', '-', '-', '-', '-']];

  autoTable(doc, {
    startY: 250,
    head: [[
      '#',
      'Area',
      'Item',
      'Description',
      'Qty',
      'Unit',
      'Rate',
      'Amount',
    ]],
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.4,
      cellPadding: 4,
      overflow: 'linebreak',
      valign: 'top',
      lineColor: BRAND.line,
      lineWidth: 0.35,
      textColor: BRAND.black,
    },
    headStyles: {
      fillColor: BRAND.pearlBlack,
      textColor: BRAND.offWhite,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [250, 249, 247],
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 56 },
      2: { cellWidth: 64 },
      3: { cellWidth: 164 },
      4: { cellWidth: 32, halign: 'right' },
      5: { cellWidth: 30 },
      6: {
        cellWidth: 70,
        halign: 'right',
        font: getMoneyFontFamily(),
        fontStyle: getMoneyFontStyle('medium'),
      },
      7: {
        cellWidth: 86,
        halign: 'right',
        font: getMoneyFontFamily(),
        fontStyle: getMoneyFontStyle('medium'),
      },
    },
    margin: { left: 36, right: 36 },
  });

  const nextSectionY = drawSummaryAndSignatory(
    doc,
    payload,
    signature,
    getLastAutoTableFinalY(doc) + 24
  );
  drawTermsSection(doc, terms, nextSectionY);
  drawFooter(doc);

  doc.save(buildFileName(payload));
}


export const graviumClassicCostEstimatePdfTemplate = {
  id: 'gravium-classic',
  name: 'Gravium Classic',
  description:
    'Default Gravium branded A4 portrait cost estimate with summary, signatory, and terms.',
  exportPdf: exportGraviumClassicCostEstimatePdf,
} as const;
