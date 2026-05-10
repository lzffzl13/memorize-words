let practiceState = { mode: null, category: "", sessionId: null, questions: [], current: 0, correct: 0 };

async function renderPractice() {
    practiceState = { mode: null, category: "", sessionId: null, questions: [], current: 0, correct: 0 };
    const words = await api("/api/words/");
    const categories = [...new Set(words.map(w => w.category_name))];

    let html = `<div class="page">
        <h2>选择练习模式</h2>
        <div class="mode-select">
            <div class="mode-btn" data-mode="en_to_cn"><b>英译中</b><br>看英文选中文</div>
            <div class="mode-btn" data-mode="cn_to_en"><b>中译英</b><br>看中文拼英文</div>
            <div class="mode-btn" data-mode="spelling"><b>拼写练习</b><br>给释义拼单词</div>
            <div class="mode-btn" data-mode="code_fill"><b>代码填空</b><br>在代码中填词</div>
        </div>
        <h2 style="margin-top:24px">选择词库分类</h2>
        <div id="cat-select" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
            <button class="cat-btn active" data-cat="">全部</button>`;
    categories.forEach(cat => {
        const count = words.filter(w => w.category_name === cat).length;
        html += `<button class="cat-btn" data-cat="${cat}">${cat} (${count})</button>`;
    });
    html += `</div>
        <button class="btn-primary" id="start-btn" disabled>开始练习</button>
    </div>`;
    app.innerHTML = html;

    // 模式选择
    document.querySelectorAll(".mode-btn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            practiceState.mode = btn.dataset.mode;
            checkStartReady();
        };
    });

    // 分类选择
    document.querySelectorAll("#cat-select .cat-btn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll("#cat-select .cat-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            practiceState.category = btn.dataset.cat;
        };
    });

    document.getElementById("start-btn").onclick = startQuiz;
}

function checkStartReady() {
    document.getElementById("start-btn").disabled = !practiceState.mode;
}

async function startQuiz() {
    const data = await api("/api/practice/start", {
        method: "POST",
        body: JSON.stringify({ mode: practiceState.mode, count: 10, category: practiceState.category }),
    });
    if (!data.questions || data.questions.length === 0) {
        alert("该分类下没有可练习的单词");
        return;
    }
    practiceState.sessionId = data.session_id;
    practiceState.questions = data.questions;
    practiceState.current = 0;
    practiceState.correct = 0;
    showQuestion();
}

function showQuestion() {
    const q = practiceState.questions[practiceState.current];
    const total = practiceState.questions.length;
    const pct = (practiceState.current / total * 100).toFixed(0);

    if (practiceState.current >= total) return showResult();

    let html = `<div class="quiz-area">
        <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
        <p style="margin:10px 0;color:#999">第 ${practiceState.current + 1}/${total} 题</p>`;

    if (practiceState.mode === "en_to_cn") {
        html += `<div class="question">${q.english} <span style="color:#999;font-size:14px">${q.pronunciation}</span></div>
            <div class="choices">${q.choices.map(c => `<button class="choice-btn" data-answer="${c}">${c}</button>`).join("")}</div>`;
    } else if (practiceState.mode === "cn_to_en") {
        html += `<div class="question">${q.chinese} <span style="color:#999">(${q.part_of_speech})</span></div>
            <input class="answer-input" id="answer-input" placeholder="输入英文..." autofocus>
            <button class="submit-btn" id="submit-answer">提交</button>`;
    } else if (practiceState.mode === "spelling") {
        html += `<div class="question">${q.chinese} <span style="color:#999">${q.pronunciation}</span></div>
            <input class="answer-input" id="answer-input" placeholder="拼写单词..." autofocus>
            <button class="submit-btn" id="submit-answer">提交</button>`;
    } else if (practiceState.mode === "code_fill") {
        html += `<div class="question">填入关键字: ${q.hint}</div>
            <div class="code-block">${q.code_snippet.replace(q.code_answer, "______")}</div>
            <input class="answer-input" id="answer-input" placeholder="填入代码..." autofocus>
            <button class="submit-btn" id="submit-answer">提交</button>`;
    }

    html += `<div id="feedback"></div>
        <p style="margin-top:16px;color:#bbb;font-size:12px;text-align:center">
            ${practiceState.mode === "en_to_cn" ? "按 1-4 选择答案" : "按 Enter 提交"}
        </p></div>`;
    app.innerHTML = html;

    if (practiceState.mode === "en_to_cn") {
        const btns = document.querySelectorAll(".choice-btn");
        btns.forEach((btn, i) => {
            btn.onclick = () => submitAnswer(btn.dataset.answer);
            btn.textContent = `${i + 1}. ${btn.textContent}`;
        });
        // 1-4 快捷键
        document.onkeydown = (e) => {
            if (e.key >= "1" && e.key <= "4") {
                const idx = parseInt(e.key) - 1;
                if (btns[idx] && !btns[idx].disabled) btns[idx].click();
            }
        };
    } else {
        const input = document.getElementById("answer-input");
        document.getElementById("submit-answer").onclick = () => submitAnswer(input.value);
        input.onkeydown = (e) => { if (e.key === "Enter") submitAnswer(input.value); };
        input.focus();
    }
}

async function submitAnswer(answer) {
    const q = practiceState.questions[practiceState.current];
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

    const fb = document.getElementById("feedback");
    const quizArea = document.querySelector(".quiz-area");
    if (res.is_correct) {
        fb.className = "feedback correct";
        fb.textContent = "正确!";
        quizArea.classList.add("correct");
    } else {
        fb.className = "feedback wrong";
        fb.textContent = `错误! 正确答案: ${res.correct_answer}`;
        quizArea.classList.add("wrong");
    }

    document.querySelectorAll(".choice-btn").forEach(b => {
        b.disabled = true;
        if (b.dataset.answer === res.correct_answer) b.classList.add("correct");
        else if (b.dataset.answer === answer && !res.is_correct) b.classList.add("wrong");
    });

    setTimeout(() => {
        practiceState.current++;
        showQuestion();
    }, 1200);
}

function showResult() {
    const total = practiceState.questions.length;
    const pct = (practiceState.correct / total * 100).toFixed(0);
    app.innerHTML = `
        <div class="page" style="text-align:center">
            <h2>练习完成!</h2>
            <div class="stats-cards" style="margin-top:20px">
                <div class="card"><div class="num">${practiceState.correct}</div><div class="label">答对</div></div>
                <div class="card"><div class="num">${total}</div><div class="label">总题数</div></div>
                <div class="card"><div class="num">${pct}%</div><div class="label">正确率</div></div>
            </div>
            <button class="btn-primary" onclick="renderPractice()">再来一轮</button>
        </div>
    `;
}
