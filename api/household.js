const { getSession } = require("../lib/auth");
const { getHousehold, saveHousehold, createHouseholdData } = require("../lib/store");

module.exports = async function handler(req, res) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "not logged in" });
    return;
  }

  res.setHeader("Cache-Control", "private, no-store");

  if (req.method === "GET") {
    let { household } = await getHousehold(session.householdId);
    if (!household) {
      household = createHouseholdData();
      await saveHousehold(session.householdId, household);
    }
    res.status(200).json(household);
    return;
  }

  if (req.method === "PUT") {
    const body = req.body || {};
    if (!Array.isArray(body.categories) || !Array.isArray(body.transactions)) {
      res.status(400).json({ error: "invalid body" });
      return;
    }
    const household = { categories: body.categories, transactions: body.transactions };
    await saveHousehold(session.householdId, household);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "method not allowed" });
};
