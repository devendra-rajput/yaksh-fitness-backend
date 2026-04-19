/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - first_name
 *         - email
 *         - password
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the user
 *         first_name:
 *           type: string
 *           description: The first name of the user
 *         last_name:
 *           type: string
 *           description: The last name of the user
 *         email:
 *           type: string
 *           description: The email of the user
 *         role:
 *           type: string
 *           enum: [user, admin]
 *           description: The role of the user
 *         phone_number:
 *           type: string
 *           description: User's phone number
 *         phone_code:
 *           type: string
 *           description: Country code for phone number
 *         profile_picture:
 *           type: string
 *           description: URL of the profile picture
 *         is_email_verified:
 *           type: boolean
 *           description: Email verification status
 *
 *     LoginResponse:
 *       type: object
 *       properties:
 *         token:
 *           type: string
 *           description: JWT access token
 *         user:
 *           $ref: '#/components/schemas/User'
 *
 *     Error:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: error
 *         message:
 *           type: string
 *           example: Error message description
 */

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management and authentication
 */

/**
 * @swagger
 * /api/v1/users/create:
 *   post:
 *     summary: Register a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - first_name
 *               - email
 *               - password
 *               - confirm_password
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               confirm_password:
 *                 type: string
 *                 format: password
 *               phone_number:
 *                 type: string
 *               phone_code:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: User created successfully
 *       409:
 *         description: Email already exists
 */

/**
 * @swagger
 * /api/v1/users/login:
 *   post:
 *     summary: Login user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Invalid credentials
 */

/**
 * @swagger
 * /api/v1/users/verify:
 *   post:
 *     summary: Verify Email OTP
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid OTP or Email
 */

/**
 * @swagger
 * /api/v1/users/resend-otp:
 *   post:
 *     summary: Resend Verification OTP
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Email already verified or invalid
 */

/**
 * @swagger
 * /api/v1/users/forgot-password:
 *   post:
 *     summary: Request Password Reset OTP
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Invalid email
 */

/**
 * @swagger
 * /api/v1/users/forgot-password/verify-otp:
 *   post:
 *     summary: Verify Forgot Password OTP
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid OTP
 */

/**
 * @swagger
 * /api/v1/users/reset-password:
 *   post:
 *     summary: Reset Password
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - password
 *               - confirm_password
 *             properties:
 *               user_id:
 *                 type: integer
 *               password:
 *                 type: string
 *                 format: password
 *               confirm_password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid request
 */

/**
 * @swagger
 * /api/v1/users/change-password:
 *   post:
 *     summary: Change Password (Authenticated)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - old_password
 *               - new_password
 *               - confirm_new_password
 *             properties:
 *               old_password:
 *                 type: string
 *                 format: password
 *               new_password:
 *                 type: string
 *                 format: password
 *               confirm_new_password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/users/profile:
 *   get:
 *     summary: Get User Profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/users/logout:
 *   get:
 *     summary: Logout User
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Get All Users (Admin Only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of users
 *       403:
 *         description: Forbidden (Admin only)
 */

/**
 * @swagger
 * /api/v1/users/upload-image:
 *   post:
 *     summary: Upload Single Image
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 */

/**
 * @swagger
 * /api/v1/users/upload-bulk-images:
 *   post:
 *     summary: Upload Multiple Images
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 */

/**
 * @swagger
 * /api/v1/users/delete-image:
 *   post:
 *     summary: Delete Local Image
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - image_url
 *             properties:
 *               image_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Image deleted successfully
 */

/**
 * @swagger
 * /api/v1/users/upload-image-aws:
 *   post:
 *     summary: Upload Image to AWS S3
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 */

/**
 * @swagger
 * /api/v1/users/delete-image-aws:
 *   post:
 *     summary: Delete Image from AWS S3
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - image_url
 *             properties:
 *               image_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Image deleted successfully
 */

/**
 * @swagger
 * /api/v1/users:
 *   delete:
 *     summary: Delete User Account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 */

/**
 * @swagger
 * /api/v1/users/generate-aws-presigned-url:
 *   post:
 *     summary: Generate AWS Presigned URL for File Upload
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - file_name
 *               - file_type
 *             properties:
 *               file_name:
 *                 type: string
 *                 description: Name of the file to be uploaded
 *                 example: profile_pic.jpg
 *               file_type:
 *                 type: string
 *                 description: MIME type of the file
 *                 example: image/jpeg
 *               folder:
 *                 type: string
 *                 description: Folder name in S3 bucket (default is 'uploads')
 *                 example: users/avatars
 *     responses:
 *       200:
 *         description: Presigned URL generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadUrl:
 *                   type: string
 *                   description: URL to PUT the file to
 *                 publicUrl:
 *                   type: string
 *                   description: Public URL of the uploaded file
 *                 key:
 *                   type: string
 *                   description: S3 object key
 *       400:
 *         description: Bad Request (Missing parameters or Server Error)
 *       401:
 *         description: Unauthorized
 */
