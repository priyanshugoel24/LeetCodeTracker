const fs = require("fs");
const { initDB, run, query } = require("./db");

async function migrate() {
  console.log("🚀 Starting migration from JSON to SQLite...");
  await initDB();

  if (fs.existsSync("data.json")) {
    const problems = JSON.parse(fs.readFileSync("data.json", "utf-8"));
    console.log(`Found ${problems.length} problems in data.json`);

    for (const p of problems) {
      await run(
        `INSERT OR REPLACE INTO problems (titleSlug, title, difficulty, acRate, status, isInMyFavorites)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [p.titleSlug, p.title, p.difficulty, p.acRate, p.status, p.isInMyFavorites ? 1 : 0]
      );

      // Topic tags
      if (p.topicTags) {
        // Clear old ones first to avoid duplicates if re-running
        await run("DELETE FROM topic_tags WHERE problemSlug = ?", [p.titleSlug]);
        for (const tag of p.topicTags) {
          await run(
            "INSERT INTO topic_tags (problemSlug, name, slug) VALUES (?, ?, ?)",
            [p.titleSlug, tag.name, tag.slug]
          );
        }
      }

      // User tags
      if (p.userTags) {
        await run("DELETE FROM user_tags WHERE problemSlug = ?", [p.titleSlug]);
        for (const tag of p.userTags) {
          await run(
            "INSERT INTO user_tags (problemSlug, tag) VALUES (?, ?)",
            [p.titleSlug, tag]
          );
        }
      }
    }
  }

  if (fs.existsSync("progress_history.json")) {
    const history = JSON.parse(fs.readFileSync("progress_history.json", "utf-8"));
    console.log(`Found ${history.length} snapshots in progress_history.json`);

    for (const h of history) {
      await run(
        `INSERT OR REPLACE INTO progress_history (date, total, easy, medium, hard)
         VALUES (?, ?, ?, ?, ?)`,
        [h.date, h.total, h.byDifficulty.Easy, h.byDifficulty.Medium, h.byDifficulty.Hard]
      );
    }
  }

  console.log("✅ Migration complete!");
}

migrate().catch(console.error);
