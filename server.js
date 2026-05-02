const express = require("express");
const path = require("path");
const fs = require("fs");
const { startScheduler, fetchProblemsManual } = require("./fetcherService");

const app = express();
const PORT = process.env.PORT || 3000;
const CREDENTIALS_FILE = ".credentials.json";
const REACT_DIST_DIR = path.join(__dirname, "frontend", "dist");
const LEGACY_PUBLIC_DIR = path.join(__dirname, "public");

function normalizeDifficulty(value) {
  if (!value) return "Unknown";
  return String(value).trim().toUpperCase();
}

function getCredentials() {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
    }
  } catch (err) {
    console.warn("Could not read credentials file:", err.message);
  }
  return {
    session: process.env.LEETCODE_SESSION || "",
    csrf: process.env.CSRF_TOKEN || "",
  };
}

function saveCredentials(session, csrf) {
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify({ session, csrf }, null, 2));
}

app.use(express.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "public"));

// Serve static assets from both legacy public/ and React build when available.
app.use(express.static(LEGACY_PUBLIC_DIR, { index: false }));
if (fs.existsSync(REACT_DIST_DIR)) {
  app.use(express.static(REACT_DIST_DIR, { index: false }));
}

// 📊 API: Get all problems
app.get("/api/problems", (req, res) => {
  try {
    const data = fs.readFileSync("data.json", "utf-8");
    const problems = JSON.parse(data);
    res.json(problems);
  } catch (err) {
    res.json([]);
  }
});

// 📈 API: Get analytics
app.get("/api/analytics", (req, res) => {
  try {
    const data = fs.readFileSync("data.json", "utf-8");
    const problems = JSON.parse(data);

    const difficultyCounts = problems.reduce(
      (counts, problem) => {
        const difficulty = normalizeDifficulty(problem.difficulty);

        if (difficulty === "EASY") counts.Easy += 1;
        else if (difficulty === "MEDIUM") counts.Medium += 1;
        else if (difficulty === "HARD") counts.Hard += 1;

        return counts;
      },
      { Easy: 0, Medium: 0, Hard: 0 }
    );

    const analytics = {
      totalSolved: problems.length,
      byDifficulty: difficultyCounts,
      byTopic: {},
      avgAcceptanceRate:
        problems.length > 0
          ? (
              problems.reduce((sum, p) => sum + parseFloat(p.acRate || 0), 0) /
              problems.length
            ).toFixed(2)
          : 0,
      lastUpdated: getLastUpdated(),
    };

    // Count by topic
    problems.forEach((p) => {
      if (p.topicTags && p.topicTags.length > 0) {
        p.topicTags.forEach((tag) => {
          analytics.byTopic[tag.name] = (analytics.byTopic[tag.name] || 0) + 1;
        });
      }
    });

    res.json(analytics);
  } catch (err) {
    res.json({
      totalSolved: 0,
      byDifficulty: { Easy: 0, Medium: 0, Hard: 0 },
      byTopic: {},
      avgAcceptanceRate: 0,
      lastUpdated: null,
    });
  }
});

