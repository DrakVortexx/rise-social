require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./src/db/database");

const authRoutes = require("./src/routes/auth");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());


// ------------------------------------------------------------
// ROOT
// ------------------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    name: "RISE API",
    status: "online",
    version: "1.0.0",
  });
});


// ------------------------------------------------------------
// HEALTH CHECK
// ------------------------------------------------------------

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      status: "ok",
      database: "connected",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});


// ------------------------------------------------------------
// AUTH
// ------------------------------------------------------------

app.use("/api/auth", authRoutes);


// ------------------------------------------------------------
// 404
// ------------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found.",
  });
});


// ------------------------------------------------------------
// SERVER
// ------------------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RISE API running on port ${PORT}`);
});