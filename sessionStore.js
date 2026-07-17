```
/**
* Simple in-memory session store, keyed by WhatsApp number.
*
* NOTE: This resets whenever the server restarts, and won't work if you
* ever run more than one server instance (no shared state between them).
* That's fine for getting started. If usage grows, swap this for Redis
* or a small database table — the get/set/clear interface below is all
* you'd need to keep, so the rest of the bot logic wouldn't have to change.
*/

const sessions = new Map();

const REQUIRED_DOCS = [
{ key: "idPhoto", label: "Photo of your SA ID / Passport" },
{ key: "selfieWithId", label: "Photo of you holding your ID" },
{ key: "payslip1", label: "Payslip - Month 1 (most recent)" },
{ key: "payslip2", label: "Payslip - Month 2" },
{ key: "payslip3", label: "Payslip - Month 3" },
{ key: "bankStatement", label: "Latest 1 month's bank statement" },
];

function getSession(phone) {
if (!sessions.has(phone)) {
sessions.set(phone, {
stage: "MAIN_MENU",
applicant: { name: null, idNumber: null },
documents: {}, // key -> mediaUrl once received
docIndex: 0,
lastActivity: Date.now(),
});
}
const s = sessions.get(phone);
s.lastActivity = Date.now();
return s;
}

function resetSession(phone) {
sessions.delete(phone);
return getSession(phone);
}

function nextMissingDoc(session) {
return REQUIRED_DOCS.find((d) => !session.documents[d.key]) || null;
}

function allDocsReceived(session) {
return REQUIRED_DOCS.every((d) => session.documents[d.key]);
}

module.exports = {
getSession,
resetSession,
nextMissingDoc,
allDocsReceived,
REQUIRED_DOCS,
};
```
