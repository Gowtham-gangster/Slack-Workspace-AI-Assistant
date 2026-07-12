import { db } from '../db/index.js';
import { cache } from './cache.js';
import { Readable } from 'stream';

export class FileService {
  private static instance: FileService;

  private constructor() {}

  public static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }

  /**
   * Performs file security checks and uploads it directly to Slack S3 pre-signed storage.
   */
  public async uploadFileDirect(
    userId: number,
    filename: string,
    length: number,
    mimeType: string,
    fileBuffer: Buffer
  ): Promise<{ ok: boolean; fileId: string }> {
    console.log(`[FileService] Starting file upload for user ${userId}: ${filename} (${length} bytes)`);

    // 1. Security Check: block executables
    const extension = filename.split('.').pop()?.toLowerCase();
    const disallowedExtensions = ['exe', 'bat', 'cmd', 'sh', 'com', 'msi', 'scr', 'vbs', 'js', 'jar', 'bin', 'wsf'];
    if (extension && disallowedExtensions.includes(extension)) {
      console.error(`[FileService] Security block: executable file extension .${extension} not allowed`);
      throw new Error('Upload blocked for security: executable files and scripts are not allowed.');
    }

    // 2. Fetch Slack Bot Token
    const tokenRow = await db.queryOne<{ value: string }>(
      'SELECT value FROM settings WHERE user_id = ? AND `key` = ?',
      [userId, 'mcp_slack_bot_token']
    );
    const token = tokenRow?.value;
    if (!token) {
      console.error('[FileService] Slack token not configured');
      throw new Error('Slack Bot Token is not configured.');
    }

    // 3. Request Slack S3 pre-signed URL via files.getUploadURLExternal
    console.log('[FileService] Requesting Slack S3 upload URL via files.getUploadURLExternal...');
    const getUrlResponse = await fetch('https://slack.com/api/files.getUploadURLExternal', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        filename: filename,
        length: String(length),
      }).toString()
    });

    const urlData = await getUrlResponse.json() as any;
    if (!urlData.ok) {
      console.error('[FileService] Slack files.getUploadURLExternal failed:', urlData.error);
      throw new Error(`Slack getUploadURLExternal failed: ${urlData.error || 'unknown error'}`);
    }

    // 4. Upload payload directly to S3 URL via standard multipart/form-data
    console.log('[FileService] Uploading file binary directly to S3 URL...');
    const slackFormData = new FormData();
    const fileBlob = new Blob([fileBuffer], { type: mimeType });
    slackFormData.append('file', fileBlob, filename);

    const uploadResponse = await fetch(urlData.upload_url, {
      method: 'POST',
      body: slackFormData
    });

    const uploadResponseText = await uploadResponse.text();
    console.log(`[FileService] Slack S3 upload completed with status ${uploadResponse.status}`);
    
    if (!uploadResponse.ok) {
      console.error(`[FileService] Slack S3 upload failed: ${uploadResponseText}`);
      throw new Error(`Slack S3 upload failed with status ${uploadResponse.status}`);
    }

    return { ok: true, fileId: urlData.file_id };
  }

  /**
   * Helper to cache the file's metadata inside the local slack_files database table.
   */
  public async saveFileMetadata(file: any): Promise<void> {
    if (!file || !file.id) return;
    try {
      console.log(`[FileService] Saving file metadata to local DB for file ${file.id}: ${file.name}`);
      await db.execute(`
        INSERT INTO slack_files (id, url_private, url_private_download, name, mimetype, size)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          url_private = VALUES(url_private),
          url_private_download = VALUES(url_private_download),
          name = VALUES(name),
          mimetype = VALUES(mimetype),
          size = VALUES(size)
      `, [
        file.id,
        file.url_private || '',
        file.url_private_download || null,
        file.name || null,
        file.mimetype || null,
        file.size || null
      ]);
    } catch (err) {
      console.error(`[FileService] Failed to save file metadata for ${file.id}:`, err);
    }
  }

  /**
   * Resolves the target file url and streams the raw binary from the Slack CDN.
   * Supports HTTP Range headers for chunked seek requests.
   */
  public async getFileStream(
    userId: number,
    fileId: string,
    rangeHeader?: string,
    urlFallback?: string,
    filenameFallback?: string
  ): Promise<{ status: number; headers: Record<string, string>; stream: ReadableStream | null; rawResponse: Response }> {
    console.log(`[FileService] Fetching file stream request for file ${fileId}`);

    // 1. Get Slack Bot Token
    const tokenRow = await db.queryOne<{ value: string }>(
      'SELECT value FROM settings WHERE user_id = ? AND `key` = ?',
      [userId, 'mcp_slack_bot_token']
    );
    const token = tokenRow?.value;
    if (!token) {
      throw new Error('Slack Bot Token is not configured.');
    }

    let url_private = '';
    let mimetype = 'application/octet-stream';
    let name = 'download';
    let size = 0;

    // 2. Query local DB
    const localFile = await db.queryOne<{ url_private: string; url_private_download: string; mimetype: string; name: string; size: number }>(
      'SELECT url_private, url_private_download, mimetype, name, size FROM slack_files WHERE id = ?',
      [fileId]
    );

    if (urlFallback) {
      url_private = urlFallback;
      name = filenameFallback || 'download';
      const ext = name.split('.').pop()?.toLowerCase();
      if (ext) {
        const mimeTypes: Record<string, string> = {
          png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
          pdf: 'application/pdf', mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska', webm: 'video/webm',
          mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac', m4a: 'audio/mp4', doc: 'application/msword',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint',
          pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', csv: 'text/csv', txt: 'text/plain',
          json: 'application/json', xml: 'application/xml', zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed'
        };
        mimetype = mimeTypes[ext] || mimetype;
      }
      if (localFile && localFile.size > 0 && !name.endsWith('.pdf')) {
        size = localFile.size;
      }
      console.log(`[FileService] Using fallback URL parameter: ${url_private}`);
    } else if (localFile) {
      url_private = localFile.url_private_download || localFile.url_private;
      mimetype = localFile.mimetype || mimetype;
      name = localFile.name || name;
      size = localFile.size || size;
      console.log(`[FileService] DB Cache hit for file ${fileId}: ${name} (${mimetype})`);
    } else {
      console.log(`[FileService] DB Cache miss and no URL parameter. Querying files.info Web API for ${fileId}...`);
      const cacheId = `file_meta:${fileId}`;
      let fileMeta = cache.get<{ url_private: string; mimetype: string; name: string; size: number }>(cacheId);

      if (!fileMeta) {
        const infoResponse = await fetch(`https://slack.com/api/files.info?file=${fileId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const infoData = await infoResponse.json() as any;
        if (!infoData.ok) {
          throw new Error(`Slack files.info failed for ${fileId}: ${infoData.error}`);
        }

        fileMeta = {
          url_private: infoData.file.url_private_download || infoData.file.url_private,
          mimetype: infoData.file.mimetype || 'application/octet-stream',
          name: infoData.file.name || 'download',
          size: infoData.file.size || 0
        };
        cache.set(cacheId, fileMeta, 86400);
      }

      url_private = fileMeta.url_private;
      mimetype = fileMeta.mimetype;
      name = fileMeta.name;
      size = fileMeta.size;
    }

    // 3. Send direct request to Slack CDN
    const requestHeaders: Record<string, string> = {
      'Authorization': `Bearer ${token}`
    };
    if (rangeHeader) {
      requestHeaders['Range'] = rangeHeader;
    }

    console.log(`[FileService] Fetching from CDN: ${url_private}`);
    const fileResponse = await fetch(url_private, { headers: requestHeaders });

    if (!fileResponse.ok) {
      throw fileResponse; // Throw standard Response so caller can log body details
    }

    // 4. Construct proxy response headers
    const proxyHeaders: Record<string, string> = {
      'Content-Type': mimetype,
      'Cache-Control': 'public, max-age=86400',
      'X-File-Name': name
    };

    const contentRange = fileResponse.headers.get('content-range');
    if (contentRange) proxyHeaders['Content-Range'] = contentRange;

    const acceptRanges = fileResponse.headers.get('accept-ranges');
    if (acceptRanges) proxyHeaders['Accept-Ranges'] = acceptRanges;

    const contentLength = fileResponse.headers.get('content-length');
    if (contentLength) {
      proxyHeaders['Content-Length'] = contentLength;
    } else if (size > 0) {
      proxyHeaders['Content-Length'] = String(size);
    }

    return {
      status: fileResponse.status,
      headers: proxyHeaders,
      stream: fileResponse.body,
      rawResponse: fileResponse
    };
  }
}
