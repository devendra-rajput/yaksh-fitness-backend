"use strict";
const nodemailer = require("nodemailer");
const path = require('path');

class NodemailerService {

    sendMail = async (to, subject, html, attachments = []) => {
        console.log("NodemailerService@sendMail")

        try{
            let transporter = await nodemailer.createTransport({
                host: process.env.MAIL_HOST,
                port: process.env.MAIL_PORT,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: process.env.MAIL_USERNAME, // generated ethereal user
                    pass: process.env.MAIL_PASSWORD, // generated ethereal password
                },
            });
            
            // send mail with defined transport object
            let params = {
                from: process.env.MAIL_FROM, // sender address
                to: to, // list of receivers
                subject: subject, // Subject line
                html: html, // html body
                attachments: [
                    {
                        filename: 'brand_logo_small.png',
                        path: path.join(__dirname, '../public/img/brand_logo_small.png'),
                        cid: 'brand_logo' // must match the `cid` used in the HTML <img src="cid:brand_logo">
                    }
                ]
            }

            if(attachments?.length){
               params.attachments = [...params.attachments, ...attachments]
            }

            let info = await transporter.sendMail(params);
            console.log("Message ID: ", info.messageId)

            return info.messageId
        }
        catch(ex){
            console.log("Mail Status :", ex.message)
            return false
        }
    }

}

module.exports = new NodemailerService;
