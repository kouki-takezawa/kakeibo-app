const { getSession } = require("../lib/auth");
const { newInviteCode, updateInvites } = require("../lib/store");

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "not logged in" });
    return;
  }

  let code;
  await updateInvites((invites) => {
    do {
      code = newInviteCode();
    } while (invites[code]);
    invites[code] = {
      householdId: session.householdId,
      expiresAt: Date.now() + INVITE_TTL_MS,
    };
    return invites;
  });

  res.status(200).json({ code, expiresAt: Date.now() + INVITE_TTL_MS });
};
