// ══════════════════════════════════════════════════════
// KEY & ADDRESS TOOLS — UI-ONLY HELPERS
// Presentation glue for the compact Key & Address Tools layout
// (html-src/partials/page-transfer-hub/phrase-to-key.html).
// It never touches phrase, key or address logic: it only
//   * opens/closes the logs strips (and opens the phrase log when Generate is tapped),
//   * reveals / hides a generated private key in a result row,
//   * copies an address / key from a result row (reusing the existing copy helpers)
//     and flashes a check icon.
// ══════════════════════════════════════════════════════
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  window.ktToggleLogs = function (id, open) {
    var box = $(id);
    if (!box) return;
    var willOpen = typeof open === 'boolean' ? open : box.classList.contains('collapsed');
    box.classList.toggle('collapsed', !willOpen);
  };

  // Show / hide the full private key of one generated row
  window.ktToggleKey = function (btn) {
    var row = btn && btn.closest ? btn.closest('.kt-rrow') : null;
    var el = row && row.querySelector('.kt-key');
    if (!row || !el) return;
    var show = !el.classList.contains('shown');
    el.classList.toggle('shown', show);
    el.textContent = show ? row.getAttribute('data-key') : row.getAttribute('data-key-mask');
    var ic = btn.querySelector('.material-icons-round');
    if (ic) ic.textContent = show ? 'visibility' : 'visibility_off';
  };

  // Copy the address (kind 'addr') or private key (kind 'key') stored on the row
  window.ktCopy = function (btn, kind) {
    var row = btn && btn.closest ? btn.closest('.kt-rrow') : null;
    if (!row) return;
    var isKey = kind === 'key';
    var text = row.getAttribute(isKey ? 'data-key' : 'data-addr');
    if (!text) return;
    if (!isKey && row.getAttribute('data-scope') === 'k2a' && typeof copyAddress === 'function') {
      copyAddress(text);
    } else if (typeof copyToClipboardLog === 'function') {
      copyToClipboardLog(text, isKey ? 'Private Key' : 'Address');
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    }
    var ic = btn.querySelector('.material-icons-round');
    if (!ic) return;
    var prev = ic.textContent;
    ic.textContent = 'check';
    setTimeout(function () { ic.textContent = prev; }, 1000);
  };

  // Starting a generation opens the phrase logs so errors are visible without scrolling
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('#generateKeysBtn') : null;
    if (t && !t.disabled) window.ktToggleLogs('ktLogsPhrase', true);
  }, true);
})();
