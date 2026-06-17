import {
  exportGraviumClassicCostEstimatePdf,
  exportGraviumClassicDesignEstimatePdf,
  graviumClassicCostEstimatePdfTemplate,
  type CostEstimateExportPayload,
  type DesignEstimateExportPayload,
} from './pdfTemplates/graviumClassicTemplate';

export type { CostEstimateExportPayload, DesignEstimateExportPayload } from './pdfTemplates/graviumClassicTemplate';

export const costEstimatePdfTemplates = [
  graviumClassicCostEstimatePdfTemplate,
] as const;

export const defaultCostEstimatePdfTemplateId =
  graviumClassicCostEstimatePdfTemplate.id;

export async function exportCostEstimatePdf(payload: CostEstimateExportPayload) {
  return exportGraviumClassicCostEstimatePdf(payload);
}

export async function exportDesignEstimatePdf(payload: DesignEstimateExportPayload) {
  return exportGraviumClassicDesignEstimatePdf(payload);
}
