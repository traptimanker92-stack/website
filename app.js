/* ══════════════════════════════════════════
   INTERVIEWIQ — app.js (Merged)
   Website 1: Text-mode interview with Claude AI scoring
   Website 2: Live video interview with camera/filler/eye tracking
══════════════════════════════════════════ */

// ─────────────────────────────────────────
// SHARED: SVG gradient def injection
// ─────────────────────────────────────────
(function injectGradDef() {
  const svgNS = "http://www.w3.org/2000/svg";
  const defs  = document.createElementNS(svgNS, "svg");
  defs.style.position = "absolute";
  defs.style.width = "0";
  defs.style.height = "0";
  defs.innerHTML = `
    <defs>
      <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#ff6b6b"/>
        <stop offset="50%" style="stop-color:#ffd93d"/>
        <stop offset="100%" style="stop-color:#c77dff"/>
      </linearGradient>
    </defs>`;
  document.body.appendChild(defs);
})();


/* ══════════════════════════════════════════
   WEBSITE 1 — TEXT MODE LOGIC
══════════════════════════════════════════ */

// ─── Question Bank ───────────────────────
const QUESTIONS = {
  HR: {
    Easy: [
      "Tell me about yourself.",
      "Why do you want to work here?",
      "What are your strengths?",
      "Where do you see yourself in 5 years?",
      "Why are you leaving your current job?",
      "What motivates you?",
      "How do you handle stress and pressure?",
    ],
    Medium: [
      "Describe a time when you had to work with a difficult team member. How did you handle it?",
      "Tell me about a time you failed and what you learned from it.",
      "How do you prioritize your work when you have multiple deadlines?",
      "Describe a situation where you had to adapt quickly to change.",
      "What do you consider your biggest professional achievement?",
    ],
    Hard: [
      "Describe a time you had to lead a team through a critical crisis. What was your approach and outcome?",
      "How have you managed stakeholders with conflicting interests in a high-stakes project?",
      "Describe a time when you had to make a difficult ethical decision at work.",
      "Talk about a time you had to influence change without formal authority.",
    ]
  },
  Technical: {
    Easy: [
      "What is the difference between an array and a linked list?",
      "Explain the concept of object-oriented programming.",
      "What is a REST API and how does it work?",
      "What is version control and why is it important?",
      "Explain the difference between SQL and NoSQL databases.",
      "What is the difference between GET and POST methods?",
    ],
    Medium: [
      "Explain the time and space complexity of a binary search algorithm.",
      "What is the difference between synchronous and asynchronous programming? When would you use each?",
      "Describe the SOLID principles in software design.",
      "How does garbage collection work in modern programming languages?",
      "Explain the concept of microservices architecture and its trade-offs.",
      "What are design patterns? Name and describe three commonly used ones.",
    ],
    Hard: [
      "How would you design a scalable URL shortener like bit.ly that handles millions of requests per second?",
      "Explain the CAP theorem and its implications for distributed database design.",
      "How would you implement a distributed rate limiter for a high-traffic API?",
      "Describe how you would approach debugging a severe performance bottleneck in a production system.",
    ]
  },
  Behavioral: {
    Easy: [
      "Tell me about a time you worked well in a team.",
      "Give an example of when you showed initiative.",
      "Describe a time you helped a colleague.",
      "When have you gone above and beyond your role?",
    ],
    Medium: [
      "Tell me about a time you disagreed with your manager. How did you handle it?",
      "Describe a project where you had to meet a very tight deadline. What was your approach?",
      "Give an example of when you had to quickly learn a new skill or technology.",
      "Describe a situation where you had to convince others to accept your idea.",
      "Tell me about a time you received negative feedback. How did you respond?",
    ],
    Hard: [
      "Describe the most complex problem you've ever solved. Walk me through your thought process.",
      "Tell me about a time when a project you led failed. What did you do differently afterward?",
      "Describe a situation where you had to balance innovation with risk management.",
      "Give an example of when you had to make a significant decision with incomplete information.",
    ]
  },
  Mixed: { Easy: [], Medium: [], Hard: [] }
};

["Easy","Medium","Hard"].forEach(d => {
  QUESTIONS.Mixed[d] = [
    ...QUESTIONS.HR[d],
    ...QUESTIONS.Technical[d],
    ...QUESTIONS.Behavioral[d]
  ];
});

const HINTS = {
  HR: "Use the STAR method: Situation, Task, Action, Result. Keep it concise and relevant to the role.",
  Technical: "Explain your thought process clearly. Start with a high-level approach before diving into details.",
  Behavioral: "Ground your answer in a real past experience. Be specific with measurable outcomes.",
  Mixed: "Identify the question type first (HR/Technical/Behavioral), then apply the appropriate strategy."
};

// ─── State ───────────────────────────────
let state = {
  userName: "User",
  jobRole: "Software Engineer",
  interviewType: "Technical",
  difficulty: "Easy",
  totalQ: 5,
  currentQ: 0,
  questions: [],
  answers: [],
  scores: [],
  sessionScores: [],
  selectedMode: "text"  // "text" or "video"
};

let sessions = JSON.parse(localStorage.getItem("iiq_sessions") || "[]");
let recognition = null;
let isRecording_text = false;

