const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL is not set.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:", error);
});

module.exports = pool;