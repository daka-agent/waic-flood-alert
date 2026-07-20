# WAIC 暴雨应急护航 · Rain Alert for WAIC 2026

> 参加 WAIC 大会遇上海暴雨，没收到任何预警通知——"马路变河道、公交变轮船"。
> 这个项目打破信息真空：来之前提醒你，雨来了帮你避开水。

**线上地址**：[https://waic-flood-alert.netlify.app/](https://waic-flood-alert.netlify.app/)

---

## 三层功能

### 预警层
- 和风天气灾害预警 API，5 分钟自动轮询
- 顶部横幅实时显示预警等级（蓝/黄/橙/红/绿）
- 预警来源标注：显示发布气象台 + 发布时间（气象法传播合规）
- 支持浏览器 Notification 推送（需用户授权）
- 当前上海无预警时显示"出行安全"绿色状态 + "预警数据源自各级气象台站官方发布"

### 积水层
- 众包上报：点击地图或右下角"+"按钮，提交积水点（位置/严重程度/描述/照片）
- 地图脉冲图钉：红色=重度 / 橙色=中度 / 黄色=轻度
- 13 个避雨点：世博 + 西岸片区的商场、地铁站等室内场所
- 图片自动压缩（canvas max 800px, q0.6）
- 照片上传提示"仅用于积水情况记录，不会进行人脸识别"
- GPS 定位需单独确认（隐私合规）

### 议程层
- WAIC 2026 议程导航器（175 场论坛 / 4 天会期 / 7 个场地）
- 收藏议程后，顶部自动提醒"下一场"时间 + 场地
- 按预警等级给出出发建议：红色=暂缓出发 / 黄色=提前出发 / 绿色=正常出行

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | 单文件 HTML + Tailwind CSS CDN JIT + Vanilla JS + 内嵌议程 JSON |
| 地图 | 高德地图 JS API 2.0（`amap://styles/dark` 暗黑主题 + 审图号合规） |
| 后端 | Netlify Functions（Node.js） |
| 气象源 | 和风天气 WeatherAlert API（`/weatheralert/v1/current/{lat}/{lon}`） |
| 存储 | GitHub Issues（labels: waterlogging）+ GitHub Contents API（图片上传） |
| 部署 | Netlify |

### 关键决策

1. **高德地图替代 Leaflet/OSM**：OSM 无审图号不合规 → 高德 JS API 2.0 免费 + 审图号 + 暗黑主题
2. **应用内轮询代替 Web Push**：FCM 国内被墙、安卓无 GMS，5 分钟 `setInterval` + `visibilitychange` 触发
3. **GitHub Issues 当数据库**：body 末尾嵌 `<!-- DATA:{...} -->` 便于解析，零成本
4. **Netlify Function 代理**：保护 API Key/Token 不暴露前端 + 解决 CORS
5. **HTTP method 区分操作**：GET 读 / POST 创建 / PATCH 关闭 Issue（避开 Netlify 路径限制）
6. **隐私合规**：GPS 单独确认 + 隐私政策弹窗（localStorage `waic_privacy_agreed`）+ 照片人脸识别排除提示

---

## 文件结构

```
├── index.html              # 单文件前端（Tailwind CDN + AMap JS API 2.0 + Vanilla JS + 内嵌议程 JSON）
├── functions/
│   ├── weather.js          # 和风天气代理（5min 内存缓存 + CORS + X-QW-Api-Key 认证 + 专属 Host）
│   └── api.js              # GitHub Issues CRUD（众包上报 + 图片上传 PUT Contents）
├── public/shelters.json    # 13 个避雨点（世博+西岸片区）
├── netlify.toml            # 部署配置 + 3 条 redirects
├── _redirects              # 备份重定向规则
├── README.md               # 本文件
└── .gitignore
```

---

## 合规说明

| 风险项 | 等级 | 解决方案 | 成本 |
|---|---|---|---|
| 地图无审图号（OSM） | P0 | 替换为高德地图 JS API 2.0（含审图号） | 免费 |
| 预警来源未标注 | P1 | 横幅显示"来源：XX气象台 · 发布时间：XX" | 免费 |
| GPS/照片隐私未告知 | P1 | 单独 GPS 确认 + 隐私政策弹窗 + 人脸识别排除提示 | 免费 |

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
2. **高德地图**：注册 [https://lbs.amap.com/](https://lbs.amap.com/) → 控制台创建 Web端(JS API)应用 → 获取 Key + 安全密钥
3. **GitHub Token**：创建 Fine-grained Token，权限：Issues Read & write + Contents Read & write
4. **GitHub 仓库**：Public 仓库（Netlify 需要访问）

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

4. 高德地图 Key 和安全密钥已硬编码在 `index.html` `<head>` 中（`_AMapSecurityConfig` + AMap script src `key=` 参数），无需 Netlify 环境变量
5. "Trigger deploy" → "Clear cache and deploy site"

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
- 高德地图 `amap://styles/dark` 原生暗黑主题
- 暴雨警示色系：蓝/黄/橙/红/绿（对应预警等级）
- 默认视图：地图（世博 + 西岸片区）
- 移动端自适应
- 首次使用上报功能弹出隐私政策弹窗

---

## 成本概览（公益项目全免费）

| 服务 | 免费额度 | 我们用量（估算） |
|---|---|---|
| 高德地图 JS API | 无限次 | ~几百次/天 |
| 和风天气 API | 前 50,000 次/月 | ~8,640 次/月（5min 轮询） |
| GitHub Issues API | 5,000 次/小时 | ~几百次/小时 |
| Netlify 托管 | 100GB 带宽/月 | ~几 GB |
| Netlify Functions | 125,000 次/月 | ~8,640 次/月 |

---

## 致谢

- 和风天气 ([QWeather](https://www.qweather.com/)) — 免费灾害预警 API
- 高德地图 ([AMap](https://lbs.amap.com/)) — 免费 JS API + 审图号合规
- Tailwind CSS — CSS 框架
- WAIC 2026 世界人工智能大会

---

## License

MIT

---

*"马路变河道、公交变轮船"——那次暴雨，连短信预警都没有。*
*这个项目就是为了不再让参会者陷入信息真空。*
