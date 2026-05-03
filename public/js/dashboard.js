let allProblems = [];
let charts = {};

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  setupEventListeners();
  initDarkMode();
});

function setupEventListeners() {
  document.getElementById("refreshBtn").addEventListener("click", fetchProblems);
  document.getElementById("searchInput").addEventListener("input", filterTable);
  const sortSelect = document.getElementById("sortSelect");
  if (sortSelect) sortSelect.addEventListener("change", filterTable);
  document.getElementById("difficultyFilter").addEventListener("change", filterTable);
  document.getElementById("topicFilter").addEventListener("change", filterTable);
  const acMin = document.getElementById("acMin");
  const acMax = document.getElementById("acMax");
  if (acMin) acMin.addEventListener("input", filterTable);
  if (acMax) acMax.addEventListener("input", filterTable);
  document.getElementById("clearFilters").addEventListener("click", clearFilters);
  const exportBtn = document.getElementById("exportBtn");
  if (exportBtn) exportBtn.addEventListener("click", () => exportData("csv"));

  const darkToggle = document.getElementById("darkModeToggle");
  if (darkToggle) darkToggle.addEventListener("click", toggleDarkMode);
  const recordBtn = document.getElementById("recordSnapshot");
  if (recordBtn) recordBtn.addEventListener("click", recordSnapshot);
  const loadBtn = document.getElementById("loadProgress");
  if (loadBtn) loadBtn.addEventListener("click", loadProgressChart);
}

async function loadData() {
  try {
    // Load problems
    const problemsRes = await fetch("/api/problems");
    allProblems = await problemsRes.json();

    // Load analytics
    const analyticsRes = await fetch("/api/analytics");
    const analytics = await analyticsRes.json();

    // Update UI
    updateStats(analytics);
    updateCharts(analytics);
    populateTopicFilter();
    displayProblems();
    updateLastUpdated(analytics.lastUpdated);
  } catch (err) {
    console.error("Error loading data:", err);
  }
}

function updateStats(analytics) {
  document.getElementById("totalSolved").textContent = analytics.totalSolved;
  document.getElementById("easySolved").textContent = analytics.byDifficulty.Easy;
  document.getElementById("mediumSolved").textContent = analytics.byDifficulty.Medium;
  document.getElementById("hardSolved").textContent = analytics.byDifficulty.Hard;
  document.getElementById("avgAcceptance").textContent = `${analytics.avgAcceptanceRate}%`;
}

function updateLastUpdated(timestamp) {
  const element = document.getElementById("lastUpdated");
  if (timestamp && timestamp !== "Never") {
    element.textContent = `Last updated: ${timestamp}`;
  } else {
    element.textContent = "Never fetched";
  }
}

function updateCharts(analytics) {
  updateDifficultyChart(analytics.byDifficulty);
  updateTopicsChart(analytics.byTopic);
}

function updateDifficultyChart(byDifficulty) {
  const ctx = document.getElementById("difficultyChart").getContext("2d");

  if (charts.difficulty) {
    charts.difficulty.destroy();
  }

  charts.difficulty = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Easy", "Medium", "Hard"],
      datasets: [
        {
          data: [byDifficulty.Easy, byDifficulty.Medium, byDifficulty.Hard],
          backgroundColor: ["#2f9e44", "#f08c00", "#e03131"],
          hoverBackgroundColor: ["#37b24d", "#fab005", "#ff6b6b"],
          borderColor: "#fff",
          borderWidth: 2,
          cutout: "68%",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: {
        duration: 900,
        easing: "easeOutQuart",
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            padding: 18,
            color: "#4a4a4a",
            font: {
              size: 13,
              family: "Inter, system-ui, sans-serif",
            },
          },
        },
      },
    },
  });
}

function updateTopicsChart(byTopic) {
  const ctx = document.getElementById("topicsChart").getContext("2d");

  // Get top 8 topics
  const sortedTopics = Object.entries(byTopic)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (charts.topics) {
    charts.topics.destroy();
  }

  charts.topics = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sortedTopics.map((t) => t[0]),
      datasets: [
        {
          label: "Problems",
          data: sortedTopics.map((t) => t[1]),
          backgroundColor: "rgba(47, 158, 68, 0.78)",
          borderColor: "#2f9e44",
          borderWidth: 1,
          borderRadius: 10,
          barThickness: 18,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: true,
      animation: {
        duration: 900,
        easing: "easeOutQuart",
      },
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            color: "rgba(0, 0, 0, 0.06)",
          },
          ticks: {
            stepSize: 1,
            color: "#5a5a5a",
            font: {
              family: "Inter, system-ui, sans-serif",
            },
          },
        },
        y: {
          grid: {
            display: false,
          },
          ticks: {
            color: "#5a5a5a",
            font: {
              family: "Inter, system-ui, sans-serif",
            },
          },
        },
      },
    },
  });
}