// 🗄️ API: Export problems as CSV or JSON
app.get("/api/export", (req, res) => {
  try {
    const format = (req.query.format || "csv").toLowerCase();
    const data = fs.readFileSync("data.json", "utf-8");
    const problems = JSON.parse(data || "[]");

    if (format === "json") {
      res.setHeader("Content-Disposition", "attachment; filename=leetcode_solved.json");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.send(JSON.stringify(problems, null, 2));
    }

    // Default: CSV
    const headers = ["title", "titleSlug", "difficulty", "acRate", "topics"];
    const rows = problems.map((p) => {
      const topics = (p.topicTags || []).map((t) => t.name).join(";");
      const ac = p.acRate ? (Number(p.acRate) * 100).toFixed(2) + "%" : "";
      return [
        String(p.title || "").replace(/"/g, '""'),
        String(p.titleSlug || "").replace(/"/g, '""'),
        String(p.difficulty || "").replace(/"/g, '""'),
        ac,
        String(topics || "").replace(/"/g, '""'),
      ];
    });

    const csvLines = [headers.join(",")].concat(
      rows.map((r) => r.map((c) => `"${c}"`).join(","))
    );

    const csv = csvLines.join("\n");
    res.setHeader("Content-Disposition", "attachment; filename=leetcode_solved.csv");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Toggle favorite for a problem
app.post("/api/problem/:slug/favorite", (req, res) => {
  try {
    const slug = req.params.slug;
    const data = fs.readFileSync("data.json", "utf-8");
    const problems = JSON.parse(data || "[]");
    const idx = problems.findIndex((p) => p.titleSlug === slug);
    if (idx === -1) return res.status(404).json({ success: false, error: "Problem not found" });

    problems[idx].isInMyFavorites = !problems[idx].isInMyFavorites;
    fs.writeFileSync("data.json", JSON.stringify(problems, null, 2));
    res.json({ success: true, isFavorite: problems[idx].isInMyFavorites });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🏷️ Set tags for a problem (replace user's tags)
app.post("/api/problem/:slug/tags", (req, res) => {
  try {
    const slug = req.params.slug;
    const { tags } = req.body;
    if (!Array.isArray(tags)) return res.status(400).json({ success: false, error: "tags must be an array" });

    const data = fs.readFileSync("data.json", "utf-8");
    const problems = JSON.parse(data || "[]");
    const idx = problems.findIndex((p) => p.titleSlug === slug);
    if (idx === -1) return res.status(404).json({ success: false, error: "Problem not found" });

    // store user tags in `userTags` field (array of strings)
    problems[idx].userTags = tags.map((t) => String(t).trim()).filter(Boolean);
    fs.writeFileSync("data.json", JSON.stringify(problems, null, 2));
    res.json({ success: true, userTags: problems[idx].userTags });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ➖ Remove a single user tag from a problem
app.post("/api/problem/:slug/tag/remove", (req, res) => {
  try {
    const slug = req.params.slug;
    const { tag } = req.body;
    if (!tag) return res.status(400).json({ success: false, error: "tag is required" });

    const data = fs.readFileSync("data.json", "utf-8");
    const problems = JSON.parse(data || "[]");
    const idx = problems.findIndex((p) => p.titleSlug === slug);
    if (idx === -1) return res.status(404).json({ success: false, error: "Problem not found" });

    const existing = problems[idx].userTags || [];
    const updated = existing.filter((t) => t !== tag);
    problems[idx].userTags = updated;
    fs.writeFileSync("data.json", JSON.stringify(problems, null, 2));
    res.json({ success: true, userTags: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📈 Progress history: returns recorded snapshots
app.get("/api/progress", (req, res) => {
  try {
    const file = "progress_history.json";
    if (!fs.existsSync(file)) return res.json([]);
    const raw = fs.readFileSync(file, "utf-8");
    const history = JSON.parse(raw || "[]");
    res.json(history);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📝 Record a snapshot of current solved count (date, total, byDifficulty)
app.post("/api/progress/record", (req, res) => {
  try {
    const data = fs.readFileSync("data.json", "utf-8");
    const problems = JSON.parse(data || "[]");
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const byDifficulty = problems.reduce((acc, p) => {
      const d = normalizeDifficulty(p.difficulty);
      if (d === "EASY") acc.Easy += 1;
      else if (d === "MEDIUM") acc.Medium += 1;
      else if (d === "HARD") acc.Hard += 1;
      return acc;
    }, { Easy: 0, Medium: 0, Hard: 0 });

    const snapshot = {
      date,
      total: problems.length,
      byDifficulty,
    };

    const file = "progress_history.json";
    let history = [];
    if (fs.existsSync(file)) {
      history = JSON.parse(fs.readFileSync(file, "utf-8") || "[]");
      // prevent duplicate date entries
      if (history.length > 0 && history[history.length - 1].date === date) {
        history[history.length - 1] = snapshot;
      } else {
        history.push(snapshot);
      }
    } else {
      history = [snapshot];
    }

    fs.writeFileSync(file, JSON.stringify(history, null, 2));
    res.json({ success: true, snapshot });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🔄 API: Manual fetch
app.post("/api/fetch", async (req, res) => {
  try {
    console.log("🔄 Manual fetch triggered...");
    await fetchProblemsManual();
    res.json({ success: true, message: "Problems fetched successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📄 Main dashboard
app.get("/", (req, res) => {
  if (fs.existsSync(path.join(REACT_DIST_DIR, "index.html"))) {
    return res.sendFile(path.join(REACT_DIST_DIR, "index.html"));
  }
  return res.sendFile(path.join(LEGACY_PUBLIC_DIR, "index.html"));
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// 🔐 Admin panel to update credentials
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.post("/admin/update-credentials", (req, res) => {
  const { session, csrf, password } = req.body;

  // Simple password protection
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  if (password !== adminPassword) {
    return res.status(401).json({ success: false, error: "Invalid password" });
  }

  if (!session || !csrf) {
    return res.status(400).json({
      success: false,
      error: "Session and CSRF token are required",
    });
  }

  try {
    saveCredentials(session, csrf);
    process.env.LEETCODE_SESSION = session;
    process.env.CSRF_TOKEN = csrf;
    res.json({
      success: true,
      message: "Credentials updated successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// React SPA fallback for non-API routes except admin.
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/admin") || req.path === "/health") {
    return next();
  }
  const indexPath = path.join(REACT_DIST_DIR, "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return next();
});

function getLastUpdated() {
  try {
    const stats = fs.statSync("data.json");
    return stats.mtime.toLocaleString();
  } catch {
    return "Never";
  }
}

// Start scheduler on server startup
startScheduler();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Dashboard running on port ${PORT}`);
  console.log(`📊 Local URL: http://localhost:${PORT}`);
  console.log(`🔐 Admin panel: http://localhost:${PORT}/admin`);
});

module.exports = {
  getCredentials,
  saveCredentials,
};
