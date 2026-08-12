const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db/database");

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

// SIGN UP
router.post("/signup", async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      displayName,
    } = req.body;

    if (!username || !email || !password || !displayName) {
      return res.status(400).json({
        error: "All fields are required.",
      });
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({
        error:
          "Username must be 3-30 characters and contain only letters, numbers, and underscores.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters.",
      });
    }

    const existingUser = await pool.query(
      `SELECT id
       FROM users
       WHERE LOWER(username) = LOWER($1)
          OR LOWER(email) = LOWER($2)
       LIMIT 1`,
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: "Username or email is already registered.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users
       (username, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING
       id,
       username,
       email,
       display_name,
       bio,
       avatar_url,
       created_at`,
      [username, email.toLowerCase(), passwordHash, displayName]
    );

    const user = result.rows[0];

    const token = createToken(user);

    res.status(201).json({
      message: "Account created successfully.",
      token,
      user,
    });
  } catch (error) {
    console.error("Signup error:", error);

    res.status(500).json({
      error: "Something went wrong while creating your account.",
    });
  }
});


// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required.",
      });
    }

    const result = await pool.query(
      `SELECT *
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    const user = result.rows[0];

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    const token = createToken(user);

    delete user.password_hash;

    res.json({
      message: "Login successful.",
      token,
      user,
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      error: "Something went wrong while logging in.",
    });
  }
});


// CURRENT USER
router.get("/me", async (req, res) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    const token = authorization.replace("Bearer ", "");

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const result = await pool.query(
      `SELECT
        id,
        username,
        email,
        display_name,
        bio,
        avatar_url,
        created_at
       FROM users
       WHERE id = $1`,
      [decoded.id]
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
    console.error("Auth error:", error);

    res.status(401).json({
      error: "Invalid or expired token.",
    });
  }
});

module.exports = router;