# 编程词汇练习

一个帮助程序员记忆编程常用英语词汇的 Web 应用。

## 功能特点

- **512 个编程词汇**，涵盖 17 个分类
- **4 种练习模式**：英译中、中译英、拼写、代码填空
- **SM-2 间隔重复算法**，科学安排复习计划
- **分类筛选**，按类别浏览和练习
- **薄弱词汇统计**，自动识别需要加强的单词
- **键盘快捷键**，1-4 选择答案，Enter 提交
- **答题动画**，正确/错误即时反馈

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

```
memorize_words/
├── main.py              # FastAPI 入口
├── database.py          # 数据库配置
├── models.py            # 数据模型
├── schemas.py           # Pydantic 模型
├── seed.py              # 数据初始化脚本
├── requirements.txt     # 依赖列表
├── data/
│   └── vocabulary.json  # 词汇数据
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
        ├── words.js     # 词库浏览
        └── stats.js     # 统计页面
```

## 技术栈

- **后端**：FastAPI + SQLAlchemy + SQLite
- **前端**：原生 HTML/CSS/JavaScript (SPA)
- **算法**：SM-2 间隔重复算法

## 使用的 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/words/` | 获取所有词汇 |
| POST | `/api/practice/start` | 开始练习 |
| POST | `/api/practice/answer` | 提交答案 |
| GET | `/api/stats/overview` | 学习概览 |
| GET | `/api/stats/weak-words` | 薄弱词汇 |

## License

MIT