// ─── Navigation ──────────────────────────
function showPage(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(`page-${page}`).classList.add("active");
  document.querySelector(`[data-page="${page}"]`)?.classList.add("active");

  if (page === "dashboard") renderDashboard();
  if (page === "history") renderHistory();
  if (page === "home") updateHomeStats();

  // Reset interview page to setup screen when navigating to it
  if (page === "interview") {
    document.getElementById("setup-screen").style.display = "block";
    document.getElementById("interview-screen").style.display = "none";
    document.getElementById("results-screen").style.display = "none";
  }

  document.getElementById("sidebar").classList.remove("open");
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

// ─── Setup ───────────────────────────────
function setDiff(btn, val) {
  document.querySelectorAll(".diff-pill").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  state.difficulty = val;
}

function selectMode(mode) {
  state.selectedMode = mode;
  document.getElementById("modeText").classList.toggle("active", mode === "text");
  document.getElementById("modeVideo").classList.toggle("active", mode === "video");
}

function startInterview() {
  const nameVal = document.getElementById("userName").value.trim();
  if (!nameVal) { showToast("Please enter your name first!"); return; }

  state.userName = nameVal;
  state.jobRole = document.getElementById("jobRole").value;
  state.interviewType = document.getElementById("interviewType").value;
  state.totalQ = parseInt(document.getElementById("qCount").value);
  state.currentQ = 0;
  state.answers = [];
  state.scores = [];
  state.sessionScores = [];

  document.getElementById("sidebarUserName").textContent = nameVal;

  if (state.selectedMode === "video") {
    // Launch Website 2 live interview overlay
    launchLiveInterview();
    return;
  }

  // Text mode: pick questions
  const pool = [...(QUESTIONS[state.interviewType]?.[state.difficulty] || QUESTIONS.Mixed[state.difficulty])];
  shuffle(pool);
  state.questions = pool.slice(0, state.totalQ);

  if (state.questions.length === 0) {
    showToast("No questions available. Try a different type or difficulty.");
    return;
  }

  document.getElementById("setup-screen").style.display = "none";
  document.getElementById("results-screen").style.display = "none";
  document.getElementById("interview-screen").style.display = "block";

  document.getElementById("qTotal").textContent = state.totalQ;
  document.getElementById("sessionRoleBadge").textContent = `${state.jobRole} · ${state.interviewType}`;

  loadQuestion_text();
}

function loadQuestion_text() {
  const q = state.questions[state.currentQ];
  document.getElementById("qNum").textContent = state.currentQ + 1;
  document.getElementById("questionText").textContent = q;
  document.getElementById("progressFill").style.width = `${(state.currentQ / state.totalQ) * 100}%`;

  let tag = state.interviewType;
  if (state.interviewType === "Mixed") {
    if (QUESTIONS.HR.Easy.concat(QUESTIONS.HR.Medium, QUESTIONS.HR.Hard).includes(q)) tag = "HR";
    else if (QUESTIONS.Technical.Easy.concat(QUESTIONS.Technical.Medium, QUESTIONS.Technical.Hard).includes(q)) tag = "Technical";
    else tag = "Behavioral";
  }
  document.getElementById("qTypeTag").textContent = tag;

  document.getElementById("answerBox").value = "";
  document.getElementById("wordCount").textContent = "0 words";
  document.getElementById("feedbackCard").style.display = "none";
  document.getElementById("hintBox").style.display = "none";
  document.getElementById("answerBox").disabled = false;
  document.querySelector(".btn-submit").disabled = false;
}

function updateWordCount() {
  const words = document.getElementById("answerBox").value.trim().split(/\s+/).filter(Boolean).length;
  document.getElementById("wordCount").textContent = `${words} word${words !== 1 ? "s" : ""}`;
}

function getHint() {
  const hintBox = document.getElementById("hintBox");
  const hintText = document.getElementById("hintText");
  const qType = document.getElementById("qTypeTag").textContent;
  hintText.textContent = HINTS[qType] || HINTS.HR;
  hintBox.style.display = "block";
}

function confirmEnd() {
  if (confirm("End session early? Your progress will be saved.")) {
    finishSession();
  }
}

// ─── Submit Answer & AI Scoring ──────────
async function submitAnswer() {
  const answer = document.getElementById("answerBox").value.trim();
  if (!answer || answer.length < 10) {
    showToast("Please write a more complete answer (at least 10 characters).");
    return;
  }

  document.getElementById("answerBox").disabled = true;
  document.querySelector(".btn-submit").disabled = true;
  document.getElementById("hintBox").style.display = "none";
  showLoading("AI is analyzing your answer…");

  const question = state.questions[state.currentQ];
  const qType = document.getElementById("qTypeTag").textContent;
  const prompt = buildScoringPrompt(question, answer, qType, state.jobRole, state.difficulty);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    const raw = data.content?.map(c => c.text || "").join("") || "";
    const parsed = parseAIResponse(raw);

    state.scores.push(parsed);
    state.answers.push({ question, answer, score: parsed, qType });

    hideLoading();
    renderFeedback(parsed);

  } catch (err) {
    hideLoading();
    const fallback = fallbackScore(answer, question);
    state.scores.push(fallback);
    state.answers.push({ question, answer, score: fallback, qType });
    renderFeedback(fallback);
    showToast("Using offline scoring (API unavailable).");
  }
}

function buildScoringPrompt(question, answer, type, role, difficulty) {
  return `You are an expert interview coach evaluating a candidate's answer for a ${role} interview (${type} question, ${difficulty} difficulty).

QUESTION: "${question}"

CANDIDATE'S ANSWER: "${answer}"

Score this answer STRICTLY on each of these 5 criteria. Return ONLY valid JSON, no markdown, no extra text:

{
  "relevance": <0-30>,
  "clarity": <0-15>,
  "technical": <0-30>,
  "grammar": <0-15>,
  "confidence": <0-10>,
  "total": <sum of above>,
  "feedback": "<detailed 150-200 word paragraph with: what the candidate did well, what was missing or weak, specific improvement tips, and an example phrase or structure they could use next time>",
  "tips": ["<tip 1>", "<tip 2>", "<tip 3>"]
}

Scoring guide:
- Relevance (0-30): Did the answer directly address the question?
- Clarity (0-15): Was the response well-structured and easy to follow?
- Technical Accuracy (0-30): Were the facts/concepts/examples correct and appropriate?
- Grammar (0-15): Was the language grammatically correct and professional?
- Confidence (0-10): Did the response sound assertive and confident?

Be honest and fair. For vague or off-topic answers, give low scores. For detailed, accurate answers, reward generously.`;
}

function parseAIResponse(raw) {
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const obj = JSON.parse(clean);
    return {
      relevance:  Math.min(30, Math.max(0, parseInt(obj.relevance) || 0)),
      clarity:    Math.min(15, Math.max(0, parseInt(obj.clarity) || 0)),
      technical:  Math.min(30, Math.max(0, parseInt(obj.technical) || 0)),
      grammar:    Math.min(15, Math.max(0, parseInt(obj.grammar) || 0)),
      confidence: Math.min(10, Math.max(0, parseInt(obj.confidence) || 0)),
      total: 0,
      feedback: obj.feedback || "Great effort! Keep practicing to improve.",
      tips: obj.tips || []
    };
  } catch {
    return fallbackScore("", "");
  }
}

function fallbackScore(answer) {
  const len = answer.split(/\s+/).filter(Boolean).length;
  const r  = Math.min(30, Math.floor(len * 0.5 + Math.random() * 10));
  const cl = Math.min(15, Math.floor(len * 0.2 + Math.random() * 5));
  const t  = Math.min(30, Math.floor(len * 0.4 + Math.random() * 10));
  const g  = Math.min(15, Math.floor(10 + Math.random() * 5));
  const co = Math.min(10, Math.floor(4 + Math.random() * 5));
  return {
    relevance: r, clarity: cl, technical: t, grammar: g, confidence: co,
    total: r + cl + t + g + co,
    feedback: `Your answer was ${len < 30 ? "quite brief" : "reasonably detailed"}. Focus on using the STAR method and specific examples. Try to be more precise about technical concepts and quantify your achievements where possible.`,
    tips: ["Use specific examples", "Quantify achievements", "Structure with STAR method"]
  };
}

