// 页面模块：服务端渲染 HTML 外壳；前端所有数据都来自请求模块的同源接口，
// 列表、统计、单锭履历在每次加载/操作后一起刷新，保证互相一致。
export function page() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>磨后洗养与入库核验台</title>
  <style>
    :root { --bg:#f1f3ef; --panel:#fff; --ink:#20241f; --muted:#687066; --line:#d4ddd0; --accent:#526f43; --warn:#9b4937; --gold:#8a6a1f; }
    * { box-sizing:border-box; } body { margin:0; background:var(--bg); color:var(--ink); font-family:Arial,"PingFang SC",sans-serif; }
    header { padding:22px 28px; background:#fff; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:16px; align-items:center; }
    h1 { margin:0; font-size:24px; } h2 { margin:0 0 10px; font-size:16px; } h3 { margin:0; font-size:17px; }
    main { display:grid; grid-template-columns:380px 1fr; gap:22px; padding:22px 28px; align-items:start; }
    .left { display:grid; gap:14px; }
    form,.panel,.card,.stat { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; }
    label { display:block; margin:9px 0 4px; color:var(--muted); font-size:13px; } input,select,textarea { width:100%; border:1px solid var(--line); border-radius:6px; padding:9px; font:inherit; background:#fff; }
    button { border:0; border-radius:6px; background:var(--accent); color:#fff; padding:9px 12px; font-weight:700; cursor:pointer; font-size:13px; }
    button.secondary { background:#69736a; } button.ghost { background:#fff; color:var(--accent); border:1px solid var(--accent); }
    button:disabled { background:#b7beb4; cursor:not-allowed; } form button { margin-top:12px; width:100%; }
    .hint { color:var(--muted); font-size:12px; line-height:1.6; margin:6px 0 0; }
    .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); gap:10px; margin-bottom:14px; }
    .stat strong { display:block; font-size:23px; margin-top:2px; } .stat span { color:var(--muted); font-size:12px; }
    .stat.stock { border:2px solid var(--accent); } .stat.stock strong { color:var(--accent); }
    .stat.paused strong { color:var(--warn); }
    .toolbar { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; align-items:center; }
    .toolbar select,.toolbar input { width:auto; min-width:150px; } .toolbar .meta { margin-left:auto; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:12px; }
    .card { display:grid; gap:7px; align-content:start; }
    .meta { color:var(--muted); font-size:13px; }
    .pill { display:inline-block; border:1px solid var(--line); border-radius:999px; padding:3px 9px; font-size:12px; justify-self:start; }
    .pill.paused { border-color:var(--warn); color:var(--warn); font-weight:700; }
    .pill.stock { border-color:var(--accent); color:var(--accent); font-weight:700; }
    .pill.void { border-color:var(--gold); color:var(--gold); font-weight:700; }
    .row { display:flex; gap:6px; flex-wrap:wrap; margin-top:4px; }
    .warn { color:var(--warn); font-weight:700; } .gold { color:var(--gold); }
    .line { border-top:1px dashed var(--line); padding-top:7px; margin-top:2px; font-size:13px; }
    #toast { position:fixed; top:16px; left:50%; transform:translateX(-50%); background:var(--warn); color:#fff; padding:10px 18px; border-radius:8px; display:none; z-index:30; max-width:80vw; }
    .modal { position:fixed; inset:0; background:rgba(32,36,31,.45); display:none; align-items:center; justify-content:center; z-index:20; padding:20px; }
    .modal .box { background:#fff; border-radius:10px; max-width:680px; width:100%; max-height:86vh; overflow:auto; padding:20px 24px; }
    .tl { list-style:none; margin:12px 0 0; padding:0; border-left:2px solid var(--line); }
    .tl li { padding:0 0 14px 16px; position:relative; } .tl li::before { content:""; position:absolute; left:-6px; top:5px; width:10px; height:10px; border-radius:50%; background:var(--accent); }
    .tl li.fail::before { background:var(--warn); } .tl li.ok::before { background:var(--gold); }
    .tl .t { font-weight:700; font-size:14px; } .tl .d { color:var(--muted); font-size:13px; line-height:1.6; }
    @media (max-width:900px){ header{display:block;padding:18px 16px;} header button{margin-top:10px;} main{grid-template-columns:1fr;padding:16px;} }
  </style>
</head>
<body>
  <header>
    <div><h1>磨后洗养与入库核验台</h1><div class="meta">墨锭试磨 → 洗养单（换水/浑浊度/擦干/养护人）→ 换人复核入库；待复洗暂停领用，烟胶变更原结论失效留单</div></div>
    <button id="reload">刷新</button>
  </header>
  <main>
    <section class="left">
      <form id="createForm">
        <h2>① 新增墨锭</h2>
        <div id="createFields"></div>
        <p class="hint">建档后统一进入「待试磨」。</p>
        <button>保存墨锭</button>
      </form>
      <form id="testForm" class="panel">
        <h2>② 试磨登记</h2>
        <label>选择墨锭</label><select name="id" class="opt" data-when="待试磨,已领用"></select>
        <div id="testFields"></div>
        <button>提交试磨</button>
      </form>
      <form id="washForm" class="panel">
        <h2>③ 洗养单</h2>
        <label>选择墨锭</label><select name="id" class="opt" data-when="待洗养,待复洗"></select>
        <div id="washFields"></div>
        <p class="hint" id="washHint"></p>
        <button>提交洗养单</button>
      </form>
      <form id="verifyForm" class="panel">
        <h2>④ 入库核验（换人复核）</h2>
        <label>选择墨锭</label><select name="id" class="opt" data-when="待核验,结论失效"></select>
        <div id="verifyFields"></div>
        <p class="hint">复核人不得与初检人为同一人；两次检查级别差不超过一级才准入库。驳回则维持当前状态并留单。</p>
        <button>提交核验</button>
      </form>
    </section>
    <section>
      <div class="stats" id="stats"></div>
      <div class="toolbar">
        <select id="statusFilter"><option value="">全部状态</option><option value="__stock__">仅可入库</option></select>
        <input id="search" placeholder="搜索编号 / 烟料 / 胶料 / 养护人…">
        <span class="meta" id="count"></span>
      </div>
      <div class="grid" id="cards"></div>
    </section>
  </main>
  <div id="toast"></div>
  <div class="modal" id="modal"><div class="box"><h2 id="modalTitle"></h2><ul class="tl" id="timeline"></ul><div class="row" style="margin-top:10px"><button class="secondary" id="modalClose">关闭</button></div></div></div>
  <script>
  const createDefs = [["code","墨锭编号","text",true],["smokeSource","烟料来源","text",false],["glueRatio","胶料比例","text",false],["ageYears","存放年限","number",false],["storage","存放位置","text",false]];
  const testDefs = [["paper","试磨纸张"],["water","加水量"],["speed","出墨速度"],["colorLayer","墨色层次"],["sediment","沉淀情况"],["score","评分（数字）"]];
  let meta = { stages: [], turbidity: [], dryness: [], levels: [], minWaterChanges: 3 };
  let items = [], stats = {};

  async function api(path, options) {
    const res = await fetch(path, options && options.body ? { ...options, headers: { "Content-Type": "application/json" } } : options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || "请求失败");
    return data;
  }
  function toast(msg) {
    const el = document.querySelector("#toast");
    el.textContent = msg; el.style.display = "block";
    clearTimeout(el._t); el._t = setTimeout(() => (el.style.display = "none"), 3200);
  }
  function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
  function esc(v) { return String(v ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c])); }

  function renderStaticForms() {
    document.querySelector("#createFields").innerHTML = createDefs.map(([k,l,t,req]) =>
      '<label>'+l+'</label><input name="'+k+'" type="'+t+'"'+(req?" required":"")+'>').join("");
    document.querySelector("#testFields").innerHTML = testDefs.map(([k,l]) =>
      '<label>'+l+'</label><input name="'+k+'">').join("");
    document.querySelector("#washFields").innerHTML =
      '<label>换水次数</label><input name="waterChanges" type="number" min="0" required>' +
      '<label>洗液浑浊度</label><select name="turbidity">' + meta.turbidity.map(t => "<option>"+t+"</option>").join("") + '</select>' +
      '<label>擦干程度</label><select name="dryness">' + meta.dryness.map(t => "<option>"+t+"</option>").join("") + '</select>' +
      '<label>养护人</label><input name="keeper" required>';
    document.querySelector("#washHint").textContent =
      "换水不少于" + meta.minWaterChanges + "次且擦干不见余湿才进入「待核验」；换水不足或仍见余湿进入「待复洗」，复洗期间暂停领用。";
    document.querySelector("#verifyFields").innerHTML =
      '<label>初检级别</label><select name="firstLevel">' + meta.levels.map(t => "<option>"+t+"</option>").join("") + '</select>' +
      '<label>初检人</label><input name="firstChecker" required>' +
      '<label>复核级别</label><select name="reviewLevel">' + meta.levels.map(t => "<option>"+t+"</option>").join("") + '</select>' +
      '<label>复核人（须换人）</label><input name="reviewer" required>';
  }

  function renderSelects() {
    document.querySelectorAll("select.opt").forEach(sel => {
      const allow = sel.dataset.when.split(",");
      const list = items.filter(i => allow.includes(i.status));
      const old = sel.value;
      sel.innerHTML = list.length
        ? list.map(i => '<option value="'+i.id+'">'+esc(i.code)+' · '+i.status+'</option>').join("")
        : '<option value="">（当前无可操作墨锭）</option>';
      if (old && list.some(i => i.id === old)) sel.value = old;
    });
  }

  function renderStats() {
    const order = [...meta.stages, "可入库数量"];
    document.querySelector("#stats").innerHTML = order.map(k => {
      const v = stats[k] ?? 0;
      const cls = k === "可入库数量" ? "stat stock" : k === "待复洗" ? "stat paused" : "stat";
      return '<div class="'+cls+'"><span>'+k+'</span><strong>'+v+'</strong></div>';
    }).join("");
  }

  function pill(item) {
    if (item.status === "待复洗") return '<span class="pill paused">待复洗 · 暂停领用</span>';
    if (item.status === "结论失效") return '<span class="pill void">结论失效 · 旧单保留</span>';
    if (item.stockable) return '<span class="pill stock">已入库 · 计可入库</span>';
    return '<span class="pill">'+item.status+'</span>';
  }

  function cardHtml(item) {
    const w = item.latestWash;
    const v = item.effectiveVerification;
    let vline = "";
    if (v) {
      const head = '末次核验：初检' + v.firstLevel + '（' + esc(v.firstChecker) + '）/ 复核' + v.reviewLevel + '（' + esc(v.reviewer) + '）· ' + v.result;
      vline = v.voided
        ? '<div class="line warn">旧核验单已作废保留（' + esc(v.voidReason) + '），不计入可入库数量，须重新核验</div>'
        : v.result === "准入库"
          ? '<div class="line">' + head + '</div>'
          : '<div class="line warn">' + head + '（' + esc(v.reasons.join("；")) + '）</div>';
    }
    return '<article class="card">' +
      '<h3>' + esc(item.code) + '</h3>' + pill(item) +
      '<div class="meta">烟料：' + esc(item.smokeSource || "未填") + ' · 胶料：' + esc(item.glueRatio || "未填") + ' · 陈放' + esc(item.ageYears) + '年</div>' +
      '<div class="meta">存放：' + esc(item.storage || "未填") + (item.holder ? ' · 领用人：' + esc(item.holder) : "") + '</div>' +
      '<div class="meta">洗养单' + item.washCount + '张' + (w ? '；末次：换水' + w.waterChanges + '次 / ' + w.turbidity + ' / ' + w.dryness + ' / ' + esc(w.keeper) : "") + '</div>' +
      vline +
      '<div class="row">' +
        '<button data-act="resume" data-id="' + item.id + '">单锭履历</button>' +
        (item.status === "已领用"
          ? '<button data-act="return" data-id="' + item.id + '">归还</button>'
          : '<button data-act="take" data-id="' + item.id + '"' + (item.status === "待复洗" ? " disabled title=\"待复洗期间暂停领用\"" : "") + '>领用</button>') +
        (item.status === "待洗养" || item.status === "待复洗" ? '<button class="ghost" data-act="to-wash" data-id="' + item.id + '">去洗养</button>' : "") +
        (item.status === "待核验" || item.status === "结论失效" ? '<button class="ghost" data-act="to-verify" data-id="' + item.id + '">去核验</button>' : "") +
        (item.status === "待试磨" || item.status === "已领用" ? '<button class="ghost" data-act="to-test" data-id="' + item.id + '">去试磨</button>' : "") +
        '<button class="secondary" data-act="change" data-id="' + item.id + '">烟胶/档案变更</button>' +
      '</div>' +
    '</article>';
  }

  function renderCards() {
    const status = document.querySelector("#statusFilter").value;
    const q = document.querySelector("#search").value.trim().toLowerCase();
    const visible = items.filter(item => {
      if (status === "__stock__" && !item.stockable) return false;
      if (status && status !== "__stock__" && item.status !== status) return false;
      if (q && !JSON.stringify(item).toLowerCase().includes(q)) return false;
      return true;
    });
    document.querySelector("#count").textContent = "显示 " + visible.length + " / 共 " + items.length + " 锭";
    document.querySelector("#cards").innerHTML = visible.map(cardHtml).join("") || '<div class="panel meta">没有符合条件的墨锭</div>';
  }

  async function refresh() {
    [items, stats] = await Promise.all([api("/api/items"), api("/api/stats")]);
    renderSelects();
    renderStats(); renderCards();
  }

  async function reloadAll() {
    try { await refresh(); } catch (e) { toast(e.message); }
  }

  function pickSelect(formId, id) {
    const sel = document.querySelector("#" + formId + " select.opt");
    if (id && [...sel.options].some(o => o.value === id)) sel.value = id;
    document.querySelector("#" + formId).scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function openResume(id) {
    const item = await api("/api/items/" + encodeURIComponent(id));
    document.querySelector("#modalTitle").textContent = item.code + " · 单锭履历（洗养单/核验单均长期保留）";
    document.querySelector("#timeline").innerHTML = item.resume.map(e =>
      '<li class="' + e.tone + '"><div class="t">' + esc(e.title) + ' <span class="meta">' + esc(e.at) + '</span></div><div class="d">' + e.detail + '</div></li>'
    ).join("");
    document.querySelector("#modal").style.display = "flex";
    document.querySelector("#modal").dataset.id = id;
  }

  document.querySelector("#cards").addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button[data-act]");
    if (!btn || btn.disabled) return;
    const id = btn.dataset.id, act = btn.dataset.act;
    try {
      if (act === "resume") return await openResume(id);
      if (act === "to-wash") return pickSelect("washForm", id);
      if (act === "to-verify") return pickSelect("verifyForm", id);
      if (act === "to-test") return pickSelect("testForm", id);
      if (act === "take") {
        const holder = prompt("领用人姓名？（待复洗墨锭不可领用）");
        if (holder === null) return;
        await api("/api/items/" + encodeURIComponent(id) + "/requisition", { method: "POST", body: JSON.stringify({ holder }) });
      } else if (act === "return") {
        await api("/api/items/" + encodeURIComponent(id) + "/requisition", { method: "DELETE" });
      } else if (act === "change") {
        const item = items.find(i => i.id === id);
        const smokeSource = prompt("新烟料来源（留空表示不改）：", item.smokeSource || "");
        if (smokeSource === null) return;
        const glueRatio = prompt("新胶料比例（留空表示不改）：", item.glueRatio || "");
        if (glueRatio === null) return;
        const patch = {};
        if (smokeSource.trim() && smokeSource.trim() !== item.smokeSource) patch.smokeSource = smokeSource.trim();
        if (glueRatio.trim() && glueRatio.trim() !== item.glueRatio) patch.glueRatio = glueRatio.trim();
        if (!Object.keys(patch).length) return;
        const r = await api("/api/items/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(patch) });
        toast("已变更：" + r.changed.join("、") + (r.status === "结论失效" ? "；原入库结论失效，旧单保留且不计入可入库数量" : ""));
      }
      await reloadAll();
      const modal = document.querySelector("#modal");
      if (modal.style.display === "flex" && modal.dataset.id === id) await openResume(id);
    } catch (e) { toast(e.message); }
  });

  function bindForm(formId, url) {
    const form = document.querySelector("#" + formId);
    form.addEventListener("submit", async ev => {
      ev.preventDefault();
      try {
        const data = formObject(form);
        if (!data.id) throw new Error("请先选择可操作的墨锭");
        await api(url(data.id), { method: "POST", body: JSON.stringify(data) });
        form.reset();
        await reloadAll();
      } catch (e) { toast(e.message); }
    });
  }
  bindForm("createForm", () => "/api/items");
  bindForm("testForm", id => "/api/items/" + encodeURIComponent(id) + "/tests");
  bindForm("washForm", id => "/api/items/" + encodeURIComponent(id) + "/wash-sheets");
  bindForm("verifyForm", id => "/api/items/" + encodeURIComponent(id) + "/verifications");

  document.querySelector("#statusFilter").onchange = renderCards;
  document.querySelector("#search").oninput = renderCards;
  document.querySelector("#reload").onclick = reloadAll;
  document.querySelector("#modalClose").onclick = () => (document.querySelector("#modal").style.display = "none");
  document.querySelector("#modal").onclick = e => { if (e.target.id === "modal") e.target.style.display = "none"; };

  (async function init() {
    try {
      meta = await api("/api/meta");
      document.querySelector("#statusFilter").insertAdjacentHTML("beforeend",
        meta.stages.map(s => "<option>" + s + "</option>").join(""));
      renderStaticForms();
      await reloadAll();
    } catch (e) { toast(e.message); }
  })();
  </script>
</body>
</html>`;
}
