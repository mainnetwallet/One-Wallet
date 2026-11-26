
// ── BIND HW PILL CLICKS (after DOM ready) ──
(function bindHwPills() {
  function attach() {
    const gp = document.getElementById('hw-group-pill');
    const wp = document.getElementById('hw-addr-pill');
    if (gp) {
      gp.addEventListener('click', function(e) { e.stopPropagation(); hwOpenGroupPicker(); });
      gp.addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); hwOpenGroupPicker(); }, { passive: false });
    }
    if (wp) {
      wp.addEventListener('click', function(e) { e.stopPropagation(); hwOpenWalletPicker(); });
      wp.addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); hwOpenWalletPicker(); }, { passive: false });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
})();
