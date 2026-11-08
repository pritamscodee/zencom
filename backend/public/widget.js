/*! Zencom Messenger loader */
(function () {
  if (window.__zencomLoaded) return;
  window.__zencomLoaded = true;

  var script = document.currentScript || document.querySelector("script[data-zencom-key]");
  var key = script && script.getAttribute("data-zencom-key");
  if (!key) return console.warn("[Zencom] missing data-zencom-key on the widget script tag");

  var FRONTEND = "__FRONTEND_URL__";
  var API = script.src.replace(/\/widget\.js.*$/, "");

  fetch(API + "/api/public/widget/" + encodeURIComponent(key))
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(mount)
    .catch(function (e) { console.warn("[Zencom] messenger unavailable", e); });

  function mount(cfg) {
    var side = cfg.position === "left" ? "left" : "right";
    var color = cfg.color || "#0052f2";
    var fg = (function (hex) {
      var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
      if (!m) return "#fff";
      var h = m[1].length === 3 ? m[1].replace(/./g, function (c) { return c + c; }) : m[1];
      function lin(i) { var c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
      var L = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
      return 1.05 / (L + 0.05) >= (L + 0.05) / 0.058 ? "#fff" : "#13171a";
    })(color);
    var open = false;
    var ease = "cubic-bezier(.2,.8,.2,1)";

    var style = document.createElement("style");
    style.textContent =
      "#zencom-launcher{position:fixed;bottom:20px;" + side + ":20px;width:60px;height:60px;border-radius:50%;border:0;padding:0;cursor:pointer;" +
      "background:" + color + ";color:" + fg + ";box-shadow:0 2px 4px rgba(19,23,26,.08),0 10px 30px -6px rgba(19,23,26,.32);z-index:2147483646;" +
      "transition:transform .25s " + ease + ",box-shadow .25s ease}" +
      "#zencom-launcher:hover{transform:translateY(-2px) scale(1.04)}#zencom-launcher:focus-visible{outline:3px solid " + color + ";outline-offset:3px}#zencom-launcher:active{transform:scale(.96)}" +
      "#zencom-launcher .zc-ic{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transition:transform .3s " + ease + ",opacity .2s ease}" +
      "#zencom-launcher .zc-ic svg{width:26px;height:26px}" +
      "#zencom-launcher .zc-close{opacity:0;transform:rotate(-90deg) scale(.6)}" +
      "#zencom-launcher.zc-open .zc-chat{opacity:0;transform:rotate(90deg) scale(.6)}" +
      "#zencom-launcher.zc-open .zc-close{opacity:1;transform:none}" +
      "#zencom-badge{position:absolute;top:-3px;" + (side === "right" ? "left" : "right") + ":-3px;min-width:20px;height:20px;border-radius:10px;background:#e11d48;color:#fff;" +
      "font:600 11px/20px system-ui,sans-serif;text-align:center;padding:0 5px;box-sizing:border-box;box-shadow:0 0 0 2px #fff;display:none}" +
      "#zencom-frame{position:fixed;bottom:96px;" + side + ":20px;width:400px;height:min(704px,calc(100vh - 116px));border:0;border-radius:20px;" +
      "box-shadow:0 0 0 1px rgba(19,23,26,.06),0 12px 24px -8px rgba(19,23,26,.18),0 32px 64px -16px rgba(19,23,26,.28);z-index:2147483647;opacity:0;transform:translateY(16px) scale(.96);transform-origin:bottom " + side + ";" +
      "pointer-events:none;visibility:hidden;transition:opacity .22s ease,transform .3s " + ease + ",visibility 0s linear .3s;background:#fff;color-scheme:light}" +
      "#zencom-frame.zc-open{opacity:1;transform:none;pointer-events:auto;visibility:visible;transition:opacity .22s ease,transform .3s " + ease + ",visibility 0s}" +
      "@media (max-width:480px){#zencom-frame{inset:0;width:100%;height:100%;border-radius:0}#zencom-launcher.zc-open{display:none}}" +
      "@media (prefers-reduced-motion:reduce){#zencom-launcher,#zencom-frame,#zencom-launcher .zc-ic{transition:none}}";
    document.head.appendChild(style);

    var btn = document.createElement("button");
    btn.id = "zencom-launcher";
    btn.setAttribute("aria-label", "Open messenger");
    btn.innerHTML =
      '<span class="zc-ic zc-chat"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.48 3 2 6.92 2 11.75c0 2.47 1.18 4.7 3.08 6.29l-.86 3.2a.6.6 0 0 0 .84.69l3.66-1.82c1.03.3 2.13.46 3.28.46 5.52 0 10-3.92 10-8.75S17.52 3 12 3z"/></svg></span>' +
      '<span class="zc-ic zc-close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></span>' +
      '<span id="zencom-badge"></span>';

    var frame = document.createElement("iframe");
    frame.id = "zencom-frame";
    frame.title = "Support messenger";
    frame.allow = "clipboard-write";
    frame.src = FRONTEND + "/widget/" + encodeURIComponent(key) + "?page=" + encodeURIComponent(location.href);

    function setOpen(v) {
      open = v;
      frame.classList.toggle("zc-open", open);
      btn.classList.toggle("zc-open", open);
      btn.setAttribute("aria-label", open ? "Close messenger" : "Open messenger");
      if (open) document.getElementById("zencom-badge").style.display = "none";
      frame.contentWindow && frame.contentWindow.postMessage({ type: "zencom:visibility", open: open }, FRONTEND);
    }
    btn.addEventListener("click", function () { setOpen(!open); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) setOpen(false); });

    window.addEventListener("message", function (e) {
      if (e.origin !== FRONTEND || !e.data || typeof e.data !== "object") return;
      if (e.data.type === "zencom:close") setOpen(false);
      if (e.data.type === "zencom:unread") {
        var badge = document.getElementById("zencom-badge");
        badge.textContent = e.data.count > 9 ? "9+" : String(e.data.count);
        badge.style.display = e.data.count > 0 && !open ? "block" : "none";
      }
    });

    document.body.appendChild(frame);
    document.body.appendChild(btn);
    frame.addEventListener("load", function () {
      frame.contentWindow.postMessage({ type: "zencom:visibility", open: open }, FRONTEND);
    });

    window.Zencom = { open: function () { setOpen(true); }, close: function () { setOpen(false); }, toggle: function () { setOpen(!open); } };
  }
})();
