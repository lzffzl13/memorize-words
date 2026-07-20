const app = document.getElementById("app");
const navLinks = document.querySelectorAll(".nav-link");
const routeAnnouncer = document.getElementById("route-announcer");
const wordsCache = { data: null, promise: null };
const pageLabels = { home: "首页", practice: "练习", words: "词库", stats: "统计" };

document.getElementById("skip-to-main")?.addEventListener("click", () => app.focus());

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

let activeSpeechUtterance = null;
let cachedEnglishVoice = null;
let activePronunciationAudio = null;
let pronunciationManifest = null;
let pronunciationManifestPromise = null;
const pronunciationAudioCache = new Map();
const missingPronunciationAudio = new Set();

function normalizePronunciationKey(text) {
    return String(text || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getPronunciationSlug(text) {
    const slug = normalizePronunciationKey(text).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return slug || "word";
}

function loadPronunciationManifest() {
    if (pronunciationManifest) return Promise.resolve(pronunciationManifest);
    if (!pronunciationManifestPromise) {
        pronunciationManifestPromise = fetch("/static/audio/manifest.json", { cache: "force-cache" })
            .then((response) => (response.ok ? response.json() : {}))
            .then((manifest) => {
                pronunciationManifest = manifest || {};
                return pronunciationManifest;
            })
            .catch(() => {
                pronunciationManifest = {};
                return pronunciationManifest;
            });
    }
    return pronunciationManifestPromise;
}

loadPronunciationManifest();

function getEnglishVoice() {
    if (!("speechSynthesis" in window)) return null;

    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    cachedEnglishVoice =
        voices.find(voice => voice.lang === "en-US") ||
        voices.find(voice => voice.lang && voice.lang.toLowerCase().startsWith("en-")) ||
        null;

    return cachedEnglishVoice;
}

if ("speechSynthesis" in window) {
    if (typeof window.speechSynthesis.addEventListener === "function") {
        window.speechSynthesis.addEventListener("voiceschanged", getEnglishVoice);
    } else {
        window.speechSynthesis.onvoiceschanged = getEnglishVoice;
    }
}

window.speakWord = function speakWord(text) {
    const word = String(text || "").trim();
    if (!word) return false;
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
        console.warn("This browser does not support speech synthesis.");
        return false;
    }

    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(word);
    const voice = cachedEnglishVoice || getEnglishVoice();

    if (activePronunciationAudio) {
        activePronunciationAudio.pause();
        activePronunciationAudio.currentTime = 0;
    }

    utterance.lang = "en-US";
    utterance.rate = 0.85;
    utterance.pitch = 1;
    utterance.volume = 1;
    if (voice) utterance.voice = voice;

    activeSpeechUtterance = utterance;
    utterance.onend = utterance.onerror = () => {
        if (activeSpeechUtterance === utterance) activeSpeechUtterance = null;
    };

    synth.cancel();
    if (synth.paused) synth.resume();
    synth.speak(utterance);
    setTimeout(() => {
        if (synth.paused) synth.resume();
    }, 0);

    return true;
};

function getPronunciationAudio(text) {
    const key = normalizePronunciationKey(text);
    if (!key || missingPronunciationAudio.has(key)) return null;

    const item = pronunciationManifest ? pronunciationManifest[key] : null;
    const file = item && item.file ? item.file : `words/${getPronunciationSlug(text)}.mp3`;

    if (!pronunciationAudioCache.has(key)) {
        const audio = new Audio(`/static/audio/${file}`);
        audio.preload = "auto";
        pronunciationAudioCache.set(key, audio);
    }
    return pronunciationAudioCache.get(key);
}

window.preloadWordPronunciation = function preloadWordPronunciation(text) {
    loadPronunciationManifest().then(() => {
        const audio = getPronunciationAudio(text);
        if (audio) audio.load();
    });
};

window.playWordPronunciation = function playWordPronunciation(text) {
    const word = String(text || "").trim();
    if (!word) return false;

    const playFromManifest = () => {
        const key = normalizePronunciationKey(word);
        const audio = getPronunciationAudio(word);
        if (!audio) return window.speakWord(word);

        let fellBack = false;
        const fallback = () => {
            if (fellBack) return;
            fellBack = true;
            missingPronunciationAudio.add(key);
            window.speakWord(word);
        };

        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        if (activePronunciationAudio && activePronunciationAudio !== audio) {
            activePronunciationAudio.pause();
            activePronunciationAudio.currentTime = 0;
        }

        activePronunciationAudio = audio;
        audio.currentTime = 0;
        audio.onerror = fallback;

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(fallback);
        }
        return true;
    };

    const played = playFromManifest();
    if (!pronunciationManifest) loadPronunciationManifest();
    return played;
};

