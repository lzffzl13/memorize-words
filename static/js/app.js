const app = document.getElementById("app");
const navLinks = document.querySelectorAll(".nav-link");
const wordsCache = { data: null, promise: null };

window.invalidateWordsCache = function invalidateWordsCache() {
    wordsCache.data = null;
    wordsCache.promise = null;
};

window.hasWordsCache = function hasWordsCache() {
    return Array.isArray(wordsCache.data);
};

window.getWords = async function getWords(forceRefresh = false) {
    if (forceRefresh) window.invalidateWordsCache();
    if (wordsCache.data) return wordsCache.data;
    if (!wordsCache.promise) {
        wordsCache.promise = api("/api/words/")
            .then((words) => {
                wordsCache.data = words;
                wordsCache.promise = null;
                return words;
            })
            .catch((error) => {
                wordsCache.promise = null;
                throw error;
            });
    }
    return wordsCache.promise;
};

window.preloadWords = function preloadWords() {
    if (!window.hasWordsCache()) {
        window.getWords().catch(() => {});
    }
};

window.debounce = function debounce(fn, delay = 120) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
};

function navigate(page) {
    navLinks.forEach(l => l.classList.remove("active"));
    const link = document.querySelector(`[data-page="${page}"]`);
    if (link) link.classList.add("active");

    switch (page) {
        case "home": renderHome(); break;
        case "practice": renderPractice(); break;
        case "words": renderWords(); break;
        case "stats": renderStats(); break;
        default: renderHome();
    }
}

async function api(url, options = {}) {
    const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    return res.json();
}

function isPageVisible(page) {
    return !!app.querySelector(`[data-page="${page}"]`);
}

// 路由监听
window.addEventListener("hashchange", () => {
    const page = location.hash.slice(2) || "home";
    navigate(page);
});

document.addEventListener("mouseover", (event) => {
    const practiceLink = event.target.closest('a[href="#/practice"]');
    if (practiceLink) window.preloadWords();
});

document.addEventListener("focusin", (event) => {
    const practiceLink = event.target.closest('a[href="#/practice"]');
    if (practiceLink) window.preloadWords();
});

function renderHomeShell() {
    app.innerHTML = `
        <div class="page home" data-page="home">
            <section class="home-hero">
                <div class="home-badge">✦ Programming Vocabulary</div>
                <h1>编程词汇练习</h1>
                <p class="home-subtitle">把常见开发词汇拆成可练、可记、可复习的小步学习流程，打开就能马上进入状态。</p>
                <div class="home-actions">
                    <a href="#/practice" class="btn-primary home-primary-btn">开始练习</a>
                    <a href="#/words" class="home-secondary-btn">浏览词库</a>
                </div>
            </section>

            <section class="home-stats-section">
                <div class="home-section-title">学习概览</div>
                <div class="stats-cards home-stats-cards">
                    <div class="card home-card">
                        <div class="home-card-icon">📚</div>
                        <div class="num" id="home-total-words">--</div>
                        <div class="label">总词数</div>
                        <div class="home-card-note">当前词库规模</div>
                    </div>
                    <div class="card home-card home-card-success">
                        <div class="home-card-icon">✅</div>
                        <div class="num" id="home-mastered" style="color:#2e7d32">--</div>
                        <div class="label">已掌握</div>
                        <div class="home-card-note">稳定记住的词</div>
                    </div>
                    <div class="card home-card home-card-warm">
                        <div class="home-card-icon">⏳</div>
                        <div class="num" id="home-learning" style="color:#f57c00">--</div>
                        <div class="label">学习中</div>
                        <div class="home-card-note">正在巩固的词</div>
                    </div>
                </div>
            </section>

            <section class="home-quick-entry">
                <div class="home-quick-card">
                    <div>
                        <div class="home-quick-title">继续今天的学习</div>
                        <div class="home-quick-text">直接进入练习、浏览词库，或者去统计页看看最近的掌握情况。</div>
                    </div>
                    <a href="#/stats" class="home-text-link">查看统计 →</a>
                </div>
            </section>
        </div>
    `;
}

// 首页
async function renderHome() {
    renderHomeShell();
    window.preloadWords();
    const overview = await api("/api/stats/overview");
    if (!isPageVisible("home")) return;

    document.getElementById("home-total-words").textContent = overview.total_words;
    document.getElementById("home-mastered").textContent = overview.mastered;
    document.getElementById("home-learning").textContent = overview.learning;
}

// 初始加载
window.addEventListener("load", () => {
    const initialPage = location.hash.slice(2) || "home";
    navigate(initialPage);
});
