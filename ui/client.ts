export function renderClientScript() {
  return `
  const state = {
    mem: [], obs: [], memPage:1, obsPage:1, pageSize:50, playbookCategory:'*', tab:'main', understanding: [], views: {}, understandingMeta: { generatedAt: 0, cached: false, feedback: { accurate: 0, inaccurate: 0 } },
    memSort:{k:'id',d:'desc'}, obsSort:{k:'at',d:'desc'}
  };
  function esc(s){return String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]||m));}
  function chip(label,v){return '<span class="chip">'+esc(label)+': <b>'+esc(v)+'</b></span>';}
  function cmp(a,b,dir){if(a===b)return 0; return (a>b?1:-1)*(dir==='asc'?1:-1);}
  function sortBy(arr,key,dir,isObs){
    const src = Array.isArray(arr) ? arr : [];
    return [...src].sort((x,y)=>{
      const a = isObs && key==='obsKind' ? ((x?.meta||{}).obsKind||'') : (key==='playbookCategory' ? ((x?.meta||{}).playbookCategory||'') : x?.[key]);
      const b = isObs && key==='obsKind' ? ((y?.meta||{}).obsKind||'') : (key==='playbookCategory' ? ((y?.meta||{}).playbookCategory||'') : y?.[key]);
      return cmp(String(a??''),String(b??''),dir);
    });
  }
  function toggleTheme(){ const b=document.body; b.classList.toggle('light'); localStorage.setItem('mp_theme', b.classList.contains('light')?'light':'dark'); }
  function applyTheme(){ if(localStorage.getItem('mp_theme')==='light') document.body.classList.add('light'); }
  function age(ts){ const d=Math.floor((Date.now()-Number(ts||Date.now()))/(1000*60*60*24)); return d===0?'today':(d+'d'); }
  function setTab(tab){
    state.tab = tab;
    document.getElementById('mainView').style.display = tab==='main' ? '' : 'none';
    document.getElementById('playbookView').style.display = tab==='playbook' ? '' : 'none';
    document.getElementById('understandingView').style.display = tab==='understanding' ? '' : 'none';
    document.getElementById('tab-main').classList.toggle('active', tab==='main');
    document.getElementById('tab-playbook').classList.toggle('active', tab==='playbook');
    document.getElementById('tab-understanding').classList.toggle('active', tab==='understanding');
    if (tab === 'playbook') renderPlaybookCards();
    if (tab === 'understanding') renderUnderstandingCards();
  }
  function showPlaybookDetail(m){
    try {
      if (state.tab !== 'main') setTab('main');
      document.getElementById('pbLabel').textContent = String(m?.id||'');
      const meta = m?.meta || {};
      const conflicts = Array.isArray(meta.conflictWith) ? meta.conflictWith : [];
      const lines = [
        'category: ' + String(meta.playbookCategory || '-'),
        'confirmations: ' + String(meta.confirmations || 0),
        'filePath: ' + String(meta.filePath || '-'),
        'conflictWith: ' + (conflicts.length ? conflicts.join(', ') : '-'),
        '',
        'why: ' + String(meta.why || meta.whyBad || '-'),
        '',
        'badSnippet:\\n' + String(meta.badSnippet || '-'),
        '',
        'correctedSnippet:\\n' + String(meta.correctedSnippet || '-'),
        '',
        'snippet:\\n' + String(meta.snippet || '-'),
        '',
        'text:\\n' + String(m?.text || '')
      ];
      document.getElementById('playbookDetail').textContent = lines.join('\\n');
      document.getElementById('playbookDetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {
      document.getElementById('timeline').textContent = 'Detail render error: ' + (e?.message || e);
    }
  }
  async function jumpToMemory(id){
    try {
      const q = document.getElementById('q');
      if (q) q.value = String(id||'');
      let hit = (state.mem || []).find(m => String(m?.id||'') === String(id||''));
      if (!hit) {
        await go();
        hit = (state.mem || []).find(m => String(m?.id||'') === String(id||''));
      }
      if (!hit) {
        document.getElementById('timeline').textContent = 'Could not load memory ' + String(id||'') + ' in current scope/filters.';
        return;
      }
      showPlaybookDetail(hit);
    } catch (e) {
      document.getElementById('timeline').textContent = 'Conflict jump error: ' + (e?.message || e);
    }
  }
  function renderUnderstandingCards(){
    const root = document.getElementById('understandingCards');
    if (!root) return;
    root.innerHTML = '';
    const list = Array.isArray(state.understanding) ? state.understanding : [];
    if (!list.length) {
      root.innerHTML = '<div class="pb-card"><h4>No summary yet</h4><div style="color:var(--muted)">Click Refresh to generate grounded summaries.</div></div>';
      return;
    }
    for (const s of list) {
      const card = document.createElement('div');
      card.className = 'pb-card';
      const sum = s?.summary || {};
      const ev = s?.evidence || {};
      card.innerHTML =
        '<h4>' + esc(String(s?.section||'')) + '</h4>' +
        '<div><b>What I know:</b> ' + esc(String(sum.whatIKnow || '-')) + '</div>' +
        '<div style="margin-top:6px"><b>Why I believe it:</b> ' + esc(String(sum.whyIBelieveIt || '-')) + '</div>' +
        '<div style="margin-top:6px"><b>Confidence:</b> ' + esc(String(sum.confidence || '-')) + ' · <b>Freshness:</b> ' + esc(String(sum.freshness || '-')) + '</div>' +
        '<div style="margin-top:6px"><b>Gaps:</b> ' + esc(Array.isArray(sum.gaps) ? sum.gaps.join(' | ') : '-') + '</div>' +
        (s?.strictFailed ? '<div style="margin-top:6px;color:#f59e0b"><b>Strict grounded:</b> failed (no evidence IDs)</div>' : '') +
        '<div style="margin-top:6px" class="mono"><b>Evidence:</b> mem[' + esc((ev.memoryIds||[]).join(', ')) + '] obs[' + esc((ev.observationIds||[]).join(', ')) + ']</div>' +
        '<div style="margin-top:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="link" data-vote="accurate">✓ accurate</span><span class="link" data-vote="inaccurate">✗ inaccurate</span></div>';
      card.querySelector('[data-vote="accurate"]').onclick = () => voteSummary('accurate');
      card.querySelector('[data-vote="inaccurate"]').onclick = () => voteSummary('inaccurate');
      root.appendChild(card);
    }
    const m = state.understandingMeta || {};
    const stamp = m.generatedAt ? new Date(m.generatedAt).toLocaleTimeString() : '-';
    const meta = document.createElement('div');
    meta.className = 'pb-card';
    meta.innerHTML = '<h4>Summary status</h4><div>generated: ' + esc(stamp) + ' · ' + (m.cached ? 'cache hit' : 'fresh') + '</div><div style="margin-top:6px">feedback: 👍 ' + esc(String((m.feedback||{}).accurate||0)) + ' · 👎 ' + esc(String((m.feedback||{}).inaccurate||0)) + '</div>';
    root.appendChild(meta);
  }
  function renderPlaybookCards(){
    const cats = ['code-rule','code-standard','decision','preference','good-example','bad-example'];
    const root = document.getElementById('playbookCards');
    root.innerHTML = '';
    for (const cat of cats) {
      const list = state.mem.filter(m => String((m?.meta||{}).playbookCategory||'')===cat).slice(0,10);
      const card = document.createElement('div');
      card.className = 'pb-card';
      const h = document.createElement('h4');
      h.textContent = cat + ' (' + list.length + ')';
      card.appendChild(h);
      if (!list.length) {
        const empty = document.createElement('div');
        empty.textContent = 'No items';
        empty.style.color = 'var(--muted)';
        card.appendChild(empty);
        root.appendChild(card);
        continue;
      }
      for (const m of list) {
        const row = document.createElement('div');
        row.style.borderTop = '1px dashed var(--line)';
        row.style.paddingTop = '8px';
        row.style.marginTop = '8px';

        const id = document.createElement('div');
        id.className = 'mono';
        id.style.fontSize = '12px';
        id.textContent = '(' + String(m.id || '') + ')';

        const text = document.createElement('div');
        text.style.margin = '4px 0 6px';
        const conflicts = Array.isArray((m?.meta||{}).conflictWith) ? (m?.meta||{}).conflictWith : [];
        if (conflicts.length) {
          const badge = document.createElement('span');
          badge.textContent = '⚠ conflict ';
          badge.style.color = '#f59e0b';
          badge.style.fontWeight = '700';
          text.appendChild(badge);
        }
        text.appendChild(document.createTextNode(String(m.text || '')));

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '10px';
        actions.style.flexWrap = 'wrap';

        const view = document.createElement('span');
        view.className = 'link';
        view.textContent = 'View detail';
        view.onclick = () => showPlaybookDetail(m);
        actions.appendChild(view);

        const pin = document.createElement('span');
        pin.className = 'link';
        pin.textContent = m?.pinned ? 'Unpin' : 'Pin';
        pin.onclick = () => togglePin(String(m?.id||''), !!m?.pinned);
        actions.appendChild(pin);

        if (String((m?.meta||{}).playbookCategory||'') === 'preference') {
          const conf = document.createElement('span');
          conf.className = 'link';
          conf.textContent = 'Confirm (' + String((m?.meta||{}).confirmations || 0) + '/3)';
          conf.onclick = () => confirmPreference(String(m?.id||''));
          actions.appendChild(conf);
        }
        if (conflicts.length) {
          for (const cid of conflicts.slice(0,3)) {
            const cl = document.createElement('span');
            cl.className = 'link';
            cl.textContent = 'Conflict→' + String(cid).slice(0,8);
            cl.onclick = () => jumpToMemory(String(cid));
            actions.appendChild(cl);
          }
        }

        row.append(id, text, actions);
        card.appendChild(row);
      }
      root.appendChild(card);
    }
  }
  function renderMemRows(items){
    const tb = document.getElementById('mem');
    tb.innerHTML = '';
    for (const m of items) {
      const tr = document.createElement('tr');
      const tdId = document.createElement('td'); tdId.className='mono'; tdId.textContent = String(m?.id||'');
      const tdPin = document.createElement('td');
      const a = document.createElement('span'); a.className='link'; a.textContent = m?.pinned ? 'Unpin' : 'Pin';
      a.onclick = () => togglePin(String(m?.id||''), !!m?.pinned);
      tdPin.textContent = m?.pinned ? '📌 ' : ''; tdPin.appendChild(a);
      const tdKind = document.createElement('td'); tdKind.textContent = String(m?.kind||'');
      const tdPb = document.createElement('td'); tdPb.textContent = String((m?.meta||{}).playbookCategory||'');
      const tdScope = document.createElement('td'); tdScope.textContent = String(m?.scope||'');
      const tdText = document.createElement('td');
      const conflicts = Array.isArray((m?.meta||{}).conflictWith) ? (m?.meta||{}).conflictWith : [];
      if (conflicts.length) {
        const badge = document.createElement('span');
        badge.textContent = '⚠ conflict ';
        badge.style.color = '#f59e0b';
        badge.style.fontWeight = '700';
        tdText.appendChild(badge);
      }
      tdText.appendChild(document.createTextNode(String(m?.text||'')));
      const tdConf = document.createElement('td'); tdConf.textContent = Number(m?.confidence||0).toFixed(2);
      const tdAge = document.createElement('td'); tdAge.textContent = age(m?.updatedAt);
      const tdAct = document.createElement('td');
      const mkAction = (label, fn) => {
        const b = document.createElement('button');
        b.className = 'link';
        b.type = 'button';
        b.style.background = 'transparent';
        b.style.border = 'none';
        b.style.padding = '0 6px 0 0';
        b.textContent = label;
        b.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await fn();
        };
        return b;
      };
      if ((m?.meta||{}).playbookCategory === 'preference') {
        tdAct.appendChild(mkAction('Confirm', () => confirmPreference(String(m?.id||''))));
      }
      tdAct.appendChild(mkAction('View', () => showPlaybookDetail(m)));
      if (conflicts.length) {
        for (const cid of conflicts.slice(0,3)) {
          tdAct.appendChild(mkAction('Conflict→'+String(cid).slice(0,8), () => jumpToMemory(String(cid))));
        }
      }
      tr.onclick = () => showPlaybookDetail(m);
      tr.append(tdId, tdPin, tdKind, tdPb, tdScope, tdText, tdConf, tdAge, tdAct);
      tb.appendChild(tr);
    }
  }
  function renderObsRows(items){
    const tb = document.getElementById('obs');
    tb.innerHTML = '';
    for (const o of items) {
      const tr = document.createElement('tr');
      const tdId = document.createElement('td'); tdId.className='mono';
      const a = document.createElement('span'); a.className='link'; a.textContent = String(o?.id||'');
      a.onclick = () => loadTimeline(String(o?.id||'')); tdId.appendChild(a);
      const tdType = document.createElement('td'); tdType.textContent = String(o?.type||'');
      const tdKind = document.createElement('td'); tdKind.textContent = String((o?.meta||{}).obsKind||'');
      const tdTitle = document.createElement('td'); tdTitle.textContent = String(o?.title||'');
      const tdContent = document.createElement('td'); tdContent.textContent = String(o?.content||'').slice(0,220);
      const tdTime = document.createElement('td'); tdTime.textContent = new Date(o?.at||Date.now()).toLocaleString();
      tr.append(tdId, tdType, tdKind, tdTitle, tdContent, tdTime);
      tb.appendChild(tr);
    }
  }
  function paginate(arr,page,size){ const total=Math.max(1,Math.ceil(arr.length/size)); const p=Math.min(total,Math.max(1,page)); return {items:arr.slice((p-1)*size,p*size), page:p, total}; }
  function render(){
    try {
      state.pageSize = Number(document.getElementById('pageSize').value || 50);
      const memSorted = sortBy(state.mem, state.memSort.k, state.memSort.d, false);
      const obsSorted = sortBy(state.obs, state.obsSort.k, state.obsSort.d, true);
      const mp = paginate(memSorted, state.memPage, state.pageSize); state.memPage = mp.page;
      const op = paginate(obsSorted, state.obsPage, state.pageSize); state.obsPage = op.page;
      renderMemRows(mp.items);
      renderObsRows(op.items);
      document.getElementById('memPage').textContent = 'Page '+mp.page+'/'+mp.total;
      document.getElementById('obsPage').textContent = 'Page '+op.page+'/'+op.total;
      document.getElementById('memSort').textContent = state.memSort.k+' '+state.memSort.d;
      document.getElementById('obsSort').textContent = state.obsSort.k+' '+state.obsSort.d;
    } catch (e) {
      document.getElementById('timeline').textContent = 'Render error: ' + (e?.message || e);
      document.getElementById('mem').innerHTML = '';
      document.getElementById('obs').innerHTML = '';
    }
  }
  function pageMem(d){ state.memPage += d; render(); }
  function pageObs(d){ state.obsPage += d; render(); }
  function sortMem(k){ state.memSort.d = state.memSort.k===k && state.memSort.d==='asc' ? 'desc' : 'asc'; state.memSort.k=k; state.memPage=1; render(); }
  function sortObs(k){ state.obsSort.d = state.obsSort.k===k && state.obsSort.d==='asc' ? 'desc' : 'asc'; state.obsSort.k=k; state.obsPage=1; render(); }
  async function confirmPreference(id){ await fetch('/api/memory/preference-confirm?id=' + encodeURIComponent(id)); await go(); }
  async function togglePin(id,isPinned){ const endpoint = isPinned ? '/api/memory/unpin?id=' : '/api/memory/pin?id='; await fetch(endpoint + encodeURIComponent(id)); await go(); }
  async function loadTimeline(id){
    const r = await fetch('/api/timeline?id='+encodeURIComponent(id)+'&before=4&after=4');
    const j = await r.json();
    document.getElementById('tlLabel').textContent = id;
    const t = (j.timeline||[]).map(x=>x.id+' | '+x.type+' | '+((x.meta||{}).obsKind||'')+' | '+x.title+'\\n'+(x.content||'').slice(0,220)+'\\n').join('\\n');
    document.getElementById('timeline').textContent = t || 'No timeline for this id.';
  }
  function currentFilters(){
    return {
      q: document.getElementById('q').value || '',
      project: document.getElementById('project').value || '*',
      domain: document.getElementById('domain').value || '*',
      playbookCategory: document.getElementById('playbookCategory').value || '*',
      pageSize: document.getElementById('pageSize').value || '50',
      tab: state.tab || 'main',
      strict: document.getElementById('strictGrounded')?.checked ? '1' : '0'
    };
  }
  async function loadViews(){
    const r = await fetch('/api/views?action=list');
    const j = await r.json();
    state.views = j?.views || {};
    const sel = document.getElementById('savedViewSelect');
    sel.innerHTML = '<option value="">Saved views…</option>';
    Object.keys(state.views).sort().forEach((k)=>sel.insertAdjacentHTML('beforeend','<option value="'+esc(k)+'">'+esc(k)+'</option>'));
  }
  async function saveView(){
    const name = (document.getElementById('savedViewName').value || '').trim();
    if (!name) return;
    const f = currentFilters();
    const u = '/api/views?action=save&name='+encodeURIComponent(name)+'&q='+encodeURIComponent(f.q)+'&project='+encodeURIComponent(f.project)+'&domain='+encodeURIComponent(f.domain)+'&playbookCategory='+encodeURIComponent(f.playbookCategory)+'&pageSize='+encodeURIComponent(f.pageSize)+'&tab='+encodeURIComponent(f.tab)+'&strict='+f.strict;
    await fetch(u);
    await loadViews();
  }
  async function loadSelectedView(){
    const name = document.getElementById('savedViewSelect').value;
    if (!name || !state.views[name]) return;
    const v = state.views[name];
    document.getElementById('q').value = String(v.q || '');
    document.getElementById('project').value = String(v.project || '*');
    document.getElementById('domain').value = String(v.domain || '*');
    document.getElementById('playbookCategory').value = String(v.playbookCategory || '*');
    document.getElementById('pageSize').value = String(v.pageSize || '50');
    if (document.getElementById('strictGrounded')) document.getElementById('strictGrounded').checked = !!v.strictGrounded;
    setTab(String(v.tab || 'main'));
    await go();
  }
  async function deleteSelectedView(){
    const name = document.getElementById('savedViewSelect').value;
    if (!name) return;
    await fetch('/api/views?action=delete&name='+encodeURIComponent(name));
    await loadViews();
  }
  async function loadRecallPack(name){
    const f = currentFilters();
    const u = '/api/recall-pack?name='+encodeURIComponent(name)+'&q='+encodeURIComponent(f.q)+'&project='+encodeURIComponent(f.project)+'&domain='+encodeURIComponent(f.domain);
    const r = await fetch(u);
    const j = await r.json();
    const panel = document.getElementById('recallPackPanel');
    if (!j || j.ok === false) { panel.textContent = 'Pack error: ' + (j?.error || 'unknown'); return; }
    panel.textContent = j.title + '\\n\\n' + j.brief + '\\n\\nEvidence mem[' + (j?.evidence?.memoryIds||[]).join(', ') + '] obs[' + (j?.evidence?.observationIds||[]).join(', ') + ']';
  }
  async function boot(){
    applyTheme();
    try {
      const r=await fetch('/api/catalog');
      const j=await r.json();
      const p=document.getElementById('project'), d=document.getElementById('domain');
      (j.projects||[]).forEach(x=>p.insertAdjacentHTML('beforeend','<option value="'+esc(x)+'">'+esc(x)+'</option>'));
      (j.domains||[]).forEach(x=>d.insertAdjacentHTML('beforeend','<option value="'+esc(x)+'">'+esc(x)+'</option>'));
      p.value='*'; d.value='*';
      await loadViews();
      go();
    } catch (e) {
      document.getElementById('timeline').textContent = 'Boot error: ' + (e?.message || e);
    }
  }
  async function voteSummary(vote){
    const q=document.getElementById('q').value, project=document.getElementById('project').value, domain=document.getElementById('domain').value;
    const strict = document.getElementById('strictGrounded').checked ? '1' : '0';
    const u='/api/summary/feedback?vote='+encodeURIComponent(vote)+'&q='+encodeURIComponent(q)+'&project='+encodeURIComponent(project)+'&domain='+encodeURIComponent(domain)+'&strict='+strict;
    await fetch(u);
    await loadUnderstanding(false);
  }
  async function loadUnderstanding(force){
    const q=document.getElementById('q').value, project=document.getElementById('project').value, domain=document.getElementById('domain').value;
    const strict = document.getElementById('strictGrounded').checked ? '1' : '0';
    const u='/api/summary/all?q='+encodeURIComponent(q)+'&project='+encodeURIComponent(project)+'&domain='+encodeURIComponent(domain)+'&strict='+strict+'&force='+(force ? '1' : '0');
    const r = await fetch(u);
    const j = await r.json();
    state.understanding = Array.isArray(j?.sections) ? j.sections : [];
    state.understandingMeta = { generatedAt: Number(j?.generatedAt || 0), cached: !!j?.cached, feedback: j?.feedback || { accurate: 0, inaccurate: 0 } };
    if (state.tab === 'understanding') renderUnderstandingCards();
  }
  async function go(){
    try {
      const q=document.getElementById('q').value, project=document.getElementById('project').value, domain=document.getElementById('domain').value;
      state.playbookCategory = document.getElementById('playbookCategory').value || '*';
      const u='/api/search?q='+encodeURIComponent(q)+'&project='+encodeURIComponent(project)+'&domain='+encodeURIComponent(domain);
      const [sr,tr]=await Promise.all([fetch(u), fetch('/api/stats')]);
      const s=await sr.json(), st=await tr.json();
      state.mem = Array.isArray(s.memories) ? s.memories : [];
      if (state.playbookCategory !== '*') state.mem = state.mem.filter(x => String((x?.meta||{}).playbookCategory||'') === state.playbookCategory);
      state.obs = Array.isArray(s.observations) ? s.observations : [];
      state.memPage=1; state.obsPage=1;
      document.getElementById('stats').innerHTML=[chip('memories',state.mem.length),chip('observations',state.obs.length),chip('totalItems',st.totalItems??'-'),chip('projectItems',st.projectItems??'-'),chip('lessons',st.lessons??'-')].join('');
      if (state.mem.length) renderMemRows(state.mem.slice(0, state.pageSize));
      if (state.obs.length) renderObsRows(state.obs.slice(0, state.pageSize));
      render();
      if (state.tab === 'playbook') renderPlaybookCards();
      await loadUnderstanding(false);
      if (!state.mem.length && !state.obs.length) document.getElementById('timeline').textContent = 'No rows for current project filter. Try selecting a project from dropdown or clear filters and Apply.';
    } catch (e) {
      document.getElementById('timeline').textContent = 'UI load error: ' + (e?.message || e);
    }
  }
  function bindEvents(){
    const byId = (id) => document.getElementById(id);
    const on = (id, ev, fn) => { const el = byId(id); if (el) el.addEventListener(ev, fn); };
    on('toggleTheme', 'click', toggleTheme);
    on('applyBtn', 'click', go);
    on('tab-main', 'click', () => setTab('main'));
    on('tab-playbook', 'click', () => setTab('playbook'));
    on('tab-understanding', 'click', () => setTab('understanding'));
    on('refreshUnderstanding', 'click', () => loadUnderstanding(true));
    on('saveViewBtn', 'click', () => saveView());
    on('loadViewBtn', 'click', () => loadSelectedView());
    on('deleteViewBtn', 'click', () => deleteSelectedView());
    on('packArchitecture', 'click', () => loadRecallPack('architecture'));
    on('packRecent', 'click', () => loadRecallPack('recent-changes'));
    on('packPrefs', 'click', () => loadRecallPack('team-preferences'));
    on('memPrev', 'click', () => pageMem(-1));
    on('memNext', 'click', () => pageMem(1));
    on('obsPrev', 'click', () => pageObs(-1));
    on('obsNext', 'click', () => pageObs(1));
    document.querySelectorAll('th[data-sort-mem]').forEach((th) => th.addEventListener('click', () => sortMem(th.getAttribute('data-sort-mem') || 'id')));
    document.querySelectorAll('th[data-sort-obs]').forEach((th) => th.addEventListener('click', () => sortObs(th.getAttribute('data-sort-obs') || 'at')));
  }
  bindEvents();
  boot();
  `;
}
