let wordsData = [];
let currentWordList = [];
let currentWordTitle = "";
let currentStatusFilter = "all";
let wordsPageInitialized = false;
let searchWordsDebounced = null;
let wordModalTrigger = null;
let currentCategory = "";
let currentSearchQuery = "";
let expandedWordIds = new Set();

const statusLabels = {
    all: "全部",
    new: "新词",
    learning: "学习中",
    review: "待复习",
    mastered: "已掌握",
};

// TTS 发音
app.addEventListener("click", (event) => {
    if (!isWordsPage()) return;

    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;

    switch (actionEl.dataset.action) {
        case "show-add-word":
            showAddWordForm();
            break;
        case "show-category":
            showCategory(actionEl.dataset.category);
            break;
        case "back-to-words":
            currentCategory = "";
            currentSearchQuery = "";
            expandedWordIds.clear();
            currentWordList = [];
            currentWordTitle = "";
            document.getElementById("search-input").value = "";
            renderWordsPageContent();
            break;
        case "filter-status":
            currentStatusFilter = actionEl.dataset.status || "all";
            expandedWordIds.clear();
            renderWordsPageContent();
            break;
        case "toggle-word-detail": {
            const wordId = Number(actionEl.dataset.wordId);
            if (expandedWordIds.has(wordId)) expandedWordIds.delete(wordId);
            else expandedWordIds.add(wordId);
            renderWordsPageContent({ focusWordId: wordId });
            break;
        }
        case "speak-word": {
            const word = wordsData.find(item => item.id === Number(actionEl.dataset.wordId));
            if (word) window.playWordPronunciation(word.english);
            break;
        }
        case "edit-word":
            showEditWordForm(Number(actionEl.dataset.wordId));
            break;
        case "delete-word":
            deleteWord(Number(actionEl.dataset.wordId), actionEl.dataset.wordEnglish);
            break;
    }
});

app.addEventListener("change", (event) => {
    if (!isWordsPage()) return;
    if (event.target.id === "word-category-select") {
        toggleCustomCategory();
    }
});

function isWordsPage() {
    return !!app.querySelector('[data-page="words"]');
}

function getFilteredWords() {
    if (currentStatusFilter === "all") return wordsData;
    return wordsData.filter(w => (w.status || "new") === currentStatusFilter);
}

function escapeWordHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
    }[char]));
}

function getVisibleWords() {
    let words = getFilteredWords();
    if (currentCategory) words = words.filter((word) => word.category_name === currentCategory);
    if (currentSearchQuery) {
        words = words.filter((word) =>
            word.english.toLowerCase().includes(currentSearchQuery) ||
            word.chinese.toLowerCase().includes(currentSearchQuery)
        );
    }
    return words;
}

function getCurrentWordTitle() {
    if (currentCategory && currentSearchQuery) return `${currentCategory} · 搜索结果`;
    if (currentCategory) return `${currentCategory} · ${statusLabels[currentStatusFilter]}`;
    return `${statusLabels[currentStatusFilter]} · 搜索结果`;
}

