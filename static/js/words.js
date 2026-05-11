let wordsData = [];

// TTS 发音
function speak(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
}

async function renderWords() {
    wordsData = await api("/api/words/");
    const categories = [...new Set(wordsData.map(w => w.category_name))];

    let html = `<div class="page">
        <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>词库浏览</h2>
            <button class="btn-primary" style="margin:0;width:auto;padding:10px 20px" onclick="showAddWordForm()">+ 添加单词</button>
        </div>
        <input class="answer-input" id="search-input" placeholder="搜索单词..." style="margin-bottom:16px">
        <div id="cat-list">`;
    categories.forEach(cat => {
        const count = wordsData.filter(w => w.category_name === cat).length;
        html += `<div class="card cat-card" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding:14px 18px" data-cat="${cat}">
            <span style="font-weight:600;font-size:15px">${cat}</span>
            <span style="color:#999">${count} 词</span>
        </div>`;
    });
    html += `</div><div id="word-detail" style="display:none"></div>
        <div id="word-modal" style="display:none"></div>
    </div>`;
    app.innerHTML = html;

    // 点击分类
    document.querySelectorAll(".cat-card").forEach(card => {
        card.onclick = () => showCategory(card.dataset.cat);
    });

    // 搜索
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
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div>
                    <b>${w.english}</b> <button class="icon-btn speak-btn" onclick="speak('${w.english}')" title="发音">🔊</button> <span style="color:#999">${w.pronunciation}</span>
                    <span style="float:right;color:#999;font-size:13px">${w.category_name}</span>
                    <div style="margin-top:4px">${w.chinese} (${w.part_of_speech})</div>
                    <div style="margin-top:6px;color:#666;font-size:14px">${w.example_sentence}</div>
                    ${w.example_sentence_cn ? `<div style="margin-top:2px;color:#999;font-size:13px">${w.example_sentence_cn}</div>` : ""}
                    ${w.code_snippet ? `<div class="code-block" style="font-size:13px;margin-top:8px">${w.code_snippet}</div>` : ""}
                </div>
                <div style="display:flex;gap:6px;margin-left:12px;flex-shrink:0">
                    <button class="icon-btn" onclick="showEditWordForm(${w.id})" title="编辑">✏️</button>
                    <button class="icon-btn" onclick="deleteWord(${w.id}, '${w.english}')" title="删除">🗑️</button>
                </div>
            </div>
        </div>`;
    });
    document.getElementById("word-detail").innerHTML = html;
}

// ===== 添加单词 =====
async function showAddWordForm() {
    const categories = await api("/api/words/categories");
    showWordForm("添加新单词", null, categories);
}

// ===== 编辑单词 =====
async function showEditWordForm(wordId) {
    const word = wordsData.find(w => w.id === wordId);
    if (!word) return;
    const categories = await api("/api/words/categories");
    showWordForm("编辑单词", word, categories);
}

// ===== 通用表单 =====
function showWordForm(title, word, categories) {
    const modal = document.getElementById("word-modal");
    modal.style.display = "block";

    let catOptions = categories.map(c =>
        `<option value="${c.name}" ${word && word.category_name === c.name ? "selected" : ""}>${c.name}</option>`
    ).join("");

    const isEdit = !!word;

    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeWordForm()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <h3 style="margin-bottom:16px">${title}</h3>
                <div class="form-group">
                    <label>英文单词 *</label>
                    <input class="form-input" id="word-english" value="${word ? word.english : ""}" placeholder="例: deploy" required>
                </div>
                <div class="form-group">
                    <label>中文释义 *</label>
                    <input class="form-input" id="word-chinese" value="${word ? word.chinese : ""}" placeholder="例: 部署" required>
                </div>
                <div class="form-group">
                    <label>分类 *</label>
                    <div style="display:flex;gap:8px">
                        <select class="form-input" id="word-category-select" style="flex:1" onchange="toggleCustomCategory()">
                            ${catOptions}
                            <option value="__custom__">自定义分类...</option>
                        </select>
                        <input class="form-input" id="word-category-custom" placeholder="输入新分类名" style="display:none;flex:1">
                    </div>
                </div>
                <div class="form-group">
                    <label>词性</label>
                    <select class="form-input" id="word-pos">
                        <option value="noun" ${word && word.part_of_speech === "noun" ? "selected" : ""}>noun 名词</option>
                        <option value="verb" ${word && word.part_of_speech === "verb" ? "selected" : ""}>verb 动词</option>
                        <option value="adj" ${word && word.part_of_speech === "adj" ? "selected" : ""}>adj 形容词</option>
                        <option value="adv" ${word && word.part_of_speech === "adv" ? "selected" : ""}>adv 副词</option>
                        <option value="phrase" ${word && word.part_of_speech === "phrase" ? "selected" : ""}>phrase 短语</option>
                        <option value="abbr" ${word && word.part_of_speech === "abbr" ? "selected" : ""}>abbr 缩写</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>音标</label>
                    <input class="form-input" id="word-pronunciation" value="${word ? word.pronunciation : ""}" placeholder="例: /dɪˈplɔɪ/">
                </div>
                <div class="form-group">
                    <label>例句</label>
                    <input class="form-input" id="word-example" value="${word ? word.example_sentence : ""}" placeholder="例: Deploy the app to production.">
                </div>
                <div class="form-group">
                    <label>例句中文</label>
                    <input class="form-input" id="word-example-cn" value="${word ? word.example_sentence_cn : ""}" placeholder="例: 将应用部署到生产环境。">
                </div>
                <div id="word-form-error" style="color:#f44336;font-size:14px;margin-top:8px"></div>
                <div style="display:flex;gap:12px;margin-top:20px">
                    <button class="submit-btn" onclick="submitWord(${word ? word.id : "null"})" style="flex:1">${isEdit ? "保存" : "添加"}</button>
                    <button class="submit-btn" onclick="closeWordForm()" style="flex:1;background:#999">取消</button>
                </div>
            </div>
        </div>
    `;
}

