const { put, get } = require("@vercel/blob");
const crypto = require("crypto");

const USERS_PATH = "users/index.json";
const INVITES_PATH = "invites/index.json";

class ConflictError extends Error {}

async function readJson(pathname) {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return { data: null, etag: null };
  const text = await new Response(result.stream).text();
  return { data: JSON.parse(text), etag: result.blob.etag };
}

async function writeJson(pathname, data) {
  return put(pathname, JSON.stringify(data), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
  });
}

// Reads, mutates and writes back a JSON blob. This app has at most a couple of
// writers (one household, one partner), so a plain read-modify-write is simple
// and good enough -- no compare-and-swap.
async function updateJson(pathname, mutateFn, { createDefault } = {}) {
  const { data } = await readJson(pathname);
  const base = data !== null ? data : createDefault ? createDefault() : null;
  const next = await mutateFn(base);
  const blob = await writeJson(pathname, next);
  return { data: next, etag: blob.etag };
}

function newId() {
  return crypto.randomBytes(8).toString("hex");
}

const INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function newInviteCode() {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += INVITE_CODE_CHARS[crypto.randomInt(INVITE_CODE_CHARS.length)];
  }
  return code;
}

const DEFAULT_CATEGORIES = [
  { id: "food", name: "食費", subcategories: [
    { id: "food-eatout", name: "外食" },
    { id: "food-market", name: "スーパー" },
    { id: "food-cafe", name: "カフェ" },
  ]},
  { id: "daily", name: "日用品", subcategories: [
    { id: "daily-misc", name: "雑貨" },
  ]},
  { id: "house", name: "住居費", subcategories: [
    { id: "house-rent", name: "家賃" },
    { id: "house-utility", name: "光熱費" },
  ]},
  { id: "transport", name: "交通費", subcategories: [
    { id: "transport-train", name: "電車・バス" },
  ]},
  { id: "income", name: "収入", subcategories: [
    { id: "income-salary", name: "給与" },
    { id: "income-other", name: "その他収入" },
  ]},
  { id: "other", name: "その他", subcategories: [
    { id: "other-misc", name: "雑費" },
  ]},
];

function createHouseholdData() {
  return {
    categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
    transactions: [],
  };
}

function householdPath(id) {
  return `households/${id}.json`;
}

async function getHousehold(id) {
  const { data, etag } = await readJson(householdPath(id));
  return { household: data, etag };
}

async function saveHousehold(id, household) {
  return writeJson(householdPath(id), household);
}

async function getUsers() {
  const { data, etag } = await readJson(USERS_PATH);
  return { users: data || {}, etag };
}

async function updateUsers(mutateFn) {
  return updateJson(USERS_PATH, mutateFn, { createDefault: () => ({}) });
}

async function getInvites() {
  const { data, etag } = await readJson(INVITES_PATH);
  return { invites: data || {}, etag };
}

async function updateInvites(mutateFn) {
  return updateJson(INVITES_PATH, mutateFn, { createDefault: () => ({}) });
}

module.exports = {
  ConflictError,
  newId,
  newInviteCode,
  createHouseholdData,
  householdPath,
  getHousehold,
  saveHousehold,
  getUsers,
  updateUsers,
  getInvites,
  updateInvites,
};
