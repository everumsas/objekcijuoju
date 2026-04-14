const STORAGE_KEY = "objekcijuoju_progress_v3";

let questions = [];
let progress = {};
let currentQuestion = null;
let answered = false;
let recentQuestionIds = [];

const RECENT_QUESTION_BLOCK_COUNT = 2;

async function init() {
  await loadQuestions();
  registerEvents();
  updateStats();
}

async function loadQuestions() {
  const response = await fetch("./questions.json", { cache: "no-store" });
  questions = await response.json();

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    progress = saved ? JSON.parse(saved) : {};
  } catch {
    progress = {};
  }

  for (const q of questions) {
    if (!progress[q.id]) {
      progress[q.id] = createEmptyProgress();
    }
  }

  saveProgress();
}

function createEmptyProgress() {
  return {
    streak: 0,
    correctTotal: 0,
    wrongTotal: 0,
    seenTotal: 0,
    mastered: false
  };
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function rebuildFreshProgress() {
  const fresh = {};
  for (const q of questions) {
    fresh[q.id] = createEmptyProgress();
  }
  return fresh;
}

function updateStats() {
  const total = questions.length;
  const mastered = questions.filter(q => progress[q.id]?.mastered).length;
  const remaining = total - mastered;
  const percent = total === 0 ? 0 : Math.round((mastered / total) * 100);

  document.getElementById("masteredCount").textContent = mastered;
  document.getElementById("totalCount").textContent = total;
  document.getElementById("remainingCount").textContent = remaining;
  document.getElementById("progressText").textContent = `${mastered} / ${total} išmokta (${percent}%)`;
  document.getElementById("progressFill").style.width = `${percent}%`;
}

function getQuestionWeight(question) {
  const p = progress[question.id];
  let weight = 1;

  weight += p.wrongTotal * 4;
  weight += Math.max(0, 3 - p.streak) * 2;

  return weight;
}

function addToRecentQuestions(questionId) {
  recentQuestionIds.push(questionId);

  while (recentQuestionIds.length > RECENT_QUESTION_BLOCK_COUNT) {
    recentQuestionIds.shift();
  }
}

function pickRandomWeightedQuestion(pool) {
  const weighted = [];

  for (const q of pool) {
    const weight = getQuestionWeight(q);
    for (let i = 0; i < weight; i++) {
      weighted.push(q);
    }
  }

  if (weighted.length === 0) return null;
  return weighted[Math.floor(Math.random() * weighted.length)];
}

function pickNextQuestion() {
  const available = questions.filter(q => !progress[q.id]?.mastered);

  if (available.length === 0) return null;

  let filtered = available.filter(q => !recentQuestionIds.includes(q.id));

  if (filtered.length === 0) {
    filtered = available;
  }

  return pickRandomWeightedQuestion(filtered);
}

function scrollToQuizTop() {
  const quizPanel = document.getElementById("quizPanel");
  if (!quizPanel) return;

  const top = quizPanel.getBoundingClientRect().top + window.scrollY - 8;
  window.scrollTo({
    top,
    behavior: "smooth"
  });
}

function startQuiz() {
  document.body.classList.add("quiz-active");
  document.getElementById("startPanel").classList.add("hidden");
  document.getElementById("quizPanel").classList.remove("hidden");
  showQuestion();
}

function showQuestion() {
  answered = false;
  currentQuestion = pickNextQuestion();

  if (!currentQuestion) {
    document.body.classList.remove("quiz-active");
    document.getElementById("quizPanel").classList.add("hidden");
    document.getElementById("startPanel").classList.remove("hidden");
    alert("Puiku. Šiuo metu visi klausimai pažymėti kaip išmokti.");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  addToRecentQuestions(currentQuestion.id);

  document.getElementById("questionCategory").textContent = currentQuestion.category || "Klausimas";
  document.getElementById("questionTitle").textContent = currentQuestion.question;
  document.getElementById("questionCounter").textContent =
    `Matytas ${progress[currentQuestion.id].seenTotal} kartus`;

  const answersContainer = document.getElementById("answersContainer");
  answersContainer.innerHTML = "";

  currentQuestion.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-btn";
    button.innerHTML = `<strong>${String.fromCharCode(65 + index)}.</strong> ${option}`;
    button.addEventListener("click", () => handleAnswer(index));
    answersContainer.appendChild(button);
  });

  document.getElementById("resultBox").classList.add("hidden");
  setTimeout(scrollToQuizTop, 80);
}

function handleAnswer(selectedIndex) {
  if (answered || !currentQuestion) return;
  answered = true;

  const p = progress[currentQuestion.id];
  p.seenTotal += 1;

  const buttons = document.querySelectorAll(".answer-btn");
  const isCorrect = selectedIndex === currentQuestion.correct;

  buttons.forEach((btn, index) => {
    btn.disabled = true;

    if (index === currentQuestion.correct) {
      btn.classList.add("correct");
    } else if (index === selectedIndex) {
      btn.classList.add("wrong");
    } else {
      btn.classList.add("neutral");
    }
  });

  const resultTitle = document.getElementById("resultTitle");
  const resultExplanation = document.getElementById("resultExplanation");
  const correctAnswerText = document.getElementById("correctAnswerText");

  if (isCorrect) {
    p.correctTotal += 1;
    p.streak += 1;
    if (p.streak >= 3) p.mastered = true;

    resultTitle.textContent = "Teisingai";
    resultTitle.className = "result-title good";
  } else {
    p.wrongTotal += 1;
    p.streak = 0;
    p.mastered = false;

    resultTitle.textContent = "Neteisingai";
    resultTitle.className = "result-title bad";
  }

  resultExplanation.textContent = currentQuestion.explanation || "";
  correctAnswerText.textContent = `Teisingas atsakymas: ${currentQuestion.options[currentQuestion.correct]}`;

  document.getElementById("resultBox").classList.remove("hidden");

  saveProgress();
  updateStats();

  setTimeout(scrollToQuizTop, 80);
}

function resetProgress() {
  if (!confirm("Ar tikrai nori ištrinti progresą?")) return;

  progress = rebuildFreshProgress();
  currentQuestion = null;
  answered = false;
  recentQuestionIds = [];

  localStorage.removeItem(STORAGE_KEY);
  saveProgress();
  updateStats();

  document.body.classList.remove("quiz-active");
  document.getElementById("quizPanel").classList.add("hidden");
  document.getElementById("startPanel").classList.remove("hidden");
  document.getElementById("answersContainer").innerHTML = "";
  document.getElementById("resultBox").classList.add("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function backToStart() {
  document.body.classList.remove("quiz-active");
  document.getElementById("quizPanel").classList.add("hidden");
  document.getElementById("startPanel").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function registerEvents() {
  document.getElementById("startBtn").addEventListener("click", startQuiz);
  document.getElementById("nextBtn").addEventListener("click", showQuestion);
  document.getElementById("backBtn").addEventListener("click", backToStart);
  document.getElementById("resetBtn").addEventListener("click", resetProgress);
}

init();