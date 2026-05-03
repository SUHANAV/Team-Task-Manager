const jwt = require("jsonwebtoken");
const { JWT_SECRET, COOKIE_NAME } = require("../config");

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function optionalAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) {
    res.locals.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    res.locals.user = payload;
  } catch (error) {
    clearAuthCookie(res);
    res.locals.user = null;
  }

  return next();
}

function requireAuth(options = {}) {
  const { asJson = false } = options;
  return (req, res, next) => {
    if (!req.user) {
      if (asJson) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      return res.redirect("/login");
    }
    return next();
  };
}

function requireAdmin(options = {}) {
  const { asJson = false } = options;
  return (req, res, next) => {
    if (!req.user) {
      if (asJson) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      return res.redirect("/login");
    }
    if (req.user.role !== "Admin") {
      if (asJson) {
        return res.status(403).json({ error: "Forbidden" });
      }
      return res.status(403).render("error", { message: "Admin access required." });
    }
    return next();
  };
}

module.exports = {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  optionalAuth,
  requireAuth,
  requireAdmin,
};
