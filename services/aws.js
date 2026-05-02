/**
 * Cloudflare R2 Storage Service
 *
 * R2 is S3-compatible — same @aws-sdk/client-s3 package, different endpoint.
 *
 * Key differences vs AWS S3:
 *  - Endpoint: https://<CLOUDFLARE_ACCOUNT_ID>[.<jurisdiction>].r2.cloudflarestorage.com
 *  - Region:   "auto"  (R2 uses Cloudflare's edge, not AWS regions)
 *  - No storage class  (R2 has a single storage tier)
 *  - Zero egress fees  (reads are free)
 *  - Public URLs come from R2_PUBLIC_URL (custom domain or pub-xxx.r2.dev)
 */

const path = require('path');
const fs = require('fs');
const moment = require('moment-timezone');
const { v4: uuidv4 } = require('uuid');
const heicConvert = require('heic-convert');
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const response = require('../helpers/v1/response.helpers');

/* ─── R2 client ──────────────────────────────────────────────────────────── */

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_JURISDICTION
    ? `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.${process.env.R2_JURISDICTION}.r2.cloudflarestorage.com`
    : `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, ''); // strip trailing slash

/** Build the public URL for a stored key. */
const publicUrl = (key) => `${PUBLIC_URL}/${key}`;

/* ─── Upload file (middleware) ───────────────────────────────────────────── */

const uploadFile = async (req, res, next) => {
  if (!req?.file?.path) {
    return response.badRequest('error.fileNotFound', res, false);
  }

  try {
    const { file } = req;
    const dateObj = new Date();
    const dir = `${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

    let fileName = `${file.fieldname}-${uuidv4()}-${moment().unix()}${path.extname(file.originalname)}`;
    let contentType = file.mimetype;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    let fileBuffer = await fs.promises.readFile(file.path);

    // Convert HEIC → JPEG
    if (file.mimetype === 'image/heic' || file.mimetype === 'image/heif') {
      fileBuffer = await heicConvert({ buffer: fileBuffer, format: 'JPEG', quality: 0.8 });
      fileName = fileName.replace(/\.heic|\.heif$/, '.jpeg');
      contentType = 'image/jpeg';
    }

    const key = `${dir}/${fileName}`;
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    }));

    req.image_url = publicUrl(key);

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

    next();
  } catch (error) {
    console.error('R2Service@uploadFile Error:', error);
    return response.badRequest('error.fileNotUploaded', res, false);
  }
};

/* ─── Delete file ────────────────────────────────────────────────────────── */

const deleteFile = async (fileUrl) => {
  try {
    const url = new URL(fileUrl);
    const key = decodeURIComponent(url.pathname.substring(1));
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (error) {
    console.error('R2Service@deleteFile Error:', error);
    return false;
  }
};

/* ─── Presigned upload URL ───────────────────────────────────────────────── */

const getPresignedUrl = async (folder, fileName, fileType, expiry = 5 * 60) => {
  try {
    const dateObj = new Date();
    const dir = `${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
    const uniqueName = `${uuidv4()}-${moment().unix()}${path.extname(fileName)}`;
    const key = `${folder}/${dir}/${uniqueName}`;

    const signedUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: fileType }),
      { expiresIn: expiry },
    );

    return { uploadUrl: signedUrl, publicUrl: publicUrl(key), key };
  } catch (err) {
    console.error('R2Service@getPresignedUrl Error:', err);
    return false;
  }
};

/* ─── Cleanup (no-op — SDK v3 is stateless) ─────────────────────────────── */

const cleanup = async () => true;

module.exports = {
  uploadFile, deleteFile, getPresignedUrl, cleanup,
};
