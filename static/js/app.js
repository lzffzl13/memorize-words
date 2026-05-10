const app = document.getElementById("app");
const navLinks = document.querySelectorAll(".nav-link");

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

// 路由监听
window.addEventListener("hashchange", () => {
    const page = location.hash.slice(2) || "home";
    navigate(page);
});

// 首页
async function renderHome() {
    const overview = await api("/api/stats/overview");
    app.innerHTML = `
        <div class="page home">
            <h1>编程词汇练习</h1>
            <div class="stats-cards">
                <div class="card"><div class="num">${overview.total_words}</div><div class="label">总词数</div></div>
                <div class="card"><div class="num" style="color:#4caf50">${overview.mastered}</div><div class="label">已掌握</div></div>
                <div class="card"><div class="num" style="color:#ff9800">${overview.learning}</div><div class="label">学习中</div></div>
            </div>
            <a href="#/practice" class="btn-primary">开始练习</a>
        </div>
    `;
}

// 初始加载
navigate("home");
