const { supabaseAdmin } = require("../supabase");

async function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: "Please log in to continue." });

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(match[1]);
    if (error || !user) return res.status(401).json({ error: "Your session is invalid or expired. Please log in again." });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles").select("id, role, display_name").eq("id", user.id).maybeSingle();
    if (profileError) {
      console.error("Profile lookup failed:", profileError.message);
      return res.status(500).json({ error: "Could not load your account profile." });
    }
    if (!profile) return res.status(403).json({ error: "Your account profile is not set up. Contact the project administrator." });

    req.user = { id: user.id, email: user.email, role: profile.role, displayName: profile.display_name };
    next();
  } catch (error) {
    console.error("Authentication check failed:", error.message);
    return res.status(500).json({ error: "Could not verify your session." });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Only an administrator can perform this action." });
  next();
}

module.exports = { requireAuth, requireAdmin };
