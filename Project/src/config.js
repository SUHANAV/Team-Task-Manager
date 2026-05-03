const path = require("path");

const ROOT_DIR = process.cwd();

const PORT = Number(process.env.PORT || 3000);
const DATABASE_PATH = process.env.DATABASE_PATH || path.join(ROOT_DIR, "data", "app.db");
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const COOKIE_NAME = "ttm_auth";

module.exports = {
  PORT,
  DATABASE_PATH,
  JWT_SECRET,
  COOKIE_NAME,
};
