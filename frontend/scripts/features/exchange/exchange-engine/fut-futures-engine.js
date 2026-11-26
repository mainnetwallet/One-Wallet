

// NOTE: Exchange market/portfolio preload used to fire 1.2s after every
// app boot, regardless of whether the user ever opens Exchange mode —
// meaning all 17 exchanges got hit on every wallet-mode session too.
// Moved to fire only on first Exchange-mode entry (see the switchPage
// hook below), so no exchange network calls happen until the user
// actually switches into Exchange mode.

// ── Global bridge functions for inline onclick ──
function excSwitchTab(t)        { EXC.switchTab(t); }
function excPortToggleVis()     { EXC.portToggleVis(); }
function excPortAction(a)       { EXC.portAction(a); }

// ── Future nav button: open dedicated Futures (Perp) trading panel ──
function excGoFuture() {
  excSwitchTab('future');
}

// ── FUT: standalone Futures (Perp) trading panel ──
var FUT = (function() {
  var __NX = window.__nxp.mod_fut_futures_engine; delete window.__nxp.mod_fut_futures_engine;


  // ── Shared with EXC module (cleared there on exchange switch via
  // _clearExchangeCache) — must reference the same window-level objects,
  // not separate per-IIFE locals. ──
  var _futBalCache = window._futBalCache; __NX._futBalCache = _futBalCache;
  var _futPosCache = window._futPosCache; __NX._futPosCache = _futPosCache;
  var _futOrdCache = window._futOrdCache; __NX._futOrdCache = _futOrdCache;

  return {
    init: __NX.init,
    setSide: __NX.setSide,
    setOrderType: __NX.setOrderType,
    togglePosMode: __NX.togglePosMode,
    openMarginPicker: __NX.openMarginPicker,
    openLeveragePicker: __NX.openLeveragePicker,
    _setLeverageValue: __NX._setLeverageValue,
    _getMaxLev: function(){ return __NX.state.maxLeverage || 125; },
    openPairPicker: __NX.openPairPicker,
    _filterFutPairs: __NX._filterFutPairs,
    _selectFutPair: __NX._selectFutPair,
    stepPrice: __NX.stepPrice,
    stepAmount: __NX.stepAmount,
    fillPrice: __NX.fillPrice,
    useBBO: __NX.useBBO,
    toggleCheck: __NX.toggleCheck,
    sliderClick: __NX.sliderClick,
    calcCost: __NX.calcCost,
    switchBottomTab: __NX.switchBottomTab,
    submitOrder: __NX.submitOrder,
    setTick: __NX.setTick,
    setObView: __NX.setObView,
    startFeed: __NX.startFeed,
    stopFeed: __NX.stopFeed,
    renderBook: __NX.renderBook,
    refreshAvbl: __NX.refreshAvbl,
    _setSplitHeight: __NX._setSplitHeight,
    _cancelOrder: __NX.cancelOrder,
    loadPositions: __NX.loadPositions,
    loadOpenOrders: __NX.loadOpenOrders,
    loadFutBalance: __NX.loadFutBalance,
    getState: function(){ return __NX.state; },
    getExchange: function(id){ return EXCHANGES.find(function(e){ return e.id===id; }) || null; },
  };
})();