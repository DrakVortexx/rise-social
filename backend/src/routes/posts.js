const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../db/database");

const router = express.Router();

function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    const token = header.split(" ")[1];

    req.user = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    next();
  } catch {
    return res.status(401).json({
      error: "Invalid or expired token.",
    });
  }
}


// CREATE POST
router.post("/", authenticate, async (req, res) => {
  try {
    const content = String(req.body.content || "").trim();

    if (!content) {
      return res.status(400).json({
        error: "Post cannot be empty.",
      });
    }

    if (content.length > 500) {
      return res.status(400).json({
        error: "Post cannot exceed 500 characters.",
      });
    }

    const result = await pool.query(
      `INSERT INTO posts (user_id, content)
       VALUES ($1, $2)
       RETURNING id, user_id, content, created_at`,
      [req.user.id, content]
    );

    res.status(201).json({
      post: result.rows[0],
    });
  } catch (error) {
    console.error("Create post error:", error);

    res.status(500).json({
      error: "Failed to create post.",
    });
  }
});


// GET FEED
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        posts.id,
        posts.content,
        posts.created_at,

        users.id AS user_id,
        users.username,
        users.display_name,
        users.avatar_url,

        COUNT(likes.post_id)::int AS like_count

      FROM posts

      JOIN users
        ON users.id = posts.user_id

      LEFT JOIN likes
        ON likes.post_id = posts.id

      GROUP BY
        posts.id,
        users.id

      ORDER BY posts.created_at DESC

      LIMIT 50
    `);

    res.json({
      posts: result.rows,
    });
  } catch (error) {
    console.error("Get posts error:", error);

    res.status(500).json({
      error: "Failed to load posts.",
    });
  }
});


// DELETE OWN POST
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM posts
       WHERE id = $1
       AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Post not found.",
      });
    }

    res.json({
      message: "Post deleted.",
    });
  } catch (error) {
    console.error("Delete post error:", error);

    res.status(500).json({
      error: "Failed to delete post.",
    });
  }
});


module.exports = router;