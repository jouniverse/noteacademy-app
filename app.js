const express = require("express");
const app = express();
const mustacheExpress = require("mustache-express");
const bodyParser = require("body-parser");
const pgp = require("pg-promise")();
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const path = require("path");
const checkAuthorization = require("./utils/authorization");
require("dotenv").config();

const userRoutes = require("./routes/users");
const indexRoutes = require("./routes/index");

const PORT = process.env.PORT || 3000;
const CONNECTION_STRING = process.env.DATABASE_URL;

// Database connection
const db = pgp(CONNECTION_STRING);
global.db = db;

const VIEWS_PATH = path.join(__dirname, "/views");

// configuring your view engine
app.engine("mustache", mustacheExpress(VIEWS_PATH + "/partials", ".mustache"));
app.set("views", VIEWS_PATH);
app.set("view engine", "mustache");

// Serve static files
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/imgs", express.static(path.join(__dirname, "imgs")));

// Session configuration
app.use(
  session({
    store: new pgSession({
      pgPromise: db, // Use existing pg-promise instance
      tableName: "session", // Name of the session table
      createTableIfMissing: true, // Auto-create the session table
    }),
    secret: process.env.SESSION_SECRET || "lhadhlsdalh",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: "lax", // Protection against CSRF
    },
  })
);

app.use(bodyParser.urlencoded({ extended: false }));

app.use((req, res, next) => {
  res.locals.authenticated = req.session.user == null ? false : true;
  next();
});

// setup routes
app.use("/", indexRoutes);
app.use("/users", checkAuthorization, userRoutes);

// Start the server only if not being run by Vercel
if (process.env.VERCEL_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server has started on ${PORT}`);
  });
}

// Export the app for Vercel
module.exports = app;
