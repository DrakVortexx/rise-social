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


// SEARCH USERS
router.get("/search", async (req, res) => {
  try {
    const query = (req.query.q || "").trim();

    if (!query || query.length < 1) {
      return res.json({
        users: [],
      });
    }

    const result = await pool.query(
      `SELECT
        id,
        username,
        display_name,
        avatar_url
      FROM users
      WHERE 
        LOWER(username) LIKE LOWER($1) OR
        LOWER(display_name) LIKE LOWER($1)
      LIMIT 20`,
      [`%${query}%`]
    );

    res.json({
      users: result.rows,
    });
  } catch (error) {
    console.error("Search users error:", error);

    res.status(500).json({
      error: "Failed to search users.",
    });
  }
});


// GET USER PROFILE
router.get("/:username", async (req, res) => {
  try {
    const username = req.params.username;

    const userResult = await pool.query(
      `SELECT
        id,
        username,
        display_name,
        bio,
        avatar_url,
        created_at
      FROM users
      WHERE LOWER(username) = LOWER($1)
      LIMIT 1`,
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    const user = userResult.rows[0];

    // Get follower count
    const followerResult = await pool.query(
      `SELECT COUNT(*)::int AS count
      FROM followers
      WHERE following_id = $1`,
      [user.id]
    );

    // Get following count
    const followingResult = await pool.query(
      `SELECT COUNT(*)::int AS count
      FROM followers
      WHERE follower_id = $1`,
      [user.id]
    );

    // Get post count
    const postResult = await pool.query(
      `SELECT COUNT(*)::int AS count
      FROM posts
      WHERE user_id = $1`,
      [user.id]
    );

    // Get current user's follow status
    let isFollowing = false;
    const currentUserId = req.headers.authorization
      ? jwt.verify(
          req.headers.authorization.split(" ")[1],
          process.env.JWT_SECRET
        ).id
      : null;

    if (currentUserId && currentUserId !== user.id) {
      const followResult = await pool.query(
        `SELECT 1 FROM followers
        WHERE follower_id = $1 AND following_id = $2`,
        [currentUserId, user.id]
      );
      isFollowing = followResult.rows.length > 0;
    }

    res.json({
      user: {
        ...user,
        follower_count: followerResult.rows[0].count,
        following_count: followingResult.rows[0].count,
        post_count: postResult.rows[0].count,
        is_following: isFollowing,
      },
    });
  } catch (error) {
    console.error("Get user profile error:", error);

    res.status(500).json({
      error: "Failed to load user profile.",
    });
  }
});


// GET USER'S POSTS
router.get("/:username/posts", async (req, res) => {
  try {
    const username = req.params.username;
    const userId = req.headers.authorization
      ? jwt.verify(
          req.headers.authorization.split(" ")[1],
          process.env.JWT_SECRET
        ).id
      : null;

    // Get user ID from username
    const userResult = await pool.query(
      `SELECT id FROM users WHERE LOWER(username) = LOWER($1)`,
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    const targetUserId = userResult.rows[0].id;

    // Get posts
    const result = await pool.query(
      `SELECT
        posts.id,
        posts.content,
        posts.created_at,
        users.id AS user_id,
        users.username,
        users.display_name,
        users.avatar_url,
        COUNT(DISTINCT likes.post_id)::int AS like_count,
        COUNT(DISTINCT comments.id)::int AS comment_count,
        EXISTS(
          SELECT 1 FROM likes 
          WHERE likes.post_id = posts.id 
          AND likes.user_id = $2
        )::boolean AS liked_by_me
      FROM posts
      JOIN users ON users.id = posts.user_id
      LEFT JOIN likes ON likes.post_id = posts.id
      LEFT JOIN comments ON comments.post_id = posts.id
      WHERE posts.user_id = $1
      GROUP BY posts.id, users.id
      ORDER BY posts.created_at DESC
      LIMIT 50`,
      [targetUserId, userId || null]
    );

    res.json({
      posts: result.rows,
    });
  } catch (error) {
    console.error("Get user posts error:", error);

    res.status(500).json({
      error: "Failed to load user posts.",
    });
  }
});


// UPDATE PROFILE (AUTHENTICATED)
router.put("/me/profile", authenticate, async (req, res) => {
  try {
    const { display_name, bio, avatar_url } = req.body;

    if (!display_name || display_name.trim().length === 0) {
      return res.status(400).json({
        error: "Display name is required.",
      });
    }

    if (display_name.length > 50) {
      return res.status(400).json({
        error: "Display name cannot exceed 50 characters.",
      });
    }

    if (bio && bio.length > 160) {
      return res.status(400).json({
        error: "Bio cannot exceed 160 characters.",
      });
    }

    const result = await pool.query(
      `UPDATE users
      SET 
        display_name = $1,
        bio = COALESCE($2, bio),
        avatar_url = COALESCE($3, avatar_url)
      WHERE id = $4
      RETURNING
        id,
        username,
        email,
        display_name,
        bio,
        avatar_url,
        created_at`,
      [
        display_name.trim(),
        bio ? bio.trim() : null,
        avatar_url || null,
        req.user.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    res.json({
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Update profile error:", error);

    res.status(500).json({
      error: "Failed to update profile.",
    });
  }
});


// FOLLOW USER
router.post("/:username/follow", authenticate, async (req, res) => {
  try {
    const username = req.params.username;
    const followerId = req.user.id;

    // Get the user to follow
    const userResult = await pool.query(
      `SELECT id FROM users WHERE LOWER(username) = LOWER($1)`,
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    const followingId = userResult.rows[0].id;

    // Prevent self-following
    if (followerId === followingId) {
      return res.status(400).json({
        error: "You cannot follow yourself.",
      });
    }

    // Try to insert follow
    await pool.query(
      `INSERT INTO followers (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [followerId, followingId]
    );

    res.json({ message: "User followed." });
  } catch (error) {
    console.error("Follow user error:", error);

    res.status(500).json({
      error: "Failed to follow user.",
    });
  }
});


// UNFOLLOW USER
router.delete("/:username/follow", authenticate, async (req, res) => {
  try {
    const username = req.params.username;
    const followerId = req.user.id;

    // Get the user to unfollow
    const userResult = await pool.query(
      `SELECT id FROM users WHERE LOWER(username) = LOWER($1)`,
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    const followingId = userResult.rows[0].id;

    await pool.query(
      `DELETE FROM followers
       WHERE follower_id = $1 AND following_id = $2`,
      [followerId, followingId]
    );

    res.json({ message: "User unfollowed." });
  } catch (error) {
    console.error("Unfollow user error:", error);

    res.status(500).json({
      error: "Failed to unfollow user.",
    });
  }
});


module.exports = router;
