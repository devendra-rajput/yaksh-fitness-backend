
const referralPayoutAdminNotificationTemplate = async (referralsToPayout, grandTotal, debitTime, adminName) => {
   const currentYear = new Date().getFullYear();

   const rowsHtml = referralsToPayout.map((r) => `
        <tr>
            <td style="padding: 10px 14px; border-bottom: 1px solid #f0f0f0; font-family: 'Montserrat', sans-serif; font-size: 13px; color: #333;">${r.name}</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #f0f0f0; font-family: 'Montserrat', sans-serif; font-size: 13px; color: #ee4d29; font-weight: 600;">$${r.totalAmount.toFixed(2)}</td>
        </tr>
    `).join('');

   return `
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
        <html xmlns="http://www.w3.org/1999/xhtml">
           <head>
              <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
              <link href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,500;0,700;0,900;1,300;1,400;1,500;1,700&display=swap" rel="stylesheet">
              <title>Referral Payout Notification</title>
              <style type="text/css">
                 a {
                    text-decoration: none;
                    outline: none;
                 }
                 .container {
                    box-shadow: 0px 0px 6px 0px #ccc;
                 }
                 body {
                    font-family: 'Roboto', sans-serif;
                 }
              </style>
           </head>
           <body>
              <table cellpadding="0" width="650" class="container" align="center" cellspacing="0" border="0">
                 <tr>
                    <td>
                       <table cellpadding="0" width="650" class="container" align="center" cellspacing="0" border="0">
                          <tr style="background-color: #ee4d29 !important; height: 50px;">
                             <td></td>
                          </tr>
                          <tr>
                             <td>
                                <div align='center'>
                                   <img style="text-align: center; margin-top: 30px; width:80px;" src="cid:brand_logo" alt="Brand Logo">
                                </div>
                             </td>
                          </tr>
                          <tr height="40">
                             <td>
                                <p style="font-family: 'Montserrat', sans-serif; font-weight: bold; color: #000; font-size: 20px; text-align: center;">Referral Payout Notification</p>
                             </td>
                          </tr>
                          <tr>
                             <td>
                                <p style="font-family: 'Montserrat', sans-serif; color: #707070; text-align: left; padding: 0px 20px; font-size: 14px; line-height: 22px;">Hello ${adminName},</p>
                                <p style="font-family: 'Montserrat', sans-serif; color: #707070; text-align: left; padding: 0px 20px; font-size: 14px; line-height: 22px;">
                                   The following users are eligible for referral payouts. Please review the details below.
                                   A total of <strong style="color: #ee4d29;">$${grandTotal.toFixed(2)}</strong> will be debited from your account after 24 hours
                                   (<strong>${debitTime}</strong>).
                                </p>
                             </td>
                          </tr>
                          <tr>
                             <td style="padding: 10px 20px 20px 20px;">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden;">
                                   <thead>
                                      <tr style="background-color: #ee4d29;">
                                         <th style="padding: 12px 14px; font-family: 'Montserrat', sans-serif; font-size: 13px; color: #ffffff; text-align: left; font-weight: 600;">User Name</th>
                                         <th style="padding: 12px 14px; font-family: 'Montserrat', sans-serif; font-size: 13px; color: #ffffff; text-align: left; font-weight: 600;">Reward Amount</th>
                                      </tr>
                                   </thead>
                                   <tbody>
                                      ${rowsHtml}
                                   </tbody>
                                   <tfoot>
                                      <tr style="background-color: #fdf3f1;">
                                         <td style="padding: 12px 14px; font-family: 'Montserrat', sans-serif; font-size: 14px; color: #333; font-weight: bold;">Total Amount to be Debited</td>
                                         <td style="padding: 12px 14px; font-family: 'Montserrat', sans-serif; font-size: 14px; color: #ee4d29; font-weight: bold;">$${grandTotal.toFixed(2)}</td>
                                      </tr>
                                   </tfoot>
                                </table>
                             </td>
                          </tr>
                          <tr>
                             <td>
                                <p style="font-family: 'Montserrat', sans-serif; color: #707070; text-align: left; padding: 0px 20px; margin-bottom: 30px; font-size: 14px; line-height: 22px;">
                                   Thank you,<br>Elevyn
                                </p>
                                <p style="font-family: 'Montserrat', sans-serif; color: #707070; text-align: left; padding: 0px 20px; margin-bottom: 30px; font-size: 12px; line-height: 20px;">
                                   This is an automated notification. Please do not reply to this email.
                                </p>
                             </td>
                          </tr>
                          <tr style="background-color: #ee4d29;">
                             <td>
                                <div>
                                   <p class="sub center" style="color:#FFFFFF; text-align:center; width:100%; font-size: 16px; font-weight: 600;">
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
        </html>
    `;
}

module.exports = referralPayoutAdminNotificationTemplate;
