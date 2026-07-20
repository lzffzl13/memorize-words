let practiceState = {
    mode: null,
    category: "",
    scope: "all",
    count: 10,
    sessionId: null,
    questions: [],
    current: 0,
    correct: 0,
    answered: [],
    reinforcementQueued: new Set(),
    wrongAttempts: new Map(),
    reinforcementResults: new Map(),
    autoStart: false,
};
let practiceCategories = [];
let practiceCategoryCounts = new Map();
let categorySheetTrigger = null;
let practiceSubmissionPending = false;
let practiceAdvanceTimer = null;

window.setPracticePreset = function setPracticePreset({ scope = "all", count = 10, mode = "en_to_cn", autoStart = false } = {}) {
    if (["all", "due", "wrong"].includes(scope)) practiceState.scope = scope;
    practiceState.count = Math.max(1, Math.min(Number(count) || 10, 50));
    practiceState.mode = mode || practiceState.mode || "en_to_cn";
    practiceState.category = "";
    practiceState.autoStart = Boolean(autoStart);
};

// TTS 发音
app.addEventListener("click", (event) => {
    if (!isPracticePage()) return;

    const modeBtn = event.target.closest(".mode-btn[data-mode]");
    if (modeBtn) {
        document.querySelectorAll(".mode-btn").forEach((btn) => {
            btn.classList.remove("selected");
            btn.setAttribute("aria-pressed", "false");
        });
        modeBtn.classList.add("selected");
        modeBtn.setAttribute("aria-pressed", "true");
        practiceState.mode = modeBtn.dataset.mode;
        checkStartReady();
        return;
    }

    const catBtn = event.target.closest("#cat-select .cat-btn[data-cat-index]");
    if (catBtn) {
        selectPracticeCategory(Number(catBtn.dataset.catIndex));
        return;
    }

    const scopeBtn = event.target.closest("#scope-select .cat-btn[data-scope]");
    if (scopeBtn) {
        document.querySelectorAll("#scope-select .cat-btn").forEach((btn) => {
            btn.classList.remove("active");
            btn.setAttribute("aria-pressed", "false");
        });
        scopeBtn.classList.add("active");
        scopeBtn.setAttribute("aria-pressed", "true");
        practiceState.scope = scopeBtn.dataset.scope;
        return;
    }

    const sheetOption = event.target.closest(".category-option[data-cat-index]");
    if (sheetOption) {
        selectPracticeCategory(Number(sheetOption.dataset.catIndex));
        closeCategorySheet();
        return;
    }

    const sheetOverlay = event.target.closest(".category-sheet-overlay");
    if (sheetOverlay && event.target === sheetOverlay) {
        closeCategorySheet();
        return;
    }

    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;

    switch (actionEl.dataset.action) {
        case "start-quiz":
            startQuiz();
            break;
        case "restart-wrong-quiz":
            restartWrongQuiz();
            break;
        case "speak-question": {
            const question = getCurrentQuestion();
            if (question) window.playWordPronunciation(question.english);
            break;
        }
        case "speak-review-word":
            window.playWordPronunciation(actionEl.dataset.word);
            break;
        case "choose-answer": {
            const question = getCurrentQuestion();
            if (!question || practiceState.answered[practiceState.current]) return;
            submitAnswer(question.choices[Number(actionEl.dataset.choiceIndex)]);
            break;
        }
        case "submit-answer": {
            const input = document.getElementById("answer-input");
            if (input) submitAnswer(input.value);
            break;
        }
        case "prev-question":
            navigateQuestion(-1);
            break;
        case "next-question":
            navigateQuestion(1);
            break;
        case "continue-pending":
            continuePendingQuestions();
            break;
        case "show-result":
            showResult();
            break;
        case "restart-quiz":
            restartQuiz();
            break;
        case "return-practice-selection":
            renderPractice();
            break;
        case "open-category-sheet":
            openCategorySheet();
            break;
        case "close-category-sheet":
            closeCategorySheet();
            break;
    }
});

app.addEventListener("input", (event) => {
    if (!isPracticePage()) return;
    if (event.target.id !== "practice-count") return;

    const value = Number(event.target.value);
    if (!Number.isNaN(value)) {
        practiceState.count = value;
    }
});

