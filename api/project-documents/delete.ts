import {
  deleteGoogleDriveFile,
  handleApiError,
  readJsonBody,
  requireProjectDocumentManageAccess,
  sendJson,
} from '../../server/projectDocumentHelpers.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const body = readJsonBody(req);
    const documentId = String(body.documentId || '').trim();

    if (!documentId) {
      sendJson(res, 400, { error: 'Document id is required.' });
      return;
    }

    const { serviceClient } = await requireProjectDocumentManageAccess(req);

    const { data: document, error: documentError } = await serviceClient
      .from('project_documents')
      .select('*')
      .eq('id', documentId)
      .maybeSingle();

    if (documentError) throw documentError;

    if (!document) {
      sendJson(res, 404, { error: 'Project document was not found.' });
      return;
    }

    if (document.drive_file_id) {
      await deleteGoogleDriveFile(document.drive_file_id);
    }

    const { error: deleteError } = await serviceClient
      .from('project_documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) throw deleteError;

    sendJson(res, 200, { ok: true });
  } catch (error) {
    handleApiError(res, error);
  }
}