// ─── Render Feedback ─────────────────────
function renderFeedback(score) {
  score.total = score.relevance + score.clarity + score.technical + score.grammar + score.confidence;

  const scoreItems = [
    { label: "Relevance",  val: score.relevance,  max: 30, color: "#ff6b6b" },
    { label: "Clarity",    val: score.clarity,    max: 15, color: "#ffd93d" },
    { label: "Technical",  val: score.technical,  max: 30, color: "#6bcb77" },
    { label: "Grammar",    val: score.grammar,    max: 15, color: "#4d96ff" },
    { label: "Confidence", val: score.confidence, max: 10, color: "#c77dff" },
  ];

  document.getElementById("totalScoreBadge").textContent = `${score.total}/100`;

  const grid = document.getElementById("scoreGrid");
  grid.innerHTML = scoreItems.map(s => {
    const fill = Math.round((s.val / s.max) * 100);
    return `<div class="score-item">
      <div class="s-label">${s.label}</div>
      <div class="s-val" style="color:${s.color}">${s.val}</div>
      <div class="s-max">/ ${s.max}</div>
      <div class="s-bar" style="background:${s.color}22"><div style="height:100%;width:${fill}%;background:${s.color};border-radius:2px;transition:width 0.8s ease"></div></div>
    </div>`;
  }).join("");

  document.getElementById("feedbackText").textContent = score.feedback;

  const fc = document.getElementById("feedbackCard");
  fc.style.display = "block";
  fc.scrollIntoView({ behavior: "smooth", block: "nearest" });

  const isLast = state.currentQ >= state.totalQ - 1;
  const nextBtn = document.getElementById("nextBtn");
  nextBtn.innerHTML = isLast
    ? `<i class="fa-solid fa-flag-checkered"></i> See Results`
    : `Next Question <i class="fa-solid fa-arrow-right"></i>`;
}

function nextQuestion() {
  state.currentQ++;
  if (state.currentQ >= state.totalQ) {
    finishSession();
  } else {
    loadQuestion_text();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

// ─── Finish Session ───────────────────────
function finishSession() {
  if (state.scores.length === 0) {
    showPage("interview");
    return;
  }

  const avgScore = state.scores.reduce((a, s) => a + s.total, 0) / state.scores.length;
  const avgBreakdown = {
    relevance:  avg(state.scores.map(s => s.relevance)),
    clarity:    avg(state.scores.map(s => s.clarity)),
    technical:  avg(state.scores.map(s => s.technical)),
    grammar:    avg(state.scores.map(s => s.grammar)),
    confidence: avg(state.scores.map(s => s.confidence)),
  };

  const session = {
    id: Date.now(),
    date: new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }),
    name: state.userName,
    role: state.jobRole,
    type: state.interviewType,
    difficulty: state.difficulty,
    questions: state.totalQ,
    answered: state.scores.length,
    score: Math.round(avgScore),
    breakdown: avgBreakdown,
    answers: state.answers,
  };

  sessions.unshift(session);
  localStorage.setItem("iiq_sessions", JSON.stringify(sessions));

  document.getElementById("interview-screen").style.display = "none";
  document.getElementById("setup-screen").style.display = "none";
  const rs = document.getElementById("results-screen");
  rs.style.display = "block";

  document.getElementById("resultsSubtitle").textContent = `${state.userName} · ${state.jobRole} · ${state.answers.length} questions answered`;
  document.getElementById("summaryScore").textContent = session.score;

  const pct = session.score / 100;
  const circumference = 427;
  const offset = circumference - pct * circumference;
  setTimeout(() => {
    document.getElementById("summaryRingFill").style.strokeDashoffset = offset;
  }, 100);

  const bd = [
    { label: "Relevance",  val: avgBreakdown.relevance,  max: 30, color: "#ff6b6b" },
    { label: "Clarity",    val: avgBreakdown.clarity,    max: 15, color: "#ffd93d" },
    { label: "Technical",  val: avgBreakdown.technical,  max: 30, color: "#6bcb77" },
    { label: "Grammar",    val: avgBreakdown.grammar,    max: 15, color: "#4d96ff" },
    { label: "Confidence", val: avgBreakdown.confidence, max: 10, color: "#c77dff" },
  ];
  document.getElementById("summaryBreakdown").innerHTML = bd.map(b => `
    <div class="summary-row">
      <span class="summary-row-label">${b.label}</span>
      <div class="summary-row-bar"><div class="summary-row-fill" style="width:${(b.val/b.max)*100}%;background:${b.color}"></div></div>
      <span class="summary-row-score" style="color:${b.color}">${Math.round(b.val)}/${b.max}</span>
    </div>
  `).join("");

  const allTips = state.scores.flatMap(s => s.tips || []).filter(Boolean);
  const uniqueTips = [...new Set(allTips)].slice(0, 4);
  const tipColors = ["#ff6b6b","#ffd93d","#6bcb77","#4d96ff"];
  if (uniqueTips.length > 0) {
    document.getElementById("resultsTips").innerHTML = `
      <h4>💡 Key Improvement Tips</h4>
      ${uniqueTips.map((t,i) => `<div class="tip-item"><div class="tip-dot" style="background:${tipColors[i%tipColors.length]}"></div><span>${t}</span></div>`).join("")}
    `;
  }

  updateHomeStats();
  updateBadges();
}

// ─── Dashboard ───────────────────────────
function renderDashboard() {
  const total = sessions.length;
  const scores = sessions.map(s => s.score);
  const avgScoreVal = total > 0 ? Math.round(avg(scores)) : null;
  const bestScoreVal = total > 0 ? Math.max(...scores) : null;
  const lastScore = total > 0 ? scores[0] : null;
  const trendVal = total > 1 ? (lastScore - avgScoreVal) : null;

  document.getElementById("kpiTotal").textContent = total;
  document.getElementById("kpiAvg").textContent   = avgScoreVal !== null ? `${avgScoreVal}` : "—";
  document.getElementById("kpiBest").textContent  = bestScoreVal !== null ? `${bestScoreVal}` : "—";
  document.getElementById("kpiTrend").textContent = trendVal !== null ? (trendVal >= 0 ? `+${trendVal}` : `${trendVal}`) : "—";

  const ctx = document.getElementById("progressChart").getContext("2d");
  if (window._progressChart) window._progressChart.destroy();

  if (total > 0) {
    document.getElementById("noDataMsg").style.display = "none";
    const labels = sessions.slice().reverse().map((s, i) => `#${i+1}`);
    const data   = sessions.slice().reverse().map(s => s.score);

    window._progressChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Score",
          data,
          borderColor: "#ff6b6b",
          backgroundColor: "rgba(255,107,107,0.1)",
          borderWidth: 2.5,
          pointBackgroundColor: data.map(v => v >= 80 ? "#6bcb77" : v >= 60 ? "#ffd93d" : "#ff6b6b"),
          pointRadius: 5,
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` Score: ${ctx.parsed.y}/100` } }
        },
        scales: {
          x: { grid: { color: "#2e2e48" }, ticks: { color: "#6060a0" } },
          y: { min: 0, max: 100, grid: { color: "#2e2e48" }, ticks: { color: "#6060a0" } }
        }
      }
    });
  } else {
    document.getElementById("noDataMsg").style.display = "flex";
  }

  const rctx = document.getElementById("radarChart").getContext("2d");
  if (window._radarChart) window._radarChart.destroy();

  if (total > 0) {
    document.getElementById("noRadarMsg").style.display = "none";
    const latest = sessions[0].breakdown;
    const radPct = [
      (latest.relevance  / 30) * 100,
      (latest.clarity    / 15) * 100,
      (latest.technical  / 30) * 100,
      (latest.grammar    / 15) * 100,
      (latest.confidence / 10) * 100,
    ];

    window._radarChart = new Chart(rctx, {
      type: "radar",
      data: {
        labels: ["Relevance","Clarity","Technical","Grammar","Confidence"],
        datasets: [{
          data: radPct,
          borderColor: "#c77dff",
          backgroundColor: "rgba(199,125,255,0.15)",
          borderWidth: 2,
          pointBackgroundColor: "#c77dff",
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            min: 0, max: 100,
            grid: { color: "#2e2e48" },
            ticks: { display: false },
            pointLabels: { color: "#a0a0c0", font: { size: 11 } }
          }
        }
      }
    });
  } else {
    document.getElementById("noRadarMsg").style.display = "flex";
  }

  const streakList = document.getElementById("streakList");
  if (sessions.length < 2) {
    streakList.innerHTML = `<p class="muted">Complete 2+ sessions to see improvement data.</p>`;
  } else {
    const items = sessions.slice(0, 5).map((s, i) => {
      if (i === sessions.length - 1) return null;
      const prev = sessions[i + 1];
      const diff = s.score - prev.score;
      const arrow = diff >= 0 ? "▲" : "▼";
      const cls   = diff >= 0 ? "streak-arrow" : "streak-arrow down";
      return `<div class="streak-item">
        <span>${s.date}</span>
        <span style="margin-left:auto;margin-right:8px">${s.score}/100</span>
        <span class="${cls}">${arrow} ${Math.abs(diff)} pts</span>
      </div>`;
    }).filter(Boolean);
    streakList.innerHTML = items.join("") || `<p class="muted">Not enough data.</p>`;
  }

  updateBadges();
}

