const express = require("express");
const path = require("path");
const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

// Authentication API
app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Codomax running at http://localhost:${PORT}`);
});
