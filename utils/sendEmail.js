import nodemailer from "nodemailer";

const sendEmail = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },

  tls: {
    rejectUnauthorized: false,
  },
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
    console.error("Email Error");
console.error(error);
  }
};

export default sendEmail;