document.addEventListener("keydown", (event) => {
    if (!isPracticePage()) return;

    const openSheet = document.querySelector(".category-sheet.open");
    if (openSheet) {
        if (event.key === "Escape") {
            event.preventDefault();
            closeCategorySheet();
            return;
        }
        window.trapFocusWithin(openSheet, event);
        return;
    }

    if (!document.querySelector(".quiz-area")) return;

    const input = document.getElementById("answer-input");
    const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName);
    if (isTyping) {
        if (input && event.key === "Enter") {
            event.preventDefault();
            submitAnswer(input.value);
        }
        return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        navigateQuestion(-1);
        return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        navigateQuestion(1);
        return;
    }

    const answered = practiceState.answered[practiceState.current];
    if (answered) return;

    if (practiceState.mode === "en_to_cn") {
        if (event.key >= "1" && event.key <= "4") {
            const question = getCurrentQuestion();
            const idx = Number(event.key) - 1;
            if (question && question.choices[idx] !== undefined) {
                submitAnswer(question.choices[idx]);
            }
        }
        return;
    }

});

function isPracticePage() {
    return !!app.querySelector('[data-page="practice"]');
}

function getCurrentQuestion() {
    return practiceState.questions[practiceState.current] || null;
}

function getWrongAnswers() {
    return [...practiceState.wrongAttempts.values()].map((item) => ({
        ...item,
        reinforcement: practiceState.reinforcementResults.get(item.question.word_id) || null,
    }));
}

function getWrongAnswerIds() {
    return getWrongAnswers().map(item => item.question.word_id);
}

function choicesAreEqual(left = [], right = []) {
    return left.length === right.length && left.every((choice, index) => choice === right[index]);
}

function buildReinforcementQuestion(question, freshQuestion = null) {
    const canUseFreshQuestion = freshQuestion && freshQuestion.word_id === question.word_id;
    const reinforcement = {
        ...question,
        ...(canUseFreshQuestion ? freshQuestion : {}),
        word_id: question.word_id,
        _isReinforcement: true,
    };

    if (Array.isArray(question.choices)) {
        let refreshedChoices = Array.isArray(reinforcement.choices)
            ? [...reinforcement.choices]
            : [...question.choices];

        // 后端会刷新干扰项；极小词库无法刷新时，至少改变选项顺序。
        if (refreshedChoices.length > 1 && choicesAreEqual(refreshedChoices, question.choices)) {
            refreshedChoices = [...refreshedChoices.slice(1), refreshedChoices[0]];
        }
        reinforcement.choices = refreshedChoices;
    }

    return reinforcement;
}

function queueWrongAnswerForReinforcement(question, freshQuestion = null) {
    if (!question || question._isReinforcement || practiceState.reinforcementQueued.has(question.word_id)) {
        return null;
    }

    const insertAt = Math.min(practiceState.current + 3, practiceState.questions.length);
    const reinforcement = buildReinforcementQuestion(question, freshQuestion);
    if (practiceState.answered.length < practiceState.questions.length) {
        practiceState.answered.length = practiceState.questions.length;
    }
    practiceState.questions.splice(insertAt, 0, reinforcement);
    practiceState.answered.splice(insertAt, 0, undefined);
    practiceState.reinforcementQueued.add(question.word_id);

    return "已加入本轮加练，稍后会再次出现。";
}

function getQuestionLabel(question) {
    if (practiceState.mode === "en_to_cn") return question.english;
    if (practiceState.mode === "cn_to_en" || practiceState.mode === "spelling") return question.chinese;
    return question.hint;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
    }[char]));
}

function formatAnswer(value) {
    const text = String(value ?? "").trim();
    return text || "（空）";
}

function getReviewEnglish(question, answered = null) {
    return question.english || (practiceState.mode !== "en_to_cn" && answered ? answered.correct_answer : "") || "";
}

function getReviewChinese(question, answered = null) {
    return question.chinese || question.hint || (practiceState.mode === "en_to_cn" && answered ? answered.correct_answer : "") || "";
}

function renderAnswerReview(answered) {
    return `<div class="answer-review">
        <div class="answer-review-row">
            <span class="answer-review-label">你的答案</span>
            <strong class="answer-review-value wrong">${escapeHtml(formatAnswer(answered.answer))}</strong>
        </div>
        <div class="answer-review-row">
            <span class="answer-review-label">正确答案</span>
            <strong class="answer-review-value correct">${escapeHtml(answered.correct_answer)}</strong>
        </div>
    </div>`;
}

