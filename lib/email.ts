import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  await sgMail.send({
    to,
    from: process.env.SENDGRID_FROM!,
    subject: "Shotota Gas — Password Reset",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#111">
        <h2 style="margin-bottom:8px;font-size:20px">Password Reset</h2>
        <p style="color:#555;margin-bottom:24px;font-size:14px">
          You requested a password reset for your Shotota Gas Management Portal account.
          Click the button below to set a new password. The link expires in 1 hour.
        </p>
        <a href="${resetLink}"
           style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
          Reset Password
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px">
          If you did not request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
