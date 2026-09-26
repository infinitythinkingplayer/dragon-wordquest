/* LexiPath / Dragon WordQuest —「一键添加到桌面」+ 桌面图标打开后的界面优化
 * 放在 <head> 里同步加载：<script src="dwq-pwa.js"></script>
 * 做五件事：
 *  1. Chrome / Edge / 安卓：挂上 manifest + 离线缓存，点按钮直接弹出系统「安装」框（真·一键）
 *  2. iPhone / iPad / Mac Safari：苹果不允许网页自动安装，弹出带图示的三步引导
 *  3. 苹果设备上「添加到主屏幕」后，桌面图标的存储和 Safari 是分开的——
 *     所以把当前进度写进网址 #dwq=…，第一次从桌面图标打开时自动搬过去，孩子的进度不会丢
 *  4. 微信 / 小红书等 App 内打开时，提示先到浏览器里打开（也带着进度）
 *  5. 全屏模式下避开刘海和底部横条，背景铺满，不再出现白边、被状态栏挡住
 */
(function () {
  "use strict";
  var ua = navigator.userAgent || "";
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var isIPad = /iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var isMac = /Macintosh/.test(ua) && !isIOS;
  var isSafari = /Safari/.test(ua) && !/Chrome|CriOS|Chromium|Edg|EdgiOS|OPR|FxiOS|Android/.test(ua);
  var isIOSChrome = /CriOS|EdgiOS/.test(ua);
  var inAppName = /MicroMessenger/i.test(ua) ? "微信" : /xhsdiscover|XiaoHongShu/i.test(ua) ? "小红书"
    : /Weibo/i.test(ua) ? "微博" : /aweme|Douyin/i.test(ua) ? "抖音" : /DingTalk/i.test(ua) ? "钉钉"
    : /\bQQ\//.test(ua) ? "QQ" : /FBAN|FBAV|Instagram|Line\//i.test(ua) ? "这个 App" : "";
  var standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  var appleHome = isIOS || (isMac && isSafari); // 苹果：桌面图标存储独立、用当前网址
  var page = location.pathname.split("/").pop() || "dwq-x7k2m9.html";
  var HASH = "#dwq=";

  /* ---------- 1. manifest（只给 Chromium 系，苹果不挂，保证桌面图标用的是带进度的当前网址） ---------- */
  if (!appleHome && /\.html$/.test(page)) {
    var ml = document.createElement("link");
    ml.rel = "manifest";
    ml.href = page.replace(/\.html$/, ".webmanifest");
    document.head.appendChild(ml);
  }
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("dwq-sw.js").catch(function () {}); });
  }

  /* ---------- 3. 进度搬家：网址里的 #dwq=… → 本机存储（只在本机还没有进度时搬一次） ---------- */
  function b64urlEncode(str) {
    return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return decodeURIComponent(escape(atob(s)));
  }
  function readJSON(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function hasProgress() { var s = readJSON("blwq_settings"); return !!(s && s.kids && s.kids.length); }

  if (location.hash.indexOf(HASH) === 0) {
    try {
      if (!localStorage.getItem("blwq_imported") && !hasProgress()) {
        var data = JSON.parse(b64urlDecode(location.hash.slice(HASH.length)));
        if (data && data.v === 2 && data.settings) {
          localStorage.setItem("blwq_settings", JSON.stringify(data.settings));
          Object.keys(data.profiles || {}).forEach(function (id) {
            localStorage.setItem("blwq_" + id, JSON.stringify(data.profiles[id]));
          });
          window.__dwqImported = true;
        }
      }
      if (standalone) localStorage.setItem("blwq_imported", "1");
    } catch (e) {}
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  }

  function snapshot() {
    // 只在「苹果浏览器里、还没添加到桌面」或「App 内置浏览器」时把进度挂在网址上
    if (standalone || !(appleHome || inAppName)) return;
    try {
      var s = readJSON("blwq_settings");
      if (!s || !s.kids || !s.kids.length) return;
      var profiles = {};
      s.kids.forEach(function (k) { var st = readJSON("blwq_" + k.id); if (st) profiles[k.id] = st; });
      var h = HASH + b64urlEncode(JSON.stringify({ v: 2, settings: s, profiles: profiles }));
      if (location.hash !== h) history.replaceState(null, "", location.pathname + location.search + h);
    } catch (e) {}
  }

  /* ---------- 2. 捕获 Chrome / Edge / 安卓 的安装事件 ---------- */
  var deferred = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; });
  window.addEventListener("appinstalled", function () {
    deferred = null;
    closeSheet();
    sheet('<div class="dwq-done"><img src="dwq-icon-180.png" alt=""><h3>添加成功 🎉</h3>' +
      '<p>以后直接点桌面上的 <b>LexiPath</b> 小龙图标就能打开，全屏、没有地址栏，进度一直都在。</p>' +
      '<button class="dwq-btn" onclick="__dwqClose()">好的</button></div>');
  });

  /* ---------- 5. 样式：安全区 + 卡片 + 引导弹层 ---------- */
  var css = [
    "html{background:#0f1b3d;-webkit-text-size-adjust:100%}",
    "body{background:transparent!important;min-height:100vh;min-height:100dvh}",
    "body::before{content:'';position:fixed;inset:0;z-index:-1;background:linear-gradient(160deg,#0f1b3d 0%,#243b7a 60%,#3c2d7a 100%)}",
    "#main{padding-top:calc(18px + env(safe-area-inset-top,0px))!important;padding-left:max(18px,env(safe-area-inset-left,0px))!important;padding-right:max(18px,env(safe-area-inset-right,0px))!important;padding-bottom:calc(110px + env(safe-area-inset-bottom,0px))!important}",
    "#nav .bar{margin-bottom:calc(14px + env(safe-area-inset-bottom,0px))!important}",
    "#ovin{padding-top:calc(18px + env(safe-area-inset-top,0px))!important;padding-bottom:calc(60px + env(safe-area-inset-bottom,0px))!important}",
    "#modal{padding-top:calc(24px + env(safe-area-inset-top,0px))!important;padding-bottom:calc(24px + env(safe-area-inset-bottom,0px))!important}",
    ".dwq-app img,.dwq-app a{-webkit-touch-callout:none}",
    /* 添加到桌面卡片 */
    ".dwq-inst{display:flex;align-items:center;gap:14px;padding:16px 16px 16px 14px;border-radius:24px;margin-bottom:16px;cursor:pointer;",
    "background:linear-gradient(135deg,rgba(124,92,255,.35),rgba(56,182,255,.22));border:1.5px solid rgba(255,255,255,.28);box-shadow:0 8px 28px rgba(0,0,0,.25);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}",
    ".dwq-inst img{width:58px;height:58px;border-radius:14px;box-shadow:0 4px 14px rgba(0,0,0,.35);flex:none}",
    ".dwq-inst h2{color:#fff;font-size:17px;margin:0}",
    ".dwq-inst p{color:rgba(255,255,255,.75);font-size:13px;font-weight:600;margin-top:3px;line-height:1.4}",
    ".dwq-inst .go{margin-left:auto;flex:none;background:#fff;color:#4b36d6;font-weight:800;font-size:14px;border-radius:14px;padding:10px 14px;box-shadow:0 4px 12px rgba(0,0,0,.2);white-space:nowrap}",
    /* 引导弹层 */
    "#dwqSheet{position:fixed;inset:0;z-index:400;background:rgba(8,12,30,.72);display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .2s}",
    "#dwqSheet.show{opacity:1}",
    "#dwqSheet .box{background:#fff;color:#22284a;width:100%;max-width:520px;border-radius:26px 26px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom,0px));transform:translateY(30px);transition:transform .25s;max-height:88vh;overflow:auto}",
    "@media (min-width:700px){#dwqSheet{align-items:center}#dwqSheet .box{border-radius:26px}}",
    "#dwqSheet.show .box{transform:none}",
    "#dwqSheet .hd{display:flex;align-items:center;gap:12px;margin-bottom:14px}",
    "#dwqSheet .hd img{width:52px;height:52px;border-radius:13px;box-shadow:0 3px 10px rgba(0,0,0,.2)}",
    "#dwqSheet h3{font-size:20px;font-weight:800;margin:0}",
    "#dwqSheet .sub{color:#8b91b3;font-size:13px;font-weight:600;margin-top:2px}",
    "#dwqSheet ol{list-style:none;margin:6px 0 10px;padding:0}",
    "#dwqSheet li{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid #eef0fa;font-size:16px;line-height:1.5}",
    "#dwqSheet li:last-child{border-bottom:0}",
    "#dwqSheet li .n{flex:none;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#7c5cff,#9d7bff);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:15px}",
    "#dwqSheet li small{display:block;color:#8b91b3;font-size:13px}",
    "#dwqSheet .ic{display:inline-flex;vertical-align:-5px;background:#eef0fa;border-radius:7px;padding:3px 5px;margin:0 2px}",
    "#dwqSheet .ic svg{width:18px;height:18px;stroke:#007aff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
    "#dwqSheet .tip{background:#f4f1ff;border-radius:14px;padding:12px 14px;font-size:14px;color:#4b3aa8;margin:4px 0 14px;line-height:1.5}",
    ".dwq-btn{display:block;width:100%;border:0;border-radius:16px;padding:15px;font-size:17px;font-weight:800;color:#fff;cursor:pointer;background:linear-gradient(135deg,#7c5cff,#9d7bff);box-shadow:0 6px 18px rgba(124,92,255,.4)}",
    ".dwq-btn.ghost{background:#eef0fa;color:#22284a;box-shadow:none;margin-top:8px}",
    ".dwq-done{text-align:center}.dwq-done img{width:84px;height:84px;border-radius:20px;box-shadow:0 6px 18px rgba(0,0,0,.25);margin:4px auto 10px;display:block}",
    ".dwq-done h3{margin-bottom:6px!important}.dwq-done p{color:#555b7d;margin-bottom:16px;line-height:1.55}",
    /* 指向分享按钮的小箭头 */
    "#dwqPoint{position:fixed;z-index:401;font-size:34px;pointer-events:none;animation:dwqb 1s ease-in-out infinite;filter:drop-shadow(0 3px 6px rgba(0,0,0,.4))}",
    "@keyframes dwqb{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}"
  ].join("\n");
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);
  if (standalone) document.documentElement.classList.add("dwq-app");

  /* ---------- 引导弹层 ---------- */
  var SHARE = '<span class="ic"><svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg></span>';
  var ADD = '<span class="ic"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg></span>';
  var DOTS = '<span class="ic"><svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/></svg></span>';
  var KEBAB = '<span class="ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="18" r="1.3"/></svg></span>';
  var INSTALL = '<span class="ic"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 8v6M9 11l3 3 3-3M8 21h8"/></svg></span>';

  function closeSheet() {
    var s = document.getElementById("dwqSheet"); if (s) s.remove();
    var p = document.getElementById("dwqPoint"); if (p) p.remove();
  }
  window.__dwqClose = closeSheet;
  function sheet(inner, point) {
    closeSheet();
    var d = document.createElement("div");
    d.id = "dwqSheet";
    d.innerHTML = '<div class="box">' + inner + "</div>";
    d.addEventListener("click", function (e) { if (e.target === d) closeSheet(); });
    document.body.appendChild(d);
    requestAnimationFrame(function () { d.classList.add("show"); });
    if (point) {
      var p = document.createElement("div");
      p.id = "dwqPoint";
      p.textContent = point.up ? "👆" : "👇";
      p.style.cssText = point.css;
      document.body.appendChild(p);
    }
  }
  function head(title, sub) {
    return '<div class="hd"><img src="dwq-icon-180.png" alt=""><div><h3>' + title + '</h3><div class="sub">' + sub + "</div></div></div>";
  }
  function steps(list) {
    return "<ol>" + list.map(function (t, i) { return '<li><span class="n">' + (i + 1) + "</span><div>" + t + "</div></li>"; }).join("") + "</ol>";
  }
  var CARRY = '<div class="tip">💾 孩子已有的进度会一起带过去：第一次从桌面图标打开时自动恢复，不用重来。</div>';
  var OK = '<button class="dwq-btn" onclick="__dwqClose()">知道了</button>';

  function copyLink(btn) {
    snapshot();
    var url = location.href;
    function done() { btn.textContent = "✅ 已复制，去浏览器粘贴打开"; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { prompt("长按复制这个链接：", url); });
    else prompt("长按复制这个链接：", url);
  }
  window.__dwqCopy = copyLink;

  function install() {
    if (standalone) return;
    if (deferred) { // Chrome / Edge / 安卓：真·一键
      var d = deferred;
      d.prompt();
      d.userChoice.then(function () { deferred = null; }).catch(function () {});
      return;
    }
    snapshot();
    if (inAppName) {
      sheet(head("先在浏览器里打开", "在" + inAppName + "里没法添加到桌面") +
        steps([
          "点右上角 " + DOTS + "（三个点）",
          "选 <b>「在浏览器打开」</b><small>" + (isIOS ? "iPhone / iPad 请选 Safari" : "选 Chrome 或手机自带浏览器") + "</small>",
          "打开后，再点一次 <b>「添加到桌面」</b>"
        ]) + CARRY +
        '<button class="dwq-btn" onclick="__dwqCopy(this)">或者：复制链接</button>' +
        '<button class="dwq-btn ghost" onclick="__dwqClose()">关闭</button>',
        { up: true, css: "top:calc(6px + env(safe-area-inset-top,0px));right:14px" });
      return;
    }
    if (isIOS) {
      var where = isIPad ? "在屏幕<b>右上角</b>，地址栏旁边" : (isIOSChrome ? "在地址栏<b>右侧</b>" : "在屏幕<b>底部</b>中间；看不到就先点底部的 " + DOTS);
      sheet(head("添加到" + (isIPad ? " iPad " : "手机") + "桌面", "像 App 一样，一点就开") +
        steps([
          "点" + (isIOSChrome ? " Chrome " : " Safari ") + "的「分享」按钮 " + SHARE + "<small>" + where + "</small>",
          "往下滑，点 <b>「添加到主屏幕」</b> " + ADD,
          "名字已经填好 <b>LexiPath</b>，点右上角 <b>「添加」</b><small>桌面上会出现小龙图标 🐉</small>"
        ]) + CARRY + OK,
        isIPad || isIOSChrome ? { up: true, css: "top:calc(4px + env(safe-area-inset-top,0px));right:" + (isIPad ? "96px" : "60px") } : null);
      return;
    }
    if (isMac && isSafari) {
      sheet(head("添加到 Mac 程序坞", "像 App 一样从程序坞打开") +
        steps([
          "点屏幕最上方菜单栏的 <b>「文件」</b>",
          "选 <b>「添加到程序坞…」</b><small>需要 macOS Sonoma 或更新版本</small>",
          "点 <b>「添加」</b>，程序坞里会出现小龙图标"
        ]) + CARRY + OK);
      return;
    }
    if (isAndroid) {
      sheet(head("添加到手机桌面", "像 App 一样，一点就开") +
        steps([
          "点浏览器右上角 " + KEBAB + "（三个点）",
          "选 <b>「添加到主屏幕」</b> 或 <b>「安装应用」</b>",
          "点 <b>「添加」/「安装」</b>，桌面上会出现小龙图标"
        ]) + OK, { up: true, css: "top:6px;right:8px" });
      return;
    }
    // 电脑 Chrome / Edge，还没拿到一键安装事件时
    var edge = /Edg\//.test(ua);
    sheet(head("安装到电脑", "装好后从桌面或开始菜单一点就开") +
      steps(edge ? [
        "点浏览器右上角 " + DOTS,
        "选 <b>「应用」→「将此站点作为应用安装」</b>",
        "点 <b>「安装」</b>"
      ] : [
        "看地址栏最右边有没有 " + INSTALL + " 安装图标，有就直接点它",
        "没有的话：点右上角 " + KEBAB + " → <b>「投放、保存和分享」</b> → <b>「将页面作为应用安装」</b>",
        "点 <b>「安装」</b>，桌面会出现小龙图标"
      ]) + OK);
  }
  window.dwqInstall = install;

  /* ---------- 链接带 ?add=1：打开就自动弹出安装（发给家长的「一个链接搞定」） ---------- */
  function autoAdd() {
    if (standalone || !/[?&]add=1\b/.test(location.search)) return;
    // 每台设备只自动弹一次；之后想装，首页的「添加到桌面」卡片一直都在
    try { if (localStorage.getItem("dwq_autoadd")) return; localStorage.setItem("dwq_autoadd", "1"); } catch (e) {}
    if (appleHome || inAppName) { install(); return; } // 苹果 / App 内：直接弹图示引导
    // Chrome / Edge / 安卓：浏览器要求安装必须由点击触发，所以给一个大按钮，点一下就弹系统安装框
    var dev = isAndroid ? "手机" : "电脑";
    sheet(head("把 LexiPath 装到这台" + dev, "装好后桌面上会出现小龙图标，一点就开") +
      '<div class="tip">🐉 全屏打开、没有地址栏，孩子更专注；进度一直保存在这台' + dev + "上。</div>" +
      '<button class="dwq-btn" id="dwqAutoBtn">一键安装</button>' +
      '<button class="dwq-btn ghost" onclick="__dwqClose()">先不装，直接开始玩</button>');
    document.getElementById("dwqAutoBtn").onclick = function () {
      if (deferred) { var d = deferred; d.prompt(); d.userChoice.then(function () { deferred = null; }).catch(function () {}); closeSheet(); }
      else install(); // 浏览器还没准备好一键安装 → 显示手动步骤
    };
  }

  /* ---------- 在欢迎页插入「添加到桌面」卡片 ---------- */
  function addCard() {
    if (standalone) return;
    var main = document.getElementById("main");
    if (!main || main.querySelector(".dwq-inst")) return;
    var first = main.querySelector(".pcard");
    if (!first) return; // 只在欢迎页（有 .pcard 列表）显示
    var sub = inAppName ? "先到浏览器里打开，再一键添加"
      : isIOS ? (isIPad ? "放在 iPad 桌面，孩子一点就开，全屏更专注" : "放在手机桌面，一点就开，全屏更专注")
      : isAndroid ? "放在手机桌面，一点就开，全屏更专注"
      : "装在电脑上，像 App 一样打开";
    var c = document.createElement("div");
    c.className = "dwq-inst";
    c.setAttribute("role", "button");
    c.innerHTML = '<img src="dwq-icon-180.png" alt=""><div><h2>添加到桌面</h2><p>' + sub + '</p></div><span class="go">' + (deferred ? "一键添加" : "添加") + "</span>";
    c.addEventListener("click", install);
    first.parentNode.insertBefore(c, first.nextSibling);
  }

  function hook() {
    if (typeof window.render === "function" && !window.render.__dwq) {
      var orig = window.render;
      var wrapped = function () { var r = orig.apply(this, arguments); try { addCard(); snapshot(); } catch (e) {} return r; };
      wrapped.__dwq = true;
      window.render = wrapped;
    }
    try { addCard(); snapshot(); } catch (e) {}
    if (!window.__dwqImported) setTimeout(autoAdd, 500);
    if (window.__dwqImported && typeof window.modal === "function") {
      window.modal('<div style="font-size:44px">🐉</div><h2>进度已恢复 ✓</h2><p class="mut" style="margin:10px 0">孩子之前的单词、打卡和龙蛋都搬过来了，接着玩就行。</p><button class="btn wide" onclick="closeModal()">好的</button>');
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hook); else hook();
  window.addEventListener("beforeinstallprompt", function () {
    var go = document.querySelector(".dwq-inst .go"); if (go) go.textContent = "一键添加";
  });
})();
