# PROJECT_STATE.md

## 项目概述
个人编程词汇练习 Web 应用，用于背诵编程相关英语单词。

## 技术栈
- **后端**: FastAPI + SQLAlchemy + SQLite
- **前端**: 原生 HTML/CSS/JS SPA（hash 路由）
- **算法**: SM-2 间隔重复算法
- **TTS**: Web Speech API (`SpeechSynthesisUtterance`)

## 项目结构
```
D:\memorize_words\
├── main.py              # FastAPI 入口
├── database.py          # SQLAlchemy 数据库配置
├── models.py            # ORM 模型 (Word, Category, UserProgress)
├── schemas.py           # Pydantic 模型 (WordOut, WordCreate 等)
├── seed.py              # 数据种子脚本 (~512个单词)
├── routers/
│   ├── words.py         # 单词 CRUD + 分类
│   ├── practice.py      # 练习相关 API
│   └── stats.py         # 统计数据 API
├── static/
│   ├── index.html       # SPA 入口页面
│   ├── css/style.css    # 全部样式
│   └── js/
│       ├── app.js       # 路由、首页、api() 封装
│       ├── practice.js  # 练习页面逻辑
│       ├── words.js     # 词库浏览/编辑
│       └── stats.js     # 统计页面
└── .gitignore
```

## 已实现功能

### 首页
- 学习概览（已掌握/学习中/待复习/新词 统计卡片）
- 从 `/api/stats/overview` 获取真实数据

### 练习
- **4种模式**: 英译中(选择题)、中译英(输入)、拼写练习、代码填空
- **默认**: 英译中 + 全部词库，开始按钮直接可点
- **答对自动跳下一题**（1200ms 延迟），答错停留手动控制
- **键盘支持**: 数字键1-4选答案，Enter提交，↑↓切换题目
- **底部按钮**: ⬅上一题 / 下一题➡（答错后出现）
- **TTS发音**: 🔊图标点击播放单词发音
- **进度条** + 答题反馈动画

### 词库
- 分类浏览 + 搜索单词
- 添加/编辑/删除单词（弹窗表单）
- 分类可选已有或自定义输入
- 🔊发音图标

### 统计
- 学习概览卡片（总词数/已掌握/学习中/待复习/新词）
- 总词数点击跳转词库，已掌握/学习中/待复习点击弹窗查看对应单词列表
- 每日趋势：7天柱状图 + 连续打卡天数 + 今日练习数
- 练习历史：最近7次记录，点击可查看每次练习的具体题目（单词、对错、用时）
- 薄弱词汇列表（正确率<60% 且答题>=3次）

## API 路由
```
GET    /api/words/              # 单词列表
GET    /api/words/categories    # 分类列表
POST   /api/words/              # 创建单词
PUT    /api/words/{id}          # 编辑单词
DELETE /api/words/{id}          # 删除单词
POST   /api/practice/start      # 开始练习
POST   /api/practice/answer     # 提交答案
GET    /api/stats/overview      # 学习概览
GET    /api/stats/weak-words    # 薄弱词汇
GET    /api/stats/sessions      # 练习历史（最近7次）
GET    /api/stats/sessions/{id} # 单次练习详情
GET    /api/stats/daily         # 每日趋势 + 连续打卡
GET    /api/stats/words-by-status # 按状态查单词
```

## 已知问题
- 网络不稳定，GitHub push 经常 connection reset，需手动重试
- 服务器端口 688 被占用时需先 `taskkill //F //IM python.exe` 再重启

## 已知问题
- 网络不稳定，GitHub push 经常 connection reset，需手动重试
- 服务器端口 688 被占用时需先 `taskkill //F //IM python.exe` 再重启
