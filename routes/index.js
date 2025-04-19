const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const fetch = require("node-fetch");

const SALT_ROUNDS = 10;

// async and await function
router.get("/", async (req, res) => {
  if (req.session.user) {
    try {
      // Fetch top stories from Hacker News
      const response = await fetch(
        "https://hacker-news.firebaseio.com/v0/topstories.json"
      );
      const storyIds = await response.json();

      // Get details for top 10 stories
      const topStories = await Promise.all(
        storyIds.slice(0, 10).map(async (id) => {
          const storyResponse = await fetch(
            `https://hacker-news.firebaseio.com/v0/item/${id}.json`
          );
          return storyResponse.json();
        })
      );

      res.render("index", {
        authenticated: true,
        stories: topStories,
      });
    } catch (error) {
      console.error("Error fetching Hacker News:", error);
      res.render("index", {
        authenticated: true,
        error: "Failed to load Hacker News stories",
      });
    }
  } else {
    res.render("index", {
      authenticated: false,
    });
  }
});

router.get("/logout", (req, res, next) => {
  if (req.session) {
    req.session.destroy((error) => {
      if (error) {
        next(error);
      } else {
        res.redirect("/login");
      }
    });
  }
});

router.get("/register", (req, res) => {
  res.render("register");
});

router.get("/login", (req, res) => {
  res.render("login");
});

router.post("/register", (req, res) => {
  let username = req.body.username;
  let password = req.body.password;

  db.oneOrNone("SELECT userid FROM users WHERE username = $1", [username]).then(
    (user) => {
      if (user) {
        res.render("register", { message: "User name already exists!" });
      } else {
        // insert user into the users table

        bcrypt.hash(password, SALT_ROUNDS, function (error, hash) {
          if (error == null) {
            db.none("INSERT INTO users(username,password) VALUES($1,$2)", [
              username,
              hash,
            ]).then(() => {
              res.redirect("/users/articles");
            });
          }
        });
      }
    }
  );
});

router.post("/login", (req, res) => {
  let username = req.body.username;
  let password = req.body.password;

  db.oneOrNone(
    "SELECT userid,username,password FROM users WHERE username = $1",
    [username]
  ).then((user) => {
    if (user) {
      // check for user's password

      bcrypt.compare(password, user.password, function (error, result) {
        if (result) {
          // put username and userId in the session
          if (req.session) {
            req.session.user = { userId: user.userid, username: user.username };
          }

          res.redirect("/users/articles");
        } else {
          res.render("login", { message: "Invalid username or password!" });
        }
      });
    } else {
      // user does not exist
      res.render("login", { message: "Invalid username or password!" });
    }
  });
});

module.exports = router;
