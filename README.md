# WAIC 暴雨应急护航 · Rain Alert for WAIC 2026

> 参加 WAIC 大会遇上海暴雨，没收到任何预警通知——"马路变河道、公交变轮船"。
> 这个项目打破信息真空：来之前提醒你，雨来了帮你避开水。

**线上地址**：[https://waic-flood-alert.netlify.app/](https://waic-flood-alert.netlify.app/)

---

## 三层功能

### 预警层
- 和风天气灾害预警 API，5 分钟自动轮询
- 顶部横幅实时显示预警等级（蓝/黄/橙/红/绿）
- 支持浏览器 Notification 推送（需用户授权）
- 当前上海无预警时显示"出行安全"绿色状态

### 积水层
- 众包上报：点击地图或右下角"+"按钮，提交积水点（位置/严重程度/描述/照片）
- 地图脉冲图钉：红色=重度 / 橙色=中度 / 黄色=轻度
- 13 个避雨点：世博 + 西岸片区的商场、地铁站等室内场所
- 图片自动压缩（canvas max 800px, q0.6）

### 议程层
- WAIC 2026 议程导航器（175 场论坛 / 4 天会期 / 7 个场地）
- 收藏议程后，顶部自动提醒"下一场"时间 + 场地
- 按预警等级给出出发建议：红色=暂缓出发 / 黄色=提前出发 / 绿色=正常出行

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | 单文件 HTML + Tailwind CSS CDN + Leaflet CDN + Vanilla JS |
| 后端 | Netlify Functions（Node.js） |
| 气象源 | 和风天气 WeatherAlert API（`/weatheralert/v1/current/{lat}/{lon}`） |
| 存储 | GitHub Issues（labels: waterlogging）+ GitHub Contents API（图片上传） |
| 部署 | Netlify |

### 关键决策

1. **应用内轮询代替 Web Push**：FCM 国内被墙、安卓无 GMS，5 分钟 `setInterval` + `visibilitychange` 触发
2. **GitHub Issues 当数据库**：body 末尾嵌 `<!-- DATA:{...} -->` 便于解析，零成本
3. **Netlify Function 代理**：保护 API Key/Token 不暴露前端 + 解决 CORS
4. **HTTP method 区分操作**：GET 读 / POST 创建 / PATCH 关闭 Issue（避开 Netlify 路径限制）

---

## 文件结构

```
├── index.html              # 单文件前端（Tailwind + Leaflet + Vanilla JS + 内嵌议程 JSON）
├── functions/
│   ├── weather.js          # 和风天气代理（5min 内存缓存 + CORS + X-QW-Api-Key 认证）
│   └── api.js              # GitHub Issues CRUD（众包上报 + 图片上传 PUT Contents）
├── public/shelters.json    # 13 个避雨点（世博+西岸片区）
├── netlify.toml            # 部署配置 + 3 条 redirects
├── _redirects              # 备份重定向规则
└── .gitignore
```

---

## 本地开发

```bash
# 克隆仓库
git clone https://github.com/daka-agent/waic-flood-alert.git
cd waic-flood-alert

# 本地预览（自动启用 mock 数据）
python -m http.server 8080
# 打开 http://localhost:8080
```

localhost 环境下自动注入 mock 数据：
- 橙色暴雨预警横幅
- 3 个积水图钉（世博中心重度 / 世博展览馆中度 / 西岸轻度）
- 预警/积水 API 失败时 fallback 到 mock

部署后（hostname 非 localhost）mock 自动失效，全部走真实 API。

---

## 部署到 Netlify

### 前置条件

1. **和风天气**：注册 [https://dev.qweather.com/](https://dev.qweather.com/) → 控制台创建项目 → 添加 API KEY 凭据 → 获取 API Key + 专属 API Host
2. **GitHub Token**：创建 Fine-grained Token，权限：Issues Read & write + Contents Read & write
3. **GitHub 仓库**：Public 仓库（Netlify 需要访问）

### 部署步骤

1. Netlify → "Add new site" → "Import an existing project" → 选 GitHub 仓库
2. Build 配置：
   - Build command：留空
   - Publish directory：`.`（项目根目录）
3. 部署后 → Site settings → Environment variables，添加：

| 变量 | 说明 |
|---|---|
| `QWEATHER_KEY` | 和风天气 API Key |
| `QWEATHER_HOST` | 和风天气专属 API Host（如 `m23mdb4er9.re.qweatherapi.com`） |
| `GH_TOKEN` | GitHub Fine-grained Token |
| `GH_REPO` | 格式 `owner/repo`（如 `daka-agent/waic-flood-alert`） |

4. "Trigger deploy" → "Clear cache and deploy site"

---

## 和风天气 2026 年变更

⚠️ 2026 年和风天气 API 有重大变更：

- **公共 API 地址** `devapi.qweather.com` 已弃用，必须使用控制台分配的**专属 API Host**
- **认证方式变更**：API Key 不再放 URL `key=` 参数，改用请求头 `X-QW-Api-Key: YOUR_KEY`
- 推荐使用 JWT 认证（Ed25519 密钥对），个人日常可用 API KEY 认证
- **灾害预警接口**：旧 `/v7/warning/now` 已标记 Legacy，新接口为 `/weatheralert/v1/current/{lat}/{lon}`
- 免费版前 50,000 次/月免费，**包含灾害预警**（国内唯一免费含预警的正式 API）
- 从 2027 年 2 月起，API KEY 认证请求量将逐步受限

---

## UI 设计

- 暗黑科技风：`#060912` 深蓝黑底 + 霓虹青/紫/粉 + 玻璃拟态卡片
- 暴雨警示色系：蓝/黄/橙/红/绿（对应预警等级）
- 默认视图：地图（世博 + 西岸片区）
- 移动端自适应

---

## 致谢

- 和风天气 ([QWeather](https://www.qweather.com/)) — 免费灾害预警 API
- Leaflet — 开源地图库
- Tailwind CSS — CSS 框架
- WAIC 2026 世界人工智能大会

---

## License

MIT

---

*"马路变河道、公交变轮船"——那次暴雨，连短信预警都没有。*
*这个项目就是为了不再让参会者陷入信息真空。*