function updateBadges() {
  const scores = sessions.map(s => s.score);
  const total = sessions.length;
  const bestScoreVal = total > 0 ? Math.max(...scores) : 0;
  const avgScoreVal  = total > 0 ? Math.round(avg(scores)) : 0;
  const first = sessions.length > 0 ? sessions[sessions.length-1].score : 0;
  const last  = sessions.length > 0 ? sessions[0].score : 0;
  const improved = last - first;

  const conditions = [
    bestScoreVal >= 90,
    total >= 3,
    scores.some(s => s >= 95),
    total >= 10,
    improved >= 20,
    avgScoreVal >= 80
  ];

  document.querySelectorAll(".badge-item").forEach((el, i) => {
    el.classList.toggle("unlocked", !!conditions[i]);
    el.classList.toggle("locked",   !conditions[i]);
  });
}

// ─── History ─────────────────────────────
function renderHistory() {
  const list = document.getElementById("historyList");
  if (sessions.length === 0) {
    list.innerHTML = `<div class="empty-history">
      <div class="empty-icon">📋</div>
      <p>No sessions yet. <button class="link-btn" onclick="showPage('interview')">Start your first practice!</button></p>
    </div>`;
    return;
  }

  const colors = { relevance:"#ff6b6b", clarity:"#ffd93d", technical:"#6bcb77", grammar:"#4d96ff", confidence:"#c77dff" };
  list.innerHTML = sessions.map(s => {
    const scoreColor = s.score >= 80 ? "#6bcb77" : s.score >= 60 ? "#ffd93d" : "#ff6b6b";
    const bd = s.breakdown;
    return `<div class="history-item">
      <div class="history-score" style="color:${scoreColor}">${s.score}</div>
      <div class="history-info">
        <div class="history-title">${s.role} — ${s.type} Round</div>
        <div class="history-meta">
          <span><i class="fa-regular fa-calendar"></i> ${s.date}</span>
          <span><i class="fa-solid fa-user"></i> ${s.name}</span>
          <span><i class="fa-solid fa-signal"></i> ${s.difficulty}</span>
          <span><i class="fa-solid fa-list"></i> ${s.answered}/${s.questions} Q</span>
        </div>
      </div>
      <div class="history-scores">
        ${Object.entries(bd).map(([k,v]) => `<span class="mini-score" style="background:${colors[k]}22;color:${colors[k]}">${k.slice(0,3).toUpperCase()}: ${Math.round(v)}</span>`).join("")}
      </div>
    </div>`;
  }).join("");
}

function clearHistory() {
  if (sessions.length === 0) { showToast("No history to clear."); return; }
  if (confirm("Clear all session history? This cannot be undone.")) {
    sessions = [];
    localStorage.removeItem("iiq_sessions");
    renderHistory();
    updateHomeStats();
    showToast("History cleared.");
  }
}

// ─── Home Stats ──────────────────────────
function updateHomeStats() {
  const total = sessions.length;
  const scores = sessions.map(s => s.score);
  document.getElementById("totalSessions").textContent = total;
  document.getElementById("avgScoreHome").textContent  = total > 0 ? Math.round(avg(scores)) : "—";
  document.getElementById("bestScore").textContent     = total > 0 ? Math.max(...scores) : "—";
}

// ─── Voice input (text mode) ─────────────
function toggleMic() {
  if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
    showToast("Voice input not supported in this browser."); return;
  }

  const micBtn = document.getElementById("micBtn");

  if (isRecording_text) {
    recognition?.stop();
    isRecording_text = false;
    micBtn.classList.remove("recording");
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onresult = (e) => {
    let transcript = "";
    for (let i = 0; i < e.results.length; i++) {
      transcript += e.results[i][0].transcript;
    }
    document.getElementById("answerBox").value = transcript;
    updateWordCount();
  };

  recognition.onerror = () => {
    isRecording_text = false;
    micBtn.classList.remove("recording");
    showToast("Voice recognition error. Please try again.");
  };

  recognition.onend = () => {
    isRecording_text = false;
    micBtn.classList.remove("recording");
  };

  recognition.start();
  isRecording_text = true;
  micBtn.classList.add("recording");
  showToast("Listening… speak your answer.");
}


/* ══════════════════════════════════════════
   WEBSITE 2 — LIVE VIDEO INTERVIEW LOGIC
══════════════════════════════════════════ */

const LIVE_QUESTIONS = [
  { id: 1, text: "Tell me about yourself and your background in software development." },
  { id: 2, text: "Explain the concept of time complexity and give an example of O(n log n)." },
  { id: 3, text: "How would you design a URL shortening service like bit.ly at scale?" },
  { id: 4, text: "Describe a challenging bug you encountered and how you resolved it." },
  { id: 5, text: "What is your approach to writing clean, maintainable code?" },
];

const FILLER_WORDS = [
  'um', 'uh', 'like', 'you know', 'basically', 'literally',
  'actually', 'right', 'so', 'i mean', 'kind of', 'sort of'
];

// ─── Live state ───────────────────────────
let liveStream      = null;
let audioCtx        = null;
let analyser        = null;
let liveRecognition = null;
let hasSTT          = false;

let isRecording_live = false;
let sessionStart     = null;
let answerStart      = null;

let timerInterval    = null;
let eyeInterval      = null;
let simInterval      = null;
let audioAnimFrame   = null;
let timerSec         = 120;

let liveCurrentQ    = 0;
let eyePct          = 0;
let wordCount       = 0;
let answerDuration  = 0;

let fillerCounts    = {};
let feedbackLog     = [];
let fullTranscript  = '';
let liveScoreData   = {};

const audioBars     = [];