function getStatusCounts(words) {
    const counts = { all: words.length, new: 0, learning: 0, review: 0, mastered: 0 };
    words.forEach((word) => {
        const status = word.status || "new";
        counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
}

function getCategoryCounts(words) {
    const counts = new Map();
    words.forEach((word) => {
        counts.set(word.category_name, (counts.get(word.category_name) || 0) + 1);
    });
    return counts;
}

function renderStatusFilters() {
    const statuses = ["all", "new", "learning", "review", "mastered"];
    const counts = getStatusCounts(wordsData);
    return `<div id="status-filter" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">${statuses.map(status => {
        const count = counts[status] || 0;
        return `<button type="button" class="cat-btn ${currentStatusFilter === status ? "active" : ""}" data-action="filter-status" data-status="${status}" aria-pressed="${currentStatusFilter === status}">${statusLabels[status]} (${count})</button>`;
    }).join("")}</div>`;
}

function renderWordsShell() {
    app.innerHTML = `<div class="page" data-page="words">
        <div class="words-header">
            <h2>词库浏览</h2>
            <button type="button" class="words-add-btn" data-action="show-add-word" aria-haspopup="dialog"><span aria-hidden="true">＋</span> 添加单词</button>
        </div>
        <label class="sr-only" for="search-input">搜索词库</label>
        <input class="answer-input" id="search-input" placeholder="搜索单词..." aria-label="搜索词库" style="margin-bottom:16px">
        <div id="status-filter-wrap"></div>
        <div id="cat-list"></div>
        <div id="word-detail" style="display:none"></div>
    </div>`;

    if (!searchWordsDebounced) {
        searchWordsDebounced = debounce((value) => {
            if (!isWordsPage()) return;
            currentSearchQuery = value.trim().toLowerCase();
            expandedWordIds.clear();
            renderWordsPageContent();
        }, 120);
    }

    document.getElementById("search-input").oninput = (e) => {
        searchWordsDebounced(e.target.value);
    };
}

function renderWordsPageContent({ focusWordId = null } = {}) {
    if (!isWordsPage()) return;

    const filteredWords = getFilteredWords();
    const categoryCounts = getCategoryCounts(filteredWords);
    const categories = [...categoryCounts.keys()];

    document.getElementById("status-filter-wrap").innerHTML = renderStatusFilters();

    let categoryHtml = "";
    categories.forEach((cat) => {
        categoryHtml += `<button type="button" class="card cat-card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding:14px 18px" data-action="show-category" data-category="${escapeWordHtml(cat)}">
            <span style="font-weight:600;font-size:15px">${escapeWordHtml(cat)}</span>
            <span style="color:#999">${categoryCounts.get(cat)} 词</span>
        </button>`;
    });

    if (categories.length === 0) {
        categoryHtml = `<div class="card" style="color:#999">当前筛选下暂无单词</div>`;
    }

    document.getElementById("cat-list").innerHTML = categoryHtml;

    const searchInput = document.getElementById("search-input");
    const detail = document.getElementById("word-detail");
    const list = document.getElementById("cat-list");

    if (searchInput) searchInput.style.display = "";

    if (currentCategory || currentSearchQuery) {
        list.style.display = "none";
        detail.style.display = "";
        renderWordList(getVisibleWords(), getCurrentWordTitle());
        if (focusWordId !== null) {
            requestAnimationFrame(() => document.querySelector(`[data-word-toggle-id="${focusWordId}"]`)?.focus());
        }
        return;
    }

    if (searchInput) {
        searchInput.value = "";
    }
    list.style.display = "";
    detail.style.display = "none";
    detail.innerHTML = "";
}

async function renderWords(options = {}) {
    const { forceRefresh = false } = options;
    if (!wordsPageInitialized || !isWordsPage()) {
        currentCategory = "";
        currentSearchQuery = "";
        expandedWordIds.clear();
        renderWordsShell();
        wordsPageInitialized = true;
    }

    wordsData = await getWords(forceRefresh);
    renderWordsPageContent();
}

function showCategory(cat) {
    currentCategory = cat;
    currentSearchQuery = "";
    expandedWordIds.clear();
    document.getElementById("search-input").value = "";
    renderWordsPageContent();
}

function renderWordList(words, title) {
    currentWordList = words;
    currentWordTitle = title;

    let html = `<div class="word-list-header">
        <button type="button" class="word-back-btn" data-action="back-to-words" aria-label="返回词库分类">← 返回</button>
        <div class="word-list-heading">
            <h3>${escapeWordHtml(title)}</h3>
            <span>${words.length} 词</span>
        </div>
    </div>`;
    if (words.length === 0) {
        html += `<div class="word-list-empty">当前筛选下暂无单词</div>`;
    }
    html += `<div class="compact-word-list">`;
    words.forEach(w => {
        const statusText = statusLabels[w.status || "new"] || "新词";
        const statusClass = `status-${w.status || "new"}`;
        const isExpanded = expandedWordIds.has(w.id);
        const detailId = `word-detail-${w.id}`;
        html += `<article class="word-compact-card ${isExpanded ? "expanded" : ""}">
            <div class="word-compact-row">
                <button type="button" class="word-compact-toggle" data-action="toggle-word-detail" data-word-id="${w.id}" data-word-toggle-id="${w.id}" aria-expanded="${isExpanded}" aria-controls="${detailId}">
                    <span class="word-compact-copy">
                        <strong>${escapeWordHtml(w.english)}</strong>
                        <span>${escapeWordHtml(w.chinese)} · ${escapeWordHtml(w.part_of_speech)}</span>
                    </span>
                    <span class="word-status-badge ${statusClass}">${statusText}</span>
                    <span class="word-compact-chevron" aria-hidden="true">›</span>
                </button>
                <button type="button" class="icon-btn speak-btn word-compact-speak" data-action="speak-word" data-word-id="${w.id}" title="发音" aria-label="播放 ${escapeWordHtml(w.english)} 的发音">🔊</button>
            </div>
            <div class="word-expanded-panel" id="${detailId}" ${isExpanded ? "" : "hidden"}>
                <div class="word-expanded-meta">
                    ${w.pronunciation ? `<span>${escapeWordHtml(w.pronunciation)}</span>` : ""}
                    <span>${escapeWordHtml(w.category_name)}</span>
                </div>
                ${w.example_sentence ? `<div class="word-expanded-example">${escapeWordHtml(w.example_sentence)}</div>` : ""}
                ${w.example_sentence_cn ? `<div class="word-expanded-example-cn">${escapeWordHtml(w.example_sentence_cn)}</div>` : ""}
                ${w.code_snippet ? `<div class="code-block word-expanded-code">${escapeWordHtml(w.code_snippet)}</div>` : ""}
                <div class="word-expanded-actions">
                    <button type="button" class="word-detail-action" data-action="edit-word" data-word-id="${w.id}" aria-label="编辑 ${escapeWordHtml(w.english)}">✏️ 编辑</button>
                    <button type="button" class="word-detail-action danger" data-action="delete-word" data-word-id="${w.id}" data-word-english="${escapeWordHtml(w.english)}" aria-label="删除 ${escapeWordHtml(w.english)}">🗑️ 删除</button>
                </div>
            </div>
        </article>`;
    });
    html += `</div>`;
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
    closeWordForm();
    wordModalTrigger = document.activeElement;

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.dataset.role = "word-modal-overlay";
    overlay.onclick = (event) => {
        if (event.target === overlay) closeWordForm();
    };

    let catOptions = categories.map(c =>
        `<option value="${c.name}" ${word && word.category_name === c.name ? "selected" : ""}>${c.name}</option>`
    ).join("");

    const isEdit = !!word;

    overlay.innerHTML = `
        <div class="modal-content" data-role="word-modal-content" role="dialog" aria-modal="true" aria-labelledby="word-modal-title">
            <div class="modal-header">
                <h3 id="word-modal-title">${title}</h3>
                <button type="button" class="icon-btn modal-close-btn" data-action="close-word-form" aria-label="关闭单词表单">×</button>
            </div>
            <div class="form-group">
                <label for="word-english">英文单词 *</label>
                <input class="form-input" id="word-english" value="${word ? word.english : ""}" placeholder="例: deploy" required>
            </div>
            <div class="form-group">
                <label for="word-chinese">中文释义 *</label>
                <input class="form-input" id="word-chinese" value="${word ? word.chinese : ""}" placeholder="例: 部署" required>
            </div>
            <div class="form-group">
                <label for="word-category-select">分类 *</label>
                <div style="display:flex;gap:8px">
                    <select class="form-input" id="word-category-select" style="flex:1">
                        ${catOptions}
                        <option value="__custom__">自定义分类...</option>
                    </select>
                    <input class="form-input" id="word-category-custom" placeholder="输入新分类名" style="display:none;flex:1">
                </div>
            </div>
            <div class="form-group">
                <label for="word-pos">词性</label>
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
                <label for="word-pronunciation">音标</label>
                <input class="form-input" id="word-pronunciation" value="${word ? word.pronunciation : ""}" placeholder="例: /dɪˈplɔɪ/">
            </div>
            <div class="form-group">
                <label for="word-example">例句</label>
                <input class="form-input" id="word-example" value="${word ? word.example_sentence : ""}" placeholder="例: Deploy the app to production.">
            </div>
            <div class="form-group">
                <label for="word-example-cn">例句中文</label>
                <input class="form-input" id="word-example-cn" value="${word ? word.example_sentence_cn : ""}" placeholder="例: 将应用部署到生产环境。">
            </div>
            <div id="word-form-error" role="alert" aria-live="polite" style="color:#f44336;font-size:14px;margin-top:8px"></div>
            <div style="display:flex;gap:12px;margin-top:20px">
                <button type="button" class="submit-btn" data-action="submit-word" data-word-id="${word ? word.id : ""}" style="flex:1">${isEdit ? "保存" : "添加"}</button>
                <button type="button" class="submit-btn" data-action="close-word-form" style="flex:1;background:#999">取消</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => document.getElementById("word-english")?.focus());
}

function toggleCustomCategory() {
    const select = document.getElementById("word-category-select");
    const custom = document.getElementById("word-category-custom");
    if (!select || !custom) return;
    custom.style.display = select.value === "__custom__" ? "block" : "none";
}

function closeWordForm() {
    const overlay = document.querySelector('[data-role="word-modal-overlay"]');
    if (!overlay) return;
    overlay.remove();
    wordModalTrigger?.focus();
    wordModalTrigger = null;
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
        const previousTitle = currentWordTitle;
        const previousWordIds = currentWordList.map(w => w.id);
        closeWordForm();
        await renderWords({ preserveDetail: !!previousTitle, title: previousTitle, wordIds: previousWordIds, forceRefresh: true });
    } else {
        document.getElementById("word-form-error").textContent = res.detail || res.error || "操作失败";
    }
}

// ===== 删除单词 =====
async function deleteWord(wordId, english) {
    if (!confirm(`确定要删除单词 "${english}" 吗？`)) return;

    const res = await api(`/api/words/${wordId}`, { method: "DELETE" });
    if (res.message) {
        await renderWords({ forceRefresh: true });
    } else {
        alert(res.error || "删除失败");
    }
}

document.addEventListener("click", (event) => {
    const overlay = document.querySelector('[data-role="word-modal-overlay"]');
    if (!overlay) return;

    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;

    if (actionEl.dataset.action === "close-word-form") {
        closeWordForm();
        return;
    }

    if (actionEl.dataset.action === "submit-word") {
        submitWord(actionEl.dataset.wordId ? Number(actionEl.dataset.wordId) : null);
    }
});

document.addEventListener("keydown", (event) => {
    const overlay = document.querySelector('[data-role="word-modal-overlay"]');
    if (!overlay) return;
    if (event.key === "Escape") {
        event.preventDefault();
        closeWordForm();
        return;
    }
    window.trapFocusWithin(overlay, event);
});
