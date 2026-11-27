/* Transfer Hub home: Send / Manage / Tools tabs (delegated, load-order independent). */
(function () {
    function showHubTab(name) {
        var root = document.getElementById('mainDashboard');
        if (!root) return;
        root.querySelectorAll('.th-hub-tab').forEach(function (t) {
            var on = t.getAttribute('data-th-tab') === name;
            t.classList.toggle('active', on);
            t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        root.querySelectorAll('.th-hub-panel').forEach(function (p) {
            p.classList.toggle('active', p.getAttribute('data-th-panel') === name);
        });
    }
    document.addEventListener('click', function (e) {
        var tab = e.target.closest && e.target.closest('.th-hub-tab');
        if (tab) showHubTab(tab.getAttribute('data-th-tab'));
    });
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var row = e.target.closest && e.target.closest('.th-hub-row');
        if (row) { e.preventDefault(); row.click(); }
    });
    window.showHubTab = showHubTab;
})();
