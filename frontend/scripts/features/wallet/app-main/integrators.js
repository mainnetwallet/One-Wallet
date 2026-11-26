// ══════════════════════════════════════════
// ── INTEGRATOR SYSTEM ──
// ══════════════════════════════════════════
const INTEGRATOR_STORAGE_KEY = 'one_integrators';
const INTEGRATOR_ACTIVE_KEY  = 'one_integrator_active';

const INTEGRATOR_PRESETS = [
  {
    id: 'nansen-trading-free',
    label: 'Nansen Trading',
    icon: '📊',
    preset: true,
  },
  {
    id: 'jumper.exchange',
    label: 'Jumper Exchange',
    icon: '🦘',
    preset: true,
  },
];

function loadIntegrators() {
  try {
    const raw = localStorage.getItem(INTEGRATOR_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveIntegrators(list) {
  localStorage.setItem(INTEGRATOR_STORAGE_KEY, JSON.stringify(list));
}

function loadActiveIntegrator() {
  return localStorage.getItem(INTEGRATOR_ACTIVE_KEY) || 'nansen-trading-free';
}

function saveActiveIntegrator(id) {
  localStorage.setItem(INTEGRATOR_ACTIVE_KEY, id);
}

function getActiveIntegrator() {
  return loadActiveIntegrator();
}

function getAllIntegrators() {
  const custom = loadIntegrators();
  return [...INTEGRATOR_PRESETS, ...custom];
}

function renderIntegratorList() {
  const list = document.getElementById('integrator-list');
  if (!list) return;
  const all = getAllIntegrators();
  const activeId = loadActiveIntegrator();
  if (list) list.innerHTML = '';
  all.forEach(item => {
    const isActive = item.id === activeId;
    const isCustom = !item.preset;
    const el = document.createElement('div');
    el.style.cssText = `display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:12px;cursor:pointer;border:1.5px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-subtle)'};background:${isActive ? 'rgba(99,102,241,0.10)' : 'var(--bg-glass)'};transition:all 0.2s;`;
    el.innerHTML = `
      <span style="font-size:20px;line-height:1;">${item.icon || '🔗'}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:700;color:${isActive ? 'var(--accent-primary)' : 'var(--text-primary)'};font-family:var(--font-display);">${item.label}</div>
        <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);letter-spacing:0.5px;margin-top:2px;">${item.id}</div>
      </div>
      ${isActive ? '<span class="material-icons-round" style="color:var(--accent-primary);font-size:18px;">radio_button_checked</span>' : '<span class="material-icons-round" style="color:var(--text-muted);font-size:18px;">radio_button_unchecked</span>'}
      ${isCustom ? `<span class="material-icons-round" onclick="event.stopPropagation();removeCustomIntegrator('${item.id}')" style="color:var(--accent-red);font-size:18px;cursor:pointer;margin-left:2px;" title="Remove">delete</span>` : ''}
    `;
    el.addEventListener('click', () => {
      saveActiveIntegrator(item.id);
      renderIntegratorList();
      updateIntegratorSummary();
      showToast(`Integrator: ${item.label}`, 'swap_horiz');
      haptic();
    });
    list.appendChild(el);
  });
}

function addCustomIntegrator() {
  const input = document.getElementById('integrator-custom-input');
  const val = (input?.value || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!val) { showToast('Enter an integrator ID', 'warning'); return; }
  const all = getAllIntegrators();
  if (all.find(x => x.id === val)) { showToast('Already exists!', 'warning'); return; }
  const custom = loadIntegrators();
  // Try to make a nice label
  const label = val.replace(/[-_.]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  custom.push({ id: val, label, icon: '🔗', preset: false });
  saveIntegrators(custom);
  saveActiveIntegrator(val);
  input.value = '';
  renderIntegratorList();
  updateIntegratorSummary();
  showToast(`Added: ${label}`, 'check_circle');
  haptic();
}

function removeCustomIntegrator(id) {
  let custom = loadIntegrators();
  custom = custom.filter(x => x.id !== id);
  saveIntegrators(custom);
  // if removed was active, reset to first preset
  if (loadActiveIntegrator() === id) {
    saveActiveIntegrator(INTEGRATOR_PRESETS[0].id);
  }
  renderIntegratorList();
  updateIntegratorSummary();
  showToast('Integrator removed', 'delete');
  haptic();
}

function updateIntegratorSummary() {
  const el = document.getElementById('sum-integrator');
  if (!el) return;
  const activeId = loadActiveIntegrator();
  const all = getAllIntegrators();
  const found = all.find(x => x.id === activeId);
  if (el) el.textContent = found ? `${found.icon} ${found.label}` : activeId;
}

// Init on page ready
document.addEventListener('DOMContentLoaded', () => {
  renderIntegratorList();
  updateIntegratorSummary();
});
// Also render when step 3 becomes visible (in case DOMContentLoaded already fired)
(function() {
  const orig = window.goToStep3;
  window.goToStep3 = function(...args) {
    if (orig) orig.apply(this, args);
    renderIntegratorList();
    updateIntegratorSummary();
  };
})();