// ─── Launch / Exit Live Interview ────────
function launchLiveInterview() {
  // Reset live state
  liveCurrentQ  = 0;
  eyePct        = 0;
  wordCount     = 0;
  answerDuration = 0;
  fillerCounts  = {};
  feedbackLog   = [];
  fullTranscript = '';
  liveScoreData = {};
  isRecording_live = false;
  sessionStart  = null;
  answerStart   = null;

  // Clear audio bars array and rebuild
  audioBars.length = 0;
  const container = document.getElementById('audioVis');
  container.innerHTML = '';
  for (let i = 0; i < 40; i++) {
    const bar = document.createElement('div');
    bar.className   = 'audio-bar';
    bar.style.height = '4px';
    container.appendChild(bar);
    audioBars.push(bar);
  }

  // Build question select list
  buildQuestionSelect();

  // Hide main content, show live overlay
  document.getElementById("mainContent").style.display = "none";
  document.getElementById("sidebar").style.display = "none";
  const overlay = document.getElementById("liveInterviewOverlay");
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";

  // Show onboarding, reset report
  document.getElementById("onboarding").style.display = "flex";
  document.getElementById("onboard-step-1").style.display = "block";
  document.getElementById("onboard-step-2").style.display = "none";
  document.getElementById("report").style.display = "none";

  // Reset permission statuses
  setPermStatus("ps-cam", "PENDING", "ps-pending");
  setPermStatus("ps-mic", "PENDING", "ps-pending");

  // Reset button states
  document.getElementById("btnRecord").disabled = true;
  document.getElementById("btnStop").disabled   = true;

  // Clear live timeline
  document.getElementById("liveTl").innerHTML = "";
  document.getElementById("fillerGrid").innerHTML = "";
  document.getElementById("fillerTlWrap").innerHTML = "";
  document.getElementById("liveTranscript").innerHTML = '<span class="transcript-placeholder">Start your answer to see transcript…</span>';
  document.getElementById("scoreBreakdown").innerHTML = "";
  document.getElementById("scoreNum").textContent = "—";
  document.getElementById("scoreGrade").textContent = "Complete an answer to see score";

  // Reset score ring
  const scoreRing = document.getElementById("scoreRing");
  if (scoreRing) scoreRing.style.strokeDashoffset = "263.9";

  // Reset recording badge
  document.getElementById("recBadge").classList.remove("active");

  // Start audio animation
  animateAudio();
}

function exitLiveInterview() {
  // Stop any active recording
  if (isRecording_live) {
    isRecording_live = false;
    if (liveRecognition) { try { liveRecognition.stop(); } catch(e) {} }
  }

  // Stop timers
  clearInterval(timerInterval);
  clearInterval(eyeInterval);
  clearInterval(simInterval);
  cancelAnimationFrame(audioAnimFrame);

  // Stop media stream
  if (liveStream) {
    liveStream.getTracks().forEach(t => t.stop());
    liveStream = null;
  }

  // Reset video element
  const vid = document.getElementById("webcam");
  vid.srcObject = null;
  vid.classList.remove("active");
  document.getElementById("videoPlaceholder").style.display = "flex";

  // Hide overlay, show main content
  document.getElementById("liveInterviewOverlay").style.display = "none";
  document.getElementById("mainContent").style.display = "block";
  document.getElementById("sidebar").style.display = "flex";

  // Return to setup screen
  showPage("interview");
}

// ─── Build question select list ──────────
function buildQuestionSelect() {
  const grid = document.getElementById('qSelectGrid');
  grid.innerHTML = '';

  LIVE_QUESTIONS.forEach((q, i) => {
    const el = document.createElement('div');
    el.className = 'q-opt' + (i === 0 ? ' selected' : '');
    el.innerHTML = `
      <div class="q-opt-num">Q${q.id}</div>
      <div class="q-opt-text">${q.text}</div>
    `;
    el.addEventListener('click', () => {
      document.querySelectorAll('.q-opt').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
      liveCurrentQ = i;
    });
    grid.appendChild(el);
  });
}

// ─── Question nav dots ────────────────────
function buildQNav() {
  const nav = document.getElementById('qNav');
  nav.innerHTML = '';

  LIVE_QUESTIONS.forEach((q, i) => {
    const dot = document.createElement('div');
    dot.className = 'q-dot' + (i === liveCurrentQ ? ' active' : '');
    dot.textContent = q.id;
    dot.title = q.text;
    dot.addEventListener('click', () => {
      if (!isRecording_live) loadLiveQuestion(i);
    });
    nav.appendChild(dot);
  });
}

function loadLiveQuestion(idx) {
  liveCurrentQ = idx;
  document.getElementById('qText').textContent  = LIVE_QUESTIONS[idx].text;
  document.getElementById('qBadge').textContent = `Q ${idx + 1} / ${LIVE_QUESTIONS.length}`;
  buildQNav();
  resetTimer();
}

// ─── Permissions & Camera ─────────────────
document.getElementById('requestPerms').addEventListener('click', async () => {
  try {
    liveStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

    setPermStatus('ps-cam', 'GRANTED', 'ps-ok');
    setPermStatus('ps-mic', 'GRANTED', 'ps-ok');
    document.getElementById('camInd').className = 'ind ind-green';
    document.getElementById('micInd').className = 'ind ind-green';

    const vid = document.getElementById('webcam');
    vid.srcObject = liveStream;
    vid.onloadedmetadata = () => {
      vid.classList.add('active');
      document.getElementById('videoPlaceholder').style.display = 'none';
      setupFaceCanvas();
    };

    audioCtx  = new AudioContext();
    const src = audioCtx.createMediaStreamSource(liveStream);
    analyser  = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    src.connect(analyser);

    setupSTT();

    setTimeout(() => {
      document.getElementById('onboard-step-1').style.display = 'none';
      document.getElementById('onboard-step-2').style.display = 'block';
    }, 600);

  } catch (err) {
    setPermStatus('ps-cam', 'DENIED', 'ps-err');
    setPermStatus('ps-mic', 'DENIED', 'ps-err');
    showDemoMode();
  }
});

function setPermStatus(id, text, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className   = 'perm-status ' + cls;
}

function showDemoMode() {
  setPermStatus('ps-cam', 'DEMO', 'ps-pending');
  setPermStatus('ps-mic', 'DEMO', 'ps-pending');
  document.getElementById('onboard-step-1').style.display = 'none';
  document.getElementById('onboard-step-2').style.display = 'block';
  startSimulatedMetrics();
}

// ─── Start Live Interview ─────────────────
document.getElementById('startLiveInterview').addEventListener('click', () => {
  document.getElementById('onboarding').style.display = 'none';
  loadLiveQuestion(liveCurrentQ);
  document.getElementById('btnRecord').disabled = false;
  startEyeSimulation();
  sessionStart = Date.now();
});

// ─── Face Mesh Canvas ─────────────────────
function setupFaceCanvas() {
  const canvas = document.getElementById('faceCanvas');
  const vid    = document.getElementById('webcam');
  canvas.width  = vid.videoWidth  || 640;
  canvas.height = vid.videoHeight || 480;
  drawFaceMesh(canvas);
}

