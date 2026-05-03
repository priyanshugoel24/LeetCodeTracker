const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "leetcode.db");
const db = new sqlite3.Database(dbPath);

function initDB() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Problems table
      db.run(`
        CREATE TABLE IF NOT EXISTS problems (
          titleSlug TEXT PRIMARY KEY,
          title TEXT,
          difficulty TEXT,
          acRate REAL,
          status TEXT,
          isInMyFavorites INTEGER DEFAULT 0,
          notes TEXT,
          lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Tags table (LeetCode tags)
      db.run(`
        CREATE TABLE IF NOT EXISTS topic_tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          problemSlug TEXT,
          name TEXT,
          slug TEXT,
          FOREIGN KEY (problemSlug) REFERENCES problems (titleSlug) ON DELETE CASCADE
        )
      `);

      // User Tags table
      db.run(`
        CREATE TABLE IF NOT EXISTS user_tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          problemSlug TEXT,
          tag TEXT,
          FOREIGN KEY (problemSlug) REFERENCES problems (titleSlug) ON DELETE CASCADE,
          UNIQUE(problemSlug, tag)
        )
      `);

      // Progress History table
      db.run(`
        CREATE TABLE IF NOT EXISTS progress_history (
          date TEXT PRIMARY KEY,
          total INTEGER,
          easy INTEGER,
          medium INTEGER,
          hard INTEGER
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

module.exports = {
  db,
  initDB,
  query,
  run
};
