// 和风天气预警 API 代理（2026 版）
// 职责：隐藏 API Key + 专属 API Host + 5分钟内存缓存 + CORS + 字段透传
// 环境变量：QWEATHER_KEY, QWEATHER_HOST
//
// 2026 年变更：
// - 不再使用公共 API 地址 devapi.qweather.com，需用控制台分配的专属 API Host
// - API Key 不再放 URL query 参数，改用请求头 X-QW-Api-Key
// - 灾害预警接口从旧的 /v7/warning/now 迁移为 /weatheralert/v1/current/{lat}/{lon}
// - 免费 1000 次/天，含灾害预警（免费付费同权）

let cache = { data: null, time: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

// 上海市区中心坐标（WAIC 会场集中区域：世博+西岸）
const SHANGHAI_LAT = '31.2304';
const SHANGHAI_LON = '121.4737';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  // 处理 OPTIONS 预检请求
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // 检查内存缓存（多用户共享一次调用，避免打爆 1000次/天 限额）
  if (cache.data && Date.now() - cache.time < CACHE_TTL) {
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(cache.data) };
  }

  const key = process.env.QWEATHER_KEY;
  const host = process.env.QWEATHER_HOST;

  if (!key) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'QWEATHER_KEY 未配置', warning: [], alerts: [] })
    };
  }
  if (!host) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'QWEATHER_HOST 未配置（2026 年起必须使用专属 API Host）', warning: [], alerts: [] })
    };
  }

  try {
    // 2026 版：新灾害预警接口使用经纬度路径参数
    const url = `https://${host}/weatheralert/v1/current/${SHANGHAI_LAT}/${SHANGHAI_LON}?lang=zh`;
    const resp = await fetch(url, {
      headers: {
        'X-QW-Api-Key': key,
        'Accept-Encoding': 'gzip'
      }
    });

    if (!resp.ok) {
      // 401/403 可能是凭据错误或安全设置未生效
      if (resp.status === 401 || resp.status === 403) {
        let detail = '';
        try { const errBody = await resp.json(); detail = errBody.error?.detail || ''; } catch (_) {}
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            warning: [],
            alerts: [],
            note: `认证/权限失败（${resp.status}）: ${detail}。请检查 API Key、API Host 是否正确，以及控制台安全设置是否已生效（可能需要1-2小时）`,
            code: String(resp.status)
          })
        };
      }
      throw new Error(`和风天气 API 返回 ${resp.status}`);
    }

    const data = await resp.json();

    // 缓存结果
    cache = { data, time: Date.now() };

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(data)
    };
  } catch (err) {
    console.error('天气预警获取失败:', err);
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message, warning: [], alerts: [] })
    };
  }
};
