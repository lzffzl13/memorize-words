let wordsData = [];

async function renderWords() {
    wordsData = await api("/api/words/");
    const categories = [...new Set(wordsData.map(w => w.category_name))];

    let html = `<div class="page"><h2>词库浏览</h2>
        <input class="answer-input" id="search-input" placeholder="搜索单词..." style="margin-bottom:16px">
        <div id="cat-list">`;
    categories.forEach(cat => {
        const count = wordsData.filter(w => w.category_name === cat).length;
        html += `<div class="card cat-card" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding:14px 18px" data-cat="${cat}">
            <span style="font-weight:600;font-size:15px">${cat}</span>
            <span style="color:#999">${count} 词</span>
        </div>`;
    });
    html += `</div><div id="word-detail" style="display:none"></div></div>`;
    app.innerHTML = html;

    // 点击分类
    document.querySelectorAll(".cat-card").forEach(card => {
        card.onclick = () => showCategory(card.dataset.cat);
    });

    // 搜索（直接显示匹配的单词）
    document.getElementById("search-input").oninput = (e) => {
        const q = e.target.value.toLowerCase();
        if (!q) {
            document.getElementById("cat-list").style.display = "";
            document.getElementById("word-detail").style.display = "none";
            return;
        }
        document.getElementById("cat-list").style.display = "none";
        document.getElementById("word-detail").style.display = "";
        const matched = wordsData.filter(w =>
            w.english.toLowerCase().includes(q) || w.chinese.includes(q)
        );
        renderWordList(matched, "搜索结果");
    };
}

function showCategory(cat) {
    const words = wordsData.filter(w => w.category_name === cat);
    document.getElementById("cat-list").style.display = "none";
    document.getElementById("search-input").style.display = "none";
    document.getElementById("word-detail").style.display = "";
    renderWordList(words, cat);
}

function renderWordList(words, title) {
    let html = `<div style="display:flex;align-items:center;margin-bottom:16px">
        <button class="submit-btn" onclick="renderWords()" style="margin:0;padding:8px 16px">返回</button>
        <h3 style="margin-left:12px">${title} (${words.length})</h3>
    </div>`;
    words.forEach(w => {
        html += `<div class="card" style="text-align:left;margin-bottom:10px;padding:14px">
            <b>${w.english}</b> <span style="color:#999">${w.pronunciation}</span>
            <span style="float:right;color:#999;font-size:13px">${w.category_name}</span>
            <div style="margin-top:4px">${w.chinese} (${w.part_of_speech})</div>
            <div style="margin-top:6px;color:#666;font-size:14px">${w.example_sentence}</div>
            ${w.example_sentence_cn ? `<div style="margin-top:2px;color:#999;font-size:13px">${w.example_sentence_cn}</div>` : ""}
            ${w.code_snippet ? `<div class="code-block" style="font-size:13px;margin-top:8px">${w.code_snippet}</div>` : ""}
        </div>`;
    });
    document.getElementById("word-detail").innerHTML = html;
}
