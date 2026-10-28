const express = require("express");
const { supabaseAdmin } = require("../supabase");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
const allowedCategories = [
  "Classroom / Infrastructure", "Hostel", "Transport", "Cleanliness",
  "Internet / IT", "Fees / Administration", "Academic", "Safety / Security", "Other"
];
const allowedStatuses = ["Submitted", "In Progress", "Resolved", "Rejected"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.use(requireAuth);

// Students can see only their own records. Admins can review all complaints.
router.get("/", async (req, res, next) => {
  try {
    let query = supabaseAdmin.from("complaints")
      .select("id, complaint_code, user_id, title, category, location, description, status, created_at, updated_at")
      .order("created_at", { ascending: false }).limit(200);
    if (req.user.role !== "admin") query = query.eq("user_id", req.user.id);
    const { data, error } = await query;
    if (error) throw error;

    let complaints = data || [];
    if (req.user.role === "admin" && complaints.length) {
      const ids = [...new Set(complaints.map(c => c.user_id))];
      const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (userError) throw userError;
      const emailById = new Map((users.users || []).map(u => [u.id, u.email || ""]));
      complaints = complaints.map(c => ({ ...c, student_email: emailById.get(c.user_id) || "Student" }));
    }
    res.json({ complaints });
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => {
  try {
    const title = cleanString(req.body.title, 120);
    const category = cleanString(req.body.category, 60);
    const location = cleanString(req.body.location || "", 120);
    const description = cleanString(req.body.description, 2000);
    if (!title || title.length < 3) return res.status(400).json({ error: "Title must contain at least 3 characters." });
    if (!allowedCategories.includes(category)) return res.status(400).json({ error: "Choose a valid complaint category." });
    if (!description || description.length < 10) return res.status(400).json({ error: "Description must contain at least 10 characters." });

    const { data, error } = await supabaseAdmin.from("complaints").insert({
      user_id: req.user.id, title, category, location: location || null, description
    }).select("id, complaint_code, title, category, location, description, status, created_at, updated_at").single();
    if (error) throw error;
    res.status(201).json({ complaint: data });
  } catch (error) { next(error); }
});

router.patch("/:id/status", requireAdmin, async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json({ error: "Invalid complaint ID." });
    const status = cleanString(req.body.status, 30);
    if (!allowedStatuses.includes(status)) return res.status(400).json({ error: "Choose a valid complaint status." });
    const { data, error } = await supabaseAdmin.from("complaints")
      .update({ status }).eq("id", req.params.id)
      .select("id, complaint_code, title, status, updated_at").maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Complaint not found." });
    res.json({ complaint: data });
  } catch (error) { next(error); }
});

function cleanString(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
module.exports = router;
