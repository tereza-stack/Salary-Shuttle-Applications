require("dotenv").config();
const express = require("express");
const twilio = require("twilio");
const {
  getSession,
  resetSession,
  nextMissingDoc,
  allDocsReceived,
} = require("./sessionStore");
const { notifyNewApplication } = require("./notify");

const { MessagingResponse } = twilio.twiml;

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ---------- Content (edit freely to match your voice / current T&Cs) ----------

const WELCOME = `Hi 👋 welcome to *Salary Shuttle Applications*.

Reply with a number:
1️⃣ Apply for a loan
2️⃣ FAQs / How it works
3️⃣ Talk to a human agent

You can type *menu* any time to come back here, or *restart* to start over.`;

const FAQ_MENU = `*FAQs* — reply with a number:
1️⃣ What is Salary Shuttle?
2️⃣ Am I eligible?
3️⃣ What documents do I need?
4️⃣ How is it repaid?
0️⃣ Back to main menu`;

const FAQ_ANSWERS = {
  "1": `*Salary Shuttle* is a staff assistance benefit offering short-term loans, tailored to your affordability, payable over 1 to 6 months. Powered by AstroFin Loan Specialists (NCRCP15272).`,
  "2": `To qualify, you must:
- Have been employed for at least 6 months
- Not be under debt review
- Pass HR employment verification (part of the process)

Approved payouts are paid via EFT, and installments are deducted via payroll.`,
  "3": `You'll need to send:
- A photo of your SA ID or Passport
- A photo of you holding your ID
- Your latest 3 months' payslips
- Your latest 1 month's bank statement

Reply *1* from the main menu when you're ready to apply and I'll collect these one by one.`,
  "4": `Approved loans are paid out via EFT, and repayments are deducted directly from your payroll over the agreed term (1–6 months). No manual repayments needed.`,
};

const AGENT_HANDOFF = `Got it — I've flagged this chat for a human agent to follow up with you. In the meantime you can reach the team directly on 082 621 9388 or 072 722 5486.`;

const DOCS_COMPLETE_INTRO = `🎉 Thank you! 

Please send us *2 references* (next of kin) — for each one, we'll need their *name*, *cell phone number*, and *relationship* to you.

Let's start with reference 1. What's their *full name*?`;

const FINAL_DONE = `✅ All done — thank you! Your application and references have been submitted. Our team will be in touch soon.

Type *menu* any time if you need anything else.`;

// ---------- Helpers ----------

function sendMenu(twiml) {
  twiml.message(WELCOME);
}

function startApply(session, twiml) {
  session.stage = "APPLY_NAME";
  twiml.message(
    `Great, let's get your application started 📝\n\nWhat's your *full name*?`
  );
}

function askNextDoc(session, twiml, { firstTime = false } = {}) {
  const missing = nextMissingDoc(session);
  if (!missing) return; // shouldn't happen, caller checks allDocsReceived first
  const intro = firstTime
    ? `Thanks! Now let's collect your documents. Please send each one as a photo, one at a time.\n\n`
    : `Got it ✅\n\n`;
  twiml.message(`${intro}Please send: *${missing.label}*`);
}

// ---------- Webhook ----------