function drawFaceMesh(canvas) {
  const ctx = canvas.getContext('2d');

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w  = canvas.width;
    const h  = canvas.height;
    const cx = w / 2;
    const cy = h * 0.42;

    ctx.strokeStyle = 'rgba(0,212,255,0.4)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.16, h * 0.22, 0, 0, Math.PI * 2);
    ctx.stroke();

    const eyeY    = cy - h * 0.04;
    const lx      = cx - w * 0.07;
    const rx      = cx + w * 0.07;
    const eyeOpen = eyePct > 50;

    ctx.setLineDash([]);

    [lx, rx].forEach(ex => {
      ctx.strokeStyle = 'rgba(0,212,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, w * 0.035, h * 0.015 * (eyeOpen ? 0.8 : 0.3), 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(0,212,255,0.8)';
      ctx.beginPath();
      ctx.arc(ex, eyeY, 3, 0, Math.PI * 2);
      ctx.fill();

      if (eyeOpen) {
        ctx.strokeStyle = 'rgba(0,212,255,0.2)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(ex, eyeY);
        ctx.lineTo(cx + (ex - cx) * 0.5, cy - h * 0.35);
        ctx.stroke();
      }
    });

    ctx.strokeStyle = 'rgba(0,212,255,0.25)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, eyeY + 8);
    ctx.lineTo(cx, cy + h * 0.04);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(0,212,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + h * 0.08, w * 0.07, h * 0.015 * (isRecording_live ? 1.4 : 1), 0, 0, Math.PI * 2);
    ctx.stroke();

    [[cx - w * 0.13, cy], [cx + w * 0.13, cy]].forEach(([px, py]) => {
      ctx.fillStyle = 'rgba(0,212,255,0.3)';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  draw();
}

// ─── Audio Visualizer ─────────────────────
function animateAudio() {
  if (!analyser) {
    audioBars.forEach(b => {
      b.style.height  = (isRecording_live ? Math.random() * 40 + 4 : 4) + 'px';
      b.style.opacity = isRecording_live ? 0.7 : 0.2;
    });
    audioAnimFrame = requestAnimationFrame(animateAudio);
    return;
  }

  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);

  audioBars.forEach((b, i) => {
    const val = data[Math.floor(i * data.length / audioBars.length)] / 255;
    b.style.height  = Math.max(4, val * 50) + 'px';
    b.style.opacity = isRecording_live ? Math.max(0.3, val) : 0.2;
  });

  audioAnimFrame = requestAnimationFrame(animateAudio);
}

// ─── Speech-to-Text ───────────────────────
function setupSTT() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { hasSTT = false; return; }

  hasSTT = true;
  liveRecognition = new SpeechRecognition();
  liveRecognition.continuous      = true;
  liveRecognition.interimResults  = true;
  liveRecognition.lang            = 'en-US';

  liveRecognition.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const text = e.results[i][0].transcript;
      if (e.results[i].isFinal) {
        processTranscript(text);
        fullTranscript += text + ' ';
      } else {
        interim = text;
      }
    }
    updateTranscriptDisplay(fullTranscript, interim);
  };

  liveRecognition.onerror = () => {};
}

// ─── Transcript Processing ────────────────
function processTranscript(text) {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  wordCount += words.length;

  FILLER_WORDS.forEach(fw => {
    const re      = new RegExp('\\b' + fw + '\\b', 'gi');
    const matches = text.match(re);
    if (matches) {
      fillerCounts[fw] = (fillerCounts[fw] || 0) + matches.length;
      const ts = getTimestamp();
      feedbackLog.push({ ts, type: 'filler', msg: `Said "${fw}" ${matches.length}×`, sev: 'warn' });
      addLiveFeedback(ts, 'filler', `Filler detected: "${fw}" ×${matches.length}`, 'warn');
      updateFillerTab();
    }
  });

  updateLiveMetrics();
}

function updateTranscriptDisplay(finalText, interim) {
  const el  = document.getElementById('liveTranscript');
  let html  = highlightFillers(finalText);
  if (interim) html += `<span style="color:var(--text3-v2)">${interim}</span>`;
  el.innerHTML  = html || '<span class="transcript-placeholder">Listening…</span>';
  el.scrollTop  = el.scrollHeight;
}

function highlightFillers(text) {
  let out = text;
  FILLER_WORDS.forEach(fw => {
    const re = new RegExp('\\b(' + fw + ')\\b', 'gi');
    out = out.replace(re, '<span class="filler-highlight" title="Filler word">$1</span>');
  });
  return out;
}

// ─── Simulated STT (fallback) ─────────────
function simulateFakeSTT() {
  const samples = [
    "So um I think the best approach would be to uh basically use a hash map",
    "You know, like the time complexity is actually O of n log n",
    "I mean, kind of similar to merge sort um where we split the array",
    "Right so the idea is to basically um yeah combine the sorted halves",
    "Like I said, uh the key insight is actually the divide and conquer strategy"
  ];
  let idx = 0;

  simInterval = setInterval(() => {
    if (!isRecording_live) { clearInterval(simInterval); return; }
    const text = samples[idx % samples.length];
    processTranscript(text);
    fullTranscript += text + ' ';
    updateTranscriptDisplay(fullTranscript, '');
    idx++;
  }, 3500);
}

// ─── Recording Controls ───────────────────
document.getElementById('btnRecord').addEventListener('click', startLiveRecording);
document.getElementById('btnStop').addEventListener('click', stopLiveRecording);
document.getElementById('btnSkip').addEventListener('click', () => {
  if (isRecording_live) stopLiveRecording();
  loadLiveQuestion((liveCurrentQ + 1) % LIVE_QUESTIONS.length);
});

function startLiveRecording() {
  isRecording_live = true;
  answerStart    = Date.now();
  wordCount      = 0;
  fullTranscript = '';

  document.getElementById('recBadge').classList.add('active');
  document.getElementById('btnRecord').disabled = true;
  document.getElementById('btnStop').disabled   = false;

  startTimer();

  if (hasSTT && liveRecognition) {
    try { liveRecognition.start(); } catch (e) {}
  } else {
    simulateFakeSTT();
  }

  addLiveFeedback(getTimestamp(), 'system', 'Recording started — answer the question', 'info');
}

function stopLiveRecording() {
  if (!isRecording_live) return;

  isRecording_live = false;
  answerDuration = (Date.now() - answerStart) / 1000;

  document.getElementById('recBadge').classList.remove('active');
  document.getElementById('btnRecord').disabled = false;
  document.getElementById('btnStop').disabled   = true;

  clearInterval(timerInterval);

  if (hasSTT && liveRecognition) {
    try { liveRecognition.stop(); } catch (e) {}
  }

  computeLiveScore();

  const dots = document.querySelectorAll('.q-dot');
  if (dots[liveCurrentQ]) dots[liveCurrentQ].classList.add('done');

  addLiveFeedback(getTimestamp(), 'system', 'Answer recorded — nice work!', 'good');
  feedbackLog.push({
    ts:   getTimestamp(),
    type: 'system',
    msg:  `Answer #${liveCurrentQ + 1} complete. Duration: ${Math.round(answerDuration)}s`,
    sev:  'good'
  });
}

// ─── Timer ────────────────────────────────
function resetTimer() {
  timerSec = 120;
  renderTimer();
}