function populateTopicFilter() {
  const topics = new Set();
  allProblems.forEach((p) => {
    if (p.topicTags) {
      p.topicTags.forEach((tag) => {
        topics.add(tag.name);
      });
    }
  });

  const select = document.getElementById("topicFilter");
  select.querySelectorAll("option:not(:first-child)").forEach((option) => option.remove());
  const sortedTopics = Array.from(topics).sort();

  sortedTopics.forEach((topic) => {
    const option = document.createElement("option");
    option.value = topic;
    option.textContent = topic;
    select.appendChild(option);
  });
}

function displayProblems() {
  filterTable();
}

function filterTable() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  const difficulty = document.getElementById("difficultyFilter").value;
  const topic = document.getElementById("topicFilter").value;
  const sortBy = document.getElementById("sortSelect") ? document.getElementById("sortSelect").value : "";
  const acMinVal = Number(document.getElementById("acMin").value || "");
  const acMaxVal = Number(document.getElementById("acMax").value || "");

  let filtered = allProblems.filter((p) => {
    // acceptance rate filter
    const acPct = p.acRate ? Number(p.acRate) * 100 : 0;
    if (!Number.isNaN(acMinVal) && acMinVal > 0 && acPct < acMinVal) return false;
    if (!Number.isNaN(acMaxVal) && acMaxVal > 0 && acPct > acMaxVal) return false;

    const matchesDifficulty = !difficulty || p.difficulty === difficulty;

    const matchesTopic = !topic || (p.topicTags && p.topicTags.some((tag) => tag.name === topic));

    // fuzzy-ish search: match title, slug, topic, or tag words
    const hay = [p.title || "", p.titleSlug || "", ...(p.topicTags || []).map((t) => t.name)].join(" ").toLowerCase();
    const matchesSearch = fuzzyMatch(hay, searchTerm);

    return matchesSearch && matchesDifficulty && matchesTopic;
  });

  // Sorting
  if (sortBy) filtered = sortProblems(filtered, sortBy);

  renderTable(filtered);
}

