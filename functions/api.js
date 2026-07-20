// 积水上报 CRUD - GitHub Issues 存储
// GET: 读取列表 | POST: 创建上报 | PATCH?action=delete&id=N: 关闭上报
// 环境变量：GH_TOKEN, GH_REPO
// 路由：通过 HTTP method 区分（参考 flood-alert 方案，避开 Netlify 路径限制）

const GH_API = 'https://api.github.com';
const LABEL = 'waterlogging';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function authHeaders() {
  return {
    'Authorization': `token ${process.env.GH_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'WAIC-flood-alert'
  };
}

function repoPath() {
  return `/repos/${process.env.GH_REPO}`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      return await listReports();
    } else if (event.httpMethod === 'POST') {
      return await createReport(event);
    } else if (event.httpMethod === 'PATCH') {
      return await deleteReport(event);
    } else {
      return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
  } catch (err) {
    console.error('API 错误:', err);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};

// 读取积水上报列表
async function listReports() {
  const url = `${GH_API}${repoPath()}/issues?labels=${LABEL}&state=open&per_page=100`;
  const resp = await fetch(url, { headers: authHeaders() });

  if (!resp.ok) {
    throw new Error(`GitHub API 返回 ${resp.status}`);
  }

  const issues = await resp.json();
  const reports = issues
    .filter(i => !i.pull_request) // 排除 PR
    .map(issue => {
      // 解析 body 末尾的 <!-- DATA:{...} -->
      const dataMatch = issue.body && issue.body.match(/<!--\s*DATA:(\{.*?\})\s*-->/s);
      let data = {};
      if (dataMatch) {
        try { data = JSON.parse(dataMatch[1]); } catch (e) { /* 解析失败用默认值 */ }
      }
      // 提取照片 URL（markdown 图片语法）
      const photoMatch = issue.body && issue.body.match(/!\[.*?\]\((.*?)\)/);
      return {
        id: issue.id,
        number: issue.number,
        lat: data.lat,
        lng: data.lng,
        severity: data.severity || 'light',
        description: data.description || '',
        photoUrl: photoMatch ? photoMatch[1] : null,
        time: data.time || issue.created_at,
        reporter: issue.user ? issue.user.login : '匿名'
      };
    })
    .filter(r => r.lat && r.lng); // 过滤掉无坐标的

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(reports) };
}

// 创建积水上报
async function createReport(event) {
  const body = JSON.parse(event.body || '{}');
  const { lat, lng, severity, description, photoBase64 } = body;

  if (!lat || !lng) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: '缺少位置信息' }) };
  }

  let photoUrl = null;

  // 上传照片到 repo（PUT contents API）
  if (photoBase64) {
    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
    const filename = `uploads/${Date.now()}.jpg`;
    try {
      const uploadResp = await fetch(`${GH_API}${repoPath()}/contents/${filename}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          message: `上传积水照片 ${filename}`,
          content: base64Data
        })
      });
      if (uploadResp.ok) {
        const uploadData = await uploadResp.json();
        photoUrl = uploadData.content.download_url;
      }
    } catch (e) {
      console.warn('照片上传失败，继续创建无图上报:', e);
    }
  }

  const sevText = { heavy: '重度', medium: '中度', light: '轻度' }[severity] || '未知';
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const dataObj = { lat, lng, severity: severity || 'light', description: description || '', time: now };

  const issueBody = `## 积水上报

- **严重程度**: ${sevText}
- **坐标**: ${lat.toFixed(4)}, ${lng.toFixed(4)}
- **时间**: ${now}
- **描述**: ${description || '（无）'}

${photoUrl ? `![现场照片](${photoUrl})` : ''}

---
<!-- DATA:${JSON.stringify(dataObj)} -->`;

  const createResp = await fetch(`${GH_API}${repoPath()}/issues`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      title: `[积水上报] ${sevText}级 - ${lat.toFixed(4)},${lng.toFixed(4)}`,
      body: issueBody,
      labels: [LABEL, `severity:${severity || 'light'}`]
    })
  });

  if (!createResp.ok) {
    const errData = await createResp.json().catch(() => ({}));
    throw new Error(`创建失败: ${errData.message || createResp.status}`);
  }

  const issue = await createResp.json();
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ success: true, number: issue.number })
  };
}

// 关闭积水上报（软删除）
async function deleteReport(event) {
  const params = event.queryStringParameters || {};
  const action = params.action;
  const id = params.id;

  if (action !== 'delete' || !id) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: '参数错误，需要 action=delete&id=N' }) };
  }

  const resp = await fetch(`${GH_API}${repoPath()}/issues/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ state: 'closed' })
  });

  if (!resp.ok) {
    throw new Error(`关闭失败: ${resp.status}`);
  }

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) };
}
