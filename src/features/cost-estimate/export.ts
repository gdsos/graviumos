import {
  exportGraviumClassicCostEstimatePdf,
  graviumClassicCostEstimatePdfTemplate,
  type CostEstimateExportPayload,
} from './pdfTemplates/graviumClassicTemplate';

export type { CostEstimateExportPayload } from './pdfTemplates/graviumClassicTemplate';

export const costEstimatePdfTemplates = [
  graviumClassicCostEstimatePdfTemplate,
] as const;

export const defaultCostEstimatePdfTemplateId =
  graviumClassicCostEstimatePdfTemplate.id;

export async function exportCostEstimatePdf(payload: CostEstimateExportPayload) {
  return exportGraviumClassicCostEstimatePdf(payload);
}
