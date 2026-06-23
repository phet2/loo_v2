/* =====================================================================
   LOO · clist data-layer (ใช้ร่วม: Overview #sched + checklist.html)
   - sync "clist" (groups+items) ชุดเดียวผ่าน Firebase realtime
   - CRUD API (เพิ่ม/แก้/ลบ/ติ๊ก) · seed จาก window.LOO.SEED · wire answer boxes (Bou)
   - เขียน meta/overview {done,total} ให้หน้า hub
   ต้องโหลด loo-data.js ก่อน
   ===================================================================== */
window.LOO_CLIST = (function () {
  'use strict';
  var FB = (window.LOO || {}).FB || {}, SPACE = (window.LOO || {}).SPACE || 'loo', SEED = (window.LOO || {}).SEED || [];
  var LS = 'loo-clist:' + SPACE;
  var state = { clist: { groups: {}, items: {} }, answers: {} };
  var remote = null, status = 'local', subs = [], firstSnap = true, m = null, root = null;
  var uid = function (p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };

  function loadLocal() { try { var s = JSON.parse(localStorage.getItem(LS) || '{}'); return { clist: s.clist || { groups: {}, items: {} }, answers: s.answers || {} }; } catch (e) { return { clist: { groups: {}, items: {} }, answers: {} }; } }
  function saveLocal() { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} }
  function emit() { subs.forEach(function (f) { try { f(state, status); } catch (e) {} }); }

  function groupsSorted() { return Object.entries(state.clist.groups).sort(function (a, b) { return (a[1].order || 0) - (b[1].order || 0); }); }
  function itemsOf(gid) { return Object.entries(state.clist.items).filter(function (e) { return e[1].gid === gid; }).sort(function (a, b) { return (a[1].order || 0) - (b[1].order || 0); }); }
  function counts() { var d = 0, t = 0; Object.values(state.clist.items).forEach(function (it) { if (it.note) return; t++; if (it.done) d++; }); return { done: d, total: t }; }

  function writeMeta() { if (!remote) return; var c = counts(); m.set(m.child(root,'meta/overview'), { done: c.done, total: c.total, title: 'overview' }); }
  function wPath(p, v) { if (remote) m.update(root, (function () { var o = {}; o[p] = v; return o; })()); }

  /* ---------- CRUD (optimistic + remote path-write) ---------- */
  function maxGroupOrder() { return Object.values(state.clist.groups).reduce(function (x, g) { return Math.max(x, g.order || 0); }, 0); }
  function maxItemOrder(gid) { return Object.values(state.clist.items).reduce(function (x, it) { return it.gid === gid && it.order > x ? it.order : x; }, 0); }

  function addGroup(title) { var gid = uid('g_'); state.clist.groups[gid] = { title: title || '', order: maxGroupOrder() + 1 }; saveLocal(); wPath('clist/groups/' + gid, state.clist.groups[gid]); writeMeta(); emit(); return gid; }
  function editGroup(gid, title) { var g = state.clist.groups[gid]; if (!g) return; g.title = title; saveLocal(); wPath('clist/groups/' + gid, g); emit(); }
  function delGroup(gid) { delete state.clist.groups[gid]; Object.keys(state.clist.items).forEach(function (iid) { if (state.clist.items[iid].gid === gid) delete state.clist.items[iid]; }); saveLocal(); if (remote) { var o = {}; o['clist/groups/' + gid] = null; o['clist/items'] = state.clist.items; m.update(root, o); } writeMeta(); emit(); }
  function addItem(gid) { var iid = uid('i_'); state.clist.items[iid] = { gid: gid, dn: '', text: '', hr: '', done: false, order: maxItemOrder(gid) + 1 }; saveLocal(); wPath('clist/items/' + iid, state.clist.items[iid]); writeMeta(); emit(); return iid; }
  function editItem(iid, patch) { var it = state.clist.items[iid]; if (!it) return; Object.assign(it, patch); saveLocal(); wPath('clist/items/' + iid, it); writeMeta(); emit(); }
  function delItem(iid) { delete state.clist.items[iid]; saveLocal(); wPath('clist/items/' + iid, null); writeMeta(); emit(); }
  function toggleItem(iid) { var it = state.clist.items[iid]; if (!it || it.note) return; it.done = !it.done; saveLocal(); wPath('clist/items/' + iid, it); writeMeta(); emit(); }

  function seedIfEmpty() {
    if (Object.keys(state.clist.groups).length) return false;
    var go = 1, G = {}, I = {};
    SEED.forEach(function (grp) { var gid = uid('g_'); G[gid] = { title: grp.title, order: go++ }; var io = 1; (grp.items || []).forEach(function (it) { var iid = uid('i_'); I[iid] = { gid: gid, dn: it.dn || '', text: it.text || '', hr: it.hr || '', done: !!it.done, note: !!it.note, order: io++ }; }); });
    state.clist.groups = G; state.clist.items = I; saveLocal();
    if (remote) m.set(m.child(root,'clist'), { groups: G, items: I });
    return true;
  }

  /* ---------- answer boxes (Bou decisions) ---------- */
  function wireAnswers() {
    document.querySelectorAll('.loo-ans').forEach(function (box) {
      var ta = box.querySelector('textarea'); if (!ta) return;
      var btn = box.querySelector('.save'), st = box.querySelector('.st'), key = ta.getAttribute('data-answer') || '';
      ta.addEventListener('input', function () { if (st) { st.className = 'st edit'; st.textContent = 'ຍັງບໍ່ໄດ້ບັນທຶກ'; } });
      if (btn) btn.addEventListener('click', function () { var v = ta.value.trim(); if (v) state.answers[key] = v; else delete state.answers[key]; saveLocal(); wPath('answers/' + key, v || null); if (st) { st.className = 'st ok'; st.textContent = '✓ ບັນທຶກແລ້ວ'; } });
    });
  }
  function renderAnswers() {
    document.querySelectorAll('.loo-ans').forEach(function (box) {
      var ta = box.querySelector('textarea'); if (!ta || document.activeElement === ta) return;
      var key = ta.getAttribute('data-answer') || '', v = state.answers[key] || '', st = box.querySelector('.st');
      if (ta.value !== v) ta.value = v;
      if (st) { if (v) { st.className = 'st ok'; st.textContent = '✓ ບັນທຶກແລ້ວ'; } else { st.className = 'st'; st.textContent = ''; } }
    });
  }

  /* ---------- css (สำหรับ Overview schedule + answers) ---------- */
  function injectCSS() {
    if (document.getElementById('loo-clist-css')) return;
    var s = document.createElement('style'); s.id = 'loo-clist-css';
    s.textContent =
      '[data-loo-row]{cursor:pointer;border-radius:8px;transition:background .15s}' +
      '[data-loo-row]:hover{background:rgba(37,99,235,.06)}' +
      '[data-loo-row]:focus-visible{outline:2px solid var(--brand,#2563EB);outline-offset:2px}' +
      '.sday .cb{transition:.15s;position:relative;flex:0 0 auto}' +
      '.sday .cb.on{background:var(--success,#1ea64a);border-color:var(--success,#1ea64a)}' +
      '.sday .cb.on::after{content:"";position:absolute;left:50%;top:47%;width:5px;height:9px;border:2px solid #fff;border-top:0;border-left:0;transform:translate(-50%,-58%) rotate(45deg)}' +
      '.sday.loo-done .dt{opacity:.6;text-decoration:line-through;text-decoration-color:rgba(120,140,180,.5)}' +
      '.swk.loo-swk-done{background:var(--mint,#c8e6cd);transition:background .3s}' +
      '.swk.loo-swk-done > h4::after{content:var(--loo-done-label,"\\2713 DONE");display:inline-block;font-family:var(--mono,monospace);font-size:.7rem;font-weight:600;letter-spacing:.03em;color:#fff;background:var(--success,#1ea64a);padding:3px 10px;border-radius:var(--pill,50px);margin-left:8px;vertical-align:2px}' +
      '.loo-prog{display:flex;align-items:center;gap:11px;margin:2px 0 18px;flex-wrap:wrap;font-family:inherit;font-size:.86rem;font-weight:600;color:var(--ink-s,#394561)}' +
      '.loo-prog .bar{flex:1 1 160px;height:8px;border-radius:99px;background:rgba(120,140,180,.18);overflow:hidden;max-width:320px}' +
      '.loo-prog .bar i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,var(--brand,#2563EB),var(--success,#1ea64a));transition:width .5s}' +
      '.loo-prog .pct{font-family:var(--mono,monospace);color:var(--brand-2,#1d4ed8)}' +
      '.loo-chip{font-family:inherit;font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:99px;white-space:nowrap}' +
      '.loo-chip.live{background:rgba(30,166,74,.16);color:var(--green-ink,#0a5a2a)}' +
      '.loo-chip.connecting{background:rgba(37,99,235,.16);color:var(--brand-2,#1d4ed8)}' +
      '.loo-chip.local{background:rgba(245,158,11,.18);color:var(--amber-ink,#a8690a)}' +
      '.loo-ans{margin-top:14px}' +
      '.loo-ans textarea{width:100%;box-sizing:border-box;font-family:inherit;font-size:.95rem;line-height:1.5;color:var(--ink,#0b1220);background:var(--canvas,#fff);border:1px solid var(--hair,#e6e6e6);border-radius:var(--r-md,8px);padding:10px 12px;resize:vertical;outline:none}' +
      '.loo-ans textarea:focus{border-color:var(--brand,#2563EB);box-shadow:0 0 0 3px rgba(37,99,235,.16)}' +
      '.loo-ans .row{display:flex;align-items:center;gap:11px;margin-top:8px}' +
      '.loo-ans .save{font-family:inherit;font-weight:700;font-size:.85rem;color:#fff;background:var(--brand,#2563EB);border:none;border-radius:var(--pill,50px);padding:8px 18px;cursor:pointer}' +
      '.loo-ans .save:hover{filter:brightness(1.08)}' +
      '.loo-ans .st{font-family:var(--mono,monospace);font-size:.74rem;font-weight:600}' +
      '.loo-ans .st.ok{color:var(--success,#1ea64a)}.loo-ans .st.edit{color:var(--amber-ink,#a8690a)}';
    document.head.appendChild(s);
  }

  /* ---------- firebase ---------- */
  function start() {
    injectCSS();
    document.documentElement.style.setProperty('--loo-done-label', '"✓ ເສັດແລ້ວ"');
    var ls = loadLocal(); state.clist = ls.clist; state.answers = ls.answers; // mutate (ห้าม reassign — C.state ต้องชี้ object เดิมเสมอ)
    wireAnswers();
    if (!FB.databaseURL) { if (seedIfEmpty()) {} status = 'local'; emit(); renderAnswers(); return; }
    status = 'connecting'; emit();
    Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js')
    ]).then(function (mods) {
      m = mods[1]; var app = mods[0].initializeApp(FB), db = m.getDatabase(app); root = m.ref(db, 'space/' + SPACE);
      remote = true;
      m.onValue(root, function (snap) {
        var v = snap.val() || {};
        var rc = v.clist || {}; var rg = rc.groups || {}, ri = rc.items || {};
        if (firstSnap) {
          firstSnap = false; status = 'live';
          // ครั้งแรก: ถ้า remote มี clist ใช้เลย · ถ้าไม่มี seed
          if (Object.keys(rg).length) { state.clist = { groups: rg, items: ri }; }
          state.answers = Object.assign({}, state.answers, v.answers || {});
          if (!Object.keys(state.clist.groups).length) { seedIfEmpty(); } else { saveLocal(); }
          writeMeta();
        } else {
          state.clist = { groups: rg, items: ri };
          state.answers = v.answers || {};
        }
        saveLocal(); emit(); renderAnswers();
      }, function (err) { console.warn('[loo-clist] sync error -> local', err && err.message); remote = null; status = 'local'; if (!Object.keys(state.clist.groups).length) seedIfEmpty(); emit(); });
    }).catch(function (err) { console.warn('[loo-clist] firebase load fail -> local', err && err.message); remote = null; status = 'local'; if (!Object.keys(state.clist.groups).length) seedIfEmpty(); emit(); renderAnswers(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  return {
    subscribe: function (cb) { subs.push(cb); cb(state, status); },
    state: state, groupsSorted: groupsSorted, itemsOf: itemsOf, counts: counts, status: function () { return status; },
    addGroup: addGroup, editGroup: editGroup, delGroup: delGroup,
    addItem: addItem, editItem: editItem, delItem: delItem, toggleItem: toggleItem
  };
})();