function renderAnswerFeedback(question, answered) {
    if (answered.is_correct) {
        return `<div class="feedback correct" role="status" aria-live="polite" aria-atomic="true">${question._isReinforcement ? "加练答对，已经巩固!" : "正确!"}</div>`;
    }

    const english = getReviewEnglish(question, answered);
    const pronunciation = question.pronunciation || "";
    const wordLine = english ? `
        <div class="feedback-word-row">
            <span class="feedback-word">${escapeHtml(english)}</span>
            ${pronunciation ? `<span class="feedback-pronunciation">${escapeHtml(pronunciation)}</span>` : ""}
            <button type="button" class="icon-btn feedback-speak-btn" data-action="speak-question" title="发音" aria-label="播放 ${escapeHtml(english)} 的发音">🔊</button>
        </div>` : "";

    return `<div class="feedback wrong" role="status" aria-live="polite" aria-atomic="true">
        <div class="feedback-main">错误! 正确答案: ${escapeHtml(answered.correct_answer)}</div>
        ${wordLine}
        ${answered.reinforcement_note ? `<div class="feedback-reinforcement-note">${escapeHtml(answered.reinforcement_note)}</div>` : ""}
    </div>`;
}

function renderWrongAnswerItem(item, index) {
    const { question, answered, reinforcement } = item;
    const english = getReviewEnglish(question, answered);
    const chinese = getReviewChinese(question, answered);
    const pronunciation = question.pronunciation || "";
    const partOfSpeech = question.part_of_speech || "";
    const example = question.example_sentence || "";
    const exampleCn = question.example_sentence_cn || "";
    const codeSnippet = question.code_snippet || "";
    const reinforcementText = reinforcement?.is_correct ? "加练已答对" : "加练仍需巩固";
    const reinforcementClass = reinforcement?.is_correct ? "resolved" : "unresolved";

    return `
        <div class="wrong-item">
            <div class="wrong-item-head">
                <div class="wrong-word-main">
                    <div class="wrong-question">${index + 1}. ${escapeHtml(english || getQuestionLabel(question))}</div>
                    <div class="wrong-meaning">
                        ${chinese ? `<span>${escapeHtml(chinese)}</span>` : ""}
                        ${partOfSpeech ? `<span>${escapeHtml(partOfSpeech)}</span>` : ""}
                        ${pronunciation ? `<span class="wrong-pronunciation">${escapeHtml(pronunciation)}</span>` : ""}
                    </div>
                </div>
                <div class="wrong-item-tools">
                    <span class="reinforcement-result ${reinforcementClass}">${reinforcementText}</span>
                    ${english ? `<button type="button" class="icon-btn review-speak-btn" data-action="speak-review-word" data-word="${escapeHtml(english)}" title="发音" aria-label="播放 ${escapeHtml(english)} 的发音">🔊</button>` : ""}
                </div>
            </div>
            <div class="wrong-answer-grid">
                <div class="wrong-answer">你的答案：${escapeHtml(formatAnswer(answered.answer))}</div>
                <div class="right-answer">正确答案：${escapeHtml(answered.correct_answer)}</div>
            </div>
            ${example ? `<div class="wrong-example">${escapeHtml(example)}</div>` : ""}
            ${exampleCn ? `<div class="wrong-example-cn">${escapeHtml(exampleCn)}</div>` : ""}
            ${codeSnippet ? `<div class="code-block wrong-code">${escapeHtml(codeSnippet)}</div>` : ""}
        </div>`;
}

function getEmptyPracticeMessage() {
    if (practiceState.scope === "due") return "当前没有到期词可练习";
    if (practiceState.scope === "wrong") return "当前还没有错题可练习";
    return "该分类下没有可练习的单词";
}

function getPracticeCategoryCounts(words) {
    const counts = new Map();
    words.forEach((word) => {
        counts.set(word.category_name, (counts.get(word.category_name) || 0) + 1);
    });
    return counts;
}

function getSelectedCategoryName() {
    return practiceState.category || "全部";
}

function getSelectedCategoryCount() {
    if (practiceState.category) return practiceCategoryCounts.get(practiceState.category) || 0;
    let total = 0;
    practiceCategoryCounts.forEach((count) => {
        total += count;
    });
    return total;
}

function updateCategorySummary() {
    const nameEl = document.getElementById("selected-category-name");
    const countEl = document.getElementById("selected-category-count");
    if (nameEl) nameEl.textContent = getSelectedCategoryName();
    if (countEl) countEl.textContent = `${getSelectedCategoryCount()} 词`;
}

function syncCategorySelection() {
    document.querySelectorAll("[data-cat-index]").forEach((el) => {
        const selected = practiceCategories[Number(el.dataset.catIndex)] === practiceState.category;
        el.classList.toggle("active", selected);
        el.classList.toggle("selected", selected);
        el.setAttribute("aria-pressed", String(selected));
    });
    updateCategorySummary();
}

