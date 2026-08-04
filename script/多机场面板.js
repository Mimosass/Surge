/**********
* 多机场流量面板（合并版 v3.2）
* 修复：第三个机场 HTTP 429 -> 指数退避(1s,2s,4s) + 降低请求频率
* 美化：分段渐变进度条 + 百分比，绿色主题
* 说明：Surge [Panel] 仅支持 {title,content,icon,icon-color}，无 SwiftUI。
**********/

(async () => {
  try {
    const args = getArgs();
    const airports = getAirports(args);
    if (airports.length === 0) {
      return $done({ title: "机场面板", content: "未配置任何机场(检查 url 参数)", icon: "exclamationmark.triangle", "icon-color": "#CB1B45" });
    }

    const lines = [];
    let failed = 0;
    for (const a of airports) {
      const title = a.title || ("机场" + a.i);
      try {
        const res = await fetchInfoWithRetry(a.url, 3);
        if (!res.ok) {
          lines.push(`🔴 ${title}\n   ${res.diag}`);
          failed++;
        } else {
          const info = res.info;
          const used = (info.download || 0) + (info.upload || 0);
          const total = info.total || 0;
          const pct = total ? (used / total) * 100 : 0;
          const pctStr = total ? pct.toFixed(1) : "?";
          const statusEmoji = pct > 90 ? "🔴" : (pct >= 70 ? "🟡" : "🟢");
          let line = `${statusEmoji} ${title}\n`;
          line += `  用量 ${bytesToSize(used)} / ${bytesToSize(total)}\n`;
          line += `  ${fancyBar(pct)}  ${pctStr}%`;
          const expire = a.expire || info.expire;
          const expLeft = getExpireDaysLeft(expire);
          if (expLeft != null) line += `\n  ⏳ ${expLeft} 天到期`;
          lines.push(line);
        }
      } catch (e) {
        lines.push(`🔴 ${title}\n   异常(${e})`);
        failed++;
      }
      if (a.i !== airports[airports.length - 1].i) lines.push("──────────────");
    }

    const title = (args.panelTitle || "✈️ 机场流量") + (failed ? ` (${failed}失败)` : " 🟢");
    $done({
      title,
      content: lines.join("\n"),
      icon: args.panelIcon || "checkmark.circle.fill",
      "icon-color": args.panelColor || "#22C55E",
    });
  } catch (error) {
    console.log(`发生错误: ${error}`);
    $done({ title: "机场面板错误", content: `错误信息: ${error}`, icon: "exclamationmark.triangle", "icon-color": "#CB1B45" });
  }
})();

function getArgs() {
  const out = {};
  for (const item of $argument.split("&")) {
    if (!item) continue;
    const idx = item.indexOf("=");
    if (idx < 0) continue;
    const key = item.slice(0, idx);
    const raw = item.slice(idx + 1);
    out[key] = raw ? decodeURIComponent(raw) : null;
  }
  return out;
}

function getAirports(args) {
  const list = [];
  if (args.url != null) list.push({ i: 1, url: args.url, title: args.title, color: args.color, icon: args.icon, expire: args.expire });
  let j = 2;
  while (args["url" + j] != null) {
    list.push({ i: j, url: args["url" + j], title: args["title" + j], color: args["color" + j], icon: args["icon" + j], expire: args["expire" + j] });
    j++;
  }
  return list;
}

// 指数退避：1s -> 2s -> 4s（应对 429 限流）
async function fetchInfoWithRetry(url, retries) {
  let lastDiag = "未知";
  for (let attempt = 1; attempt <= retries; attempt++) {
    const r = await rawFetch(url);
    if (r.ok && r.info) return { ok: true, info: r.info };
    lastDiag = r.diag;
    if (attempt < retries) await sleep(2000 * Math.pow(2.5, attempt - 1));
  }
  return { ok: false, diag: lastDiag };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function rawFetch(url) {
  const request = { headers: { "User-Agent": "Quantumult%20X", "Accept": "application/json" }, url };
  return new Promise((resolve) => {
    $httpClient.get(request, (err, resp) => {
      if (err) return resolve({ ok: false, diag: `网络错误: ${err}` });
      if (resp.status !== 200) return resolve({ ok: false, diag: `HTTP ${resp.status}（限流/错误）` });
      const header = Object.keys(resp.headers || {}).find((k) => k.toLowerCase() === "subscription-userinfo");
      if (header) {
        const parsed = parseUserinfo(resp.headers[header]);
        if (parsed) return resolve({ ok: true, info: parsed });
      }
      try {
        const body = resp.body || (resp.data ? (typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data)) : "");
        const parsed = parseBody(body);
        if (parsed) return resolve({ ok: true, info: parsed });
        const peek = (body || "").slice(0, 80).replace(/\s+/g, " ");
        return resolve({ ok: false, diag: `头无流量信息，body 非标准JSON（前80字：${peek}）` });
      } catch (e) {
        return resolve({ ok: false, diag: `解析异常: ${e}` });
      }
    });
  });
}

function parseUserinfo(str) {
  const matches = (str || "").match(/\w+=[\d.eE+-]+/g);
  if (!matches || matches.length === 0) return null;
  const o = {};
  for (const it of matches) {
    const idx = it.indexOf("=");
    o[it.slice(0, idx)] = Number(it.slice(idx + 1));
  }
  if (o.total || o.download != null || o.upload != null) return o;
  return null;
}

function parseBody(body) {
  if (!body) return null;
  let d;
  try { d = typeof body === "string" ? JSON.parse(body) : body; } catch { return null; }
  const up = d.uploadTotal != null ? d.uploadTotal : (d.uploaded != null ? d.uploaded : (d.upload != null ? d.upload : 0));
  const down = d.downloadTotal != null ? d.downloadTotal : (d.downloaded != null ? d.downloaded : (d.download != null ? d.download : 0));
  const total = d.total != null ? d.total : (d.quota != null ? d.quota : 0);
  const expire = d.expire != null ? d.expire : (d.expireIn != null ? d.expireIn : null);
  if (total || up || down) return { upload: up, download: down, total, expire };
  return null;
}

function getExpireDaysLeft(expire) {
  if (!expire) return null;
  const now = new Date().getTime();
  let t;
  if (typeof expire === "number" || /^[\d.]+$/.test(expire)) {
    t = parseInt(expire);
    if (t < 1000000000000) t *= 1000;
  } else {
    t = new Date(expire).getTime();
    if (isNaN(t)) return null;
  }
  const days = Math.ceil((t - now) / (1000 * 60 * 60 * 24));
  return days > 0 ? days : null;
}

function bytesToSize(bytes) {
  if (!bytes || bytes === 0) return "0B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + " " + units[i];
}

// 彩色进度条：用 emoji 方块当彩色像素，按用量分段着色
// 0-70% 绿🟩, 70-90% 黄🟨, >90% 红🟥；未用灰⬜
function fancyBar(pct) {
  const total = 10;
  const filled = Math.max(0, Math.min(total, Math.round((pct / 100) * total)));
  let bar = "";
  for (let i = 0; i < total; i++) {
    if (i < filled) {
      const segPct = ((i + 1) / total) * 100;
      bar += segPct > 90 ? "🟥" : (segPct >= 70 ? "🟨" : "🟩");
    } else {
      bar += "⬜";
    }
  }
  return bar;
}
