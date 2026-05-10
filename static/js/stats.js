async function renderStats() {
    const [overview, weakWords] = await Promise.all([
        api("/api/stats/overview"),
        api("/api/stats/weak-words?limit=20"),
    ]);

    let html = `<div class="page">
        <h2>学习统计</h2>

        <div class="stats-cards" style="margin-top:20px">
            <div class="card"><div class="num">${overview.total_words}</div><div class="label">总词数</div></div>
            <div class="card"><div class="num" style="color:#4caf50">${overview.mastered}</div><div class="label">已掌握</div></div>
            <div class="card"><div class="num" style="color:#ff9800">${overview.learning}</div><div class="label">学习中</div></div>
            <div class="card"><div class="num" style="color:#2196f3">${overview.review}</div><div class="label">待复习</div></div>
        </div>

        <div style="margin-top:30px">
            <h3>薄弱词汇 <span style="font-size:14px;color:#999;font-weight:normal">(正确率 < 60%)</span></h3>`;

    if (weakWords.length === 0) {
        html += `<div class="card" style="margin-top:16px;text-align:center;color:#999">
            暂无薄弱词汇数据，多练习几次就会显示了
        </div>`;
    } else {
        html += `<div style="margin-top:12px">`;
        weakWords.forEach(w => {
            const accuracyColor = w.accuracy < 30 ? "#f44336" : w.accuracy < 50 ? "#ff9800" : "#ff9800";
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