function selectPracticeCategory(index) {
    practiceState.category = practiceCategories[index] || "";
    syncCategorySelection();
}

function openCategorySheet() {
    const sheet = document.getElementById("category-sheet");
    if (!sheet) return;
    categorySheetTrigger = document.activeElement;
    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    requestAnimationFrame(() => sheet.querySelector(".category-sheet-close")?.focus());
}

function closeCategorySheet() {
    const sheet = document.getElementById("category-sheet");
    if (!sheet || !sheet.classList.contains("open")) return;
    sheet.classList.remove("open");
    sheet.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    categorySheetTrigger?.focus();
    categorySheetTrigger = null;
}

function renderPracticeShell() {
    app.innerHTML = `<div class="page practice-setup" data-page="practice">
        <div class="practice-header">
            <h2>选择练习</h2>
            <span class="practice-count-pill">${practiceState.count} 题</span>
        </div>
        <section class="practice-section">
            <h3 class="practice-section-title">练习模式</h3>
            <div class="mode-select">
                <button type="button" class="mode-btn ${practiceState.mode === "en_to_cn" ? "selected" : ""}" data-mode="en_to_cn" aria-pressed="${practiceState.mode === "en_to_cn"}"><b>英译中</b><span>看英文选中文</span></button>
                <button type="button" class="mode-btn ${practiceState.mode === "cn_to_en" ? "selected" : ""}" data-mode="cn_to_en" aria-pressed="${practiceState.mode === "cn_to_en"}"><b>中译英</b><span>看中文拼英文</span></button>
                <button type="button" class="mode-btn ${practiceState.mode === "spelling" ? "selected" : ""}" data-mode="spelling" aria-pressed="${practiceState.mode === "spelling"}"><b>拼写练习</b><span>给释义拼单词</span></button>
                <button type="button" class="mode-btn ${practiceState.mode === "code_fill" ? "selected" : ""}" data-mode="code_fill" aria-pressed="${practiceState.mode === "code_fill"}"><b>代码填空</b><span>在代码中填词</span></button>
            </div>
        </section>
        <section class="practice-section practice-category-section">
            <div class="practice-section-heading">
                <h3 class="practice-section-title">词库分类</h3>
                <button type="button" class="category-change-btn" data-action="open-category-sheet" aria-haspopup="dialog">更换</button>
            </div>
            <div id="cat-select" class="practice-category-picker">加载词库分类中...</div>
        </section>
        <section class="practice-settings-card">
            <div>
                <h3 class="practice-section-title">练习范围</h3>
                <div id="scope-select" class="practice-chip-row practice-scope-row">
                    <button type="button" class="cat-btn ${practiceState.scope === "all" ? "active" : ""}" data-scope="all" aria-pressed="${practiceState.scope === "all"}">全部单词</button>
                    <button type="button" class="cat-btn ${practiceState.scope === "due" ? "active" : ""}" data-scope="due" aria-pressed="${practiceState.scope === "due"}">只练到期词</button>
                    <button type="button" class="cat-btn ${practiceState.scope === "wrong" ? "active" : ""}" data-scope="wrong" aria-pressed="${practiceState.scope === "wrong"}">只练错题</button>
                </div>
            </div>
            <div class="practice-count-row">
                <div>
                    <h3 class="practice-section-title" id="practice-count-label">题量</h3>
                    <p class="practice-hint" id="practice-count-hint">建议 5~20 题，最多 50 题</p>
                </div>
                <input class="answer-input practice-count-input" id="practice-count" type="number" min="1" max="50" value="${practiceState.count}" aria-labelledby="practice-count-label" aria-describedby="practice-count-hint" />
            </div>
        </section>
        <button type="button" class="btn-primary practice-start-btn" id="start-btn" data-action="start-quiz">开始练习</button>
    </div>`;
    checkStartReady();
}

