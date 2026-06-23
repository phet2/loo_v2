/* =====================================================================
   LOO · shared checklist engine
   ---------------------------------------------------------------------
   ทำให้ checkbox ในตารางงานรายวัน "ติ๊กได้" + บันทึก + ซิงก์ข้ามคน realtime
   ใช้ร่วมกันทั้ง index.html / Overview / Plan (วางไฟล์โฟลเดอร์เดียวกัน)

   โหมด:
   • ค่าเริ่มต้น  -> เก็บใน "เครื่องนี้" เท่านั้น (localStorage)
   • ใส่ Firebase -> ซิงก์ realtime ข้ามทุกคน (ติ๊กแล้วคนอื่นเห็นทันที)

   ── เปิดซิงก์ข้ามคน (ครั้งเดียว ~5 นาที) ──────────────────────────────
   1) https://console.firebase.google.com  ->  Add project (ฟรี · ปิด Analytics ได้)
   2) เมนูซ้าย Build -> Realtime Database -> Create Database
        - เลือก location (เช่น Singapore)  ->  Start in TEST MODE  ->  Enable
   3) มุมซ้ายบน ⚙ Project settings -> เลื่อนลงส่วน "Your apps"
        - กดไอคอน </>  (Web)  ->  ตั้งชื่อ -> Register app
        - คัดลอก object "firebaseConfig = { ... }"  (ต้องมี databaseURL)
   4) วาง object นั้นแทน null ใน FIREBASE_CONFIG ด้านล่าง  ->  save -> รีเฟรชหน้าเว็บ
        chip มุมขวาจะเปลี่ยนจาก "device only" เป็น "live sync"

   ── ตั้ง Security Rules (Database -> Rules -> วางแล้ว Publish) ─────────
   หมายเหตุ: Firebase เก็บแค่ "ค่า true/false ของช่องติ๊ก" ไม่ใช่เนื้อหาเอกสาร
   {
     "rules": {
       "space": {
         "loo-customer-brain": { ".read": true, ".write": true }
       },
       "$x": { ".read": false, ".write": false }
     }
   }
   (ล็อกแน่นขึ้นภายหลังได้ด้วย Firebase Auth — ดู README/ถามทีม dev)
   ===================================================================== */
