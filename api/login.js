const { setSessionCookie, verifyPassword } = require("../lib/auth");
const { getUsers } = require("../lib/store");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  const { users } = await getUsers();
  const user = users[email];

  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "メールアドレスまたはパスワードが違います" });
    return;
  }

  setSessionCookie(res, { uid: email, householdId: user.householdId });
  res.status(200).json({ email });
};
