import {
  decodeBase64File,
  handleApiError,
  readJsonBody,
  getOrCreateGoogleDriveFolder,
  requireProjectDocumentManageAccess,
  sendJson,
  uploadFileToGoogleDrive,
} from '../../server/projectDocumentHelpers.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
};

function cleanDriveFolderName(value: unknown) {
  return String(value ?? '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function getProjectField(project: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = project[key];

    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return '';
}

function getProjectDocumentFolderName(
  project: Record<string, unknown>,
  projectId: string
) {
  const projectName =
    cleanDriveFolderName(
      getProjectField(project, ['name', 'project_name', 'title'])
    ) || 'Project';
  const clientName = cleanDriveFolderName(
    getProjectField(project, ['client_name', 'clientName', 'client', 'customer_name', 'lead_name'])
  );
  const shortProjectId = projectId.slice(0, 8);

  return [projectName, clientName, shortProjectId].filter(Boolean).join(' - ');
}

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

    const { data: project, error: projectError } = await serviceClient
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError) throw projectError;

    if (!project) {
      sendJson(res, 404, { error: 'Project was not found.' });
      return;
    }

    const projectFolder = await getOrCreateGoogleDriveFolder(
      getProjectDocumentFolderName(project as Record<string, unknown>, projectId)
    );
    const fileBuffer = decodeBase64File(base64Data);
    const driveFile = await uploadFileToGoogleDrive({
      fileName,
      mimeType,
      buffer: fileBuffer,
      parentFolderId: projectFolder.id,
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
        drive_folder_id: projectFolder.id,
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