function toggleCustomCategory() {
    const select = document.getElementById("word-category-select");
    const custom = document.getElementById("word-category-custom");
    custom.style.display = select.value === "__custom__" ? "block" : "none";
}

function closeWordForm() {
    const modal = document.getElementById("word-modal");
    modal.style.display = "none";
    modal.innerHTML = "";
}

async function submitWord(wordId) {
    const english = document.getElementById("word-english").value.trim();
    const chinese = document.getElementById("word-chinese").value.trim();
    const select = document.getElementById("word-category-select");
    const customCat = document.getElementById("word-category-custom").value.trim();
    const category_name = select.value === "__custom__" ? customCat : select.value;

    if (!english || !chinese) {
        document.getElementById("word-form-error").textContent = "英文和中文必填";
        return;
    }
    if (!category_name) {
        document.getElementById("word-form-error").textContent = "请选择或输入分类";
        return;
    }

    const data = {
        english,
        chinese,
        category_name,
        part_of_speech: document.getElementById("word-pos").value,
        pronunciation: document.getElementById("word-pronunciation").value.trim(),
        example_sentence: document.getElementById("word-example").value.trim(),
        example_sentence_cn: document.getElementById("word-example-cn").value.trim(),
    };

    const url = wordId ? `/api/words/${wordId}` : "/api/words/";
    const method = wordId ? "PUT" : "POST";

    const res = await api(url, {
        method,
        body: JSON.stringify(data),
    });

    if (res.id) {
        closeWordForm();
        renderWords();
    } else {
        document.getElementById("word-form-error").textContent = res.detail || res.error || "操作失败";
    }
}

// ===== 删除单词 =====
async function deleteWord(wordId, english) {
    if (!confirm(`确定要删除单词 "${english}" 吗？`)) return;

    const res = await api(`/api/words/${wordId}`, { method: "DELETE" });
    if (res.message) {
        renderWords();
    } else {
        alert(res.error || "删除失败");
    }
}
