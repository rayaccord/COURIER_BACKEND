import nodemailer from "nodemailer";

const sendEmail = async (to, subject, html) => {
  try {

    console.log("EMAIL USER:", process.env.EMAIL_USER);
console.log(
  "EMAIL PASS EXISTS:",
  !!process.env.EMAIL_PASS
);

    const transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },

  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
});

    const mailOptions = {
  from: `"HOOKS FOOD Courier" <${process.env.EMAIL_USER}>`,
  to,
  subject,

  text: `
Your HOOKS FOOD verification code is:

${html.replace(/<[^>]*>/g, "")}

If you did not request this code, please ignore this email.
  `,

  html,
};

    await transporter.verify();

console.log("SMTP Connected Successfully");

await transporter.sendMail(mailOptions);

    console.log(`Email sent to ${to}`);
 } catch (error) {
  console.error("========== EMAIL ERROR ==========");
  console.error(error);
  console.error("code:", error.code);
  console.error("response:", error.response);
  console.error("command:", error.command);
  console.error("================================");
}
};

export default sendEmail;
