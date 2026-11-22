// ==UserScript==
// @name         S喵大赌场 · 整点补给自动领取
// @namespace    soliumbra-auto-claim
// @version      1.0.0
// @description  页面开着时自动领取整点补给 / 每日签到（可选救济金、游乐铜板），无需挂载在账房页面
// @match        https://casino.soliumbra.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // ====== 可调设置 ======
  const SETTINGS = {
    claimHourly: true,   // 自动领整点补给
    claimDaily: true,    // 自动领每日签到
    claimRelief: false,  // 自动领救济金（余额低于 4000 才会开）
    claimCopper: false,  // 自动领游乐铜板（铜板低于门槛才开）
    pollMs: 30 * 1000,        // 平时每 30 秒查一次状态
    pollMsNearHour: 5 * 1000, // 临近整点 2 分钟内改为每 5 秒查
    toastMs: 6000,
  };

  const API = "https://casino.soliumbra.com/api";
  const CLAIMS = [
    { key: "daily",   path: "/wallet/claim/daily", enabled: () => SETTINGS.claimDaily,   name: "每日签到" },
    { key: "hourly",  path: "/wallet/claim/hourly", enabled: () => SETTINGS.claimHourly, name: "整点补给" },
    { key: "relief",  path: "/wallet/relief",       enabled: () => SETTINGS.claimRelief, name: "救济金" },
    { key: "copper",  path: "/wallet/copper-relief",enabled: () => SETTINGS.claimCopper, name: "游乐铜板" },
  ];

  let claimedKeys = new Set(); // 本轮已成功领取的，避免重复请求

  function log(...args) {
    console.log("%c[自动领取]", "color:#e0a23c;font-weight:bold", ...args);
  }

  function toast(text, good = true) {
    const host = document.getElementById("auto-claim-toast") || (() => {
      const d = document.createElement("div");
      d.id = "auto-claim-toast";
      d.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none";
      document.body.appendChild(d);
      return d;
    })();
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText = `padding:10px 14px;border-radius:10px;font-size:13px;color:#f5ead2;background:${good ? "#3a2a12" : "#4a1a1a"};border:1px solid ${good ? "#e0a23c" : "#c05656"};box-shadow:0 4px 16px rgba(0,0,0,.5);opacity:0;transition:opacity .3s`;
    host.appendChild(el);
    requestAnimationFrame(() => (el.style.opacity = "1"));
    setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 400); }, SETTINGS.toastMs);
  }

  async function api(path, method = "GET") {
    const res = await fetch(`${API}${path}`, {
      credentials: "include",
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
      method,
    });
    if (res.status === 401) throw Object.assign(new Error("未登录"), { status: 401 });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = new Error((data && data.message) || `HTTP ${res.status}`);
      err.status = res.status;
      err.code = data && data.error;
      throw err;
    }
    return data;
  }

  function msUntilNextHour(now = Date.now()) {
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return next.getTime() - now;
  }

  async function tryClaim(entry) {
    if (!entry.enabled() || claimedKeys.has(entry.key)) return;
    try {
      const data = await api(entry.path, "POST");
      const amount = typeof data?.claimed === "number" ? data.claimed : null;
      log(`领取成功：${entry.name}`, amount !== null ? `+${amount}` : data);
      toast(`✅ 已自动领取${entry.name}${amount !== null ? ` +${amount}` : ""}`);
      claimedKeys.add(entry.key);
    } catch (err) {
      if (err.status === 401) return; // 未登录，等下次
      // 领取失败多半是“还没到时间/已领过”，标记本轮跳过，避免反复请求
      log(`领取失败：${entry.name}`, err.message);
      claimedKeys.add(entry.key);
    }
  }

  let checking = false;
  async function check() {
    if (checking) return;
    checking = true;
    try {
      const me = await api("/me");
      const wallet = me?.wallet;
      if (!wallet) return;
      claimedKeys = new Set(); // 新一轮，重置

      const flags = [
        [wallet.dailyAvailable, SETTINGS.claimDaily],
        [wallet.hourlyAvailable, SETTINGS.claimHourly],
        [wallet.reliefAvailable, SETTINGS.claimRelief],
        [wallet.copperReliefAvailable, SETTINGS.claimCopper],
      ];
      const ready = CLAIMS.filter((e, i) => flags[i]?.[0] && flags[i]?.[1]);
      if (ready.length === 0) {
        const next = [wallet.nextDailyAt, wallet.nextHourlyAt].filter(Boolean).sort((a, b) => a - b)[0] || null;
        lastNextAt = next;
        if (next) {
          const at = new Date(next);
          log(`暂无可领，下一次在 ${at.toLocaleString("zh-CN", { hour12: false })}（${Math.round((next - Date.now()) / 60000)} 分钟后）`);
        }
        return;
      }
      lastNextAt = null;
      log("发现可领取：", ready.map(r => r.name).join("、"));
      log("发现可领取：", ready.map(r => r.name).join("、"));
      for (const entry of ready) await tryClaim(entry);
    } catch (err) {
      if (err.status !== 401) log("查询失败", err.message);
    } finally {
      checking = false;
      schedule();
    }
  }

  let timer = null;
  let lastNextAt = null; // 上次看到的最近可领时间，用于精准定时
  function schedule() {
    clearTimeout(timer);
    const near = msUntilNextHour() < 2 * 60 * 1000;
    let delay = near ? SETTINGS.pollMsNearHour : SETTINGS.pollMs;
    // 如果知道精确的下一次可领时间，就在那之后 2 秒醒来，一次到位
    if (lastNextAt) {
      const until = lastNextAt - Date.now() + 2000;
      if (until > 0 && until < delay) delay = until;
    }
    timer = setTimeout(check, Math.max(1000, delay));
  }

  // 启动：等页面就绪后开始轮询
  const start = () => {
    log("自动领取已启动（整点补给：" + (SETTINGS.claimHourly ? "开" : "关") + "，每日签到：" + (SETTINGS.claimDaily ? "开" : "关") + "）");
    setTimeout(check, 2000);
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
})();
