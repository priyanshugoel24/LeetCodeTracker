const fetch = require("node-fetch");
const fs = require("fs");

const dotenv = require("dotenv");
dotenv.config();

const LEETCODE_URL = "https://leetcode.com/graphql/";

// 🔑 Replace these with your values
const SESSION = process.env.LEETCODE_SESSION;
const CSRF = process.env.CSRF_TOKEN;

const COOKIE = `LEETCODE_SESSION=${SESSION}; csrftoken=${CSRF}`;

// ✅ Latest working query (V2)
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
      "Origin": "https://leetcode.com",
      "Referer": "https://leetcode.com/problemset/",
      "User-Agent": "Mozilla/5.0",
      "Cookie": COOKIE,
      "x-csrftoken": CSRF,
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

  // 🔍 Debug raw response if needed
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

async function main() {
  let allSolved = [];
  let skip = 0;

  console.log("🚀 Fetching solved problems...");

  while (true) {
    const result = await fetchProblems(skip);

    const questions = result.questions;

    console.log(`Fetched ${questions.length} problems (skip=${skip})`);

    allSolved.push(...questions);

    if (!result.hasMore) break;

    skip += questions.length;

    // small delay to avoid rate limiting
    await new Promise((res) => setTimeout(res, 300));
  }

  console.log(`\n✅ Total solved problems: ${allSolved.length}`);

  // 📁 Save JSON
  fs.writeFileSync(
    "leetcode_solved.json",
    JSON.stringify(allSolved, null, 2)
  );

  // 📄 Save CSV
  const csv = [
    "Title,Slug,Difficulty,AcceptanceRate,Topics",
    ...allSolved.map((q) =>
      `"${q.title.replace(/"/g, '""')}",${q.titleSlug},${q.difficulty},${q.acRate},"${q.topicTags.map(t => t.name).join("|")}"`
    ),
  ].join("\n");

  fs.writeFileSync("leetcode_solved.csv", csv);

  console.log("📦 Exported:");
  console.log(" - leetcode_solved.json");
  console.log(" - leetcode_solved.csv");
}

main().catch((err) => {
  console.error("❌ Script failed:", err.message);
});