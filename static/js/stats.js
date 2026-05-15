function isStatsPage() {
    return !!app.querySelector('[data-page="stats"]');
}

app.addEventListener("click", (event) => {
    if (isStatsPage()) {
        const actionEl = event.target.closest("[data-action]");
        if (actionEl) {
            switch (actionEl.dataset.action) {
                case "goto-words":
                    location.hash = "#/words";
                    return;
                case "show-status-words":
                    showStatusWords(actionEl.dataset.status);
                    return;
                case "show-session-detail":
                    showSessionDetail(Number(actionEl.dataset.sessionId));
                    return;
            }
        }
    }

    const overlay = event.target.closest(".modal-overlay");
    if (overlay && event.target === overlay) {
        overlay.remove();
    }
});

async function renderStats() {
    const [overview, weakWords, sessions, dailyData] = await Promise.all([
        api("/api/stats/overview"),
        api("/api/stats/weak-words?limit=20"),
        api("/api/stats/sessions?limit=7"),
        api("/api/stats/daily"),
    ]);

    let html = `<div class="page" data-page="stats">
        <h2>学习统计</h2>

        <div class="stats-cards" style="margin-top:20px">
            <div class="card stat-clickable" data-action="goto-words"><div class="num">${overview.total_words}</div><div class="label">总词数</div></div>
            <div class="card stat-clickable" data-action="show-status-words" data-status="mastered"><div class="num" style="color:#4caf50">${overview.mastered}</div><div class="label">已掌握</div></div>
            <div class="card stat-clickable" data-action="show-status-words" data-status="learning"><div class="num" style="color:#ff9800">${overview.learning}</div><div class="label">学习中</div></div>
            <div class="card stat-clickable" data-action="show-status-words" data-status="review"><div class="num" style="color:#2196f3">${overview.review}</div><div class="label">待复习</div></div>
            <div class="card"><div class="num" style="color:#9e9e9e">${overview.new}</div><div class="label">新词</div></div>
        </div>`;

    html += `<div style="margin-top:30px">
        <h3>每日趋势</h3>
        <div class="card" style="margin-top:12px;padding:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <div>
                    <span style="font-size:14px;color:#666">连续打卡</span>
                    <span style="font-size:28px;font-weight:700;color:#ff9800;margin-left:8px">${dailyData.streak}</span>
                    <span style="font-size:14px;color:#999">天</span>
                </div>
                <div style="text-align:right">
                    <span style="font-size:14px;color:#666">今日练习</span>
                    <span style="font-size:28px;font-weight:700;color:#4caf50;margin-left:8px">${dailyData.today_total}</span>
                    <span style="font-size:14px;color:#999">题</span>
                </div>
            </div>
            <div class="daily-chart">`;

    const maxTotal = Math.max(...dailyData.daily.map(d => d.total), 1);
    dailyData.daily.forEach(d => {
        const height = d.total > 0 ? Math.max((d.total / maxTotal) * 100, 8) : 0;
        const barColor = d.accuracy >= 80 ? "#4caf50" : d.accuracy >= 60 ? "#ff9800" : d.total > 0 ? "#f44336" : "#e0e0e0";
        html += `<div class="daily-bar-group">
                <div class="daily-bar-wrap">
                    <div class="daily-bar" style="height:${height}%;background:${barColor}" title="${d.total}题 ${d.accuracy}%"></div>
                </div>
                <div class="daily-label">${d.weekday}</div>
                <div class="daily-count">${d.total > 0 ? d.total : ""}</div>
            </div>`;
    });

    html += `</div></div></div>`;

    html += `<div style="margin-top:30px">
        <h3>练习历史</h3>`;

    if (sessions.length === 0) {
        html += `<div class="card" style="margin-top:16px;text-align:center;color:#999">
            暂无练习记录
        </div>`;
    } else {
        html += `<div style="margin-top:12px">`;
        sessions.forEach(s => {
            const accColor = s.accuracy >= 80 ? "#4caf50" : s.accuracy >= 60 ? "#ff9800" : "#f44336";
            html += `<div class="card session-card stat-clickable" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:12px 16px" data-action="show-session-detail" data-session-id="${s.id}">
                <div>
                    <span class="session-mode">${s.mode_name}</span>
                    <span style="color:#999;font-size:13px;margin-left:12px">${s.started_at}</span>
                </div>
                <div style="text-align:right">
                    <span style="font-weight:700;color:${accColor}">${s.accuracy}%</span>
                    <span style="color:#999;font-size:13px;margin-left:8px">${s.correct_answers}/${s.total_questions}</span>
                </div>
            </div>`;
        });
        html += `</div>`;
    }

    html += `</div>`;

    html += `<div style="margin-top:30px">
        <h3>薄弱词汇 <span style="font-size:14px;color:#999;font-weight:normal">(正确率 < 60%)</span></h3>`;

    if (weakWords.length === 0) {
        html += `<div class="card" style="margin-top:16px;text-align:center;color:#999">
            暂无薄弱词汇数据，多练习几次就会显示了
        </div>`;
    } else {
        html += `<div style="margin-top:12px">`;
        weakWords.forEach(w => {
            const accuracyColor = w.accuracy < 30 ? "#f44336" : w.accuracy < 50 ? "#ff9800" : "#ffc107";
            html += `<div class="card weak-word-card" style="text-align:left;margin-bottom:10px;padding:14px">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <b>${w.english}</b>
                        <span style="color:#999;margin-left:8px">${w.pronunciation}</span>
                        <span style="float:right;color:#999;font-size:13px">${w.category_name}</span>
                    </div>
                    <div style="text-align:right;min-width:100px">
                        <div style="font-size:20px;font-weight:700;color:${accuracyColor}">${w.accuracy}%</div>
                        <div style="font-size:12px;color:#999">${w.correct_attempts}/${w.total_attempts} 正确</div>
                    </div>
                </div>
                <div style="margin-top:6px;color:#666">${w.chinese} (${w.part_of_speech})</div>
                <div style="margin-top:8px">
                    <div class="accuracy-bar">
                        <div class="accuracy-fill" style="width:${w.accuracy}%;background:${accuracyColor}"></div>
                    </div>
                </div>
            </div>`;
        });
        html += `</div>`;
    }

    html += `</div></div>`;
    app.innerHTML = html;
}

