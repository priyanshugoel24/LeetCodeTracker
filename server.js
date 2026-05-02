const express = require("express");
const path = require("path");
const fs = require("fs");
const { startScheduler, fetchProblemsManual } = require("./fetcherService");

const app = express();
const PORT = process.env.PORT || 3000;

function normalizeDifficulty(value) {
  if (!value) return "Unknown";
  return String(value).trim().toUpperCase();
}

app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "public"));

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
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
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
});
