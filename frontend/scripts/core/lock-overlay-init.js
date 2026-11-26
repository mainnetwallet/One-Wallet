
(function(){
  try {
    var bioOn = localStorage.getItem('one_bio_lock') === 'on';
    var hasPin = !!localStorage.getItem('one_lock_pin');
    var hasPat = !!localStorage.getItem('one_lock_pat');
    var hasBio = !!localStorage.getItem('one_bio_cred_id');
    var lockEnabled = bioOn && (hasPin || hasPat || hasBio);
    if (!lockEnabled) {
      // No lock — hide overlay as soon as DOM is available
      document.addEventListener('DOMContentLoaded', function() {
        var ov = document.getElementById('one-lock-overlay');
        if (ov) ov.style.display = 'none';
      });
    }
  } catch(e) {}
})();
