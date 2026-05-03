require("dotenv").config();

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const { initDb } = require("./db");
const { PORT } = require("./config");
const { optionalAuth } = require("./middleware/auth");
const viewsRouter = require("./routes/views");
const authRouter = require("./routes/auth");
const actionsRouter = require("./routes/actions");
const apiRouter = require("./routes/api");

initDb();

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "..", "public")));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(optionalAuth);

app.use("/", viewsRouter);
app.use("/", authRouter);
app.use("/", actionsRouter);
app.use("/api", apiRouter);

app.use((req, res) => {
  return res.status(404).render("error", { message: "Page not found." });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
