
  // mcspUpdateTrigger — updates read-only chain display in manual contract modal
  function mcspUpdateTrigger(chain) {
    const nameEl  = document.getElementById('manualSelectedChainName');
    const subEl   = document.getElementById('manualSelectedChainSymbol');
    const emojiEl = document.getElementById('manualChainEmoji');
    if (nameEl)  nameEl.textContent = chain.name;
    if (subEl)   subEl.textContent  = chain.symbol + (chain.chainId ? ' · Chain ID: ' + chain.chainId : '');
    if (!emojiEl) return;
    const logoURI = chain.logoURI || null;
    const emoji   = chain.emoji || '🔗';
    if (logoURI) {
      const img = new Image();
      img.onload = function() {
        emojiEl.innerHTML = '';
        const el = document.createElement('img');
        el.src = logoURI;
        el.style.cssText = 'width:28px;height:28px;border-radius:8px;object-fit:cover;display:block;';
        emojiEl.appendChild(el);
      };
      img.onerror = function() { emojiEl.innerHTML = `<span style="font-size:20px;line-height:1;">${emoji}</span>`; };
      emojiEl.innerHTML = `<span style="font-size:20px;line-height:1;">${emoji}</span>`;
      img.src = logoURI;
    } else {
      emojiEl.innerHTML = `<span style="font-size:20px;line-height:1;">${emoji}</span>`;
    }
  }
