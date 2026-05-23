# 编程词汇练习

一个帮助程序员记忆编程常用英语词汇的 Web 应用，基于 FastAPI + 原生 JavaScript 构建，支持练习、词库管理和学习统计。

## 功能特点

- **676 个编程词汇**，覆盖 **17 个分类**
- **4 种练习模式**：英译中、中译英、拼写、代码填空
- **3 种练习范围**：全部单词、只练到期词、只练错题
- **自定义题量**：单次可练 1~50 题
- **SM-2 间隔重复算法**，按记忆状态安排复习
- **词库浏览与搜索**：按分类、按状态查看单词
- **词库管理**：支持新增、编辑、删除单词和自定义分类
- **学习统计**：概览、每日趋势、连续打卡、练习历史、单次详情
- **薄弱词汇统计**：自动识别正确率较低的单词
- **状态视图联动**：从统计卡片快速查看已掌握 / 学习中 / 待复习词汇
- **键盘快捷键**：1-4 快速选项，Enter 提交，方向键切题
- **TTS 发音**：支持练习页和词库页朗读单词
- **首页快捷入口**：练习、词库、统计一键直达

## 词汇分类

| 分类 | 示例词汇 |
|------|----------|
| 常用变量名 | index, count, flag, temp |
| 常用函数名 | get, set, init, parse |
| Web/FastAPI 高频 | request, response, middleware |
| 数据库相关 | query, schema, migration |
| 部署/Linux 相关 | deploy, docker, nginx |
| AI 方向 | tensor, gradient, epoch |
| 常见报错信息 | KeyError, TypeError, TimeoutError |

## 页面预览

- **首页**：展示学习概览，并提供练习 / 词库 / 统计快捷入口
- **练习页**：选择模式、分类、范围和题量，支持错题重练
- **词库页**：支持搜索、状态筛选、分类浏览、增删改词汇
- **统计页**：查看趋势图、连续打卡、薄弱词汇和练习历史

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库

```bash
python seed.py
```

### 3. 启动服务

```bash
python main.py
```

浏览器访问 http://127.0.0.1:688

## 项目结构

```text
memorize_words/
├── main.py              # FastAPI 入口
├── database.py          # 数据库配置
├── models.py            # 数据模型
├── schemas.py           # Pydantic 模型
├── seed.py              # 数据初始化脚本
├── requirements.txt     # 依赖列表
├── data/
│   └── vocabulary.json  # 词汇与分类数据
├── routers/
│   ├── words.py         # 词汇 API
│   ├── practice.py      # 练习 API
│   └── stats.py         # 统计 API
├── services/
│   ├── quiz_generator.py      # 题目生成
│   └── spaced_repetition.py   # SM-2 算法
└── static/
    ├── index.html       # 页面入口
    ├── css/style.css    # 样式
    └── js/
        ├── app.js       # 路由和首页
        ├── practice.js  # 练习页面
        ├── words.js     # 词库浏览与编辑
        └── stats.js     # 统计页面
```

## 技术栈

- **后端**：FastAPI + SQLAlchemy + SQLite
- **前端**：原生 HTML / CSS / JavaScript（SPA）
- **算法**：SM-2 间隔重复算法
- **浏览器能力**：Web Speech API（TTS 发音）

## 使用的 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/words/` | 获取所有词汇 |
| GET | `/api/words/categories` | 获取分类列表 |
| POST | `/api/words/` | 添加单词 |
| PUT | `/api/words/{id}` | 编辑单词 |
| DELETE | `/api/words/{id}` | 删除单词 |
| POST | `/api/practice/start` | 开始练习 |
| POST | `/api/practice/answer` | 提交答案 |
| GET | `/api/stats/overview` | 学习概览 |
| GET | `/api/stats/weak-words` | 薄弱词汇 |
| GET | `/api/stats/sessions` | 练习历史 |
| GET | `/api/stats/sessions/{id}` | 单次练习详情 |
| GET | `/api/stats/daily` | 每日趋势 + 连续打卡 |
| GET | `/api/stats/words-by-status` | 按状态查单词 |

## License

MIT