function renderPracticeCategories(words) {
    if (!isPracticePage()) return;
    const categoryPicker = document.getElementById("cat-select");
    if (!categoryPicker) return;

    const categoryCounts = getPracticeCategoryCounts(words);
    practiceCategoryCounts = categoryCounts;
    const categories = [...categoryCounts.keys()];
    practiceCategories = ["", ...categories];

    const totalCount = words.length;

    let desktopChips = `<button type="button" class="cat-btn ${practiceState.category === "" ? "active" : ""}" data-cat-index="0" aria-pressed="${practiceState.category === ""}">全部</button>`;
    categories.forEach((cat, index) => {
        desktopChips += `<button type="button" class="cat-btn ${practiceState.category === cat ? "active" : ""}" data-cat-index="${index + 1}" aria-pressed="${practiceState.category === cat}">${cat} (${categoryCounts.get(cat)})</button>`;
    });

    let sheetOptions = `<button type="button" class="category-option ${practiceState.category === "" ? "selected" : ""}" data-cat-index="0" aria-pressed="${practiceState.category === ""}">
        <span>全部</span>
        <span>${totalCount} 词</span>
    </button>`;
    categories.forEach((cat, index) => {
        sheetOptions += `<button type="button" class="category-option ${practiceState.category === cat ? "selected" : ""}" data-cat-index="${index + 1}" aria-pressed="${practiceState.category === cat}">
            <span>${cat}</span>
            <span>${categoryCounts.get(cat)} 词</span>
        </button>`;
    });

    categoryPicker.innerHTML = `
        <button type="button" class="category-summary" data-action="open-category-sheet" aria-haspopup="dialog">
            <span class="category-summary-label">当前分类</span>
            <span class="category-summary-main" id="selected-category-name">${getSelectedCategoryName()}</span>
            <span class="category-summary-count" id="selected-category-count">${getSelectedCategoryCount()} 词</span>
        </button>
        <div class="practice-chip-row category-chip-row">${desktopChips}</div>
        <div class="category-sheet" id="category-sheet" aria-hidden="true">
            <div class="category-sheet-overlay"></div>
            <div class="category-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="category-sheet-title">
                <div class="category-sheet-header">
                    <div>
                        <div class="category-sheet-title" id="category-sheet-title">选择词库分类</div>
                        <div class="category-sheet-subtitle">${categories.length} 个分类</div>
                    </div>
                    <button type="button" class="icon-btn category-sheet-close" data-action="close-category-sheet" title="关闭" aria-label="关闭词库分类选择">×</button>
                </div>
                <div class="category-option-grid">${sheetOptions}</div>
            </div>
        </div>
    `;
}

async function renderPractice() {
    clearPracticeAdvanceTimer();
    practiceSubmissionPending = false;
    const previousMode = practiceState.mode;
    const previousCategory = practiceState.category;
    const previousScope = practiceState.scope;
    const previousCount = practiceState.count;
    const shouldAutoStart = Boolean(practiceState.autoStart);
    practiceState = {
        mode: previousMode || "en_to_cn",
        category: previousCategory || "",
        scope: previousScope || "all",
        count: previousCount || 10,
        sessionId: null,
        questions: [],
        current: 0,
        correct: 0,
        answered: [],
        reinforcementQueued: new Set(),
        wrongAttempts: new Map(),
        reinforcementResults: new Map(),
        autoStart: false,
    };
    renderPracticeShell();
    const words = await getWords();
    if (!isPracticePage()) return;
    renderPracticeCategories(words);
    if (shouldAutoStart) await startQuiz();
}

function checkStartReady() {
    const startBtn = document.getElementById("start-btn");
    if (startBtn) startBtn.disabled = !practiceState.mode;
}

async function startQuiz(extra = {}) {
    clearPracticeAdvanceTimer();
    practiceSubmissionPending = false;
    const countInput = document.getElementById("practice-count");
    const requestedCount = countInput ? Number(countInput.value) : practiceState.count;
    practiceState.count = Math.max(1, Math.min(Number.isNaN(requestedCount) ? 10 : requestedCount, 50));
    if (countInput) countInput.value = practiceState.count;

    const payload = {
        mode: practiceState.mode,
        count: practiceState.count,
        category: practiceState.category,
        scope: practiceState.scope,
        ...extra,
    };

    const startBtn = document.getElementById("start-btn");
    const startBtnText = startBtn?.textContent || "开始练习";
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.setAttribute("aria-busy", "true");
        startBtn.textContent = "正在准备...";
    }

    let data;
    try {
        data = await api("/api/practice/start", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    } catch (error) {
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.removeAttribute("aria-busy");
            startBtn.textContent = startBtnText;
        }
        alert("暂时无法开始练习，请稍后重试。");
        return;
    }
    if (!data.questions || data.questions.length === 0) {
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.removeAttribute("aria-busy");
            startBtn.textContent = startBtnText;
        }
        alert(getEmptyPracticeMessage());
        return;
    }
    practiceState.sessionId = data.session_id;
    practiceState.questions = data.questions;
    practiceState.current = 0;
    practiceState.correct = 0;
    practiceState.answered = [];
    practiceState.reinforcementQueued = new Set();
    practiceState.wrongAttempts = new Map();
    practiceState.reinforcementResults = new Map();
    showQuestion();
}

