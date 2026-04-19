/**
 * Nodemailer Service
 * Handles email sending functionality
 */

const nodemailer = require('nodemailer');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Send email using Nodemailer
 */
const sendMail = async (to, subject, html, attachments = []) => {
  console.log('NodeMailerService@sendMailNodemailer');

  try {
    const transporter = await nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.MAIL_USERNAME, // generated ethereal user
        pass: process.env.MAIL_PASSWORD, // generated ethereal password
      },
    });

    // send mail with defined transport object
    const params = {
      from: process.env.MAIL_FROM, // sender address
      to, // list of receivers
      subject, // Subject line
      html, // html body
      attachments: [
        {
          filename: 'brand_logo.png',
          path: path.join(__dirname, '../public/img/brand_logo.png'),
          cid: 'brand_logo', // must match the `cid` used in the HTML <img src="cid:brand_logo">
        },
      ],
    };

    if (attachments?.length) {
      params.attachments = [...params.attachments, ...attachments];
    }

    const info = await transporter.sendMail(params);
    console.log('Message ID: ', info.messageId);

    return info.messageId;
  } catch (ex) {
    console.log('Mail Error :', ex.message);
    logger.error('Email sending failed', {
      error: ex.message,
      // stack: ex.stack,
      to,
      subject,
      action: 'send_email',
    });
    return false;
  }
};

/**
 * Cleanup Nodemailer resources
 */
const cleanup = async () => {
  console.log('NodemailerService@cleanup');
  try {
    // Nodemailer doesn't maintain persistent connections
    // Transporter is created per request and closed automatically
    console.log('✅ Nodemailer cleanup completed');
    return true;
  } catch (error) {
    console.error('NodemailerService@cleanup Error:', error);
    return false;
  }
};

module.exports = {
  sendMail,
  cleanup,
};
