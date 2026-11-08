
const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");

const router = express.Router();
const scryptAsync = promisify(crypto.scrypt);

// Local JSON storage file
const DATA_FILE = path.join(__dirname, "../data/users.json");

// Read users and create storage automatically if missing
async function readUsers() {
    await fs.mkdir(path.dirname(DATA_FILE), {
        recursive: true
    });

    try {
        const data = await fs.readFile(DATA_FILE, "utf8");
        return JSON.parse(data);
    } catch (error) {
        if (error.code === "ENOENT") {
            await fs.writeFile(DATA_FILE, "[]", "utf8");
            return [];
        }

        throw error;
    }
}

// Save users
async function saveUsers(users) {
    await fs.writeFile(
        DATA_FILE,
        JSON.stringify(users, null, 2),
        "utf8"
    );
}

// ==============================
// REGISTER API
// POST /api/auth/register
// ==============================

router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body || {};

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            !name.trim() ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid name, email and password"
            });
        }

        // Password validation
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        const users = await readUsers();

        // Check duplicate email
        const existingUser = users.find(
            user => user.email === cleanEmail
        );

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        // Generate password hash
        const salt = crypto.randomBytes(16).toString("hex");

        const hash = await scryptAsync(password, salt, 64);

        const newUser = {
            id: crypto.randomUUID(),
            name: cleanName,
            email: cleanEmail,
            password: hash.toString("hex"),
            salt: salt,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        await saveUsers(users);

        return res.status(201).json({
            success: true,
            message: "User registered successfully!",
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                createdAt: newUser.createdAt
            }
        });

    } catch (error) {
        console.error("Registration error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error during registration"
        });
    }
});

// ==============================
// LOGIN API
// POST /api/auth/login
// ==============================

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const users = await readUsers();

        const user = users.find(
            u => u.email === email.trim().toLowerCase()
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Verify password
        const hash = await scryptAsync(
            password,
            user.salt,
            64
        );

        const storedHash = Buffer.from(user.password, "hex");

        const passwordMatch =
            storedHash.length === hash.length &&
            crypto.timingSafeEqual(storedHash, hash);

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Login successful!",
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error during login"
        });
    }
});

module.exports = router;