function renderTable(problems) {
  const tbody = document.getElementById("problemsBody");
  tbody.innerHTML = "";

  if (problems.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #999;">No problems found</td></tr>';
    return;
  }

  problems.forEach((p) => {
    const row = document.createElement("tr");

    const difficulty = String(p.difficulty || "").toLowerCase();
    const difficultyClass = `difficulty-${difficulty}`;
    const difficultyLabel = difficulty ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1) : "Unknown";
    const topics = p.topicTags
      ? p.topicTags
          .map((tag) => `<span class="topic-tag">${tag.name}</span>`)
          .join("")
      : "";

    // user tags and favorite
    const userTags = (p.userTags || [])
      .map((t) => `<span class="topic-tag user-tag" data-tag="${t}" data-slug="${p.titleSlug}">${t}<span class="tag-remove" data-tag="${t}" data-slug="${p.titleSlug}">✕</span></span>`)
      .join("");
    const isFav = !!p.isInMyFavorites;

    const favHtml = `<button class="fav-btn" data-slug="${p.titleSlug}" aria-label="favorite">${isFav ? "★" : "☆"}</button>`;

    row.innerHTML = `
      <td style="width:56px">${favHtml}</td>
      <td><strong>${p.title}</strong><div class="subtitle">${p.titleSlug}</div></td>
      <td><span class="pill ${difficultyClass}">${difficultyLabel}</span></td>
      <td>${(Number(p.acRate) * 100).toFixed(2)}%</td>
      <td>
        <div class="topics">${topics} ${userTags}</div>
        <div style="margin-top:8px; display:flex; gap:8px;">
          <input class="tag-input" data-slug="${p.titleSlug}" placeholder="Add tag" />
          <button class="tag-add-btn" data-slug="${p.titleSlug}">Add</button>
        </div>
      </td>
      <td>
        <button class="btn btn-secondary notes-toggle" data-slug="${p.titleSlug}">
          ${p.notes ? "📝 Edit" : "➕ Add"}
        </button>
      </td>
    `;

    tbody.appendChild(row);

    // Notes Row (hidden by default)
    const notesRow = document.createElement("tr");
    notesRow.className = "expanded-row";
    notesRow.id = `notes-${p.titleSlug}`;
    notesRow.style.display = "none";
    notesRow.innerHTML = `
      <td colSpan="6">
        <div class="notes-editor">
          <h4>Solution Notes for ${p.title}</h4>
          <textarea class="notes-textarea" id="textarea-${p.titleSlug}" placeholder="Complexity, approach, etc...">${p.notes || ""}</textarea>
          <div class="notes-actions">
            <button class="btn btn-primary notes-save" data-slug="${p.titleSlug}">Save Notes</button>
            <button class="btn btn-secondary notes-cancel" data-slug="${p.titleSlug}">Cancel</button>
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(notesRow);
  });

  // Attach event listeners for favorite and tag actions
  document.querySelectorAll(".notes-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slug = btn.getAttribute("data-slug");
      const row = document.getElementById(`notes-${slug}`);
      row.style.display = row.style.display === "none" ? "table-row" : "none";
    });
  });

  document.querySelectorAll(".notes-cancel").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slug = btn.getAttribute("data-slug");
      document.getElementById(`notes-${slug}`).style.display = "none";
    });
  });

  document.querySelectorAll(".notes-save").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const slug = btn.getAttribute("data-slug");
      const notes = document.getElementById(`textarea-${slug}`).value;
      try {
        const res = await fetch(`/api/problem/${slug}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        });
        const j = await res.json();
        if (j.success) {
          const p = allProblems.find((x) => x.titleSlug === slug);
          if (p) p.notes = notes;
          document.getElementById(`notes-${slug}`).style.display = "none";
          // update button text
          document.querySelector(`.notes-toggle[data-slug="${slug}"]`).textContent = "📝 Edit";
        } else {
          alert(j.error || "Could not save notes");
        }
      } catch (err) {
        alert("Error saving notes: " + err.message);
      }
    });
  });

  document.querySelectorAll(".fav-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const slug = btn.getAttribute("data-slug");
      try {
        const res = await fetch(`/api/problem/${slug}/favorite`, { method: "POST" });
        const j = await res.json();
        if (j.success) {
          btn.textContent = j.isFavorite ? "★" : "☆";
          // update local data
          const p = allProblems.find((x) => x.titleSlug === slug);
          if (p) p.isInMyFavorites = j.isFavorite;
        } else {
          alert(j.error || "Could not toggle favorite");
        }
      } catch (err) {
        alert("Error toggling favorite: " + err.message);
      }
    });
  });

  document.querySelectorAll(".tag-add-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const slug = btn.getAttribute("data-slug");
      const input = document.querySelector(`.tag-input[data-slug=\"${slug}\"]`);
      if (!input) return;
      const val = input.value.trim();
      if (!val) return;
      // merge with existing userTags
      const p = allProblems.find((x) => x.titleSlug === slug);
      const newTags = Array.from(new Set([...(p.userTags || []), val]));
      try {
        const res = await fetch(`/api/problem/${slug}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: newTags }),
        });
        const j = await res.json();
        if (j.success) {
          input.value = "";
          // update local data and re-render
          if (p) p.userTags = j.userTags;
          filterTable();
        } else {
          alert(j.error || "Could not set tags");
        }
      } catch (err) {
        alert("Error setting tags: " + err.message);
      }
    });
  });

    // Remove tag handler
    document.querySelectorAll(".tag-remove").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const slug = btn.getAttribute("data-slug");
        const tag = btn.getAttribute("data-tag");
        if (!confirm(`Remove tag '${tag}'?`)) return;
        try {
          const res = await fetch(`/api/problem/${slug}/tag/remove`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tag }),
          });
          const j = await res.json();
          if (j.success) {
            const p = allProblems.find((x) => x.titleSlug === slug);
            if (p) p.userTags = j.userTags;
            filterTable();
          } else {
            alert(j.error || "Could not remove tag");
          }
        } catch (err) {
          alert("Error removing tag: " + err.message);
        }
      });
    });

    // Inline edit: double-click a user-tag to edit
    document.querySelectorAll(".user-tag").forEach((el) => {
      el.addEventListener("dblclick", (e) => {
        const slug = el.getAttribute("data-slug");
        const tag = el.getAttribute("data-tag");
        const input = document.createElement("input");
        input.className = "tag-edit-input";
        input.value = tag;
        input.style.minWidth = "80px";
        el.replaceWith(input);
        input.focus();

        const finish = async () => {
          const newVal = input.value.trim();
          // find problem and update tags
          const p = allProblems.find((x) => x.titleSlug === slug);
          if (!p) return;
          const existing = p.userTags || [];
          const updated = existing.map((t) => (t === tag ? newVal : t)).filter(Boolean);
          try {
            const res = await fetch(`/api/problem/${slug}/tags`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tags: updated }),
            });
            const j = await res.json();
            if (j.success) {
              p.userTags = j.userTags;
              filterTable();
            } else {
              alert(j.error || "Could not update tag");
            }
          } catch (err) {
            alert("Error updating tag: " + err.message);
          }
        };

        input.addEventListener("blur", finish);
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            input.blur();
          } else if (ev.key === "Escape") {
            // cancel: restore
            filterTable();
          }
        });
      });
    });
}

// Simple fuzzy match: returns true if all query tokens appear in order in the haystack
function fuzzyMatch(haystack, query) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  // split tokens and ensure each token is present
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((t) => haystack.includes(t));
}

function sortProblems(list, mode) {
  const copy = [...list];
  if (mode === "title_asc") {
    copy.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  } else if (mode === "difficulty") {
    const rank = (d) => {
      if (!d) return 99;
      const s = String(d).toLowerCase();
      if (s.includes("easy")) return 1;
      if (s.includes("medium")) return 2;
      if (s.includes("hard")) return 3;
      return 99;
    };
    copy.sort((a, b) => rank(a.difficulty) - rank(b.difficulty));
  } else if (mode === "ac_desc") {
    copy.sort((a, b) => (Number(b.acRate) || 0) - (Number(a.acRate) || 0));
  }
  return copy;
}

// --- Progress Chart functions ---
async function recordSnapshot() {
  try {
    const res = await fetch(`/api/progress/record`, { method: "POST" });
    const j = await res.json();
    if (j.success) {
      alert(`Snapshot recorded for ${j.snapshot.date}`);
      loadProgressChart();
    } else {
      alert(j.error || "Could not record snapshot");
    }
  } catch (err) {
    alert("Error recording snapshot: " + err.message);
  }
}

async function loadProgressChart() {
  try {
    const res = await fetch(`/api/progress`);
    const history = await res.json();
    const labels = history.map((h) => h.date);
    const totals = history.map((h) => h.total);

    const ctx = document.getElementById("progressChart").getContext("2d");
    if (charts.progress) charts.progress.destroy();
    charts.progress = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Total Solved",
            data: totals,
            borderColor: "#4f46e5",
            backgroundColor: "rgba(79,70,229,0.12)",
            fill: true,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  } catch (err) {
    console.error("Error loading progress:", err);
  }
}

function clearFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("difficultyFilter").value = "";
  document.getElementById("topicFilter").value = "";
  filterTable();
}

async function exportData(format = "csv") {
  try {
    const res = await fetch(`/api/export?format=${format}`);
    if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);

    const blob = await res.blob();
    // Attempt to read filename from headers
    const disposition = res.headers.get("content-disposition") || "";
    let filename = format === "json" ? "leetcode_solved.json" : "leetcode_solved.csv";
    const match = disposition.match(/filename=("?)([^";]+)\1/);
    if (match && match[2]) filename = match[2];

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert("Export error: " + err.message);
  }
}

function initDarkMode() {
  const saved = localStorage.getItem("lc-dark-mode");
  const enabled = saved === "true" || (saved === null && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (enabled) document.documentElement.classList.add("dark");
  updateDarkToggleText();
}

function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("lc-dark-mode", isDark ? "true" : "false");
  updateDarkToggleText();
}

function updateDarkToggleText() {
  const btn = document.getElementById("darkModeToggle");
  if (!btn) return;
  const isDark = document.documentElement.classList.contains("dark");
  btn.textContent = isDark ? "☀️ Light" : "🌙 Dark";
}

async function fetchProblems() {
  const btn = document.getElementById("refreshBtn");
  const originalText = btn.textContent;
  btn.textContent = "⏳ Fetching...";
  btn.disabled = true;

  try {
    const res = await fetch("/api/fetch", { method: "POST" });
    const result = await res.json();

    if (result.success) {
      // Reload data after fetch completes
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await loadData();
      btn.textContent = "✅ Fetched!";
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);
    } else {
      alert("Error: " + result.error);
      btn.textContent = originalText;
      btn.disabled = false;
    }
  } catch (err) {
    alert("Error fetching problems: " + err.message);
    btn.textContent = originalText;
    btn.disabled = false;
  }
}
