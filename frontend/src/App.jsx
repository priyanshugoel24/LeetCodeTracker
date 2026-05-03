import { useEffect, useMemo, useState, Fragment } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement
);

const defaultAnalytics = {
  totalSolved: 0,
  byDifficulty: { Easy: 0, Medium: 0, Hard: 0 },
  byTopic: {},
  avgAcceptanceRate: 0,
  lastUpdated: "Never",
};

export default function App() {
  const [problems, setProblems] = useState([]);
  const [analytics, setAnalytics] = useState(defaultAnalytics);
  const [progress, setProgress] = useState([]);
  const [tagDraft, setTagDraft] = useState({});
  const [expanded, setExpanded] = useState({});
  const [notesDraft, setNotesDraft] = useState({});
  const [filters, setFilters] = useState({
    q: "",
    difficulty: "",
    topic: "",
    sort: "",
    acMin: "",
    acMax: "",
    revisionOnly: false,
  });

  useEffect(() => {
    const saved = localStorage.getItem("lc-dark-mode");
    if (saved === "true") document.documentElement.classList.add("dark");
    loadAll();
    loadProgress();
  }, []);

  async function loadAll() {
    const [pRes, aRes] = await Promise.all([fetch("/api/problems"), fetch("/api/analytics")]);
    setProblems(await pRes.json());
    setAnalytics(await aRes.json());
  }

  async function loadProgress() {
    const res = await fetch("/api/progress");
    setProgress(await res.json());
  }

  const topics = useMemo(() => {
    const s = new Set();
    problems.forEach((p) => (p.topicTags || []).forEach((t) => s.add(t.name)));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [problems]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    let list = problems.filter((p) => {
      const hay = [p.title || "", p.titleSlug || "", ...(p.topicTags || []).map((t) => t.name), ...(p.userTags || [])]
        .join(" ")
        .toLowerCase();
      const queryOk = !q || q.split(/\s+/).every((token) => hay.includes(token));
      const difficultyOk = !filters.difficulty || String(p.difficulty || "").toLowerCase() === filters.difficulty.toLowerCase();
      const topicOk = !filters.topic || (p.topicTags || []).some((t) => t.name === filters.topic);
      const ac = Number(p.acRate || 0) * 100;
      const minOk = !filters.acMin || ac >= Number(filters.acMin);
      const maxOk = !filters.acMax || ac <= Number(filters.acMax);
      const revisionOk = !filters.revisionOnly || p.needsReview;
      return queryOk && difficultyOk && topicOk && minOk && maxOk && revisionOk;
    });

    if (filters.sort === "title_asc") list.sort((a, b) => a.title.localeCompare(b.title));
    if (filters.sort === "difficulty") {
      const rank = { EASY: 1, MEDIUM: 2, HARD: 3 };
      list.sort((a, b) => (rank[String(a.difficulty).toUpperCase()] || 99) - (rank[String(b.difficulty).toUpperCase()] || 99));
    }
    if (filters.sort === "ac_desc") list.sort((a, b) => Number(b.acRate || 0) - Number(a.acRate || 0));

    return list;
  }, [problems, filters]);

  async function fetchNow() {
    await fetch("/api/fetch", { method: "POST" });
    await loadAll();
  }

  async function exportData(format = "csv") {
    const res = await fetch(`/api/export?format=${format}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ext = format === "json" ? "json" : "csv";
    a.href = url;
    a.download = `leetcode_solved.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("lc-dark-mode", isDark ? "true" : "false");
  }

  async function toggleFavorite(slug) {
    const res = await fetch(`/api/problem/${slug}/favorite`, { method: "POST" });
    const payload = await res.json();
    if (!payload.success) return;
    setProblems((prev) => prev.map((p) => (p.titleSlug === slug ? { ...p, isInMyFavorites: payload.isFavorite } : p)));
  }

  async function addTag(slug) {
    const value = (tagDraft[slug] || "").trim();
    if (!value) return;
    const item = problems.find((p) => p.titleSlug === slug);
    if (!item) return;
    const tags = Array.from(new Set([...(item.userTags || []), value]));
    const res = await fetch(`/api/problem/${slug}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    const payload = await res.json();
    if (!payload.success) return;
    setTagDraft((prev) => ({ ...prev, [slug]: "" }));
    setProblems((prev) => prev.map((p) => (p.titleSlug === slug ? { ...p, userTags: payload.userTags } : p)));
  }

  async function removeTag(slug, tag) {
    const res = await fetch(`/api/problem/${slug}/tag/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag }),
    });
    const payload = await res.json();
    if (!payload.success) return;
    setProblems((prev) => prev.map((p) => (p.titleSlug === slug ? { ...p, userTags: payload.userTags } : p)));
  }

  async function editTag(slug, currentTag) {
    const nextTag = window.prompt("Edit tag", currentTag);
    if (nextTag === null) return;
    const item = problems.find((p) => p.titleSlug === slug);
    if (!item) return;
    const updated = (item.userTags || []).map((t) => (t === currentTag ? nextTag.trim() : t)).filter(Boolean);
    const res = await fetch(`/api/problem/${slug}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: updated }),
    });
    const payload = await res.json();
    if (!payload.success) return;
    setProblems((prev) => prev.map((p) => (p.titleSlug === slug ? { ...p, userTags: payload.userTags } : p)));
  }

  async function saveNotes(slug) {
    const notes = notesDraft[slug];
    const res = await fetch(`/api/problem/${slug}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    const payload = await res.json();
    if (!payload.success) return;
    setProblems((prev) => prev.map((p) => (p.titleSlug === slug ? { ...p, notes: payload.notes } : p)));
    setExpanded((prev) => ({ ...prev, [slug]: false }));
  }

  async function toggleReview(slug) {
    const res = await fetch(`/api/problem/${slug}/review`, { method: "POST" });
    const payload = await res.json();
    if (!payload.success) return;
    setProblems((prev) => prev.map((p) => (p.titleSlug === slug ? { ...p, needsReview: payload.needsReview, nextReviewDate: payload.nextReviewDate } : p)));
  }

  async function recordSnapshot() {
    await fetch("/api/progress/record", { method: "POST" });
    await loadProgress();
  }

  const topTopics = Object.entries(analytics.byTopic || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="container">
      <header className="header">
        <div className="header-content">
          <h1>LeetCode Tracker</h1>
          <div className="header-actions">
            <button className="btn btn-primary" onClick={fetchNow}>Fetch Now</button>
            <a className="btn btn-secondary" href="/admin">Update Credentials</a>
            <button className="btn btn-secondary" onClick={() => exportData("csv")}>Export CSV</button>
            <button className="btn btn-secondary" onClick={toggleDark}>Toggle Theme</button>
            <span className="last-updated">Last updated: {analytics.lastUpdated || "Never"}</span>
          </div>
        </div>
      </header>

      <section className="stats-grid">
        <StatCard label="Total Solved" value={analytics.totalSolved} />
        <StatCard label="Easy" value={analytics.byDifficulty.Easy} className="easy" />
        <StatCard label="Medium" value={analytics.byDifficulty.Medium} className="medium" />
        <StatCard label="Hard" value={analytics.byDifficulty.Hard} className="hard" />
        <StatCard label="Avg Acceptance" value={`${analytics.avgAcceptanceRate}%`} />
      </section>

      <section className="charts-section">
        <div className="chart-container">
          <h3>Difficulty Distribution</h3>
          <Doughnut
            data={{
              labels: ["Easy", "Medium", "Hard"],
              datasets: [{
                data: [analytics.byDifficulty.Easy, analytics.byDifficulty.Medium, analytics.byDifficulty.Hard],
                backgroundColor: ["#2f9e44", "#f08c00", "#e03131"],
              }],
            }}
          />
        </div>
        <div className="chart-container">
          <h3>Top Topics</h3>
          <Bar
            data={{
              labels: topTopics.map((t) => t[0]),
              datasets: [{ label: "Problems", data: topTopics.map((t) => t[1]), backgroundColor: "rgba(47, 158, 68, 0.78)" }],
            }}
            options={{ indexAxis: "y", plugins: { legend: { display: false } } }}
          />
        </div>
      </section>

      <section className="problems-section">
        <div className="filters">
          <h3>Problems</h3>
          <div className="filter-group">
            <input className="search-box" placeholder="Search problems..." value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
            <select className="filter-select" value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}>
              <option value="">Sort: Default</option>
              <option value="title_asc">Title A-Z</option>
              <option value="difficulty">Difficulty</option>
              <option value="ac_desc">Acceptance Desc</option>
            </select>
            <select className="filter-select" value={filters.difficulty} onChange={(e) => setFilters((f) => ({ ...f, difficulty: e.target.value }))}>
              <option value="">All Difficulties</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
            <select className="filter-select" value={filters.topic} onChange={(e) => setFilters((f) => ({ ...f, topic: e.target.value }))}>
              <option value="">All Topics</option>
              {topics.map((topic) => <option value={topic} key={topic}>{topic}</option>)}
            </select>
            <input type="number" min="0" max="100" className="filter-select" placeholder="AC min" value={filters.acMin} onChange={(e) => setFilters((f) => ({ ...f, acMin: e.target.value }))} />
            <input type="number" min="0" max="100" className="filter-select" placeholder="AC max" value={filters.acMax} onChange={(e) => setFilters((f) => ({ ...f, acMax: e.target.value }))} />
            <label className="checkbox-label">
              <input type="checkbox" checked={filters.revisionOnly} onChange={(e) => setFilters((f) => ({ ...f, revisionOnly: e.target.checked }))} />
              Needs Review
            </label>
            <button className="btn btn-secondary" onClick={() => setFilters({ q: "", difficulty: "", topic: "", sort: "", acMin: "", acMax: "", revisionOnly: false })}>Clear Filters</button>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Fav</th>
                <th>Title</th>
                <th>Difficulty</th>
                <th>Acceptance Rate</th>
                <th>Topics / Tags</th>
                <th>Review</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <Fragment key={p.titleSlug}>
                  <tr>
                    <td><button className="fav-btn" onClick={() => toggleFavorite(p.titleSlug)}>{p.isInMyFavorites ? "★" : "☆"}</button></td>
                    <td><strong>{p.title}</strong><div className="subtitle">{p.titleSlug}</div></td>
                    <td><span className={`pill difficulty-${String(p.difficulty || "").toLowerCase()}`}>{String(p.difficulty || "Unknown")}</span></td>
                    <td>{(Number(p.acRate || 0) * 100).toFixed(2)}%</td>
                    <td>
                      <div className="topics">
                        {(p.topicTags || []).map((t) => <span key={`${p.titleSlug}-${t.name}`} className="topic-tag">{t.name}</span>)}
                        {(p.userTags || []).map((t) => (
                          <span key={`${p.titleSlug}-user-${t}`} className="topic-tag user-tag" onDoubleClick={() => editTag(p.titleSlug, t)}>
                            {t}
                            <span className="tag-remove" onClick={() => removeTag(p.titleSlug, t)}>x</span>
                          </span>
                        ))}
                      </div>
                      <div className="tag-row">
                        <input className="tag-input" value={tagDraft[p.titleSlug] || ""} placeholder="Add tag" onChange={(e) => setTagDraft((prev) => ({ ...prev, [p.titleSlug]: e.target.value }))} />
                        <button className="tag-add-btn" onClick={() => addTag(p.titleSlug)}>Add</button>
                      </div>
                    </td>
                    <td>
                      <button className={`btn ${p.needsReview ? "btn-review-active" : "btn-secondary"}`} onClick={() => toggleReview(p.titleSlug)}>
                        {p.needsReview ? "🚩 Review" : "🏳️ Mark"}
                      </button>
                      {p.needsReview && p.nextReviewDate && (
                        <div className={`review-date ${new Date(p.nextReviewDate) < new Date() ? "overdue" : ""}`}>
                          {new Date(p.nextReviewDate).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-secondary" onClick={() => {
                        setExpanded(prev => ({ ...prev, [p.titleSlug]: !prev[p.titleSlug] }));
                        if (!expanded[p.titleSlug]) setNotesDraft(prev => ({ ...prev, [p.titleSlug]: p.notes || "" }));
                      }}>
                        {p.notes ? "📝 Edit" : "➕ Add"}
                      </button>
                    </td>
                  </tr>
                  {expanded[p.titleSlug] && (
                    <tr className="expanded-row">
                      <td colSpan="7">
                        <div className="notes-editor">
                          <h4>Solution Notes for {p.title}</h4>
                          <textarea
                            className="notes-textarea"
                            value={notesDraft[p.titleSlug] || ""}
                            onChange={(e) => setNotesDraft(prev => ({ ...prev, [p.titleSlug]: e.target.value }))}
                            placeholder="Write your notes here... (complexity, approach, etc.)"
                          />
                          <div className="notes-actions">
                            <button className="btn btn-primary" onClick={() => saveNotes(p.titleSlug)}>Save Notes</button>
                            <button className="btn btn-secondary" onClick={() => setExpanded(prev => ({ ...prev, [p.titleSlug]: false }))}>Cancel</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="chart-container progress-card">
        <h3>Solved Over Time</h3>
        <Line
          data={{
            labels: progress.map((p) => p.date),
            datasets: [{ label: "Total Solved", data: progress.map((p) => p.total), borderColor: "#4f46e5", backgroundColor: "rgba(79,70,229,0.12)", fill: true }],
          }}
        />
        <div className="progress-actions">
          <button className="btn btn-secondary" onClick={recordSnapshot}>Record Snapshot</button>
          <button className="btn btn-secondary" onClick={loadProgress}>Reload Progress</button>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, className = "" }) {
  return (
    <div className="stat-card">
      <div className={`stat-value ${className}`}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