async function restartQuiz() {
    await startQuiz();
}

async function restartWrongQuiz() {
    const wrongIds = getWrongAnswerIds();
    if (wrongIds.length === 0) return;
    const previousScope = practiceState.scope;
    practiceState.scope = "wrong";
    practiceState.count = wrongIds.length;
    await startQuiz({ word_ids: wrongIds, count: wrongIds.length });
    practiceState.scope = previousScope;
}

function clearPracticeAdvanceTimer() {
    if (practiceAdvanceTimer !== null) {
        clearTimeout(practiceAdvanceTimer);
        practiceAdvanceTimer = null;
    }
}

function getFirstUnansweredIndex(startIndex = 0) {
    for (let index = Math.max(0, startIndex); index < practiceState.questions.length; index++) {
        if (!practiceState.answered[index]) return index;
    }
    return -1;
}

function getNextUnansweredIndex(currentIndex) {
    const laterIndex = getFirstUnansweredIndex(currentIndex + 1);
    if (laterIndex !== -1) return laterIndex;

    for (let index = 0; index < currentIndex; index++) {
        if (!practiceState.answered[index]) return index;
    }
    return -1;
}

function continuePendingQuestions() {
    clearPracticeAdvanceTimer();
    const pendingIndex = getNextUnansweredIndex(practiceState.current);
    if (pendingIndex === -1) {
        showResult();
        return;
    }
    practiceState.current = pendingIndex;
    showQuestion();
}

function scheduleAdvanceAfterCorrect(answeredIndex) {
    clearPracticeAdvanceTimer();
    practiceAdvanceTimer = setTimeout(() => {
        practiceAdvanceTimer = null;
        if (!isPracticePage() || practiceState.current !== answeredIndex) return;
        continuePendingQuestions();
    }, 1200);
}

