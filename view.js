// 页面模块：只负责输出 HTML 与前端渲染，数据全部来自请求模块返回的 JSON。

export function renderPage(init) {
  const data = JSON.stringify({
    stages: init.stages,
    turbidityOptions: init.turbidityOptions,
    drynessOptions: init.drynessOptions,
    gradeOptions: init.gradeOptions,
    minWaterChanges: init.minWaterChanges
  });
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>墨锭磨后洗养与入库核验台</title>
  <style>
    :root { --bg:#f1f3ef; --panel:#fff; --ink:#20241f; --muted:#687066; --line:#d4ddd0; --accent:#526f43; --warn:#9b4937; --hold:#c07a1e; }
    * { box-sizing:border-box; } body { margin:0; background:var(--bg); color:var(--ink); font-family:Arial,"PingFang SC",sans-serif; }
    header { padding:22px 28px; background:#fff; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:16px; align-items:center; }
    h1 { margin:0; font-size:24px; } h2 { margin:0 0 12px; font-size:17px; } h3 { margin:0; font-size:16px; } main { display:grid; grid-template-columns:370px 1fr; gap:22px; padding:22px 28px; }
    form,.panel,.card,.stat { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; }
    label { display:block; margin:10px 0 5px; color:var(--muted); font-size:13px; } input,select,textarea { width:100%; border:1px solid var(--line); border-radius:6px; padding:9px; font:inherit; background:#fff; } textarea { min-height:54px; }
    button { border:0; border-radius:6px; background:var(--accent); color:#fff; padding:9px 12px; font-weight:700; cursor:pointer; } button.secondary { background:#69736a; } button.danger { background:var(--warn); } button.hold { background:var(--hold); } button:disabled { background:#aab3a5; cursor:not-allowed; }
    .row { display:grid; grid-template-columns:1fr 1fr; gap:8px; } .row3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
    .btns { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
    .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); gap:10px; margin-bottom:14px; } .stat strong { display:block; font-size:22px; } .stat.extra strong { color:var(--accent); } .stat.holdstat strong { color:var(--warn); }
    .toolbar { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; } .toolbar select,.toolbar input { width:auto; min-width:150px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(290px,1fr)); gap:12px; } .card { display:grid; gap:6px; align-content:start; }
    .meta { color:var(--muted); font-size:13px; } .pill { display:inline-block; border:1px solid var(--line); border-radius:999px; padding:3px 8px; font-size:12px; justify-self:start; }
    .pill.s-待复洗 { color:var(--warn); border-color:var(--warn); font-weight:700; } .pill.s-已入库 { color:var(--accent); border-color:var(--accent); }
    .pill.s-待复核 { color:var(--hold); border-color:var(--hold); }
    .warn { color:var(--warn); font-weight:700; } .ok { color:var(--accent); font-weight:700; }
    dialog { border:1px solid var(--line); border-radius:10px; padding:0; width:min(720px,94vw); max-height:88vh; }
    dialog::backdrop { background:rgba(32,36,31,.45); }
    .modal-head { display:flex; justify-content:space-between; align-items:center; padding:16px 18px; border-bottom:1px solid var(--line); }
    .modal-body { padding:16px 18px; overflow:auto; max-height:calc(88vh - 64px); }
    .timeline { border-left:2px solid var(--line); margin-left:6px; padding-left:14px; display:grid; gap:10px; }
    .tl { position:relative; } .tl::before { content:""; position:absolute; left:-21px; top:4px; width:9px; height:9px; border-radius:50%; background:var(--accent); }
    .tl .kind { font-size:12px; color:#fff; background:#69736a; border-radius:4px; padding:1px 6px; margin-right:6px; }
    .tl .kind.k-wash { background:#3f6c8a; } .tl .kind.k-review { background:var(--accent); } .tl .kind.k-req { background:#8a6d3f; }
    .tl .kind.k-bad { background:var(--warn); } .tl .at { color:var(--muted); font-size:12px; }
    .section-title { margin:18px 0 8px; font-size:14px; font-weight:700; color:var(--muted); }
    #toast { position:fixed; right:20px; bottom:20px; display:grid; gap:8px; z-index:9; }
    .toast { background:#2d342a; color:#fff; padding:10px 14px; border-radius:8px; max-width:340px; font-size:14px; } .toast.err { background:var(--warn); }
    @media (max-width:900px){ header{display:block;padding:18px 16px;} main{grid-template-columns:1fr;padding:16px;} }
  </style>
</head>
<body>
  <header>
    <div><h1>墨锭磨后洗养与入库核验台</h1><div class="meta">试磨 · 洗养 · 换人复核 · 入库核验 · 单锭履历</div></div>
    <button id="reload">刷新重载</button>
  </header>
  <main>
    <section>
      <form id="createForm">
        <h2>新增墨锭</h2>
        <div class="row"><div><label>墨锭编号 *</label><input name="code" required></div><div><label>存放年限</label><input name="ageYears" type="number" value="0" min="0"></div></div>
        <label>烟料来源 *</label><input name="smokeSource" required>
        <label>胶料比例 *</label><input name="glueRatio" placeholder="如 7.5%" required>
        <label>存放位置 *</label><input name="storage" required>
        <label>初始状态</label><select name="status"><option>待试磨</option><option>已试磨</option></select>
        <div class="btns"><button>保存墨锭</button></div>
      </form>
      <form id="testForm" style="margin-top:14px">
        <h2>试磨记录</h2>
        <label>选择墨锭</label><select name="id" class="itemSelect"></select>
        <div class="row3"><div><label>试磨纸张</label><input name="paper"></div><div><label>加水量</label><input name="water"></div><div><label>评分</label><input name="score" type="number" min="0" max="100"></div></div>
        <div class="row3"><div><label>出墨速度</label><input name="speed"></div><div><label>墨色层次</label><input name="colorLayer"></div><div><label>沉淀情况</label><input name="sediment"></div></div>
        <div class="btns"><button class="secondary">提交试磨</button></div>
      </form>
      <form id="washForm" style="margin-top:14px">
        <h2>洗养单</h2>
        <label>选择墨锭（已试磨 / 待复洗）</label><select name="id" class="itemSelect washable"></select>
        <div class="row">
          <div><label>换水次数（≥3）</label><input name="waterChanges" type="number" min="0"></div>
          <div><label>洗液浑浊度</label><select name="turbidity"></select></div>
        </div>
        <div class="row">
          <div><label>擦干程度</label><select name="dryness"></select></div>
          <div><label>养护人 *</label><input name="caretaker"></div>
        </div>
        <label>备注</label><textarea name="note"></textarea>
        <div class="btns"><button class="hold">提交洗养单</button></div>
      </form>
      <form id="reviewForm" style="margin-top:14px">
        <h2>复核入库单（须换人）</h2>
        <label>选择墨锭（待复核）</label><select name="id" class="itemSelect reviewable"></select>
        <div class="row">
          <div><label>初检人 *</label><input name="firstInspector"></div>
          <div><label>初检级别</label><select name="firstGrade" class="grade"></select></div>
        </div>
        <div class="row">
          <div><label>复检人 *（须与初检不同）</label><input name="secondInspector"></div>
          <div><label>复检级别</label><select name="secondGrade" class="grade"></select></div>
        </div>
        <label>备注</label><textarea name="note"></textarea>
        <div class="btns"><button>提交复核入库</button></div>
      </form>
    </section>
    <section>
      <div class="stats" id="stats"></div>
      <div class="toolbar">
        <select id="statusFilter"><option value="">全部状态</option></select>
        <input id="search" placeholder="搜索编号 / 烟料 / 养护人 / 复核人">
      </div>
      <div class="panel">
        <h2>墨锭列表</h2>
        <div class="meta" style="margin-bottom:10px">待复洗墨锭暂停领用；换水不足 3 次或仍见余湿即判待复洗；复核两人级别差超过一级不准入库；烟料来源或胶料比例变更后原入库结论失效（旧单保留）。</div>
        <div class="grid" id="cards"></div>
      </div>
    </section>
  </main>

  <dialog id="detail">
    <div class="modal-head"><h2 id="detailTitle"></h2><button class="secondary" id="closeDetail">关闭</button></div>
    <div class="modal-body" id="detailBody"></div>
  </dialog>
  <div id="toast"></div>

  <script>
    const CFG = ${data};
    let items = [];
    const $ = (sel, root=document) => root.querySelector(sel);
    const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const fd = form => Object.fromEntries(new FormData(form).entries());

    async function api(path, options) {
      const res = await fetch(path, options && options.body ? { ...options, headers:{ 'Content-Type':'application/json' } } : options);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '请求失败');
      return data;
    }
    function toast(msg, isErr) {
      const el = document.createElement('div');
      el.className = 'toast' + (isErr ? ' err' : '');
      el.textContent = msg;
      $('#toast').appendChild(el);
      setTimeout(() => el.remove(), 4200);
    }
    function fillStaticOptions() {
      $('#statusFilter').innerHTML = '<option value="">全部状态</option>' + CFG.stages.map(s => '<option>'+s+'</option>').join('');
      $$('select[name="turbidity"]').forEach(s => s.innerHTML = CFG.turbidityOptions.map(o => '<option>'+o+'</option>').join(''));
      $$('select[name="dryness"]').forEach(s => s.innerHTML = CFG.drynessOptions.map(o => '<option>'+o+'</option>').join(''));
      $$('select.grade').forEach(s => s.innerHTML = CFG.gradeOptions.map(o => '<option>'+o+'</option>').join(''));
    }

    function render() {
      // 三个表单的墨锭下拉、统计、列表全部来自同一份 items，保证重载后一致。
      const opts = items.map(i => '<option value="'+esc(i.id)+'">'+esc(i.code)+' · '+esc(i.smokeSource)+' · '+esc(i.status)+'</option>').join('');
      $$('.itemSelect').forEach(s => { const v = s.value; s.innerHTML = opts; if (v && [...s.options].some(o=>o.value===v)) s.value = v; });
      $('.washable').innerHTML = items.filter(i => i.status==='已试磨' || i.status==='待复洗')
        .map(i => '<option value="'+esc(i.id)+'">'+esc(i.code)+' · '+esc(i.status)+'</option>').join('');
      $('.reviewable').innerHTML = items.filter(i => i.status==='待复核' || i.status==='已入库')
        .map(i => '<option value="'+esc(i.id)+'">'+esc(i.code)+' · '+esc(i.status)+'</option>').join('');

      const counts = Object.fromEntries(CFG.stages.map(s => [s, items.filter(i => i.status===s).length]));
      const storable = items.filter(i => i.activeReview).length;
      const held = items.filter(i => i.requisitionHeld).length;
      $('#stats').innerHTML =
        CFG.stages.map(s => '<div class="stat"><span>'+s+'</span><strong>'+counts[s]+'</strong></div>').join('') +
        '<div class="stat extra"><span>可入库（有效结论）</span><strong>'+storable+'</strong></div>' +
        '<div class="stat holdstat"><span>暂停领用</span><strong>'+held+'</strong></div>';

      const status = $('#statusFilter').value;
      const q = $('#search').value.trim();
      const visible = items.filter(i => (!status || i.status===status) && (!q || JSON.stringify(i).includes(q)));
      $('#cards').innerHTML = visible.map(cardHtml).join('') || '<div class="meta">没有符合条件的墨锭</div>';

      $$('[data-detail]').forEach(b => b.onclick = () => openDetail(b.dataset.detail));
      $$('[data-req]').forEach(b => b.onclick = () => requisition(b.dataset.req));
    }

    function cardHtml(i) {
      const w = i.latestWash;
      const r = i.activeReview;
      const washLine = w
        ? '<div class="meta">末次洗养：换水'+w.waterChanges+'次 · '+esc(w.turbidity)+' · '+esc(w.dryness)+' · '+esc(w.caretaker)+(w.passed?'':' <span class="warn">不合格</span>')+'</div>'
        : '<div class="meta">末次洗养：未洗养</div>';
      const reviewLine = r
        ? '<div class="meta ok">入库有效：初检'+esc(r.firstGrade)+'('+esc(r.firstInspector)+') / 复检'+esc(r.secondGrade)+'('+esc(r.secondInspector)+')</div>'
        : (i.status==='已入库' ? '<div class="meta warn">入库结论已失效，需重新复核</div>' : '<div class="meta">入库结论：无有效单</div>');
      return '<article class="card">'
        + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h3>'+esc(i.code)+'</h3><span class="pill s-'+esc(i.status)+'">'+esc(i.status)+'</span></div>'
        + '<div class="meta">'+esc(i.smokeSource)+' · 胶比'+esc(i.glueRatio)+' · 陈'+esc(i.ageYears)+'年 · '+esc(i.storage)+'</div>'
        + washLine + reviewLine
        + (i.requisitionHeld ? '<div class="warn">暂停领用（待复洗）</div>' : '')
        + '<div class="btns"><button class="secondary" data-detail="'+esc(i.id)+'">单锭履历 / 变更</button>'
        + (i.requisitionHeld
            ? '<button class="danger" disabled title="待复洗期间暂停领用">暂停领用</button>'
            : '<button data-req="'+esc(i.id)+'">领用</button>')
        + '</div></article>';
    }

    async function openDetail(id) {
      const i = await api('/api/items/'+encodeURIComponent(id)+'/history');
      $('#detailTitle').textContent = i.code + ' · ' + i.status;
      const tl = i.history.map(h => {
        const bad = h.kind.includes('不合格') || h.kind.includes('失效');
        const cls = h.kind.includes('洗养') ? 'k-wash' : h.kind.includes('复核') ? 'k-review' : h.kind.includes('领用') ? 'k-req' : h.kind.includes('试磨') ? '' : bad ? 'k-bad' : '';
        return '<div class="tl"><div><span class="kind '+(bad?'k-bad':cls)+'">'+esc(h.kind)+'</span><span class="at">'+esc((h.at||'').replace('T',' ').slice(0,19))+'</span></div><div>'+esc(h.step)+'：'+esc(h.note)+'</div></div>';
      }).join('');
      $('#detailBody').innerHTML =
        '<div class="section-title">档案（修改烟料来源或胶料比例将使原入库结论失效，旧单保留）</div>'
        + '<div class="row">'
        + '<div><label>烟料来源</label><input id="edSmoke" value="'+esc(i.smokeSource)+'"></div>'
        + '<div><label>胶料比例</label><input id="edGlue" value="'+esc(i.glueRatio)+'"></div></div>'
        + '<div class="row"><div><label>存放年限</label><input id="edAge" type="number" value="'+esc(i.ageYears)+'"></div>'
        + '<div><label>存放位置</label><input id="edStorage" value="'+esc(i.storage)+'"></div></div>'
        + '<div class="btns"><button id="saveEdit">保存变更</button></div>'
        + '<div class="section-title">单锭履历（'+i.history.length+' 条，含全部洗养单 / 复核单 / 领用单）</div>'
        + '<div class="timeline">'+(tl || '<div class="meta">暂无履历</div>')+'</div>';
      $('#detail').showModal();
      $('#saveEdit').onclick = async () => {
        try {
          await api('/api/items/'+encodeURIComponent(id), { method:'PATCH', body: JSON.stringify({
            smokeSource: $('#edSmoke').value, glueRatio: $('#edGlue').value,
            ageYears: $('#edAge').value, storage: $('#edStorage').value }) });
          $('#detail').close();
          await load();
          toast('档案变更已保存');
        } catch (e) { toast(e.message, true); }
      };
    }

    async function requisition(id) {
      const borrower = prompt('领用人姓名');
      if (!borrower) return;
      const purpose = prompt('领用用途（可留空）') || '';
      try { await api('/api/items/'+encodeURIComponent(id)+'/requisitions', { method:'POST', body: JSON.stringify({ borrower, purpose }) }); await load(); toast('领用登记成功'); }
      catch (e) { toast(e.message, true); }
    }

    async function submitAction(form, suffix, okMsg) {
      const p = fd(form);
      if (!p.id) { toast('请选择墨锭', true); return; }
      try {
        const res = await api('/api/items/'+encodeURIComponent(p.id)+suffix, { method:'POST', body: JSON.stringify(p) });
        form.reset(); await load();
        toast(typeof okMsg === 'function' ? okMsg(res) : okMsg);
      } catch (e) { toast(e.message, true); }
    }

    async function load() {
      items = await api('/api/items');
      render();
    }

    $('#createForm').onsubmit = async e => { e.preventDefault();
      try { await api('/api/items', { method:'POST', body: JSON.stringify(fd($('#createForm'))) }); $('#createForm').reset(); await load(); toast('墨锭已建档'); }
      catch (err) { toast(err.message, true); }
    };
    $('#testForm').onsubmit = e => { e.preventDefault(); submitAction($('#testForm'), '/tests', '试磨记录已提交'); };
    $('#washForm').onsubmit = e => { e.preventDefault();
      submitAction($('#washForm'), '/washes', res => res.status==='待复洗' ? '洗养不合格，已转入待复洗并暂停领用' : '洗养合格，已转待复核');
    };
    $('#reviewForm').onsubmit = e => { e.preventDefault();
      submitAction($('#reviewForm'), '/reviews', '复核通过，准予入库');
    };
    $('#statusFilter').onchange = render;
    $('#search').oninput = render;
    $('#reload').onclick = () => load().then(()=>toast('已从存储重载，列表 / 统计 / 履历一致'));
    $('#closeDetail').onclick = () => $('#detail').close();
    fillStaticOptions();
    load();
  </script>
</body>
</html>`;
}
