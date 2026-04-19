const forgotPassword = async (otp) => {
  const currentYear = new Date().getFullYear();

  return `
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
      <html xmlns="http://www.w3.org/1999/xhtml">
         <head>
            <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
            <link href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,500;0,700;0,900;1,300;1,400;1,500;1,700&display=swap" rel="stylesheet">
            <title>Forget Password</title>
            <style type="text/css">
               a{
                  text-decoration: none;
                  outline: none;
               }
               .container {
                  box-shadow: 0px 0px 6px 0px #ccc;
               }
               body{
                  font-family: 'Roboto', sans-serif;
               }
            </style>
         </head>
         <body>
            <table cellpadding="0" width="600" class="container" align="center" cellspacing="0" border="0">
               <tr>
                  <td>
                     <table cellpadding="0" width="600" class="container" align="center" cellspacing="0" border="0" >
                        <tr style="background-color: #ee4d29 !important; height: 50px;">
                           <td></td>
                        </tr>
                        <tr>
                           <td>
                              <div align='center' >
                                 <img style="text-align; margin-top: 20px; width:80px;" src="cid:brand_logo" alt="Brand Logo">
                              </div>
                           </td>
                        </tr>
                        <tr height="40">
                           <td>
                              <p style="font-family: 'Montserrat', sans-serif; font-weight: bold; color: #000; font-size: 20px; text-align: center;">Forgot Password </p>
                           </td>
                        </tr>
                        <tr>
                           <td>
                              <p style="font-family: 'Montserrat', sans-serif;color: #707070;text-align: left;padding: 0px 20px;font-size: 14px;line-height: 22px;">Hello,</p>
                              <p style="font-family: 'Montserrat', sans-serif;color: #707070;text-align: left;padding: 0px 20px;font-size: 14px;line-height: 22px;">We’ve received your request to reset your password. To do so, Use the following OTP to complete your forgot password procedures. 
                           </td>
                        </tr>
                        <tr>
                           <td style="text-align: center; padding: 30px 0;">
                              <div style="background-color:#ee4d29;padding:2px 20px;color:#FFFFFF !important; display:inline-block; text-align:center; border-radius:15px">
                                 <h1 style="letter-spacing: 10px;">${otp}</h1>
                              </div>
                           </td>
                        </tr>
                        <tr>
                           <td>
                              <p style="font-family: 'Montserrat', sans-serif;color: #707070;text-align: left;padding: 0px 20px;margin-bottom: 30px;font-size: 14px;line-height: 22px;">Thank you,<br>Node JS Boilerplate</p>
                              <p style="font-family: 'Montserrat', sans-serif;color: #707070;text-align: left;padding: 0px 20px;margin-bottom: 30px;font-size: 14px;line-height: 22px;">If you did not make this request or no longer want to change your password, please disregard this message; your account remains safe and your existing password will not be changed.</p>
                           </td>
                        </tr>
                        <tr style=" background-color:   #ee4d29   ;">
                           <td>
                              <div>
                                 <p class="sub center" style="color:#FFFFFF; text-align:center ; width:100% ; font-size:"16px; font-weight:600">
                                    © ${currentYear}
                                 </p>
                              </div>
                           </td>
                        </tr>
                     </table>
                  </td>
               </tr>
            </table>
         </body>
      </html>`;
};

module.exports = forgotPassword;
