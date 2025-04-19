const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

// async and await function
router.post("/delete-article", async (req, res) => {
  let articleId = req.body.articleId;

  await db.none("DELETE FROM articles WHERE articleid = $1", [articleId]);
  res.redirect("/users/articles");
});

router.get("/add-article", (req, res) => {
  res.render("add-article");
});

router.post("/add-article", (req, res) => {
  let title = req.body.title;
  let description = req.body.description;
  let userId = req.session.user.userId;

  db.none("INSERT INTO articles(title,body,userid) VALUES($1,$2,$3)", [
    title,
    description,
    userId,
  ]).then(() => {
    res.redirect("/users/articles");
  });
});

router.post("/update-article", (req, res) => {
  let title = req.body.title;
  let description = req.body.description;
  let articleId = req.body.articleId;

  db.none(
    "UPDATE articles SET title = $1, body = $2, dateupdated = CURRENT_TIMESTAMP WHERE articleid = $3",
    [title, description, articleId]
  ).then(() => {
    res.redirect("/users/articles");
  });
});

router.get("/articles/edit/:articleId", (req, res) => {
  let articleId = req.params.articleId;

  db.one("SELECT articleid,title,body FROM articles WHERE articleid = $1", [
    articleId,
  ]).then((article) => {
    res.render("edit-article", article);
  });
});

router.get("/articles", (req, res) => {
  let userId = req.session.user.userId;

  db.any(
    "SELECT articleid, title, body, datecreated, dateupdated FROM articles WHERE userid = $1 ORDER BY dateupdated DESC",
    [userId]
  ).then((articles) => {
    // Format dates and prepare preview text
    articles = articles.map((article) => {
      return {
        ...article,
        preview:
          article.body.length > 200
            ? article.body.substring(0, 200) + "..."
            : article.body,
        hasMoreContent: article.body.length > 200,
        datecreated: new Date(article.datecreated).toLocaleString(),
        dateupdated: new Date(article.dateupdated).toLocaleString(),
      };
    });
    res.render("articles", { articles: articles });
  });
});

// Settings page
router.get("/settings", (req, res) => {
  res.render("settings");
});

// Change username
router.post("/change-username", async (req, res) => {
  const newUsername = req.body.newUsername;
  const userId = req.session.user.userId;

  try {
    // Check if username already exists
    const existingUser = await db.oneOrNone(
      "SELECT userid FROM users WHERE username = $1",
      [newUsername]
    );
    if (existingUser) {
      return res.render("settings", { message: "Username already exists" });
    }

    await db.none("UPDATE users SET username = $1 WHERE userid = $2", [
      newUsername,
      userId,
    ]);
    req.session.user.username = newUsername;
    res.redirect("/users/settings");
  } catch (error) {
    res.render("settings", { message: "Error updating username" });
  }
});

// Change password
router.post("/change-password", async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const userId = req.session.user.userId;

  if (newPassword !== confirmPassword) {
    return res.render("settings", { message: "New passwords do not match" });
  }

  try {
    const user = await db.one("SELECT password FROM users WHERE userid = $1", [
      userId,
    ]);

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.render("settings", {
        message: "Current password is incorrect",
      });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await db.none("UPDATE users SET password = $1 WHERE userid = $2", [
      hash,
      userId,
    ]);
    res.redirect("/users/settings");
  } catch (error) {
    res.render("settings", { message: "Error updating password" });
  }
});

// Delete account
router.post("/delete-account", async (req, res) => {
  const password = req.body.password;
  const userId = req.session.user.userId;

  try {
    const user = await db.one("SELECT password FROM users WHERE userid = $1", [
      userId,
    ]);

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render("settings", { message: "Incorrect password" });
    }

    // Delete user's articles first (due to foreign key constraint)
    await db.none("DELETE FROM articles WHERE userid = $1", [userId]);
    // Delete user
    await db.none("DELETE FROM users WHERE userid = $1", [userId]);

    req.session.destroy();
    res.redirect("/");
  } catch (error) {
    res.render("settings", { message: "Error deleting account" });
  }
});

module.exports = router;