function renderTimer() {
  const m  = String(Math.floor(timerSec / 60)).padStart(2, '0');
  const s  = String(timerSec % 60).padStart(2, '0');
  const el = document.getElementById('qTimer');
  el.textContent = `${m}:${s}`;
  el.className   = 'q-timer2' + (timerSec <= 10 ? ' danger' : timerSec <= 30 ? ' warning' : '');
}

function startTimer() {
  timerSec = 120;
  timerInterval = setInterval(() => {
    timerSec--;
    renderTimer();
    if (timerSec <= 0) {
      stopLiveRecording();
      clearInterval(timerInterval);
    }
  }, 1000);
}

// ─── Eye Contact Simulation ───────────────
function startEyeSimulation() {
  let trend      = 75;
  let eyeTotal   = 0;
  let eyeSamples = 0;

  eyeInterval = setInterval(() => {
    trend = Math.max(20, Math.min(100, trend + (Math.random() - 0.4) * 15));
    eyePct = Math.round(trend);

    eyeTotal  += eyePct;
    eyeSamples++;
    const avgEye = Math.round(eyeTotal / eyeSamples);

    const col = eyePct > 65 ? 'var(--green2)' : eyePct > 40 ? 'var(--accent3-v2)' : 'var(--red2)';

    const fill   = document.getElementById('eyeFill');
    const pctEl  = document.getElementById('eyePct');
    const metric = document.getElementById('eyeMetric');
    const ring   = document.getElementById('eyeRing');

    if (fill)   { fill.style.width = eyePct + '%'; fill.style.background = col; }
    if (pctEl)  { pctEl.textContent = eyePct + '%'; pctEl.style.color = col; }
    if (metric) { metric.textContent = avgEye + '%'; metric.className = 'metric-value ' + (avgEye > 65 ? 'good2' : avgEye > 40 ? 'warn2' : 'bad2'); }
    if (ring)   { ring.style.strokeDashoffset = 169.6 * (1 - eyePct / 100); ring.setAttribute('stroke', col.replace('var(', '').replace(')', '')); }

    const statusEl = document.getElementById('eyeStatus');
    if (statusEl) statusEl.textContent = eyePct > 65 ? '✓ Good contact' : eyePct > 40 ? '⚠ Moderate' : '✗ Low contact';

    if (isRecording_live && eyePct < 35 && Math.random() < 0.15) {
      const ts = getTimestamp();
      addLiveFeedback(ts, 'eye', 'Low eye contact detected — look at the camera', 'warn');
      feedbackLog.push({ ts, type: 'eye_contact', msg: `Eye contact dropped to ${eyePct}%`, sev: 'warn' });
    }
  }, 1200);
}

// ─── Live Metrics ─────────────────────────
function updateLiveMetrics() {
  const total    = Object.values(fillerCounts).reduce((a, b) => a + b, 0);
  const fillerEl = document.getElementById('fillerMetric');
  if (fillerEl) {
    fillerEl.textContent = total;
    fillerEl.className   = 'metric-value ' + (total < 3 ? 'good2' : total < 7 ? 'warn2' : 'bad2');
  }

  const dur    = isRecording_live ? (Date.now() - answerStart) / 1000 : (answerDuration || 1);
  const wpm    = Math.round((wordCount / dur) * 60);
  const paceEl = document.getElementById('paceMetric');
  if (paceEl) {
    paceEl.textContent = wpm || '—';
    if (wpm) paceEl.className = 'metric-value ' + (wpm >= 100 && wpm <= 180 ? 'good2' : wpm < 80 ? 'bad2' : 'warn2');
  }
  const subEl = document.getElementById('paceSub');
  if (subEl && wpm) subEl.textContent = `WPM — ${wpm < 100 ? 'Too slow' : wpm > 180 ? 'Too fast' : 'Good pace'}`;

  const conf    = computeConfidence();
  const confEl  = document.getElementById('confMetric');
  if (confEl) {
    confEl.textContent = conf ? conf + '%' : '—';
    confEl.className   = 'metric-value ' + (conf > 70 ? 'good2' : conf > 50 ? 'warn2' : 'bad2');
  }
}

function computeConfidence() {
  if (!wordCount) return null;
  const fTotal        = Object.values(fillerCounts).reduce((a, b) => a + b, 0);
  const fillerPenalty = Math.min(40, fTotal * 5);
  const dur           = isRecording_live ? (Date.now() - answerStart) / 1000 : (answerDuration || 1);
  const wpm           = Math.round((wordCount / dur) * 60);
  const pacePenalty   = (wpm < 80 || wpm > 200) ? 15 : 0;
  return Math.max(0, Math.round((eyePct * 0.4) + (70 * 0.3) + ((100 - fillerPenalty - pacePenalty) * 0.3)));
}

// ─── Filler Tab ───────────────────────────
function updateFillerTab() {
  const grid = document.getElementById('fillerGrid');
  grid.innerHTML = '';

  Object.entries(fillerCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([word, count]) => {
      const cls = count >= 5 ? 'fc-high' : count >= 3 ? 'fc-med' : 'fc-low';
      const div = document.createElement('div');
      div.className = 'filler-chip';
      div.innerHTML = `
        <span class="filler-word">"${word}"</span>
        <span class="filler-count ${cls}">${count}×</span>
      `;
      grid.appendChild(div);
    });

  const tl = document.getElementById('fillerTlWrap');
  tl.innerHTML = '';
  feedbackLog
    .filter(x => x.type === 'filler')
    .slice(-8)
    .forEach(x => {
      const d = document.createElement('div');
      d.className = 'tl-item';
      d.innerHTML = `
        <span class="tl-ts">${x.ts}</span>
        <div class="tl-body"><div class="tl-msg">${x.msg}</div></div>
      `;
      tl.appendChild(d);
    });
}

// ─── Live Feedback Timeline ───────────────
function addLiveFeedback(ts, type, msg, sev) {
  const tl     = document.getElementById('liveTl');
  const sevMap = { warn: 'sev-warn', bad: 'sev-bad', good: 'sev-good', info: 'sev-info' };

  const div = document.createElement('div');
  div.className = 'tl-item fade-in';
  div.innerHTML = `
    <span class="tl-ts">${ts}</span>
    <div class="tl-body">
      <div class="tl-type">${type.replace('_', ' ')}</div>
      <div class="tl-msg">${msg}</div>
    </div>
    <span class="tl-sev ${sevMap[sev] || 'sev-info'}"></span>
  `;

  tl.insertBefore(div, tl.firstChild);
  while (tl.children.length > 12) tl.removeChild(tl.lastChild);
}

// ─── Score Computation ────────────────────
function computeLiveScore() {
  const fTotal       = Object.values(fillerCounts).reduce((a, b) => a + b, 0);
  const fillerScore  = Math.max(0, 100 - fTotal * 8);
  const eyeScore     = eyePct;
  const dur          = answerDuration || 1;
  const wpm          = Math.round((wordCount / dur) * 60);
  const paceScore    = (wpm >= 100 && wpm <= 180) ? 100 : wpm >= 80 ? 75 : 50;
  const contentScore = Math.min(100, wordCount * 1.2);
  const overall      = Math.round(fillerScore * 0.25 + eyeScore * 0.25 + paceScore * 0.25 + contentScore * 0.25);

  liveScoreData = { overall, fillerScore, eyeScore, paceScore, contentScore, fTotal, wpm, wordCount };
  renderLiveScore();
}

