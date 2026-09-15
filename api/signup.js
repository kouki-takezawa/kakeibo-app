const { setSessionCookie, hashPassword } = require("../lib/auth");
const { newId, createHouseholdData, saveHousehold, updateUsers } = require("../lib/store");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "メールアドレスの形式が正しくありません" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "パスワードは8文字以上にしてください" });
    return;
  }

  const householdId = newId();
  let created = false;

  try {
    await updateUsers((users) => {
      if (users[email]) {
        throw new Error("EMAIL_TAKEN");
      }
      users[email] = {
        passwordHash: hashPassword(password),
        householdId,
        createdAt: Date.now(),
      };
      return users;
    });
    created = true;
  } catch (err) {
    if (err.message === "EMAIL_TAKEN") {
      res.status(409).json({ error: "このメールアドレスは既に登録されています" });
      return;
    }
    throw err;
  }

  if (created) {
    await saveHousehold(householdId, createHouseholdData());
  }

  setSessionCookie(res, { uid: email, householdId });
  res.status(200).json({ email });
};
