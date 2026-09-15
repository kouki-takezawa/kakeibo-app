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
    let { household, etag } = await getHousehold(session.householdId);
    if (!household) {
      household = createHouseholdData();
      const blob = await saveHousehold(session.householdId, household);
      etag = blob.etag;
    }
    res.setHeader("X-Data-Etag", etag);
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
    const clientEtag = req.headers["x-data-etag"];

    try {
      const blob = await saveHousehold(session.householdId, household, clientEtag || undefined);
      res.setHeader("X-Data-Etag", blob.etag);
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(409).json({
        error: "ほかの端末での変更と競合しました。画面を再読み込みしてからやり直してください",
      });
    }
    return;
  }

  res.status(405).json({ error: "method not allowed" });
};
