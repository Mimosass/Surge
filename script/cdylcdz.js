// BoxJs: https://raw.githubusercontent.com/Mimosass/Surge/main/boxjs/itruenessboxjs.json

/* 充电有礼充电桩签到 - Surge 脚本 v11.0
   功能：http-request 自动捕获 Token + cron 每日签到领任务
   说明：小程序登录后每个业务请求都带 Authorization_Bar，拦截即存 */

const Env = (function () {
  class Env {
    constructor(e, t = {}) { this.name = e, this.data = null, this.dataFile = null, this.format = "json", this.isNode(), this.isQX(), this.isSurge(), this.isLoon(), this.isShadowrocket(), this.isStash(), this.isQuanX(), this.logSeparator = "\n", this.startTime = new Date().getTime(), Object.assign(this, t), this.log("", `🔔${this.name}, 开始!`) }
    isNode() { return "undefined" != typeof module && !!module.exports }
    isQX() { return "undefined" != typeof $task }
    isSurge() { return "undefined" != typeof $httpClient && "undefined" == typeof $task }
    isLoon() { return "undefined" != typeof $loon }
    isShadowrocket() { return "undefined" != typeof $rocket }
    isStash() { return "undefined" != typeof $environment && $environment["surge-version"] }
    isQuanX() { return "undefined" != typeof $task }
    getEnv() { return this.isNode() ? "Node.js" : this.isQuanX() ? "Quantumult X" : this.isSurge() ? "Surge" : this.isLoon() ? "Loon" : this.isShadowrocket() ? "Shadowrocket" : this.isStash() ? "Stash" : void 0 }
    isNeedRewrite() { return this.getEnv() }
    lodash_get(t, e, s = void 0) { const r = e.replace(/\[(\d+)\]/g, ".$1").split("."); let o = t; for (const t of r) if (o = Object(o)[t], void 0 === o) return s; return o }
    setdata(t, e) { return this.setval(t, e) }
    getdata(t) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.read(t); case "Quantumult X": return $prefs.valueForKey(t); case "Node.js": return this.data = this.loaddata(), this.data[t]; default: return this.data && this.data[t] || null } }
    setval(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.write(t, e); case "Quantumult X": return $prefs.setValueForKey(t, e); case "Node.js": return this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0; default: return this.data && this.data[e] || null } }
    wait(t) { return new Promise(e => setTimeout(e, t)) }
    get(t, e = (() => { })) { $httpClient.get(t, (t, s, r) => { !t && s && (s.body = r), e(t, s, r) }); }
    post(t, e = (() => { })) { const s = t.method ? t.method.toLowerCase() : "post"; $httpClient[s](t, (t, s, r) => { !t && s && (s.body = r), e(t, s, r) }); }
    msg(e = "", s = "", r = "") { if (!this.isMute) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": $notification.post(e, s, r); break; case "Quantumult X": $notify(e, s, r); } } if (!this.isMuteLog) console.log(["", "==============📣系统通知📣==============", e, s, r].join("\n")) }
    log(...t) { t.length > 0 && console.log(t.join(this.logSeparator)) }
    done(t = {}) { $done(t) }
  }
  return Env;
})();

const $ = new Env("充电有礼");
const API = "https://nad.ehuoke.com/gw/advert/mini-program/ext";

const KEY_TOKEN = "gold_sign_in_token";
const KEY_EQUIP = "gold_sign_in_equipmentValue";
const KEY_APPID = "gold_sign_in_appid";
const EQUIP_DEFAULT = "";  // 服务端不强制校验，留空即可，不绑定任何设备

function getBox(k) { return $.getdata(k) || ""; }
function setBox(k, v) { $.setdata(v, k); console.log(`[签到] BoxJS 写入 ${k}`); }

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/Linux";

