const express = require("express");
const { supabaseAdmin, supabaseUrl, anonKey } = require("../supabase");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/signup", async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!emailPattern.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address." });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: "Password must be between 8 and 128 characters." });

    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status === 429 ? 429 : 400).json({ error: safeAuthError(data) });

    if (!data.access_token) {
      return res.status(201).json({ needsEmailConfirmation: true, message: "Account created. Confirm your email before logging in." });
    }
    res.status(201).json({ accessToken: data.access_token, tokenType: data.token_type || "bearer" });
  } catch (error) { next(error); }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!emailPattern.test(email) || !password) return res.status(400).json({ error: "Enter a valid email and password." });

    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) return res.status(401).json({ error: "Login failed. Check your email and password, and confirm your email if required." });
    res.json({ accessToken: data.access_token, tokenType: data.token_type || "bearer" });
  } catch (error) { next(error); }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email, displayName: req.user.displayName }, role: req.user.role });
});

function safeAuthError(data) {
  const message = data?.msg || data?.message || data?.error_description || "";
  if (/already registered|already exists/i.test(message)) return "An account may already exist for this email. Try logging in.";
  if (/password/i.test(message)) return "Password does not meet the authentication requirements.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Please wait and try again.";
  return "Could not create account. Check the details and try again.";
}

module.exports = router;