function navigate(page) {
    navLinks.forEach((navLink) => {
        navLink.classList.remove("active");
        navLink.removeAttribute("aria-current");
    });
    const link = document.querySelector(`[data-page="${page}"]`);
    if (link) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
    }

    switch (page) {
        case "home": renderHome(); break;
        case "practice": renderPractice(); break;
        case "words": renderWords(); break;
        case "stats": renderStats(); break;
        default: renderHome();
    }

    if (routeAnnouncer) routeAnnouncer.textContent = `已进入${pageLabels[page] || "首页"}`;
}

window.trapFocusWithin = function trapFocusWithin(container, event) {
    if (!container || event.key !== "Tab") return;
    const focusable = [...container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
};

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

            <section class="home-today-section" aria-labelledby="home-today-title">
                <div class="home-today-card">
                    <div class="home-today-content">
                        <div class="home-today-eyebrow">
                            <span>今日任务</span>
                            <span class="home-today-status" id="home-today-status">正在安排...</span>
                        </div>
                        <div class="home-today-main">
                            <div class="home-today-icon" aria-hidden="true">✓</div>
                            <div>
                                <h2 id="home-today-title">准备今天的复习</h2>
                                <p id="home-today-text">正在根据你的学习进度安排任务。</p>
                            </div>
                        </div>
                    </div>
                    <a href="#/practice" class="btn-primary home-today-action" id="home-today-action" data-action="prepare-daily-practice" data-scope="due" data-count="10">
                        <span>去完成</span><span aria-hidden="true">→</span>
                    </a>
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

        </div>
    `;
}

app.addEventListener("click", (event) => {
    const dailyAction = event.target.closest('[data-action="prepare-daily-practice"]');
    if (!dailyAction) return;
    if (typeof window.setPracticePreset === "function") {
        window.setPracticePreset({
            scope: dailyAction.dataset.scope,
            count: Number(dailyAction.dataset.count),
            autoStart: true,
        });
    }
});

// 首页
async function renderHome() {
    renderHomeShell();
    window.preloadWords();
    const overview = await api("/api/stats/overview");
    if (!isPageVisible("home")) return;

    document.getElementById("home-total-words").textContent = overview.total_words;
    document.getElementById("home-mastered").textContent = overview.mastered;
    document.getElementById("home-learning").textContent = overview.learning;

    const dueCount = Number(overview.review || 0);
    const fallbackCount = Math.min(10, Math.max(1, Number(overview.new || overview.total_words || 10)));
    const taskCount = dueCount > 0 ? Math.min(10, dueCount) : fallbackCount;
    const todayStatus = document.getElementById("home-today-status");
    const todayTitle = document.getElementById("home-today-title");
    const todayText = document.getElementById("home-today-text");
    const todayAction = document.getElementById("home-today-action");

    if (dueCount > 0) {
        todayStatus.textContent = `${dueCount} 个待复习`;
        todayTitle.textContent = `复习 ${taskCount} 个到期词`;
        todayText.textContent = "先完成一组短练习，把今天到期的内容及时巩固。";
        todayAction.dataset.scope = "due";
        todayAction.querySelector("span:first-child").textContent = "开始今日复习";
    } else {
        todayStatus.textContent = "今日已清空";
        todayTitle.textContent = `完成 ${taskCount} 题基础练习`;
        todayText.textContent = "当前没有到期词，可以继续熟悉词库里的内容。";
        todayAction.dataset.scope = "all";
        todayAction.querySelector("span:first-child").textContent = "开始今日练习";
    }
    todayAction.dataset.count = String(taskCount);
}

// 初始加载
window.addEventListener("load", () => {
    const initialPage = location.hash.slice(2) || "home";
    navigate(initialPage);
});
