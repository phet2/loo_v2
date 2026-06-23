/* Overview #sched : render ตารางงานจาก clist (ชุดเดียวกับ checklist.html) + ติ๊กได้
   ต้องโหลดหลัง loo-data.js + loo-clist.js */
(function () {
  'use strict';
  var C = window.LOO_CLIST; var mount = document.querySelector('.sched');
  if (!C || !mount) return;
  var esc = function (s) { return (s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function chip(st) { var t = st === 'live' ? 'live sync · ທຸກຄົນເຫັນຮ່ວມກັນ' : st === 'connecting' ? 'ກຳລັງເຊື່ອມ sync…' : 'device only · ຍັງບໍ່ໄດ້ຕັ້ງ sync'; return '<span class="loo-chip ' + st + '">' + t + '</span>'; }

  function render(state, status) {
    var gs = C.groupsSorted(), c = C.counts();
    var cards = gs.map(function (ge) {
      var g = ge[1], its = C.itemsOf(ge[0]);
      var tasks = its.filter(function (e) { return !e[1].note; });
      var gd = tasks.filter(function (e) { return e[1].done; }).length, gt = tasks.length;
      var allDone = gt > 0 && gd === gt;
      var rows = its.map(function (ie) {
        var iid = ie[0], it = ie[1];
        if (it.note) return '<div class="sday">' + (it.dn ? '<span class="dn" style="color:var(--muted)">' + esc(it.dn) + '</span>' : '') + '<span class="dt">' + esc(it.text) + '</span>' + (it.hr ? '<span class="hr" style="color:var(--muted)">' + esc(it.hr) + '</span>' : '') + '</div>';
        return '<div class="sday' + (it.done ? ' loo-done' : '') + '" data-loo-row data-iid="' + iid + '" role="checkbox" tabindex="0" aria-checked="' + it.done + '">' +
          '<span class="cb' + (it.done ? ' on' : '') + '"></span>' +
          (it.dn ? '<span class="dn">' + esc(it.dn) + '</span>' : '') +
          '<span class="dt">' + esc(it.text) + '</span>' +
          (it.hr ? '<span class="hr">' + esc(it.hr) + '</span>' : '') + '</div>';
      }).join('');
      return '<div class="swk' + (allDone ? ' loo-swk-done' : '') + '"><h4>' + esc(g.title) +
        ' <span style="font-family:var(--mono);font-size:.74rem;font-weight:600;color:var(--muted)">· ' + gd + '/' + gt + '</span></h4>' + rows + '</div>';
    }).join('');
    var pct = c.total ? Math.round(c.done / c.total * 100) : 0;
    var prog = '<div class="loo-prog"><span>ຄວາມຄືບໜ້າ</span><span class="bar"><i style="width:' + pct + '%"></i></span><span class="pct">' + c.done + '/' + c.total + '</span>' + chip(status) + '</div>';
    mount.innerHTML = prog + cards;
  }
  mount.addEventListener('click', function (e) { var r = e.target.closest('[data-iid]'); if (r) C.toggleItem(r.getAttribute('data-iid')); });
  mount.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { var r = e.target.closest('[data-iid]'); if (r) { e.preventDefault(); C.toggleItem(r.getAttribute('data-iid')); } } });
  C.subscribe(render);
})();
