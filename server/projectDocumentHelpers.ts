import { createClient } from '@supabase/supabase-js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink';
const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type DriveUploadResult = {
  id: string;
  name?: string;
  mimeType?: string;
  size?: string;
  webViewLink?: string;
  webContentLink?: string;
};

type DriveFolderResult = {
  id: string;
  name?: string;
};

function getEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
}

function getSupabaseAnonKey() {
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
}

function readBearerToken(req: any) {
  const authorization =
    req.headers?.authorization || req.headers?.Authorization || '';

  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw Object.assign(new Error('Missing authorization token.'), {
      statusCode: 401,
    });
  }

  return authorization.replace('Bearer ', '').trim();
}

export function readJsonBody(req: any) {
  if (!req.body) return {};

  if (typeof req.body === 'string') {
    return JSON.parse(req.body);
  }

  return req.body;
}

export function sendJson(res: any, statusCode: number, body: unknown) {
  res.status(statusCode).json(body);
}

export function handleApiError(res: any, error: unknown) {
  const message = error instanceof Error ? error.message : 'Request failed.';
  const statusCode =
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as { statusCode?: unknown }).statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : 500;

  sendJson(res, statusCode, { error: message });
}

export function decodeBase64File(base64Data: string) {
  const cleanBase64 = base64Data.includes(',')
    ? base64Data.split(',').pop() || ''
    : base64Data;

  const buffer = Buffer.from(cleanBase64, 'base64');

  if (buffer.byteLength === 0) {
    throw Object.assign(new Error('File is empty.'), { statusCode: 400 });
  }

  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw Object.assign(
      new Error('File is too large. Upload files up to 10 MB for now.'),
      { statusCode: 413 }
    );
  }

  return buffer;
}

export async function requireProjectDocumentManageAccess(req: any) {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const token = readBearerToken(req);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL or anon key is not configured.');
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token);

  if (userError || !user) {
    throw Object.assign(new Error('Invalid user session.'), {
      statusCode: 401,
    });
  }

  const { data: canManage, error: permissionError } = await userClient.rpc(
    'can_manage_page',
    { page_key: 'portal.projects' }
  );

  if (permissionError) {
    throw permissionError;
  }

  if (canManage !== true) {
    throw Object.assign(
      new Error('Projects manage access is required for project documents.'),
      { statusCode: 403 }
    );
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return { user, serviceClient };
}

async function getGoogleDriveAccessToken() {
  const clientId = getEnv('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = getEnv('GOOGLE_OAUTH_CLIENT_SECRET');
  const refreshToken = getEnv('GOOGLE_OAUTH_REFRESH_TOKEN');

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error_description || body.error || 'Google OAuth refresh failed.');
  }

  if (!body.access_token) {
    throw new Error('Google OAuth did not return an access token.');
  }

  return body.access_token as string;
}

async function makeDriveFileViewable(fileId: string, accessToken: string) {
  const shareMode = process.env.GOOGLE_DRIVE_LINK_SHARING || 'anyone';

  if (shareMode !== 'anyone') return;

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
        allowFileDiscovery: false,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error?.message || 'Could not set Drive sharing permission.');
  }
}

function getRootDriveFolderId() {
  return getEnv('GOOGLE_DRIVE_ROOT_FOLDER_ID');
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function getOrCreateGoogleDriveFolder(
  folderName: string,
  parentFolderId = getRootDriveFolderId()
): Promise<DriveFolderResult> {
  const accessToken = await getGoogleDriveAccessToken();
  const safeFolderName = folderName.trim() || 'Project Documents';
  const searchUrl = new URL(DRIVE_FILES_URL);

  searchUrl.searchParams.set(
    'q',
    `'${escapeDriveQueryValue(parentFolderId)}' in parents and mimeType = '${DRIVE_FOLDER_MIME_TYPE}' and name = '${escapeDriveQueryValue(safeFolderName)}' and trashed = false`
  );
  searchUrl.searchParams.set('spaces', 'drive');
  searchUrl.searchParams.set('fields', 'files(id,name)');

  const searchResponse = await fetch(searchUrl.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const searchBody = await searchResponse.json().catch(() => ({}));

  if (!searchResponse.ok) {
    throw new Error(searchBody.error?.message || 'Google Drive folder lookup failed.');
  }

  const existingFolder = Array.isArray(searchBody.files)
    ? searchBody.files.find((file: DriveFolderResult) => file.id)
    : null;

  if (existingFolder?.id) {
    return existingFolder as DriveFolderResult;
  }

  const createUrl = new URL(DRIVE_FILES_URL);
  createUrl.searchParams.set('fields', 'id,name');

  const createResponse = await fetch(createUrl.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: safeFolderName,
      mimeType: DRIVE_FOLDER_MIME_TYPE,
      parents: [targetParentFolderId],
    }),
  });

  const createBody = await createResponse.json().catch(() => ({}));

  if (!createResponse.ok) {
    throw new Error(createBody.error?.message || 'Google Drive folder creation failed.');
  }

  return createBody as DriveFolderResult;
}

export async function uploadFileToGoogleDrive({
  fileName,
  mimeType,
  buffer,
  parentFolderId,
}: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  parentFolderId?: string | null;
}): Promise<DriveUploadResult> {
  const accessToken = await getGoogleDriveAccessToken();
  const targetParentFolderId = parentFolderId?.trim() || getRootDriveFolderId();
  const boundary = `gravium_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const metadata = {
    name: fileName,
    parents: [parentFolderId],
  };

  const metadataPart = Buffer.from(
    `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`,
    'utf8'
  );

  const closePart = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const multipartBody = Buffer.concat([metadataPart, buffer, closePart]);

  const response = await fetch(DRIVE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error?.message || 'Google Drive upload failed.');
  }

  await makeDriveFileViewable(body.id, accessToken);

  return body as DriveUploadResult;
}

export async function deleteGoogleDriveFile(fileId: string) {
  const accessToken = await getGoogleDriveAccessToken();

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (response.ok || response.status === 404) return;

  const body = await response.json().catch(() => ({}));
  throw new Error(body.error?.message || 'Google Drive delete failed.');
}