app.post("/webhook", async (req, res) => {
  const from = req.body.From; // e.g. "whatsapp:+27821234567"
  const body = (req.body.Body || "").trim();
  const bodyLower = body.toLowerCase();
  const mediaUrl = req.body.MediaUrl0;
  const numMedia = Number(req.body.NumMedia || 0);

  const twiml = new MessagingResponse();

  // Global commands, available from any stage
  if (bodyLower === "menu") {
    const session = getSession(from);
    session.stage = "MAIN_MENU";
    sendMenu(twiml);
    return res.type("text/xml").send(twiml.toString());
  }
  if (bodyLower === "restart") {
    resetSession(from);
    sendMenu(twiml);
    return res.type("text/xml").send(twiml.toString());
  }

  const session = getSession(from);

  try {
    switch (session.stage) {
      case "MAIN_MENU": {
        if (body === "1") {
          startApply(session, twiml);
        } else if (body === "2") {
          session.stage = "FAQ_MENU";
          twiml.message(FAQ_MENU);
        } else if (body === "3") {
          session.stage = "AGENT";
          twiml.message(AGENT_HANDOFF);
        } else {
          sendMenu(twiml);
        }
        break;
      }

      case "FAQ_MENU": {
        if (body === "0") {
          session.stage = "MAIN_MENU";
          sendMenu(twiml);
        } else if (FAQ_ANSWERS[body]) {
          twiml.message(FAQ_ANSWERS[body]);
          twiml.message(FAQ_MENU);
        } else {
          twiml.message(`Sorry, I didn't catch that.\n\n${FAQ_MENU}`);
        }
        break;
      }

      case "APPLY_NAME": {
        if (!body) {
          twiml.message(`Please type your full name to continue.`);
          break;
        }
        session.applicant.name = body;
        session.stage = "APPLY_ID";
        twiml.message(`Thanks ${body}. What's your *SA ID or Passport number*?`);
        break;
      }

      case "APPLY_ID": {
        if (!body) {
          twiml.message(`Please type your ID or Passport number to continue.`);
          break;
        }
        session.applicant.idNumber = body;
        session.stage = "APPLY_DOCS";
        askNextDoc(session, twiml, { firstTime: true });
        break;
      }

      case "APPLY_DOCS": {
        if (numMedia > 0 && mediaUrl) {
          const missing = nextMissingDoc(session);
          if (missing) {
            session.documents[missing.key] = mediaUrl;
          }
          if (allDocsReceived(session)) {
            session.stage = "APPLY_REF1_NAME";
            twiml.message(DOCS_COMPLETE_INTRO);
          } else {
            askNextDoc(session, twiml);
          }
        } else {
          const missing = nextMissingDoc(session);
          twiml.message(
            `Please send *${missing.label}* as a photo/image attachment. Type *menu* if you'd like to stop and go back.`
          );
        }
        break;
      }

      case "APPLY_REF1_NAME": {
        if (!body) {
          twiml.message(`Please type reference 1's full name to continue.`);
          break;
        }
        session.references[0].name = body;
        session.stage = "APPLY_REF1_PHONE";
        twiml.message(`Thanks. What's *${body}'s* cell phone number?`);
        break;
      }

      case "APPLY_REF1_PHONE": {
        if (!body) {
          twiml.message(`Please type reference 1's cell phone number to continue.`);
          break;
        }
        session.references[0].phone = body;
        session.stage = "APPLY_REF1_RELATIONSHIP";
        twiml.message(`And what's their *relationship* to you (e.g. spouse, parent, sibling, friend)?`);
        break;
      }

      case "APPLY_REF1_RELATIONSHIP": {
        if (!body) {
          twiml.message(`Please type reference 1's relationship to you to continue.`);
          break;
        }
        session.references[0].relationship = body;
        session.stage = "APPLY_REF2_NAME";
        twiml.message(`Great, now reference 2. What's their *full name*?`);
        break;
      }

      case "APPLY_REF2_NAME": {
        if (!body) {
          twiml.message(`Please type reference 2's full name to continue.`);
          break;
        }
        session.references[1].name = body;
        session.stage = "APPLY_REF2_PHONE";
        twiml.message(`Thanks. What's *${body}'s* cell phone number?`);
        break;
      }

      case "APPLY_REF2_PHONE": {
        if (!body) {
          twiml.message(`Please type reference 2's cell phone number to continue.`);
          break;
        }
        session.references[1].phone = body;
        session.stage = "APPLY_REF2_RELATIONSHIP";
        twiml.message(`And what's their *relationship* to you (e.g. spouse, parent, sibling, friend)?`);
        break;
      }

      case "APPLY_REF2_RELATIONSHIP": {
        if (!body) {
          twiml.message(`Please type reference 2's relationship to you to continue.`);
          break;
        }
        session.references[1].relationship = body;
        session.stage = "DONE";
        twiml.message(FINAL_DONE);
        try {
          await notifyNewApplication(from, session);
        } catch (err) {
          console.error("Failed to send notification email:", err.message);
        }
        break;
      }

      case "AGENT":
      case "DONE": {
        twiml.message(
          `Type *menu* to see options again, or *restart* to begin a new application.`
        );
        break;
      }

      default: {
        session.stage = "MAIN_MENU";
        sendMenu(twiml);
      }
    }
  } catch (err) {
    console.error("Error handling message:", err);
    twiml.message(
      `Sorry, something went wrong on our end. Please type *menu* to try again, or contact us on 082 621 9388.`
    );
  }

  res.type("text/xml").send(twiml.toString());
});

app.get("/", (_req, res) => {
  res.send("AstroFin WhatsApp bot is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AstroFin WhatsApp bot listening on port ${PORT}`);
});