(function () {
  'use strict';

  /* ============================ CONFIG ============================ */
  // วาง firebaseConfig ที่นี่เพื่อเปิดซิงก์ realtime ข้ามคน (ต้องมี databaseURL)
  // ปล่อย null = เก็บเฉพาะเครื่องนี้ (localStorage)
  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyAkOwClFlteywn7o9oN8yDP8-Yiht_eN-A",
    authDomain: "news-cde3e.firebaseapp.com",
    databaseURL: "https://news-cde3e-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "news-cde3e",
    storageBucket: "news-cde3e.firebasestorage.app",
    messagingSenderId: "828096137317",
    appId: "1:828096137317:web:4e2ed851283132f450de8c"
  };
  // databaseURL ตั้งแล้ว (asia-southeast1) — sync จะทำงานทันทีที่ Rules อนุญาต path space/loo-customer-brain
  /* ตัวอย่าง:
  var FIREBASE_CONFIG = {
    apiKey: "AIza......",
    authDomain: "loo-xxxx.firebaseapp.com",
    databaseURL: "https://loo-xxxx-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "loo-xxxx",
    appId: "1:....:web:...."
  };
  */
  var SPACE = 'loo-customer-brain'; // namespace กันชนกับโปรเจกต์อื่น
  /* ================================================================ */

  var LSKEY = 'loo-checklist:' + SPACE;

  // ---- ระบุหน้าจากชื่อไฟล์ ----
  var fname = (location.pathname.split('/').pop() || 'index').replace(/\.html?$/i, '').toLowerCase();
  var docId = 'index';
  if (fname.indexOf('overview') > -1) docId = 'overview';
  else if (fname.indexOf('plan') > -1) docId = 'plan';

  var DOC_TITLES = {
    overview: 'ສະໝອງລູກຄ້າ · ສະບັບເຂົ້າໃຈງ່າຍ',
    plan: 'Dev Technical Reference (Block A)'
  };

  // ---- state ----
  var state = { checks: {}, meta: {} };
  var remote = null;                 // { writeKey, writeMeta }
  var syncStatus = 'local';          // 'local' | 'connecting' | 'live'
  var rows = [];

  function loadLocal() {
    try {
      var s = JSON.parse(localStorage.getItem(LSKEY) || '{}');
      return { checks: s.checks || {}, meta: s.meta || {} };
    } catch (e) { return { checks: {}, meta: {} }; }
  }
  function saveLocal() { try { localStorage.setItem(LSKEY, JSON.stringify(state)); } catch (e) {} }

  /* ----------------------------- styles ----------------------------- */
  function injectCSS() {
    var css = document.createElement('style');
    css.textContent =
      '[data-loo-row]{cursor:pointer;border-radius:8px;transition:background .15s}' +
      '[data-loo-row]:hover{background:rgba(93,135,255,.06)}' +
      '[data-loo-row]:focus-visible{outline:2px solid var(--blue,#5d87ff);outline-offset:2px}' +
      '.sday .cb{transition:background .15s,border-color .15s;position:relative;flex:0 0 auto}' +
      '[data-loo-row]:hover .cb{border-color:var(--blue,#5d87ff)}' +
      '.sday .cb.on{background:var(--green,#10b981);border-color:var(--green,#10b981)}' +
      '.sday .cb.on::after{content:"";position:absolute;left:50%;top:47%;width:5px;height:9px;' +
        'border:2px solid #fff;border-top:0;border-left:0;transform:translate(-50%,-58%) rotate(45deg)}' +
      '.sday.loo-done .dt{opacity:.6;text-decoration:line-through;text-decoration-color:rgba(120,140,180,.5)}' +
      '.loo-prog{display:flex;align-items:center;gap:11px;margin:2px 0 18px;flex-wrap:wrap;' +
        'font-family:inherit;font-size:.86rem;font-weight:600;color:var(--ink-s,var(--ink-soft,#394561))}' +
      '.loo-prog .bar{flex:1 1 160px;height:8px;border-radius:99px;background:rgba(120,140,180,.18);' +
        'overflow:hidden;max-width:320px}' +
      '.loo-prog .bar i{display:block;height:100%;width:0;border-radius:99px;' +
        'background:linear-gradient(90deg,var(--blue,#5d87ff),var(--green,#10b981));' +
        'transition:width .5s cubic-bezier(.22,1,.36,1)}' +
      '.loo-prog .pct{font-family:"JetBrains Mono",monospace;color:var(--blue-700,#3a57c4)}' +
      '.loo-chip{font-family:inherit;font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:99px;white-space:nowrap}' +
      '.loo-chip.live{background:rgba(16,185,129,.16);color:var(--green-ink,#0a7a55)}' +
      '.loo-chip.connecting{background:rgba(93,135,255,.16);color:var(--blue-700,#3a57c4)}' +
      '.loo-chip.local{background:rgba(245,158,11,.18);color:var(--amber-ink,#a8690a)}' +
      '.swk h4 .loo-wk{font-family:"JetBrains Mono",monospace;font-size:.74rem;font-weight:600;' +
        'color:var(--muted,#5b667f);margin-left:8px}' +
      '@media (prefers-reduced-motion:reduce){.loo-prog .bar i{transition:none}}';
    document.head.appendChild(css);
  }

  /* ------------------------ doc page (checkboxes) ------------------------ */
  function setupDocPage() {
    rows = Array.prototype.slice.call(document.querySelectorAll('.sday'))
      .filter(function (r) { return r.querySelector('.cb'); });
    if (!rows.length) return false;

    rows.forEach(function (row, i) {
      var key = docId + ':' + i;
      row.setAttribute('data-loo-row', key);
      row.setAttribute('role', 'checkbox');
      row.setAttribute('tabindex', '0');
      row.addEventListener('click', function (e) { if (e.target.closest('a')) return; toggle(key); });
      row.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(key); }
      });
    });

    // meta ของหน้านี้ (ให้ hub รู้จำนวนข้อ)
    state.meta[docId] = { total: rows.length, title: document.title || DOC_TITLES[docId] || docId };

    var sched = document.querySelector('.sched');
    if (sched) {
      var p = document.createElement('div');
      p.className = 'loo-prog';
      p.innerHTML = '<span>ຄວາມຄືບໜ້າ</span>' +
        '<span class="bar"><i id="loo-bar"></i></span>' +
        '<span class="pct" id="loo-pct">0/0</span>' +
        '<span class="loo-chip local" id="loo-chip">device only</span>';
      sched.parentNode.insertBefore(p, sched);
    }
    Array.prototype.slice.call(document.querySelectorAll('.swk')).forEach(function (wk) {
      var h = wk.querySelector('h4');
      if (h) { var s = document.createElement('span'); s.className = 'loo-wk'; h.appendChild(s); }
    });
    return true;
  }

  function renderDocPage() {
    var done = 0;
    rows.forEach(function (row, i) {
      var on = !!state.checks[docId + ':' + i];
      if (on) done++;
      var cb = row.querySelector('.cb');
      if (cb) cb.classList.toggle('on', on);
      row.classList.toggle('loo-done', on);
      row.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    var total = rows.length;
    var bar = document.getElementById('loo-bar');
    var pct = document.getElementById('loo-pct');
    if (bar) bar.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
    if (pct) pct.textContent = done + '/' + total;

    Array.prototype.slice.call(document.querySelectorAll('.swk')).forEach(function (wk) {
      var label = wk.querySelector('.loo-wk');
      if (!label) return;
      var cbs = wk.querySelectorAll('.sday .cb'), d = 0;
      Array.prototype.slice.call(cbs).forEach(function (c) { if (c.classList.contains('on')) d++; });
      label.textContent = '· ' + d + '/' + cbs.length;
    });
    state.meta[docId] = { total: total, title: document.title || DOC_TITLES[docId] || docId };
  }

  function toggle(key) {
    var val = !state.checks[key];
    if (val) state.checks[key] = true; else delete state.checks[key];
    renderDocPage();
    saveLocal();
    if (remote) remote.writeKey(key, val); // เขียนเฉพาะ key นี้ (กันการติ๊กพร้อมกันทับกัน)
  }

  /* --------------------------- hub (index) --------------------------- */
  function renderHub() {
    Array.prototype.slice.call(document.querySelectorAll('[data-loo-doc]')).forEach(function (slot) {
      var id = slot.getAttribute('data-loo-doc');
      var total = (state.meta[id] || {}).total || 0;
      var done = 0;
      Object.keys(state.checks).forEach(function (k) { if (k.indexOf(id + ':') === 0 && state.checks[k]) done++; });
      var pctNum = total ? Math.round(done / total * 100) : 0;
      slot.innerHTML = '<span class="bar"><i style="width:' + pctNum + '%"></i></span>' +
        '<span class="pct">' + (total ? done + '/' + total : '—') + '</span>';
    });
  }

  function setChip() {
    var chip = document.getElementById('loo-chip');
    if (!chip) return;
    if (syncStatus === 'live') { chip.className = 'loo-chip live'; chip.textContent = 'live sync · ທຸກຄົນເຫັນຮ່ວມກັນ'; }
    else if (syncStatus === 'connecting') { chip.className = 'loo-chip connecting'; chip.textContent = 'ກຳລັງເຊື່ອມ sync…'; }
    else { chip.className = 'loo-chip local'; chip.textContent = 'device only · ຍັງບໍ່ໄດ້ຕັ້ງ sync'; }
  }

  function renderAll() {
    if (docId === 'index') renderHub(); else renderDocPage();
    setChip();
  }

  /* ----------------------------- remote ----------------------------- */
  function startRemote() {
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.databaseURL) return Promise.resolve(false);
    syncStatus = 'connecting'; setChip();
    return Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js')
    ]).then(function (m) {
      var app = m[0].initializeApp(FIREBASE_CONFIG);
      var db = m[1].getDatabase(app);
      var root = m[1].ref(db, 'space/' + SPACE);
      var first = true;

      remote = {
        writeKey: function (key, val) {
          var u = {}; u['checks/' + key] = val ? true : null; // null = ลบช่อง
          m[1].update(root, u);
        },
        writeMeta: function () {
          if (docId === 'index') return;
          var u = {}; u['meta/' + docId] = state.meta[docId] || {};
          m[1].update(root, u);
        }
      };

      m[1].onValue(root, function (snap) {
        var v = snap.val() || {};
        var rChecks = v.checks || {};
        if (first) {
          first = false;
          // ครั้งแรก: รวมของเดิมในเครื่องเข้ากับ remote (กันค่าที่ติ๊กไว้ก่อนเปิด sync หาย)
          var merged = Object.assign({}, state.checks, rChecks);
          var diff = JSON.stringify(merged) !== JSON.stringify(rChecks);
          state.checks = merged;
          state.meta = Object.assign({}, state.meta, v.meta || {});
          if (diff) m[1].update(root, { checks: merged });
          remote.writeMeta();
          syncStatus = 'live';
        } else {
          state.checks = rChecks;
          state.meta = Object.assign({}, state.meta, v.meta || {});
        }
        saveLocal();
        renderAll();
      }, function (err) {
        console.warn('[loo-checklist] sync ไม่สำเร็จ -> ใช้โหมด device-only. ตรวจ databaseURL/Rules:', err && err.message);
        remote = null; syncStatus = 'local'; renderAll();
      });
      return true;
    }).catch(function (err) {
      console.warn('[loo-checklist] โหลด Firebase SDK ไม่ได้ -> device-only:', err && err.message);
      remote = null; syncStatus = 'local'; renderAll();
      return false;
    });
  }

  /* ------------------------------ init ------------------------------ */
  function init() {
    injectCSS();
    state = loadLocal();
    if (docId !== 'index') setupDocPage();
    renderAll();
    startRemote();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