function renderLiveScore() {
  const { overall, fillerScore, eyeScore, paceScore, contentScore } = liveScoreData;

  const numEl   = document.getElementById('scoreNum');
  const gradeEl = document.getElementById('scoreGrade');
  const ring    = document.getElementById('scoreRing');

  if (numEl)   numEl.textContent = overall;
  if (ring)    ring.style.strokeDashoffset = 263.9 * (1 - overall / 100);
  if (gradeEl) gradeEl.textContent =
    overall >= 85 ? 'Excellent 🏆' :
    overall >= 70 ? 'Good ✅'      :
    overall >= 55 ? 'Fair ⚠️'      : 'Needs Work ❌';

  const breakdown = document.getElementById('scoreBreakdown');
  if (breakdown) {
    const rows = [
      ['Eye contact',    eyeScore,     'var(--green2)'],
      ['Filler words',   fillerScore,  'var(--orange2)'],
      ['Speaking pace',  paceScore,    'var(--accent-v2)'],
      ['Content length', contentScore, 'var(--accent2-v2)'],
    ];
    breakdown.innerHTML = rows.map(([label, value, color]) => `
      <div class="score-row">
        <span class="score-row-label">${label}</span>
        <div class="score-bar-track">
          <div class="score-bar-fill" style="width:${value}%;background:${color}"></div>
        </div>
        <span class="score-row-num" style="color:${color}">${Math.round(value)}</span>
      </div>
    `).join('');
  }
}

// ─── Tabs (live panel) ────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const parentPanel = tab.closest('.analytics-panel');
    if (!parentPanel) return;
    parentPanel.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    parentPanel.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const pane = document.getElementById('pane-' + tab.dataset.tab);
    if (pane) pane.classList.add('active');
  });
});

// ─── Report ───────────────────────────────
document.getElementById('btnReport').addEventListener('click', showLiveReport);
document.getElementById('closeReport').addEventListener('click', () => {
  document.getElementById('report').style.display = 'none';
});
document.getElementById('restartBtn').addEventListener('click', () => {
  document.getElementById('report').style.display = 'none';
  exitLiveInterview();
  setTimeout(() => launchLiveInterview(), 100);
});

function showLiveReport() {
  if (!sessionStart) { showToast('Complete at least one answer first!'); return; }
  if (isRecording_live) stopLiveRecording();

  const reportEl = document.getElementById('report');
  reportEl.style.display = 'block';
  reportEl.scrollTop = 0;

  const dur = Math.round((Date.now() - sessionStart) / 1000);
  document.getElementById('report-sub').textContent =
    `Session duration: ${Math.floor(dur / 60)}m ${dur % 60}s  •  Questions attempted: ${LIVE_QUESTIONS.length}  •  Generated: ${new Date().toLocaleTimeString()}`;

  const fTotal2 = Object.values(fillerCounts).reduce((a, b) => a + b, 0);
  document.getElementById('report-metrics').innerHTML = `
    <div class="report-metric">
      <div class="rm-val" style="color:var(--accent-v2)">${liveScoreData.overall || '—'}</div>
      <div class="rm-label">Overall Score</div>
    </div>
    <div class="report-metric">
      <div class="rm-val" style="color:var(--red2)">${fTotal2}</div>
      <div class="rm-label">Filler Words</div>
    </div>
    <div class="report-metric">
      <div class="rm-val" style="color:var(--green2)">${eyePct}%</div>
      <div class="rm-label">Eye Contact</div>
    </div>
  `;

  const tlEl  = document.getElementById('report-timeline');
  tlEl.innerHTML = '';
  const logs  = feedbackLog.length ? feedbackLog : [{ ts: '00:00', type: 'system', msg: 'No events recorded — try answering a question!' }];
  logs.forEach(x => {
    const d = document.createElement('div');
    d.className = 'rtl-item';
    d.innerHTML = `
      <span class="rtl-ts">${x.ts}</span>
      <div class="rtl-body">
        <div class="rtl-type">${x.type.replace(/_/g, ' ')}</div>
        <div class="rtl-msg">${x.msg}</div>
      </div>
    `;
    tlEl.appendChild(d);
  });

  const advice = [];
  if (fTotal2 > 5) {
    advice.push({ t: 'Reduce filler words', d: `You used ${fTotal2} filler words. Practice pausing silently instead of saying "um" or "uh".`, c: 'bad' });
  } else {
    advice.push({ t: 'Great filler word control!', d: 'You kept filler words under control. Keep it up.', c: 'good' });
  }
  if (eyePct < 60) {
    advice.push({ t: 'Improve eye contact', d: 'Look directly at your camera lens. It simulates eye contact in real video interviews.', c: 'bad' });
  } else {
    advice.push({ t: 'Strong eye contact', d: 'You maintained good eye contact throughout. This builds trust with interviewers.', c: 'good' });
  }
  if (liveScoreData.wpm > 0 && (liveScoreData.wpm < 100 || liveScoreData.wpm > 180)) {
    advice.push({ t: 'Adjust speaking pace', d: `Your pace was ~${liveScoreData.wpm} WPM. Aim for 120–160 WPM for clear, confident delivery.`, c: 'bad' });
  }
  advice.push({ t: 'Practice structure', d: 'Use the STAR method (Situation, Task, Action, Result) for behavioral questions.', c: '' });

  document.getElementById('report-advice').innerHTML =
    advice.map(a => `<div class="advice-item ${a.c}"><strong>${a.t}</strong><br>${a.d}</div>`).join('');

  document.getElementById('report-transcript').innerHTML =
    highlightFillers(fullTranscript) ||
    '<span style="color:var(--text3-v2);font-style:italic">No transcript recorded.</span>';
}

// ─── Demo mode ────────────────────────────
function startSimulatedMetrics() {
  setInterval(() => {
    audioBars.forEach(b => {
      b.style.height  = (isRecording_live ? Math.random() * 44 + 4 : 4) + 'px';
      b.style.opacity = isRecording_live ? 0.7 : 0.2;
    });
  }, 100);
}


/* ══════════════════════════════════════════
   SHARED UTILITIES
══════════════════════════════════════════ */

function getTimestamp() {
  if (!sessionStart) return '00:00';
  const s = Math.round((Date.now() - sessionStart) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function showLoading(msg) {
  document.getElementById("loadingMsg").textContent = msg || "Loading…";
  document.getElementById("loadingOverlay").style.display = "flex";
}

function hideLoading() {
  document.getElementById("loadingOverlay").style.display = "none";
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}


/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
(function init() {
  setTimeout(() => {
    const ring = document.getElementById("heroRing");
    if (ring) ring.style.strokeDashoffset = Math.round(314 * (1 - 0.82));
  }, 500);

  updateHomeStats();

  document.getElementById("interview-screen").style.display = "none";
  document.getElementById("results-screen").style.display = "none";
  document.getElementById("liveInterviewOverlay").style.display = "none";
})();