function showQuestion() {
    const total = practiceState.questions.length;
    if (practiceState.current >= total) return showResult();

    const q = getCurrentQuestion();
    const pct = (practiceState.current / total * 100).toFixed(0);
    const answered = practiceState.answered[practiceState.current];
    const reinforcementBadge = q._isReinforcement
        ? `<span class="reinforcement-badge">错题加练</span>`
        : "";

    let html = `<div class="page practice-quiz-page" data-page="practice"><div class="quiz-area" aria-labelledby="question-title">
        <div class="quiz-topbar">
            <span class="quiz-index">${reinforcementBadge}第 ${practiceState.current + 1}/${total} 题</span>
            <span class="quiz-correct-count">已对 ${practiceState.correct}</span>
        </div>
        <div class="progress" role="progressbar" aria-label="练习进度" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${practiceState.current}"><div class="progress-bar" style="width:${pct}%"></div></div>`;

    if (practiceState.mode === "en_to_cn") {
        html += `<div class="question question-card">
            <div class="question-main">
                <span class="question-word" id="question-title">${q.english}</span>
                <button type="button" class="icon-btn speak-btn" data-action="speak-question" title="发音" aria-label="播放 ${escapeHtml(q.english)} 的发音">🔊</button>
            </div>
            <div class="question-meta">${q.pronunciation}</div>
        </div>`;
        if (answered) {
            html += `<div class="choices">${q.choices.map((c, index) => {
                let cls = "choice-btn";
                if (c === answered.correct_answer) cls += " correct";
                else if (c === answered.answer && !answered.is_correct) cls += " wrong";
                return `<button type="button" class="${cls}" disabled>${index + 1}. ${c}</button>`;
            }).join("")}</div>`;
        } else {
            html += `<div class="choices">${q.choices.map((c, index) => `<button type="button" class="choice-btn" data-action="choose-answer" data-choice-index="${index}" aria-keyshortcuts="${index + 1}">${index + 1}. ${c}</button>`).join("")}</div>`;
        }
    } else if (practiceState.mode === "cn_to_en") {
        html += `<div class="question question-card">
            <div class="question-main" id="question-title">${q.chinese}</div>
            <div class="question-meta">${q.part_of_speech}</div>
        </div>`;
        if (answered) {
            html += renderAnswerReview(answered);
        } else {
            html += `<div class="answer-form">
                <label class="sr-only" for="answer-input">输入英文答案</label>
                <input class="answer-input" id="answer-input" placeholder="输入英文..." autocomplete="off" autofocus>
                <button type="button" class="submit-btn" id="submit-answer" data-action="submit-answer" aria-keyshortcuts="Enter">提交</button>
            </div>`;
        }
    } else if (practiceState.mode === "spelling") {
        html += `<div class="question question-card">
            <div class="question-main" id="question-title">${q.chinese}</div>
            <div class="question-meta">${q.pronunciation}</div>
        </div>`;
        if (answered) {
            html += renderAnswerReview(answered);
        } else {
            html += `<div class="answer-form">
                <label class="sr-only" for="answer-input">拼写英文单词</label>
                <input class="answer-input" id="answer-input" placeholder="拼写单词..." autocomplete="off" autocapitalize="none" spellcheck="false" autofocus>
                <button type="button" class="submit-btn" id="submit-answer" data-action="submit-answer" aria-keyshortcuts="Enter">提交</button>
            </div>`;
        }
    } else if (practiceState.mode === "code_fill") {
        const maskedCode = escapeHtml(q.code_snippet).replace(
            escapeHtml(q.code_answer),
            "______"
        );
        html += `<div class="question question-card">
            <div class="question-main" id="question-title">填入关键字: ${q.hint}</div>
            <div class="code-block">${maskedCode}</div>
        </div>`;
        if (answered) {
            html += renderAnswerReview(answered);
        } else {
            html += `<div class="answer-form">
                <label class="sr-only" for="answer-input">填入代码答案</label>
                <input class="answer-input" id="answer-input" placeholder="填入代码..." autocomplete="off" autocapitalize="none" spellcheck="false" autofocus>
                <button type="button" class="submit-btn" id="submit-answer" data-action="submit-answer" aria-keyshortcuts="Enter">提交</button>
            </div>`;
        }
    }

    if (answered) {
        html += renderAnswerFeedback(q, answered);
    } else {
        html += `<div id="feedback" role="status" aria-live="polite" aria-atomic="true"></div>`;
    }

    const canPrev = practiceState.current > 0;
    const isLast = practiceState.current >= total - 1;
    const canNext = answered && !isLast;
    const allAnswered = getFirstUnansweredIndex() === -1;
    html += `<div class="quiz-actions">
        ${canPrev ? `<button type="button" class="nav-btn" data-action="prev-question" aria-keyshortcuts="ArrowLeft ArrowUp">⬅ 上一题</button>` : `<span class="quiz-action-spacer"></span>`}
        ${canNext ? `<button type="button" class="nav-btn quiz-primary-action" data-action="next-question" aria-keyshortcuts="ArrowRight ArrowDown">下一题 ➡</button>` : isLast && answered && allAnswered ? `<button type="button" class="nav-btn quiz-primary-action" data-action="show-result">查看结果</button>` : isLast && answered ? `<button type="button" class="nav-btn quiz-primary-action" data-action="continue-pending">继续未完成题目 ➡</button>` : `<span class="quiz-action-spacer"></span>`}
    </div></div></div>`;

    app.innerHTML = html;

    if (!answered && practiceState.mode !== "en_to_cn") {
        const input = document.getElementById("answer-input");
        if (input) input.focus();
    }

    window.preloadWordPronunciation(q.english);
}

function navigateQuestion(direction) {
    if (practiceSubmissionPending) return;
    clearPracticeAdvanceTimer();
    const next = practiceState.current + direction;
    if (next < 0) return;
    if (next >= practiceState.questions.length) {
        if (direction > 0 && practiceState.answered[practiceState.current]) continuePendingQuestions();
        return;
    }
    if (direction > 0 && !practiceState.answered[practiceState.current]) return;
    practiceState.current = next;
    showQuestion();
}

function disableCurrentAnswerControls() {
    document.querySelectorAll(".choice-btn").forEach((button) => {
        button.disabled = true;
    });
    const input = document.getElementById("answer-input");
    if (input) input.disabled = true;
    const submitButton = document.getElementById("submit-answer");
    if (submitButton) submitButton.disabled = true;
}

function showCorrectAnswerEffect(question, answeredRecord) {
    const feedback = document.getElementById("feedback");
    const quizArea = document.querySelector(".quiz-area");
    if (feedback && quizArea) {
        feedback.className = "feedback correct";
        feedback.textContent = question._isReinforcement ? "加练答对，已经巩固!" : "正确!";
        quizArea.classList.add("correct");
    }

    const correctCount = document.querySelector(".quiz-correct-count");
    if (correctCount) correctCount.textContent = `已对 ${practiceState.correct}`;

    document.querySelectorAll(".choice-btn").forEach((button) => {
        const choice = button.textContent.replace(/^\d+\.\s*/, "");
        if (choice === answeredRecord.correct_answer) button.classList.add("correct");
    });
}

