
  function bsbToggleKeyVisibility() {
    var ta   = document.getElementById('bsb-keys');
    var icon = document.getElementById('bsbKeysEyeIcon');
    if (!ta) return;
    var isMasked = ta.classList.contains('sk-masked');
    if (isMasked) {
      ta.classList.remove('sk-masked');
      ta.classList.add('sk-visible');
      if (icon) icon.textContent = 'visibility';
    } else {
      ta.classList.remove('sk-visible');
      ta.classList.add('sk-masked');
      if (icon) icon.textContent = 'visibility_off';
    }
  }

  function supTogglePkVisibility() {
    var ta   = document.getElementById('sup-pkArea');
    var icon = document.getElementById('supPkAreaEyeIcon');
    if (!ta) return;
    var isMasked = ta.classList.contains('sk-masked');
    if (isMasked) {
      ta.classList.remove('sk-masked');
      ta.classList.add('sk-visible');
      if (icon) icon.textContent = 'visibility';
    } else {
      ta.classList.remove('sk-visible');
      ta.classList.add('sk-masked');
      if (icon) icon.textContent = 'visibility_off';
    }
  }

  function skToggleKeyVisibility(textareaId, btnId) {
    var ta   = document.getElementById(textareaId);
    var icon = document.getElementById(btnId) && document.getElementById(btnId).querySelector('.sk-eye-icon');
    if (!ta) return;
    var isMasked = ta.classList.contains('sk-masked');
    if (isMasked) {
      ta.classList.remove('sk-masked');
      ta.classList.add('sk-visible');
      if (icon) icon.textContent = 'visibility';
    } else {
      ta.classList.remove('sk-visible');
      ta.classList.add('sk-masked');
      if (icon) icon.textContent = 'visibility_off';
    }
  }
  