async function showStatusWords(status) {
    const statusNames = { mastered: "已掌握", learning: "学习中", review: "待复习" };
    const words = await api(`/api/stats/words-by-status?status=${status}`);

    let content = `<h3 style="margin-bottom:16px">${statusNames[status]} (${words.length})</h3>`;
    if (words.length === 0) {
        content += `<div style="text-align:center;color:#999;padding:20px">暂无数据</div>`;
    } else {
        content += `<div style="max-height:400px;overflow-y:auto">`;
        words.forEach(w => {
            content += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0">
                <div>
                    <b>${w.english}</b>
                    <span style="color:#999;margin-left:8px">${w.pronunciation}</span>
                </div>
                <div style="text-align:right">
                    <span style="color:#666">${w.chinese}</span>
                    <span style="color:#999;font-size:12px;margin-left:8px">${w.category_name}</span>
                </div>
            </div>`;
        });
        content += `</div>`;
    }
    showModal(content);
}

async function showSessionDetail(sessionId) {
    const detail = await api(`/api/stats/sessions/${sessionId}`);

    let content = `<h3 style="margin-bottom:4px">${detail.mode_name}</h3>
        <div style="color:#999;font-size:13px;margin-bottom:16px">${detail.started_at} · ${detail.correct_answers}/${detail.total_questions} 正确</div>`;

    if (detail.records && detail.records.length > 0) {
        content += `<div style="max-height:400px;overflow-y:auto">`;
        detail.records.forEach((r) => {
            const icon = r.is_correct ? "✓" : "✗";
            const color = r.is_correct ? "#4caf50" : "#f44336";
            const time = r.response_time_ms ? ` ${(r.response_time_ms / 1000).toFixed(1)}s` : "";
            content += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0">
                <div>
                    <span style="color:${color};font-weight:700;margin-right:8px">${icon}</span>
                    <b>${r.english}</b>
                </div>
                <div style="color:#666">${r.chinese}<span style="color:#999;font-size:12px;margin-left:8px">${time}</span></div>
            </div>`;
        });
        content += `</div>`;
    }
    showModal(content);
}

function showModal(content) {
    const existing = document.querySelector(".modal-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.onclick = (event) => {
        if (event.target === overlay) overlay.remove();
    };
    overlay.innerHTML = `<div class="modal-content" style="max-width:520px">${content}</div>`;
    document.body.appendChild(overlay);
}
