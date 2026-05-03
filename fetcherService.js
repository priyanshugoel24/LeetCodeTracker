const fetch = require("node-fetch");
const fs = require("fs");
const cron = require("node-cron");
const dotenv = require("dotenv");
const { recordSnapshot } = require("./utils");
const { run } = require("./db");

dotenv.config();

const LEETCODE_URL = "https://leetcode.com/graphql/";

function getCredentials() {
  try {
    if (fs.existsSync(".credentials.json")) {
      const creds = JSON.parse(fs.readFileSync(".credentials.json", "utf-8"));
      return { session: creds.session, csrf: creds.csrf };
    }
  } catch (err) {
    console.warn("Could not read credentials file, using env vars");
  }
  return {
    session: process.env.LEETCODE_SESSION || "",
    csrf: process.env.CSRF_TOKEN || "",
  };
}

function getCookie() {
  const creds = getCredentials();
  return `LEETCODE_SESSION=${creds.session}; csrftoken=${creds.csrf}`;
}

const query = `
query problemsetQuestionListV2($filters: QuestionFilterInput, $limit: Int, $searchKeyword: String, $skip: Int, $sortBy: QuestionSortByInput, $categorySlug: String) {
  problemsetQuestionListV2(
    filters: $filters
    limit: $limit
    searchKeyword: $searchKeyword
    skip: $skip
    sortBy: $sortBy
    categorySlug: $categorySlug
  ) {
    questions {
      title
      titleSlug
      difficulty
      status
      topicTags {
        name
        slug
      }
      acRate
      frequency
    }
    totalLength
    hasMore
  }
}
`;

async function fetchProblems(skip) {
  const res = await fetch(LEETCODE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://leetcode.com",
      Referer: "https://leetcode.com/problemset/",
      "User-Agent": "Mozilla/5.0",
      Cookie: getCookie(),
      "x-csrftoken": getCredentials().csrf,
    },
    body: JSON.stringify({
      operationName: "problemsetQuestionListV2",
      query,
      variables: {
        skip,
        limit: 100,
        categorySlug: "all-code-essentials",
        filters: {
          filterCombineType: "ALL",
          statusFilter: {
            questionStatuses: ["SOLVED"],
            operator: "IS",
          },
        },
        searchKeyword: "",
        sortBy: {
          sortField: "CUSTOM",
          sortOrder: "ASCENDING",
        },
      },
    }),
  });

  const text = await res.text();

  if (!text.startsWith("{")) {
    console.error("❌ Non-JSON response (likely blocked):");
    console.log(text);
    throw new Error("Blocked or invalid response");
  }

  const data = JSON.parse(text);

  if (!data.data) {
    console.error("❌ GraphQL Error:", data.errors);
    throw new Error("GraphQL failed");
  }

  return data.data.problemsetQuestionListV2;
}

async function fetchProblemsManual() {
  let allFetched = [];
  let skip = 0;

  console.log("🚀 Fetching solved problems from LeetCode...");

  try {
    while (true) {
      const result = await fetchProblems(skip);
      const questions = result.questions;

      console.log(`Fetched ${questions.length} problems (skip=${skip})`);
      allFetched.push(...questions);

      if (!result.hasMore) break;

      skip += questions.length;
      await new Promise((res) => setTimeout(res, 300));
    }

    console.log(`\n✅ Total solved problems fetched: ${allFetched.length}`);

    // Update SQLite database
    for (const q of allFetched) {
      // Update problem basic info (don't overwrite isInMyFavorites)
      await run(
        `INSERT INTO problems (titleSlug, title, difficulty, acRate, status)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(titleSlug) DO UPDATE SET
           title = excluded.title,
           difficulty = excluded.difficulty,
           acRate = excluded.acRate,
           status = excluded.status,
           lastUpdated = CURRENT_TIMESTAMP`,
        [q.titleSlug, q.title, q.difficulty, q.acRate, q.status]
      );

      // Update topic tags
      await run("DELETE FROM topic_tags WHERE problemSlug = ?", [q.titleSlug]);
      for (const tag of q.topicTags) {
        await run(
          "INSERT INTO topic_tags (problemSlug, name, slug) VALUES (?, ?, ?)",
          [q.titleSlug, tag.name, tag.slug]
        );
      }
    }

    console.log("📦 Saved to SQLite database");

    // Record snapshot for progress history
    await recordSnapshot();
    console.log("📈 Progress snapshot recorded");

    return allFetched;
  } catch (err) {
    console.error("❌ Fetch failed:", err.message);
    throw err;
  }
}

function startScheduler() {
  // ⏰ Run daily at 2 AM
  cron.schedule("0 2 * * *", async () => {
    console.log("\n⏰ Daily fetch scheduled...");
    try {
      await fetchProblemsManual();
      console.log("✅ Daily fetch and snapshot completed");
    } catch (err) {
      console.error("❌ Daily fetch failed:", err.message);
    }
  });

  console.log("📅 Scheduler started - will fetch daily at 2:00 AM");
}

module.exports = {
  fetchProblemsManual,
  startScheduler,
};
