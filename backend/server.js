const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "RISE API",
    status: "online",
    version: "1.0.0",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "RISE backend is running",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RISE API running on port ${PORT}`);
});