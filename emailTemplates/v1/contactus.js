
const contactUsTemplate = async (data) => {

    return `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
            <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
            <link href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,500;0,700;0,900;1,300;1,400;1,500;1,700&display=swap" rel="stylesheet">
            <title>Email-Verification</title>
            <style type="text/css">
                a{
                    text-decoration: none;
                    outline: none;
                }
    
                .container {
                box-shadow: 0px 0px 6px 0px #ff5c5d;
                }
                body
                {
                    font-family: 'Roboto', sans-serif;
                    font-weight: 500;
                }
            </style>
        </head>
        <body>
        
        <table cellpadding="0" width="600" class="container" align="center" cellspacing="0" border="0">
        <tr>
            <td>
                <table cellpadding="0" width="600" class="container" align="center" cellspacing="0" border="0" >
                <tr style="
                     background-color: #ee4d29 !important;
                     height: 15px;">
                     <td></td>
                  </tr>
                
                 <tr>
                         <td>
                            <div align='center' >
                               <img style="text-align: center;margin-top: 0;width: 160px; margin-top: 30px;" src="${process.env.API_URL}/public/img/brand-logo-email.png">
                            </div>
                         </td>
                      </tr>
                <tr>
                    <td>
                        <p style="color: #000;text-align: left;padding: 0px 20px;font-size: 20px;line-height: 22px;font-weight:bold;margin: 0;">Hello! ${data.fullName}</p>
                    </td>
                </tr>
                <tr>
                    <td>
                        <p style="line-height: 22px; color: #555659; text-align: left; padding: 0 20px;">Thanks for contacting us.</p>
                    </td>
                </tr>
                <tr>
                    <td>
                        <p style="line-height: 22px; color: #555659; text-align: left; padding: 0 20px;margin: 0;"><b>Email:</b> ${data.email}</p>
                    </td>
                </tr>
                <tr>
                    <td>
                        <p style="line-height: 22px; color: #555659; text-align: left; padding: 0 20px;margin: 0;"><b>companyName:</b> ${data.companyName}</p>
                    </td>
                </tr>
                <tr>
                <td>
                    <p style="line-height: 22px; color: #555659; text-align: left; padding: 0 20px;margin: 0;"><b>Message:</b> ${data.message}</p>
                </td>
            </tr>
        <tr>
        <td>
            <p style="line-height: 22px; color: #555659; text-align: left; padding: 0 20px;margin: 0;"><b>PhoneNo:</b> ${data.phoneNo}</p>
        </td>
    </tr>
                <tr>
                    <td>
                        <p style="line-height: 26px; color: #555659; text-align: left; padding: 0 20px;">
                        If you encounter any other difficulties, please contact <a style="color: #ff5c5d; text-decoration: underline;" href="mailto:support@ownbuzz.io">support@PrPublication.systems</a>.</p>
                    </td>
                </tr>
                <tr>
                    <td>
                        <p style="line-height: 26px; color: #555659; text-align: left; padding: 0 20px;">
                        Regards, <br>Pr Publication Team</p>
                    </td>
                </tr>
                </table>
                <tr height="50" style="background-color: #ee4d29;">
                    <td>
                        <div>
                            <p style="color: #fff;text-align: center;font-size: 14px;width: 100%;padding: 3px 0;">Thanks for contacting us</p>
                        </div>
                        </td>
                    </tr>
                </td>
            </tr>
        </table>
    </body>
</html>`

}

module.exports = contactUsTemplate;