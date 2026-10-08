// preload/ai.cjs — AI 域：OpenAI 兼容 chat/completions 非流式调用
const https = require('https');
const http = require('http');

function aiChat(cfg) {
  const base = (cfg.baseUrl || '').replace(/\/+$/, '');
  const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
  const payload = JSON.stringify({
    model: cfg.model,
    messages: cfg.messages,
    temperature: cfg.temperature != null ? cfg.temperature : 0.6,
    stream: false,
  });
  const u = new URL(url);
  const mod = u.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = mod.request(u, {
      method: 'POST',
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey || ''}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; if (body.length > 4 * 1024 * 1024) req.destroy(); });
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${(j.error && j.error.message) || body.slice(0, 300)}`));
          const content = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
          if (!content) return reject(new Error('响应中没有内容: ' + body.slice(0, 200)));
          resolve(content.trim());
        } catch (e) { reject(new Error('响应解析失败: ' + body.slice(0, 200))); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时（120s）')); });
    req.on('error', (e) => reject(e));
    req.write(payload);
    req.end();
  });
}

module.exports = { aiChat };
