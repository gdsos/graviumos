import {
  decodeBase64File,
  handleApiError,
  readJsonBody,
  requireProjectDocumentManageAccess,
  sendJson,
  uploadFileToGoogleDrive,
} from '../../server/projectDocumentHelpers';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const body = readJsonBody(req);
    const projectId = String(body.projectId || '').trim();
    const fileName = String(body.fileName || '').trim();
    const mimeType = String(body.mimeType || 'application/octet-stream').trim();
    const base64Data = String(body.base64Data || '').trim();
    const category = String(body.category || 'Project Document').trim();
    const notes = String(body.notes || '').trim();

    if (!projectId) {
      sendJson(res, 400, { error: 'Project id is required.' });
      return;
    }

    if (!fileName) {
      sendJson(res, 400, { error: 'File name is required.' });
      return;
    }

    if (!base64Data) {
      sendJson(res, 400, { error: 'File data is required.' });
      return;
    }

    const { user, serviceClient } = await requireProjectDocumentManageAccess(req);
    const fileBuffer = decodeBase64File(base64Data);
    const driveFile = await uploadFileToGoogleDrive({
      fileName,
      mimeType,
      buffer: fileBuffer,
    });

    const documentUrl =
      driveFile.webViewLink ||
      `https://drive.google.com/file/d/${driveFile.id}/view`;

    const { data, error } = await serviceClient
      .from('project_documents')
      .insert({
        project_id: projectId,
        name: fileName,
        document_url: documentUrl,
        category,
        notes,
        storage_provider: 'google_drive',
        drive_file_id: driveFile.id,
        drive_folder_id: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || null,
        mime_type: driveFile.mimeType || mimeType,
        file_size: driveFile.size ? Number(driveFile.size) : fileBuffer.byteLength,
        uploaded_by: user.id,
        uploaded_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error) throw error;

    sendJson(res, 200, { document: data });
  } catch (error) {
    handleApiError(res, error);
  }
}

