# 编程词汇练习

一个面向程序员的编程英语词汇练习 Web 应用，基于 FastAPI、SQLAlchemy、SQLite 和原生 JavaScript 构建。项目内置 676 个编程词汇和 17 个分类，支持词库浏览、练习、错题复习、学习统计和自定义新增单词。

## 功能

- 676 个编程常用英语词汇，覆盖基础概念、Web、数据库、部署、AI、常见报错等分类
- 英译中、中译英、拼写、代码填空 4 种练习模式
- 全部单词、到期复习、错题复习 3 种练习范围
- 支持新增、编辑、删除单词
- 基于 SM-2 的间隔重复复习逻辑
- 学习统计、练习历史、薄弱词汇统计
- 浏览器 TTS 发音

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/lzffzl13/memorize-words.git
cd memorize-words
```

### 2. 创建虚拟环境

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Linux / macOS:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. 安装依赖

```bash
pip install -r requirements.txt
```

### 4. 启动服务

```bash
python main.py
```

浏览器访问：

```text
http://127.0.0.1:688
```

第一次启动时，程序会自动创建数据库并导入内置词库。默认数据库文件是项目目录下的 `vocab.db`。

## 数据库

默认使用 SQLite，不需要额外安装数据库，适合本地开发和小型部署。

也可以通过环境变量切换到 MySQL：

```bash
DATABASE_URL=mysql+pymysql://root:123456@127.0.0.1:3306/memorize_words?charset=utf8mb4
```

使用 MySQL 前需要先创建数据库：

```sql
CREATE DATABASE memorize_words CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 初始化数据

项目内置词库位于：

```text
data/vocabulary.json
```

通常不需要手动执行初始化脚本，因为应用启动时会在数据库为空时自动导入。

如果需要手动初始化：

```bash
python seed.py
```

如果数据库已有单词，这条命令会跳过，不会覆盖现有学习数据。

如果你明确想重置数据库并重新导入初始词库：

```bash
python seed.py --reset
```

注意：`--reset` 会清空单词、学习进度和练习记录。

## 服务器部署

示例启动命令：

```bash
uvicorn main:app --host 0.0.0.0 --port 688
```

如果使用 `systemd` 托管，可以创建：

```text
/etc/systemd/system/memorize-words.service
```

内容示例：

```ini
[Unit]
Description=Memorize Words FastAPI App
After=network.target

[Service]
WorkingDirectory=/root/memorize-words
ExecStart=/root/memorize-words/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 688
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
systemctl daemon-reload
systemctl enable memorize-words
systemctl restart memorize-words
systemctl status memorize-words
```

## 常用 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/words/` | 获取所有单词 |
| GET | `/api/words/categories` | 获取分类 |
| POST | `/api/words/` | 添加单词 |
| PUT | `/api/words/{id}` | 编辑单词 |
| DELETE | `/api/words/{id}` | 删除单词 |
| POST | `/api/practice/start` | 开始练习 |
| POST | `/api/practice/answer` | 提交答案 |
| GET | `/api/stats/overview` | 学习概览 |
| GET | `/api/stats/weak-words` | 薄弱词汇 |
| GET | `/api/stats/sessions` | 练习历史 |
| GET | `/api/stats/daily` | 每日趋势 |

## 项目结构

```text
memorize-words/
├── main.py              # FastAPI 入口
├── database.py          # 数据库配置
├── models.py            # SQLAlchemy 模型
├── schemas.py           # Pydantic 模型
├── seed.py              # 数据初始化脚本
├── requirements.txt     # Python 依赖
├── data/
│   └── vocabulary.json  # 内置词库
├── routers/             # API 路由
├── services/            # 练习题生成和复习算法
└── static/              # 前端页面、样式和脚本
```

## License

MIT
