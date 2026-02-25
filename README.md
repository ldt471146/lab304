# Lab304 实验室座位管理系统

实验室日常签到、座位预约与排行榜系统，适用于高校实验室考勤管理场景。

**在线访问**：<https://ldt471146.github.io/lab304/>

## 功能

- **签到 / 签退** — 按时段（上午 / 下午 / 晚上）独立签到，选择座位，签退自动记录时长
- **座位预约** — 提前预约指定日期、时段的座位，支持取消
- **排行榜** — 总积分排行与本月签到排行，支持学级内排名
- **仪表板** — 个人签到统计、排名、今日预约一览
- **主题切换** — 浅色 / 深色主题自由切换，偏好自动保存
- **数据导出（管理员）** — 签到记录 + 预约记录按日期范围导出，支持 CSV / Excel

## 技术栈

| 层 | 技术 |
|---|------|
| 前端框架 | React 19 + React Router 7 |
| 构建工具 | Vite 7 |
| 后端服务 | Supabase（Auth + PostgreSQL） |
| 图标 | Lucide React |
| 样式 | 自定义 CSS（浅色 / 深色主题） |
| 部署 | GitHub Pages（Actions 自动构建） |

## 快速开始

### 前置条件

- Node.js >= 18
- 一个 [Supabase](https://supabase.com) 项目

### 安装

```bash
git clone https://github.com/ldt471146/lab304.git
cd lab304
npm install
```

### 配置环境变量

在项目根目录创建 `.env` 文件：

```env
VITE_SUPABASE_URL=你的_Supabase_项目_URL
VITE_SUPABASE_ANON_KEY=你的_Supabase_Anon_Key
```

### 数据库表结构

在 Supabase 中创建以下表和视图：

| 名称 | 类型 | 说明 |
|------|------|------|
| `users` | 表 | 用户资料（student_id, name, grade, checkin_count, points, is_admin） |
| `seats` | 表 | 座位定义（seat_number, row_label, col_number, is_active） |
| `checkins` | 表 | 签到记录（user_id, check_date, seat_id, time_slot, checked_at, checked_out_at） |
| `reservations` | 表 | 预约记录（user_id, seat_id, reserve_date, time_slot, status） |
| `seat_status_today` | 视图 | 今日座位占用状态 |
| `leaderboard` | 视图 | 总积分排行榜 |
| `leaderboard_monthly` | 视图 | 本月签到排行榜 |

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

## 项目结构

```
src/
├── main.jsx                 # 入口
├── App.jsx                  # 路由与认证状态管理
├── index.css                # 全局主题样式
├── lib/
│   └── supabase.js          # Supabase 客户端
├── context/
│   ├── AuthContext.jsx       # 认证上下文
│   └── ThemeContext.jsx      # 主题上下文
├── components/
│   └── NavBar.jsx           # 侧边导航栏
└── pages/
    ├── AuthPage.jsx         # 登录 / 注册
    ├── SetupProfile.jsx     # 资料补全
    ├── Dashboard.jsx        # 仪表板 + 管理员导出
    ├── CheckinPage.jsx      # 签到
    ├── ReservePage.jsx       # 预约
    └── LeaderboardPage.jsx  # 排行榜
```

## 签到时段

| 时段 | 时间 |
|------|------|
| 上午 | 08:00 – 12:00 |
| 下午 | 14:00 – 18:00 |
| 晚上 | 19:00 – 22:00 |

## 许可证

MIT