function buildReferer() {
  const appid = getBox(KEY_APPID) || "";
  return appid
    ? `https://servicewechat.com/${appid}/75/page-frame.html`
    : "";
}
function extractAppID(url) {
  // 从 servicewechat.com 的 URL 或 Referer 头中提取 AppID
  const m = url && url.match(/servicewechat\.com\/([a-z0-9]{16,32})\//i);
  return m ? m[1] : null;
}

function authHeaders() {
  const h = { "Content-Type": "application/json", "User-Agent": UA };
  const referer = buildReferer();
  if (referer) h["Referer"] = referer;
  const tk = getBox(KEY_TOKEN);
  if (tk) h["Authorization_Bar"] = tk;
  return h;
}
function parseBody(json) {
  if (!json) return null;
  if (json.body !== undefined) return json.body;
  if (json.data !== undefined) return json.data;
  return null;
}
function isUnauthorized(json) { return json && (json.result === 401 || json.code === 401); }
function httpGet(url) {
  return new Promise((resolve) => {
    $.get({ url, headers: authHeaders() }, (err, resp, body) => {
      if (err) return resolve(null);
      try { resolve(JSON.parse(body)); } catch (e) { resolve(null); }
    });
  });
}
function httpPost(url, body) {
  return new Promise((resolve) => {
    $.post({ url, body: JSON.stringify(body), headers: authHeaders() }, (err, resp, body) => {
      if (err) return resolve(null);
      try { resolve(JSON.parse(body)); } catch (e) { resolve(null); }
    });
  });
}

async function claimTask(taskId) {
  const res = await httpPost(API + "/daily-task/common/receive/CDZ", { equipmentValue: getBox(KEY_EQUIP) || EQUIP_DEFAULT, taskId });
  return res && res.code === "0000000";
}

async function doSignIn() {
  const token = getBox(KEY_TOKEN);
  if (!token) { $.msg("充电有礼", "需要登录", "请先打开小程序获取 Token"); return; }
  $.msg("充电有礼", "开始签到", "正在查询任务与余额...");

  let week = await httpGet(API + "/sign-in/one-week-data?equipmentTypeValue=CDZ");
  if (isUnauthorized(week)) {
    $.msg("充电有礼", "Token 已过期", "获取失败，请重新打开小程序获取新 Token");
    return;
  }
  const weekBody = parseBody(week) || [];
  const today = weekBody.find(d => d.date === new Date().toISOString().slice(0, 10));
  const signed = today && today.sign;
  console.log("[签到] 今日签到: " + (signed ? "已签到" : "未签到"));

  // 如果未签到，执行签到
  if (!signed) {
    console.log("[签到] 执行签到...");
    const saveRes = await httpPost(API + "/sign-in/save", {
      equipmentTypeValue: "CDZ",
      equipmentValue: getBox(KEY_EQUIP) || EQUIP_DEFAULT
    });
    if (saveRes && saveRes.code === "0000000") {
      console.log("[签到] 签到成功");
    } else {
      console.log("[签到] 签到失败: " + JSON.stringify(saveRes));
    }
  }

  const taskList = await httpGet(API + "/daily-task/common/task-list/CDZ");
  const taskBody = parseBody(taskList) || [];
  const tasks = taskBody.filter(t => t.unreceived === false);
  console.log(`[签到] 可领取任务: ${tasks.length} 个`);

  let total = 0, ok = 0, fail = 0;
  for (const t of tasks) {
    console.log(`[签到] 领取任务 ${t.id} (${t.name})...`);
    if (await claimTask(t.id)) { total += t.rewardValue || 0; ok++; console.log(`[签到] 成功 +${t.rewardValue}`); }
    else { fail++; console.log("[签到] 领取失败"); }
  }

  const balance = await httpGet(API + "/benefit/common/user-benefit/CDZ");
  const balanceVal = parseBody(balance);
  console.log("[签到] 余额: " + balanceVal);

  const lines = [];
  lines.push("今日签到：" + (signed ? "已签到" : "未签到"));
  lines.push(`任务领取：成功 ${ok} 个，失败 ${fail} 个`);
  lines.push("本次获得：" + total + " 金币");
  lines.push("当前余额：" + balanceVal + " 金币");
  $.msg("充电有礼 ✅ 完成", "签到结果", lines.join("\n"));
}

(async () => {
  try {
    if (typeof $request !== "undefined" && $request) {
      // 仅 http-request 一种触发：从业务请求头抓 token 和 AppID
      const h = $request.headers || {};
      const tk = h["Authorization_Bar"];
      const url = $request.url || $request.url || "";
      const referer = h["Referer"] || h["referer"] || "";

      // 同时提取 AppID（URL 或 Referer 头中）
      let appid = extractAppID(url);
      if (!appid && referer) appid = extractAppID(referer);
      if (appid) {
        const oldAppid = getBox(KEY_APPID);
        if (appid !== oldAppid) {
          setBox(KEY_APPID, appid);
          console.log(`[签到] 已记录小程序 AppID: ${appid}`);
        }
      }

      if (tk) {
        const old = getBox(KEY_TOKEN);
        if (tk !== old) {
          setBox(KEY_TOKEN, tk);
          $.msg("充电有礼", "Token 已更新", "新 Token: " + tk.substring(0, 40) + "...");
          console.log("[签到] 写入 Token: " + tk.substring(0, 30) + "...");
        } else {
          console.log("[签到] Token 未变化，跳过");
        }
      } else {
        console.log("[签到] 请求无 Authorization_Bar，跳过");
      }
      $done({});
    } else {
      await doSignIn();
      $.done({});
    }
  } catch (e) {
    console.log("[签到] 错误: " + e.message);
    if (typeof $done === "function") $done({});
  }
})();
