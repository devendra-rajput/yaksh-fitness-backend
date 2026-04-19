/**
 * AWS S3 Service
 * Handles file uploads, deletions, and presigned URLs for AWS S3
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

// AWS S3 Client instance
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const bucketName = process.env.AWS_S3_BUCKET_NAME;

/**
 * Upload file to AWS S3 (middleware)
 */
const uploadFile = async (req, res, next) => {
  console.log('AWSService@uploadFile');

  if (!req?.file?.path) {
    return response.badRequest('error.fileNotFound', res, false);
  }

  try {
    const { file } = req;

    const dateObj = new Date();
    const uploadDirectory = `${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
    let fileName = `${file.fieldname}-${uuidv4()}-${moment().unix()}${path.extname(file.originalname)}`;
    let contentType = file.mimetype;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    let fileBuffer = await fs.promises.readFile(file.path);

    // Convert HEIC to JPEG if necessary
    if (file.mimetype === 'image/heic' || file.mimetype === 'image/heif') {
      const jpegBuffer = await heicConvert({
        buffer: fileBuffer,
        format: 'JPEG',
        quality: 0.8,
      });

      fileBuffer = jpegBuffer; // Use converted buffer
      fileName = fileName.replace(/\.heic|\.heif$/, '.jpeg');
      contentType = 'image/jpeg';
    }

    // Defined S3 bucket params to upload the file
    const key = `${uploadDirectory}/${fileName}`;
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      // ACL: 'public-read',
      ContentType: contentType,
    };

    // Upload using v3 command
    const command = new PutObjectCommand(params);
    await s3.send(command);

    // Construct public URL manually
    const fileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    // Attached uploaded image URL with request for further use
    req.image_url = fileUrl;

    // Delete file after uploading to S3
    // Delete file after uploading to S3
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(file.path)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.unlinkSync(file.path);
    }

    next();
  } catch (error) {
    console.log('Upload error:', error);
    return response.badRequest('error.fileNotUploaded', res, false);
  }
};

/**
 * Delete file from AWS S3
 */
const deleteFile = async (fileUrl) => {
  console.log('AWSService@deleteFile');

  // const bucket = process.env.AWS_S3_BUCKET_NAME;
  const url = new URL(fileUrl);
  const key = decodeURIComponent(url.pathname.substring(1)); // remove leading `/`

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3.send(command);

    return true;
  } catch (error) {
    console.log('Error in deleteFile: ', error);
    return false;
  }
};

/**
 * Generate presigned URL for direct upload to S3
 */
const getPresignedUrl = async (folder, fileName, fileType, expiry = 5 * 60) => {
  console.log('AWSService@getPresignedUrl');
  try {
    const dateObj = new Date();
    const uploadDirectory = `${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

    // Sanitize filename and make unique
    const uniqueFileName = `${uuidv4()}-${moment().unix()}${path.extname(fileName)}`;
    const key = `${folder}/${uploadDirectory}/${uniqueFileName}`;

    const params = {
      Bucket: bucketName,
      Key: key,
      ContentType: fileType,
      // ACL: "public-read", // Optional depending on bucket policy
    };

    const command = new PutObjectCommand(params);

    // 5 minutes expiry
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: expiry });

    const publicUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return {
      uploadUrl: signedUrl,
      publicUrl,
      key,
    };
  } catch (err) {
    console.log('AWSService@getPresignedUrl Error: ', err);
    return false;
  }
};

/**
 * Cleanup AWS resources
 */
const cleanup = async () => {
  console.log('AWSService@cleanup');
  try {
    // AWS SDK v3 doesn't maintain persistent connections
    // S3Client is stateless and doesn't require cleanup
    console.log('✅ AWS cleanup completed');
    return true;
  } catch (error) {
    console.error('AWSService@cleanup Error:', error);
    return false;
  }
};

// Export all functions
module.exports = {
  uploadFile,
  deleteFile,
  getPresignedUrl,
  cleanup,
};
