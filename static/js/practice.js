let practiceState = { mode: null, category: "", scope: "all", count: 10, sessionId: null, questions: [], current: 0, correct: 0, answered: [] };
let practiceCategories = [];

// TTS 发音
app.addEventListener("click", (event) => {
    if (!isPracticePage()) return;

    const modeBtn = event.target.closest(".mode-btn[data-mode]");
    if (modeBtn) {
        document.querySelectorAll(".mode-btn").forEach(btn => btn.classList.remove("selected"));
        modeBtn.classList.add("selected");
        practiceState.mode = modeBtn.dataset.mode;
        checkStartReady();
        return;
    }

    const catBtn = event.target.closest("#cat-select .cat-btn[data-cat-index]");
    if (catBtn) {
        document.querySelectorAll("#cat-select .cat-btn").forEach(btn => btn.classList.remove("active"));
        catBtn.classList.add("active");
        practiceState.category = practiceCategories[Number(catBtn.dataset.catIndex)] || "";
        return;
    }

    const scopeBtn = event.target.closest("#scope-select .cat-btn[data-scope]");
    if (scopeBtn) {
        document.querySelectorAll("#scope-select .cat-btn").forEach(btn => btn.classList.remove("active"));
        scopeBtn.classList.add("active");
        practiceState.scope = scopeBtn.dataset.scope;
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
        case "show-result":
            showResult();
            break;
        case "restart-quiz":
            restartQuiz();
            break;
        case "return-practice-selection":
            renderPractice();
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
    if (!document.querySelector(".quiz-area")) return;

    if (event.key === "ArrowUp") {
        event.preventDefault();
        navigateQuestion(-1);
        return;
    }

    if (event.key === "ArrowDown") {
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

    const input = document.getElementById("answer-input");
    if (input && event.key === "Enter") {
        submitAnswer(input.value);
    }
});

function isPracticePage() {
    return !!app.querySelector('[data-page="practice"]');
}

function getCurrentQuestion() {
    return practiceState.questions[practiceState.current] || null;
}

function getWrongAnswers() {
    return practiceState.questions
        .map((question, index) => {
            const answered = practiceState.answered[index];
            if (!answered || answered.is_correct) return null;
            return { question, answered };
        })
        .filter(Boolean);
}

function getWrongAnswerIds() {
    return getWrongAnswers().map(item => item.question.word_id);
}

function getQuestionLabel(question) {
    if (practiceState.mode === "en_to_cn") return question.english;
    if (practiceState.mode === "cn_to_en" || practiceState.mode === "spelling") return question.chinese;
    return question.hint;
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

function renderPracticeShell() {
    app.innerHTML = `<div class="page" data-page="practice">
        <h2>选择练习模式</h2>
        <div class="mode-select">
            <div class="mode-btn ${practiceState.mode === "en_to_cn" ? "selected" : ""}" data-mode="en_to_cn"><b>英译中</b><br>看英文选中文</div>
            <div class="mode-btn ${practiceState.mode === "cn_to_en" ? "selected" : ""}" data-mode="cn_to_en"><b>中译英</b><br>看中文拼英文</div>
            <div class="mode-btn ${practiceState.mode === "spelling" ? "selected" : ""}" data-mode="spelling"><b>拼写练习</b><br>给释义拼单词</div>
            <div class="mode-btn ${practiceState.mode === "code_fill" ? "selected" : ""}" data-mode="code_fill"><b>代码填空</b><br>在代码中填词</div>
        </div>
        <h2 style="margin-top:24px">选择词库分类</h2>
        <div id="cat-select" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;color:#999">加载词库分类中...</div>
        <h2 style="margin-top:24px">选择练习范围</h2>
        <div id="scope-select" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
            <button class="cat-btn ${practiceState.scope === "all" ? "active" : ""}" data-scope="all">全部单词</button>
            <button class="cat-btn ${practiceState.scope === "due" ? "active" : ""}" data-scope="due">只练到期词</button>
            <button class="cat-btn ${practiceState.scope === "wrong" ? "active" : ""}" data-scope="wrong">只练错题</button>
        </div>
        <h2 style="margin-top:24px">题量</h2>
        <input class="answer-input" id="practice-count" type="number" min="1" max="50" value="${practiceState.count}" style="max-width:160px;margin-top:8px" />
        <p style="margin-top:8px;color:#999;font-size:13px">建议 5~20 题，最多 50 题</p>
        <button class="btn-primary" id="start-btn" data-action="start-quiz">开始练习</button>
    </div>`;
    checkStartReady();
}

function renderPracticeCategories(words) {
    if (!isPracticePage()) return;

    const categoryCounts = getPracticeCategoryCounts(words);
    const categories = [...categoryCounts.keys()];
    practiceCategories = ["", ...categories];

    let html = `<button class="cat-btn ${practiceState.category === "" ? "active" : ""}" data-cat-index="0">全部</button>`;
    categories.forEach((cat, index) => {
        html += `<button class="cat-btn ${practiceState.category === cat ? "active" : ""}" data-cat-index="${index + 1}">${cat} (${categoryCounts.get(cat)})</button>`;
    });
    document.getElementById("cat-select").innerHTML = html;
}

async function renderPractice() {
    const previousMode = practiceState.mode;
    const previousCategory = practiceState.category;
    const previousScope = practiceState.scope;
    const previousCount = practiceState.count;
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
    };
    renderPracticeShell();
    const words = await getWords();
    if (!isPracticePage()) return;
    renderPracticeCategories(words);
}

function checkStartReady() {
    const startBtn = document.getElementById("start-btn");
    if (startBtn) startBtn.disabled = !practiceState.mode;
}

async function startQuiz(extra = {}) {
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

    const data = await api("/api/practice/start", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    if (!data.questions || data.questions.length === 0) {
        alert(getEmptyPracticeMessage());
        return;
    }
    practiceState.sessionId = data.session_id;
    practiceState.questions = data.questions;
    practiceState.current = 0;
    practiceState.correct = 0;
    practiceState.answered = [];
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

function showQuestion() {
    const total = practiceState.questions.length;
    if (practiceState.current >= total) return showResult();

    const q = getCurrentQuestion();
    const pct = (practiceState.current / total * 100).toFixed(0);
    const answered = practiceState.answered[practiceState.current];

    let html = `<div class="page" data-page="practice"><div class="quiz-area">
        <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
        <p style="margin:10px 0;color:#999">第 ${practiceState.current + 1}/${total} 题</p>`;

    if (practiceState.mode === "en_to_cn") {
        html += `<div class="question">${q.english} <button class="icon-btn speak-btn" data-action="speak-question" title="发音">🔊</button> <span style="color:#999;font-size:14px">${q.pronunciation}</span></div>`;
        if (answered) {
            html += `<div class="choices">${q.choices.map(c => {
                let cls = "choice-btn";
                if (c === answered.correct_answer) cls += " correct";
                else if (c === answered.answer && !answered.is_correct) cls += " wrong";
                return `<button class="${cls}" disabled>${c}</button>`;
            }).join("")}</div>`;
        } else {
            html += `<div class="choices">${q.choices.map((c, index) => `<button class="choice-btn" data-action="choose-answer" data-choice-index="${index}">${index + 1}. ${c}</button>`).join("")}</div>`;
        }
    } else if (practiceState.mode === "cn_to_en") {
        html += `<div class="question">${q.chinese} <span style="color:#999">(${q.part_of_speech})</span></div>`;
        if (answered) {
            html += `<div style="margin-top:10px;padding:12px;background:#f5f5f5;border-radius:8px">你的答案: ${answered.answer} | 正确答案: ${answered.correct_answer}</div>`;
        } else {
            html += `<input class="answer-input" id="answer-input" placeholder="输入英文..." autofocus>
                <button class="submit-btn" id="submit-answer" data-action="submit-answer">提交</button>`;
        }
    } else if (practiceState.mode === "spelling") {
        html += `<div class="question">${q.chinese} <span style="color:#999">${q.pronunciation}</span></div>`;
        if (answered) {
            html += `<div style="margin-top:10px;padding:12px;background:#f5f5f5;border-radius:8px">你的答案: ${answered.answer} | 正确答案: ${answered.correct_answer}</div>`;
        } else {
            html += `<input class="answer-input" id="answer-input" placeholder="拼写单词..." autofocus>
                <button class="submit-btn" id="submit-answer" data-action="submit-answer">提交</button>`;
        }
    } else if (practiceState.mode === "code_fill") {
        html += `<div class="question">填入关键字: ${q.hint}</div>
            <div class="code-block">${q.code_snippet.replace(q.code_answer, "______")}</div>`;
        if (answered) {
            html += `<div style="margin-top:10px;padding:12px;background:#f5f5f5;border-radius:8px">你的答案: ${answered.answer} | 正确答案: ${answered.correct_answer}</div>`;
        } else {
            html += `<input class="answer-input" id="answer-input" placeholder="填入代码..." autofocus>
                <button class="submit-btn" id="submit-answer" data-action="submit-answer">提交</button>`;
        }
    }

    if (answered) {
        const fbClass = answered.is_correct ? "feedback correct" : "feedback wrong";
        const fbText = answered.is_correct ? "正确!" : `错误! 正确答案: ${answered.correct_answer}`;
        html += `<div class="${fbClass}">${fbText}</div>`;
    } else {
        html += `<div id="feedback"></div>`;
    }

    const canPrev = practiceState.current > 0;
    const isLast = practiceState.current >= total - 1;
    const canNext = answered && !isLast;
    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;gap:12px">
        ${canPrev ? `<button class="nav-btn" data-action="prev-question">⬅ 上一题</button>` : `<span></span>`}
        ${canNext ? `<button class="nav-btn" data-action="next-question">下一题 ➡</button>` : isLast && answered ? `<button class="nav-btn" style="background:#4a90d9;color:#fff;border-color:#4a90d9" data-action="show-result">查看结果</button>` : `<span></span>`}
    </div></div></div>`;

    app.innerHTML = html;

    if (!answered && practiceState.mode !== "en_to_cn") {
        const input = document.getElementById("answer-input");
        if (input) input.focus();
    }

    window.preloadWordPronunciation(q.english);
}

function navigateQuestion(direction) {
    const next = practiceState.current + direction;
    if (next < 0) return;
    if (next >= practiceState.questions.length) return;
    if (direction > 0 && !practiceState.answered[practiceState.current]) return;
    practiceState.current = next;
    showQuestion();
}

async function submitAnswer(answer) {
    const q = getCurrentQuestion();
    if (!q) return;

    const res = await api("/api/practice/answer", {
        method: "POST",
        body: JSON.stringify({
            session_id: practiceState.sessionId,
            word_id: q.word_id,
            mode: practiceState.mode,
            answer: answer,
            response_time_ms: 0,
        }),
    });

    if (res.is_correct) practiceState.correct++;

    practiceState.answered[practiceState.current] = {
        answer: answer,
        is_correct: res.is_correct,
        correct_answer: res.correct_answer,
    };

    const fb = document.getElementById("feedback");
    const quizArea = document.querySelector(".quiz-area");
    if (fb && quizArea) {
        if (res.is_correct) {
            fb.className = "feedback correct";
            fb.textContent = "正确!";
            quizArea.classList.add("correct");
        } else {
            fb.className = "feedback wrong";
            fb.textContent = `错误! 正确答案: ${res.correct_answer}`;
            quizArea.classList.add("wrong");
        }
    }

    document.querySelectorAll(".choice-btn").forEach(btn => {
        btn.disabled = true;
        if (btn.textContent.replace(/^\d+\.\s*/, "") === res.correct_answer) btn.classList.add("correct");
        else if (btn.textContent.replace(/^\d+\.\s*/, "") === answer && !res.is_correct) btn.classList.add("wrong");
    });

    const input = document.getElementById("answer-input");
    if (input) input.disabled = true;
    const submitBtn = document.getElementById("submit-answer");
    if (submitBtn) submitBtn.disabled = true;

    if (res.is_correct) {
        setTimeout(() => {
            if (practiceState.current < practiceState.questions.length - 1) {
                navigateQuestion(1);
            } else {
                showResult();
            }
        }, 1200);
    } else {
        showQuestion();
    }
}

function showResult() {
    const total = practiceState.questions.length;
    const pct = (practiceState.correct / total * 100).toFixed(0);
    const wrongAnswers = getWrongAnswers();

    let wrongSection = `
        <div class="card" style="margin-top:24px;text-align:left">
            <h3 style="margin-bottom:12px">错题回顾</h3>`;

    if (wrongAnswers.length === 0) {
        wrongSection += `<div style="color:#4caf50">本轮没有错题，继续保持。</div>`;
    } else {
        wrongSection += `<div style="display:flex;flex-direction:column;gap:10px">`;
        wrongAnswers.forEach((item, index) => {
            wrongSection += `
                <div style="padding:12px;border:1px solid #eee;border-radius:8px;background:#fafafa">
                    <div style="font-weight:700;margin-bottom:6px">${index + 1}. ${getQuestionLabel(item.question)}</div>
                    <div style="color:#c62828">你的答案：${item.answered.answer || "（空）"}</div>
                    <div style="color:#2e7d32;margin-top:4px">正确答案：${item.answered.correct_answer}</div>
                </div>`;
        });
        wrongSection += `</div>`;
    }

    wrongSection += `</div>`;

    app.innerHTML = `
        <div class="page" data-page="practice" style="text-align:center">
            <h2>练习完成!</h2>
            <div class="stats-cards" style="margin-top:20px">
                <div class="card"><div class="num">${practiceState.correct}</div><div class="label">答对</div></div>
                <div class="card"><div class="num">${total}</div><div class="label">总题数</div></div>
                <div class="card"><div class="num">${pct}%</div><div class="label">正确率</div></div>
            </div>
            <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:30px">
                <button class="btn-primary" style="width:auto;margin:0;padding:14px 28px" data-action="restart-quiz">再来一轮</button>
                ${wrongAnswers.length > 0 ? `<button class="nav-btn" style="padding:14px 28px;background:#fff3e0;border-color:#ff9800;color:#ff9800" data-action="restart-wrong-quiz">重练错题</button>` : ""}
                <button class="nav-btn" style="padding:14px 28px" data-action="return-practice-selection">返回选择</button>
            </div>
            ${wrongSection}
        </div>
    `;
}
