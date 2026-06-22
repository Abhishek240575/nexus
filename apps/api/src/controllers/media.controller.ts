import { Request, Response } from 'express';
import * as R from '../utils/response';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

interface AuthenticatedRequest extends Request {
  user: { id: string; handle: string; premium_tier: string };
}

const s3 = new S3Client({
  region:      'auto',
  endpoint:    process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY!,
    secretAccessKey: process.env.R2_SECRET_KEY!,
  },
  forcePathStyle: true,
});

const PAID_TIERS = ['plus', 'pro', 'enterprise'];

const VIDEO_MAX_BYTES   = 50 * 1024 * 1024;  // 50 MB
const IMAGE_MAX_BYTES   = 10 * 1024 * 1024;  // 10 MB
const ALLOWED_VIDEO     = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_IMAGE     = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// ─── Get presigned upload URL ─────────────────────────────────────────────────
export const getUploadUrl = async (req: Request, res: Response): Promise<void> => {
  const { id: userId, premium_tier } = (req as AuthenticatedRequest).user;
  const { content_type, file_size, media_type } = req.body;

  if (!content_type) { R.badRequest(res, 'content_type required'); return; }

  const isVideo = media_type === 'video' || ALLOWED_VIDEO.includes(content_type);
  const isImage = ALLOWED_IMAGE.includes(content_type);

  if (!isVideo && !isImage) {
    R.badRequest(res, `Unsupported file type: ${content_type}`); return;
  }

  // Tier gate — videos only for paid users
  if (isVideo && !PAID_TIERS.includes(premium_tier)) {
    R.forbidden(res, 'Short video uploads require a Plus, Pro, or Enterprise subscription. Upgrade at /premium.');
    return;
  }

  const maxBytes = isVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
  if (file_size && file_size > maxBytes) {
    R.badRequest(res, `File too large. Max ${isVideo ? '50MB' : '10MB'}.`); return;
  }

  const ext     = content_type.split('/')[1]?.replace('quicktime', 'mov') || 'bin';
  const folder  = isVideo ? 'videos' : 'images';
  const key     = `${folder}/${userId}/${uuidv4()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket:      process.env.R2_BUCKET!,
    Key:         key,
    ContentType: content_type,
  });

  const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  const publicUrl    = `${process.env.R2_PUBLIC_URL}/${key}`;

  R.ok(res, {
    upload_url:  presignedUrl,
    public_url:  publicUrl,
    key,
    expires_in:  300,
    is_video:    isVideo,
  });
};

// ─── Delete uploaded media ────────────────────────────────────────────────────
export const deleteMedia = async (req: Request, res: Response): Promise<void> => {
  const { key } = req.body;
  if (!key) { R.badRequest(res, 'key required'); return; }

  // Security: only allow deleting from images/ or videos/ folders
  if (!key.startsWith('images/') && !key.startsWith('videos/')) {
    R.forbidden(res, 'Cannot delete this file'); return;
  }

  await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
  R.ok(res, { deleted: true });
};
