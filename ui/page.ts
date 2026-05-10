import type { MemoryStore } from "../types";

export function renderPage(store: MemoryStore) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pi Memory</title>
  <style>
    :root {
      --bg: #0b1020; --panel: #121a2b; --panel-2: #0f172a; --text: #e5e7eb; --muted: #94a3b8;
      --line: #24324a; --accent: #22c55e; --accent-2: #16a34a; --chip: #1e293b; --head: #0c1425; --link: #93c5fd;
    }
    body.light {
      --bg: #f3f6fb; --panel: #ffffff; --panel-2: #f8fafc; --text: #0f172a; --muted: #475569;
      --line: #d7e0ec; --accent: #16a34a; --accent-2: #15803d; --chip: #eef2f7; --head: #edf2f9; --link: #1d4ed8;
    }
    * { box-sizing: border-box; } body { margin:0; font-family: Inter, ui-sans-serif, system-ui; color:var(--text); background:var(--bg); overflow-x:hidden; }
    .wrap { max-width: 1460px; margin:0 auto; padding: 20px; }
    .top { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px; }
    .top h1 { margin:0; font-size:24px; }
    .meta { color:var(--muted); font-size:13px; display:flex; gap:8px; align-items:center; }
    .card { background:linear-gradient(180deg,var(--panel),var(--panel-2)); border:1px solid var(--line); border-radius:14px; padding:14px; }
    .filters { display:grid; grid-template-columns:1fr 170px 170px 170px 110px 110px; gap:10px; margin-bottom:12px; }
    input, select, button { border-radius:10px; border:1px solid var(--line); background:var(--panel-2); color:var(--text); padding:10px 12px; font-size:14px; }
    button { background:var(--accent); color:#06210f; border:none; font-weight:600; cursor:pointer; } button:hover{ background:var(--accent-2); }
    .ghost { background:transparent; border:1px solid var(--line); color:var(--text); }
    .stats { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
    .chip { background:var(--chip); border:1px solid var(--line); border-radius:999px; padding:6px 10px; color:var(--muted); font-size:12px; }
    .grid { display:grid; grid-template-columns: 1fr; gap:12px; }
    .split { display:grid; grid-template-columns: 1fr; gap:12px; }
    .split > div { min-width: 0; }
    .title { margin:0 0 8px; font-size:15px; color:var(--muted); display:flex; justify-content:space-between; align-items:center; }
    .table-wrap { overflow:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; table-layout: fixed; }
    th, td { border-bottom:1px solid var(--line); padding:8px 10px; text-align:left; vertical-align:top; font-size:13px; word-break: break-word; }
    th { cursor:pointer; position:sticky; top:0; background:var(--head); color:var(--link); z-index:1; }
    tr:hover td { background: rgba(127,127,127,.06); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .link { color:var(--link); text-decoration:underline; cursor:pointer; }
    .pager { margin-top:8px; display:flex; gap:8px; align-items:center; color:var(--muted); font-size:12px; }
    .timeline { white-space:pre-wrap; border:1px solid var(--line); border-radius:10px; padding:10px; max-height:300px; overflow:auto; }
    .tabs { display:flex; gap:8px; margin:8px 0 12px; }
    .tab-btn { background:transparent; color:var(--text); border:1px solid var(--line); }
    .tab-btn.active { background:var(--accent); color:#06210f; border:none; }
    .pb-grid { display:grid; grid-template-columns: repeat(auto-fit,minmax(260px,1fr)); gap:10px; }
    .pb-card { border:1px solid var(--line); border-radius:10px; padding:10px; background:var(--panel-2); }
    .pb-card h4 { margin:0 0 8px; font-size:13px; color:var(--muted); }
    @media (max-width: 1100px){ .split{ grid-template-columns:1fr; } .filters{ grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <h1>Pi Memory UI</h1>
      <div class="meta">
        <span>items=${store.items.length} · observations=${store.observations.length}</span>
        <button id="toggleTheme" class="ghost">Toggle theme</button>
      </div>
    </div>

    <div class="card">
      <div class="filters">
        <input id="q" placeholder="Search memories/observations" />
        <select id="project"><option value="*">All projects</option><option value="">Current project</option></select>
        <select id="domain"><option value="*">All domains</option><option value="">Current domain</option></select>
        <select id="playbookCategory">
          <option value="*">All playbook</option><option value="code-rule">code-rule</option><option value="code-standard">code-standard</option><option value="decision">decision</option><option value="preference">preference</option><option value="good-example">good-example</option><option value="bad-example">bad-example</option>
        </select>
        <select id="pageSize"><option>20</option><option selected>50</option><option>100</option></select>
        <button id="applyBtn">Apply</button>
      </div>
      <div class="filters" style="grid-template-columns:220px 1fr 120px 120px 120px 1fr;">
        <select id="savedViewSelect"><option value="">Saved views…</option></select>
        <input id="savedViewName" placeholder="Save current filters as…" />
        <button id="saveViewBtn" class="ghost">Save</button>
        <button id="loadViewBtn" class="ghost">Load</button>
        <button id="deleteViewBtn" class="ghost">Delete</button>
        <div></div>
      </div>

      <div id="stats" class="stats"></div>
      <div class="tabs">
        <button id="tab-main" class="tab-btn active">Memories & Observations</button>
        <button id="tab-playbook" class="tab-btn">Playbook</button>
        <button id="tab-superpowers" class="tab-btn">Superpowers</button>
        <button id="tab-understanding" class="tab-btn">Understanding</button>
      </div>

      <div id="mainView" class="split">
        <div>
          <h3 class="title"><span>Memories</span><span id="memSort"></span></h3>
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th data-sort-mem="id">id</th><th data-sort-mem="pinned">pin</th><th data-sort-mem="kind">kind</th><th data-sort-mem="playbookCategory">playbook</th><th data-sort-mem="scope">scope</th><th data-sort-mem="text">text</th><th data-sort-mem="confidence">conf</th><th data-sort-mem="updatedAt">age</th><th>actions</th>
              </tr></thead>
              <tbody id="mem"></tbody>
            </table>
          </div>
          <div class="pager"><button id="memPrev" class="ghost">Prev</button><span id="memPage"></span><button id="memNext" class="ghost">Next</button></div>
        </div>

        <div>
          <h3 class="title"><span>Observations</span><span id="obsSort"></span></h3>
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th data-sort-obs="id">id</th><th data-sort-obs="type">type</th><th data-sort-obs="obsKind">obsKind</th><th data-sort-obs="title">title</th><th data-sort-obs="content">content</th><th data-sort-obs="at">time</th>
              </tr></thead>
              <tbody id="obs"></tbody>
            </table>
          </div>
          <div class="pager"><button id="obsPrev" class="ghost">Prev</button><span id="obsPage"></span><button id="obsNext" class="ghost">Next</button></div>
        </div>
      </div>

      <div style="margin-top:12px;">
        <h3 class="title">Timeline panel <span id="tlLabel"></span></h3>
        <div id="timeline" class="timeline">Click an observation id to load timeline.</div>
      </div>
      <div style="margin-top:12px;">
        <h3 class="title">Playbook detail <span id="pbLabel"></span></h3>
        <div id="playbookDetail" class="timeline">Click a memory row to inspect structured playbook fields.</div>
      </div>

      <div id="playbookView" style="display:none; margin-top:12px;">
        <div class="pb-grid" id="playbookCards"></div>
      </div>

      <div id="superpowersView" style="display:none; margin-top:12px;">
        <div style="display:flex; gap:8px; margin-bottom:10px;">
          <select id="superpowersTypeFilter">
            <option value="*">All types</option>
            <option value="decision">decision</option>
            <option value="preference">preference</option>
            <option value="constraint">constraint</option>
            <option value="open-question">open-question</option>
          </select>
        </div>
        <div class="pb-grid" id="superpowersCards"></div>
      </div>

      <div id="understandingView" style="display:none; margin-top:12px;">
        <div class="title"><span>Human-readable understanding</span><span><label style="font-size:12px;color:var(--muted);margin-right:10px;"><input id="strictGrounded" type="checkbox" /> grounded-only</label><button id="refreshUnderstanding" class="ghost">Refresh</button></span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
          <button id="packArchitecture" class="ghost">Recall pack: Architecture</button>
          <button id="packRecent" class="ghost">Recall pack: Recent changes</button>
          <button id="packPrefs" class="ghost">Recall pack: Team preferences</button>
        </div>
        <div id="recallPackPanel" class="timeline" style="margin-bottom:10px;">Pick a recall pack to generate a grounded brief.</div>
        <div id="understandingCards" class="pb-grid"></div>
      </div>
    </div>
  </div>

<script src="/ui.js"></script>
</body></html>`;
}
