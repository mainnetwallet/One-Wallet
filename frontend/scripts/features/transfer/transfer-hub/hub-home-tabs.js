/* Transfer Hub home: Send / Manage / Tools are all shown together (no tabs any more).
   Keeps the keyboard handler so Enter / Space opens the focused row (delegated, load-order independent). */
(function () {
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var row = e.target.closest && e.target.closest('.th-hub-row');
        if (row) { e.preventDefault(); row.click(); }
    });
    // Tabs are gone; kept so any old caller does nothing instead of throwing
    window.showHubTab = function () {};
})();
