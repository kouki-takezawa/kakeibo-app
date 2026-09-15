const { getSession, setSessionCookie } = require("../lib/auth");
const { getInvites, updateInvites, updateUsers } = require("../lib/store");

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

  const code = String(req.body?.code || "").trim().toUpperCase();
  if (!code) {
    res.status(400).json({ error: "招待コードを入力してください" });
    return;
  }

  const { invites } = await getInvites();
  const invite = invites[code];

  if (!invite || invite.expiresAt < Date.now()) {
    res.status(400).json({ error: "招待コードが無効か、有効期限が切れています" });
    return;
  }
  if (invite.householdId === session.householdId) {
    res.status(400).json({ error: "既にこの世帯に参加しています" });
    return;
  }

  const targetHouseholdId = invite.householdId;

  await updateUsers((users) => {
    if (users[session.uid]) {
      users[session.uid].householdId = targetHouseholdId;
    }
    return users;
  });

  await updateInvites((current) => {
    delete current[code];
    return current;
  });

  setSessionCookie(res, { uid: session.uid, householdId: targetHouseholdId });
  res.status(200).json({ householdId: targetHouseholdId });
};