async function submitAnswer(answer) {
    const submittedIndex = practiceState.current;
    const q = getCurrentQuestion();
    if (!q || practiceSubmissionPending || practiceState.answered[submittedIndex]) return;

    clearPracticeAdvanceTimer();
    practiceSubmissionPending = true;
    disableCurrentAnswerControls();
    const submittedSessionId = practiceState.sessionId;

    let res;
    try {
        res = await api("/api/practice/answer", {
            method: "POST",
            body: JSON.stringify({
                session_id: submittedSessionId,
                word_id: q.word_id,
                mode: practiceState.mode,
                answer: answer,
                response_time_ms: 0,
                previous_choices: Array.isArray(q.choices) ? q.choices : [],
            }),
        });
    } catch (error) {
        practiceSubmissionPending = false;
        if (isPracticePage() && practiceState.sessionId === submittedSessionId) {
            showQuestion();
            alert("答案提交失败，请重试。");
        }
        return;
    }

    practiceSubmissionPending = false;
    if (!isPracticePage() || practiceState.sessionId !== submittedSessionId) return;

    if (res.is_correct) practiceState.correct++;

    let reinforcementNote = "";
    if (!res.is_correct) {
        reinforcementNote = queueWrongAnswerForReinforcement(q, res.reinforcement_question) || "";
    }

    const answeredRecord = {
        answer: answer,
        is_correct: res.is_correct,
        correct_answer: res.correct_answer,
        reinforcement_note: reinforcementNote,
    };
    practiceState.answered[submittedIndex] = answeredRecord;

    if (!res.is_correct && !q._isReinforcement && !practiceState.wrongAttempts.has(q.word_id)) {
        practiceState.wrongAttempts.set(q.word_id, {
            question: {
                ...q,
                choices: Array.isArray(q.choices) ? [...q.choices] : q.choices,
            },
            answered: { ...answeredRecord },
        });
    }

    if (q._isReinforcement) {
        practiceState.reinforcementResults.set(q.word_id, {
            is_correct: res.is_correct,
            answer: answer,
            correct_answer: res.correct_answer,
        });
    }

    if (res.is_correct) {
        showCorrectAnswerEffect(q, answeredRecord);
        scheduleAdvanceAfterCorrect(submittedIndex);
    } else {
        showQuestion();
    }
}

function showResult() {
    const unansweredIndex = getFirstUnansweredIndex();
    if (unansweredIndex !== -1) {
        practiceState.current = unansweredIndex;
        showQuestion();
        return;
    }

    clearPracticeAdvanceTimer();
    const total = practiceState.questions.length;
    const pct = (practiceState.correct / total * 100).toFixed(0);
    const wrongAnswers = getWrongAnswers();
    const initialWrongCount = wrongAnswers.length;
    const reinforcedCount = wrongAnswers.filter((item) => item.reinforcement?.is_correct).length;

    let wrongSection = `
        <div class="card practice-wrong-card">
            <h3>错题回顾</h3>`;

    if (wrongAnswers.length === 0) {
        wrongSection += `<div class="practice-empty-result">本轮没有错题，继续保持。</div>`;
    } else {
        wrongSection += `<div class="wrong-list">`;
        wrongAnswers.forEach((item, index) => {
            wrongSection += renderWrongAnswerItem(item, index);
        });
        wrongSection += `</div>`;
    }

    wrongSection += `</div>`;

    app.innerHTML = `
        <div class="page practice-result-page" data-page="practice">
            <h2>练习完成!</h2>
            <div class="stats-cards practice-result-stats">
                <div class="card"><div class="num">${practiceState.correct}</div><div class="label">答对</div></div>
                <div class="card"><div class="num">${total}</div><div class="label">总题数</div></div>
                <div class="card"><div class="num">${pct}%</div><div class="label">正确率</div></div>
            </div>
            ${initialWrongCount > 0 ? `<div class="practice-reinforcement-summary">本轮加练 ${initialWrongCount} 个错题，已答对 ${reinforcedCount} 个。</div>` : ""}
            <div class="practice-result-actions">
                <button type="button" class="btn-primary" data-action="restart-quiz">再来一轮</button>
                ${wrongAnswers.length > 0 ? `<button type="button" class="nav-btn practice-wrong-retry" data-action="restart-wrong-quiz">重练错题</button>` : ""}
                <button type="button" class="nav-btn" data-action="return-practice-selection">返回选择</button>
            </div>
            ${wrongSection}
        </div>
    `;
}
