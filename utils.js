const { query, run } = require("./db");

function normalizeDifficulty(value) {
  if (!value) return "Unknown";
  const s = String(value).trim().toUpperCase();
  if (s === "EASY" || s === "MEDIUM" || s === "HARD") return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

async function recordSnapshot() {
  try {
    const problems = await query("SELECT difficulty FROM problems");
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const counts = problems.reduce((acc, p) => {
      const d = p.difficulty.toUpperCase();
      if (d === "EASY") acc.easy += 1;
      else if (d === "MEDIUM") acc.medium += 1;
      else if (d === "HARD") acc.hard += 1;
      return acc;
    }, { easy: 0, medium: 0, hard: 0 });

    const total = problems.length;

    await run(
      `INSERT OR REPLACE INTO progress_history (date, total, easy, medium, hard)
       VALUES (?, ?, ?, ?, ?)`,
      [date, total, counts.easy, counts.medium, counts.hard]
    );

    return {
      date,
      total,
      byDifficulty: { Easy: counts.easy, Medium: counts.medium, Hard: counts.hard }
    };
  } catch (err) {
    console.error("❌ Failed to record snapshot:", err.message);
    return null;
  }
}

async function getAllProblems() {
  const problems = await query("SELECT * FROM problems");
  const topicTags = await query("SELECT * FROM topic_tags");
  const userTags = await query("SELECT * FROM user_tags");

  return problems.map(p => ({
    ...p,
    isInMyFavorites: !!p.isInMyFavorites,
    topicTags: topicTags.filter(t => t.problemSlug === p.titleSlug).map(t => ({ name: t.name, slug: t.slug })),
    userTags: userTags.filter(t => t.problemSlug === p.titleSlug).map(t => t.tag)
  }));
}

module.exports = {
  normalizeDifficulty,
  recordSnapshot,
  getAllProblems
};
