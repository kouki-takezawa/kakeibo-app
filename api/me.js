const { getSession } = require("../lib/auth");

module.exports = async function handler(req, res) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "not logged in" });
    return;
  }
  res.status(200).json({ email: session.uid });
};
