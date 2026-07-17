const nodemailer = require("nodemailer");
const { REQUIRED_DOCS } = require("./sessionStore");

function buildTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Emails the applications inbox once a client has submitted every
 * required document. Twilio's MediaUrl links require Twilio auth to
 * open directly, so staff should open them while logged into the
 * Twilio console, or you can extend this function to download and
 * attach the files instead (see comment below).
 */
async function notifyNewApplication(phone, session) {
  const transporter = buildTransport();

  const docLines = REQUIRED_DOCS.map(
    (d) => `- ${d.label}: ${session.documents[d.key]}`
  ).join("\n");

  const refLines = (session.references || [])
    .map(
      (r, i) =>
        `- Reference ${i + 1}: ${r.name || "Not provided"} | ${r.phone || "Not provided"} | ${r.relationship || "Not provided"}`
    )
    .join("\n");

  const body = `New Salary Shuttle application via WhatsApp bot

Applicant name: ${session.applicant.name || "Not provided"}
ID number: ${session.applicant.idNumber || "Not provided"}
Physical address: ${session.applicant.address || "Not provided"}
WhatsApp number: ${phone}

Documents received:
${docLines}

Next of kin / references:
${refLines}

Next step: HR employment verification, then process per standard workflow.
`;

  await transporter.sendMail({
    from: process.env.NOTIFY_EMAIL_FROM,
    to: process.env.NOTIFY_EMAIL_TO,
    subject: `New loan application - ${session.applicant.name || phone}`,
    text: body,
  });

  // OPTIONAL upgrade: instead of linking to Twilio media URLs, you can
  // download each file server-side (with Twilio basic auth) and attach
  // it to this email directly. Ask me if you want that version — it
  // needs the account SID/auth token added to the media fetch request.
}

module.exports = { notifyNewApplication };
