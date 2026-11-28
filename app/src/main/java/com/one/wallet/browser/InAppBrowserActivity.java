package com.one.wallet.browser;

import com.one.wallet.MainActivity;
import com.one.wallet.R;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

public class InAppBrowserActivity extends AppCompatActivity {

    public static final String EXTRA_URL         = "extra_url";
    public static final String EXTRA_TITLE       = "extra_title";
    public static final String EXTRA_OPEN_SEARCH = "extra_open_search";
    public static final String EXTRA_SHOW_TABS   = "extra_show_tabs";
    public static final int    RESULT_OPEN_WALLET_DRAWER = 9001;

    private static final String PREFS_NAME   = "one_browser_prefs";
    private static final String HISTORY_KEY  = "browser_history";
    private static final int    HISTORY_MAX  = 30;
    private static final String TABS_KEY     = "browser_tabs";
    private static final String ACTIVE_TAB_KEY = "browser_active_tab";

    // ── Tab model ────────────────────────────────────────────────
    private static class Tab {
        WebView  webView;
        String   url   = "";
        String   title = "New Tab";
        boolean  loading = false;
        Bitmap   favicon = null;
        boolean  desktopMode = false;
        boolean  loaded = false; // false = restored but not yet loaded (lazy)
    }

    private final List<Tab> tabs    = new ArrayList<>();
    private int             activeTab = 0;

    // ── UI refs ──────────────────────────────────────────────────
    private FrameLayout  webViewContainer;
    private ProgressBar  progressBar;
    private TextView     tvUrl;
    private ImageButton  btnBack, btnForward, btnClose, btnNewTab, btnWallet, btnMenu, btnCloseToProfile;
    private ImageView    ivLock;
    private TextView     tvTabCount;
    private View         btnTabSwitcher;

    // Tab switcher panel
    private View         tabSwitcherOverlay;
    private RecyclerView rvTabs;
    private TabAdapter   tabAdapter;

    private boolean      pendingShowTabs = false;

    // History overlay
    private View         historyOverlay;
    private RecyclerView rvHistory;
    private HistoryAdapter historyAdapter;

    // Search overlay
    private LinearLayout searchOverlay;
    private EditText     etSearch;
    private TextView     btnSearchGo;
    private TextView     btnSearchPaste;
    private ImageButton  btnSearchCancel;
    private View         searchDismissArea;

    private final AtomicInteger web3ReqId = new AtomicInteger(1);

    // ── Persistent wallet selection across page navigations & app restarts ──
    private static final String KEY_SELECTED_WALLET = "selected_wallet_address";
    private volatile String selectedWalletAddress = null;

    // ── Chain selector ──────────────────────────────────────────
    private static final String KEY_SELECTED_CHAIN_ID   = "selected_chain_id";
    private static final String KEY_SELECTED_CHAIN_NAME = "selected_chain_name";
    private volatile String selectedChainId      = "0x1";
    private volatile String selectedChainName    = "ETH";
    private String selectedChainLogoURI = null;
    private android.widget.LinearLayout btnChainSelector;
    private android.widget.ImageView ivChainLogo;

    // ── Native chain picker (desktop-mode safe) ──────────────────
    private View         nativeChainPickerOverlay;
    private View         nativeChainPickerSheet;
    private RecyclerView rvNativeChains;
    private EditText     etNativeChainSearch;
    private NativeChainAdapter nativeChainAdapter;
    private java.util.List<java.util.Map<String,String>> allChainsList = new java.util.ArrayList<>();

    // ── Native wallet drawer (desktop-mode safe) ─────────────────
    private View         nativeWalletDrawerOverlay;
    private android.view.View nativeWalletDrawer;
    private RecyclerView rvNativeWalletGroups;
    private TextView     tvNativeWalletActive;
    private TextView     tvNativeWalletGroupCount;
    private NativeWalletGroupAdapter nativeWalletGroupAdapter;
    private org.json.JSONArray nativeWalletGroupsData = new org.json.JSONArray();

    // ── Strict validation + JS-literal helpers for page-controlled bridge input ──
    // Strings that originate in a dApp page must never be spliced into JS that runs in the
    // key-holding main WebView without (a) validation at the bridge entry and (b) JSON quoting.
    private static final java.util.regex.Pattern ADDRESS_RE =
        java.util.regex.Pattern.compile("^0x[0-9a-fA-F]{40}$");
    private static final java.util.regex.Pattern CHAIN_ID_RE =
        java.util.regex.Pattern.compile("^0x[0-9a-fA-F]{1,16}$");
    private static final java.util.regex.Pattern METHOD_RE =
        java.util.regex.Pattern.compile("^[A-Za-z0-9_.:-]{1,64}$");

    public static boolean isValidAddress(String s) { return s != null && ADDRESS_RE.matcher(s).matches(); }
    public static boolean isValidChainId(String s) { return s != null && CHAIN_ID_RE.matcher(s).matches(); }
    /** True only for absolute http(s) URLs; page JS must not open other schemes (file:, intent:, javascript:). */
    private static final java.util.Set<String> EXTERNAL_SCHEMES =
        new java.util.HashSet<>(java.util.Arrays.asList("mailto", "tel", "sms", "smsto", "wc"));

    /** Schemes a dApp page may hand to the system after a user tap. */
    static boolean isAllowedExternalScheme(Uri u) {
        String sch = u != null ? u.getScheme() : null;
        return sch != null && EXTERNAL_SCHEMES.contains(sch.toLowerCase(java.util.Locale.ROOT));
    }

    static boolean isHttpUrl(String url) {
        if (url == null) return false;
        String u = url.trim().toLowerCase(java.util.Locale.ROOT);
        return u.startsWith("https://") || u.startsWith("http://");
    }
    public static boolean isValidMethod(String s)  { return s != null && METHOD_RE.matcher(s).matches(); }

    // ── Web3 request identity ───────────────────────────────────────────────────────────────
    // addJavascriptInterface exposes OneWeb3Bridge to every frame of a page, including
    // third-party iframes, and the bridge cannot tell which frame called it. Each call therefore
    // has to carry a token that only the provider injected into the top frame knows. The token is
    // bound to the top document's origin, so one site's token is useless while a tab shows another.
    private static final byte[] BRIDGE_SECRET = new byte[32];
    static { new java.security.SecureRandom().nextBytes(BRIDGE_SECRET); }

    /** Same string as JavaScript's location.origin for an http(s) URL, else null. */
    static String originOf(String url) {
        if (!isHttpUrl(url)) return null;
        Uri u = Uri.parse(url.trim());
        String authority = u.getEncodedAuthority();
        if (u.getScheme() == null || authority == null) return null;
        authority = authority.substring(authority.lastIndexOf('@') + 1)
            .toLowerCase(java.util.Locale.ROOT);
        String scheme = u.getScheme().toLowerCase(java.util.Locale.ROOT);
        String defaultPort = "https".equals(scheme) ? ":443" : ":80";
        if (authority.endsWith(defaultPort)) {
            authority = authority.substring(0, authority.length() - defaultPort.length());
        }
        return authority.isEmpty() ? null : scheme + "://" + authority;
    }

    /** What the confirmation sheet shows: the host for https, the full origin for plain http. */
    static String displayHost(String origin) {
        return origin.startsWith("https://") ? origin.substring("https://".length()) : origin;
    }

    static String bridgeToken(String origin) {
        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(BRIDGE_SECRET, "HmacSHA256"));
            StringBuilder hex = new StringBuilder();
            for (byte b : mac.doFinal(origin.getBytes(java.nio.charset.StandardCharsets.UTF_8))) {
                hex.append(String.format(java.util.Locale.ROOT, "%02x", b & 0xff));
            }
            return hex.toString();
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** True when {@code token} belongs to the document {@code wv} is showing. UI thread only. */
    private static boolean isTokenFor(WebView wv, String token) {
        String origin = originOf(wv.getUrl());
        if (origin == null || token == null) return false;
        return java.security.MessageDigest.isEqual(
            bridgeToken(origin).getBytes(java.nio.charset.StandardCharsets.UTF_8),
            token.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    /** Returns {@code s} as a complete, double-quoted JavaScript string literal (quotes included). */
    public static String jsStr(String s) {
        String q = JSONObject.quote(s == null ? "" : s);
        return q.replace(String.valueOf((char) 0x2028), "\\u2028")
                .replace(String.valueOf((char) 0x2029), "\\u2029");
    }

    public void saveSelectedChain(String id, String name, String logoURI) {
        selectedChainId      = id;
        selectedChainName    = name;
        selectedChainLogoURI = (logoURI != null && !logoURI.isEmpty()) ? logoURI : chainLogoFromId(id);
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
            .putString(KEY_SELECTED_CHAIN_ID,   id   != null ? id   : "0x1")
            .putString(KEY_SELECTED_CHAIN_NAME, name != null ? name : "ETH")
            .putString("selected_chain_logo",   selectedChainLogoURI != null ? selectedChainLogoURI : "")
            .apply();
    }

    private void loadSelectedChain() {
        android.content.SharedPreferences p = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        selectedChainId      = p.getString(KEY_SELECTED_CHAIN_ID,   "0x1");
        selectedChainName    = p.getString(KEY_SELECTED_CHAIN_NAME, "ETH");
        selectedChainLogoURI = p.getString("selected_chain_logo",   null);
        if (selectedChainLogoURI != null && selectedChainLogoURI.isEmpty())
            selectedChainLogoURI = null;
        // If no saved logo, derive from chainId using TrustWallet assets
        if (selectedChainLogoURI == null)
            selectedChainLogoURI = chainLogoFromId(selectedChainId);
    }

    public static String chainLogoFromId(String hexId) {
        if (hexId == null) return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png";
        java.util.Map<String, String> m = new java.util.HashMap<>();
        m.put("0x1",     "ethereum");
        m.put("0x38",    "smartchain");
        m.put("0x89",    "polygon");
        m.put("0xa4b1",  "arbitrum");
        m.put("0xa",     "optimism");
        m.put("0x2105",  "base");
        m.put("0xa86a",  "avalanchec");
        m.put("0xfa",    "fantom");
        m.put("0xa4ec",  "celo");
        m.put("0x64",    "xdai");
        m.put("0xe708",  "linea");
        m.put("0x82750", "scroll");
        m.put("0x171",   "solana");
        String slug = m.get(hexId.toLowerCase());
        if (slug == null) return null;
        return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/" + slug + "/info/logo.png";
    }

    public void updateChainButton() {
        if (ivChainLogo == null) return;
        if (selectedChainLogoURI != null && !selectedChainLogoURI.isEmpty()) {
            final String uri = selectedChainLogoURI;
            new Thread(() -> {
                try {
                    java.net.URL url = new java.net.URL(uri);
                    java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(4000);
                    conn.setReadTimeout(4000);
                    conn.connect();
                    android.graphics.Bitmap bmp = null;
                    try {
                        bmp = android.graphics.BitmapFactory.decodeStream(conn.getInputStream());
                    } finally {
                        conn.disconnect();
                    }
                    if (bmp != null) {
                        int size = Math.min(bmp.getWidth(), bmp.getHeight());
                        android.graphics.Bitmap output = android.graphics.Bitmap.createBitmap(size, size, android.graphics.Bitmap.Config.ARGB_8888);
                        android.graphics.Canvas canvas = new android.graphics.Canvas(output);
                        android.graphics.Paint paint = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
                        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
                        paint.setXfermode(new android.graphics.PorterDuffXfermode(android.graphics.PorterDuff.Mode.SRC_IN));
                        canvas.drawBitmap(bmp, 0, 0, paint);
                        final android.graphics.Bitmap finalBmp = output;
                        runOnUiThread(() -> {
                            ivChainLogo.setImageBitmap(finalBmp);
                            ivChainLogo.setVisibility(android.view.View.VISIBLE);
                        });
                    }
                } catch (Exception ignored) {}
            }).start();
        }
    }

    /**
     * Shows a beautiful bottom-sheet chain picker modal injected into the active dApp WebView.
     * Fetches chain list from main wallet JS (getBrowserChainListJson) and renders using
     * the same hcp-chain-item style as index.html — no AlertDialog.
     */
    private void showChainPicker() {
        WebView mv = MainActivity.getMainWebView();
        if (mv == null) { Toast.makeText(this, "Wallet not ready", Toast.LENGTH_SHORT).show(); return; }
        final String currentChainId = selectedChainId != null ? selectedChainId : "0x1";
        mv.post(() -> mv.evaluateJavascript(
            "(function(){ try { return getBrowserChainListJson(); } catch(e){ return '[]'; } })()",
            result -> {
                String json = result;
                if (json != null && json.startsWith("\"") && json.endsWith("\""))
                    json = json.substring(1, json.length()-1).replace("\\\"","\"").replace("\\\\","\\");
                if (json == null || json.equals("null") || json.isEmpty()) json = "[]";
                final String chainsJson = json;
                runOnUiThread(() -> showNativeChainPicker(chainsJson, currentChainId));
            }));
    }

    /** Safely parse hex chainId string (e.g. "0x82750") to long — avoids int overflow for large IDs */
    private static long parseHexChainId(String hex) {
        if (hex == null || hex.isEmpty()) return 1L;
        try {
            String clean = hex.startsWith("0x") || hex.startsWith("0X")
                ? hex.substring(2) : hex;
            if (clean.isEmpty()) return 1L;
            return Long.parseLong(clean, 16);
        } catch (NumberFormatException e) { return 1L; }
    }

    private void showNativeChainPicker(String chainsJson, String currentChainId) {
        // Set sheet height to ~72% of screen
        int screenH = getResources().getDisplayMetrics().heightPixels;
        android.view.ViewGroup.LayoutParams lp = nativeChainPickerSheet.getLayoutParams();
        lp.height = (int)(screenH * 0.72f);
        nativeChainPickerSheet.setLayoutParams(lp);
        allChainsList.clear();
        try {
            org.json.JSONArray arr = new org.json.JSONArray(chainsJson);
            for (int i = 0; i < arr.length(); i++) {
                org.json.JSONObject c = arr.getJSONObject(i);
                java.util.Map<String,String> m = new java.util.HashMap<>();
                String hex = c.optString("hex","");
                if (hex.isEmpty()) hex = "0x" + Integer.toHexString(c.optInt("chainId",1));
                m.put("hex", hex);
                m.put("name", c.optString("name", hex));
                m.put("emoji", c.optString("emoji","🔗"));
                m.put("color", c.optString("color","#6366f1"));
                m.put("logoURI", c.optString("logoURI",""));
                m.put("chainId", String.valueOf(c.optLong("chainId", parseHexChainId(hex))));
                m.put("selected", hex.equalsIgnoreCase(currentChainId) ? "1" : "0");
                allChainsList.add(m);
            }
        } catch (Exception ignored) {}
        etNativeChainSearch.setText("");
        nativeChainAdapter.setData(new java.util.ArrayList<>(allChainsList));
        nativeChainPickerOverlay.setVisibility(View.VISIBLE);
        // Animate sheet up
        int sheetH = nativeChainPickerSheet.getHeight() > 0
            ? nativeChainPickerSheet.getHeight()
            : (int)(getResources().getDisplayMetrics().heightPixels * 0.72f);
        nativeChainPickerSheet.setTranslationY(sheetH);
        nativeChainPickerSheet.animate().translationY(0).setDuration(300)
            .setInterpolator(new android.view.animation.DecelerateInterpolator(2f)).start();
    }

    private void hideNativeChainPicker() {
        int sheetH2 = nativeChainPickerSheet.getHeight() > 0
            ? nativeChainPickerSheet.getHeight()
            : (int)(getResources().getDisplayMetrics().heightPixels * 0.72f);
        nativeChainPickerSheet.animate().translationY(sheetH2)
            .setDuration(250).setInterpolator(new android.view.animation.AccelerateInterpolator())
            .withEndAction(() -> nativeChainPickerOverlay.setVisibility(View.GONE)).start();
        etNativeChainSearch.setText("");
        hideKeyboard();
    }

    private void filterNativeChains(String query) {
        if (query.isEmpty()) { nativeChainAdapter.setData(new java.util.ArrayList<>(allChainsList)); return; }
        java.util.List<java.util.Map<String,String>> filtered = new java.util.ArrayList<>();
        for (java.util.Map<String,String> m : allChainsList) {
            String name = (m.get("name") != null ? m.get("name") : "").toLowerCase();
            String cid  = (m.get("chainId") != null ? m.get("chainId") : "");
            if (name.contains(query) || cid.contains(query)) filtered.add(m);
        }
        nativeChainAdapter.setData(filtered);
    }

    private void saveSelectedWallet(String address) {
        selectedWalletAddress = address;
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .edit().putString(KEY_SELECTED_WALLET, address != null ? address : "").apply();
    }

    private void loadSelectedWallet() {
        String saved = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .getString(KEY_SELECTED_WALLET, "");
        selectedWalletAddress = (saved != null && !saved.isEmpty()) ? saved : null;
    }

    // ══════════════════════════════════════════════════════════════
    // Web3 JS provider string (identical to original)
    // ══════════════════════════════════════════════════════════════
    // ── FIX: separate full-inject vs re-announce-only strings ───
    // FULL inject: used only in onPageFinished (once per page load)
    private static final String WEB3_PROVIDER_JS =
        "(function() {\n" +
        "  // Install only in the document this token was made for (it may have navigated meanwhile)\n" +
        "  if (String(window.location.origin) !== __ONE_ORIGIN__) return;\n" +
        "  var _bridgeToken = '__ONE_BRIDGE_TOKEN__';\n" +
        "  // Guard: if already injected this page, skip full re-init to preserve listeners\n" +
        "  if (window._oneWeb3Injected) {\n" +
        "    // Re-announce to catch any dApp that fires eip6963:requestProvider late\n" +
        "    if (window.ethereum && window.ethereum._oneAnnounce) window.ethereum._oneAnnounce();\n" +
        "    return;\n" +
        "  }\n" +
        "  window._oneWeb3Injected = true;\n" +
        "  window._oneW3Pending = window._oneW3Pending || {};\n" +
        "  window._oneAccountsIntercepted = false;\n" +
        "  window._oneW3Resolve = function(reqId, resultJson) {\n" +
        "    var p = window._oneW3Pending[reqId];\n" +
        "    if (!p) return;\n" +
        "    delete window._oneW3Pending[reqId];\n" +
        "    try { p.resolve(JSON.parse(resultJson)); } catch(e) { p.resolve(resultJson); }\n" +
        "  };\n" +
        "  window._oneW3Reject = function(reqId, msg) {\n" +
        "    var p = window._oneW3Pending[reqId];\n" +
        "    if (!p) return;\n" +
        "    delete window._oneW3Pending[reqId];\n" +
        "    p.reject(new Error(msg || 'User rejected'));\n" +
        "  };\n" +
        "  var _listeners = {};\n" +
        "  function _emit(event, data) {\n" +
        "    var cbs = _listeners[event] || [];\n" +
        "    cbs.forEach(function(cb){ try{ cb(data); }catch(e){} });\n" +
        "  }\n" +
        "  var _accounts = [];\n" +
        "  var _chainId = '__ONE_CHAIN_ID__';\n" +
        "  var _connected = false;\n" +
        "  function _request(method, params) {\n" +
        "    return new Promise(function(resolve, reject) {\n" +
        "      var id = (window._oneW3ReqCounter = (window._oneW3ReqCounter||0)+1);\n" +
        "      window._oneW3Pending[id] = {resolve: resolve, reject: reject};\n" +
        "      try {\n" +
        "        window.OneWeb3Bridge.handleRequest(_bridgeToken, id, method, JSON.stringify(params || []));\n" +
        "      } catch(e) {\n" +
        "        delete window._oneW3Pending[id];\n" +
        "        reject(new Error('OneWeb3Bridge not available'));\n" +
        "      }\n" +
        "    });\n" +
        "  }\n" +
        "  var provider = {\n" +
        "    isMetaMask: true, isOneWallet: true, _isConnected: false,\n" +
        "    _accounts: _accounts,\n" +
        "    get selectedAddress() { return _accounts.length > 0 ? _accounts[0] : null; },\n" +
        "    get chainId() { return _chainId; },\n" +
        "    get networkVersion() { return parseInt(_chainId, 16).toString(); },\n" +
        "    request: function(args) {\n" +
        "      var method = args.method; var params = args.params || [];\n" +
        "      if (method === 'eth_accounts') return Promise.resolve(_accounts.slice());\n" +
        "      if (method === 'eth_chainId') return Promise.resolve(_chainId);\n" +
        "      if (method === 'net_version') return Promise.resolve(parseInt(_chainId, 16).toString());\n" +
        "      if (method === 'eth_requestAccounts') {\n" +
        "        if (_connected && _accounts.length > 0) return Promise.resolve(_accounts.slice());\n" +
        "        return _request(method, params);\n" +
        "      }\n" +
        "      return _request(method, params);\n" +
        "    },\n" +
        "    send: function(m, p) {\n" +
        "      if (typeof m === 'string') return provider.request({method:m,params:p||[]});\n" +
        "      var pl=m, cb=p;\n" +
        "      provider.request({method:pl.method,params:pl.params||[]})\n" +
        "        .then(function(r){cb(null,{id:pl.id,jsonrpc:'2.0',result:r});})\n" +
        "        .catch(function(e){cb(e,null);});\n" +
        "    },\n" +
        "    sendAsync: function(pl, cb) {\n" +
        "      provider.request({method:pl.method,params:pl.params||[]})\n" +
        "        .then(function(r){cb(null,{id:pl.id,jsonrpc:'2.0',result:r});})\n" +
        "        .catch(function(e){cb(e,null);});\n" +
        "    },\n" +
        "    on: function(e,cb){ if(!_listeners[e])_listeners[e]=[]; _listeners[e].push(cb); return provider; },\n" +
        "    removeListener: function(e,cb){ if(_listeners[e]) _listeners[e]=_listeners[e].filter(function(c){return c!==cb;}); return provider; },\n" +
        "    off: function(e,cb){ return provider.removeListener(e,cb); },\n" +
        "    isConnected: function(){ return _connected; },\n" +
        "    enable: function(){ return provider.request({method:'eth_requestAccounts'}); },\n" +
        "    _updateState: function(accounts, chainId) {\n" +
        "      var prevA=_accounts.slice(), prevC=_chainId;\n" +
        "      _accounts.length=0; (accounts||[]).forEach(function(a){_accounts.push(a);}); provider._accounts=_accounts;\n" +
        "      _chainId = chainId||'0x1'; _connected = _accounts.length>0; provider._isConnected=_connected;\n" +
        "      if(window.web3&&window.web3.eth) window.web3.eth.accounts=_accounts;\n" +
        "      if(prevC!==_chainId) _emit('chainChanged',_chainId);\n" +
        "      if(JSON.stringify(prevA)!==JSON.stringify(_accounts)) _emit('accountsChanged',_accounts);\n" +
        "      if(_connected && prevA.length===0) _emit('connect',{chainId:_chainId});\n" +
        "    }\n" +
        "  };\n" +
        "  window.ethereum = provider;\n" +
        "  function _announce() {\n" +
        "    try {\n" +
        "      window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{\n" +
        "        detail: Object.freeze({info: Object.freeze({uuid:'one-wallet-android',name:'One Wallet',rdns:'com.one.wallet',icon:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAMAAADVRocKAAADAFBMVEXy3GAEZKMULJ4Mmc7b2aSZoJoAGWOkayEBJl1Sm9+g06AuZtNb29/YnSpSbtNXr3vZsV/43hsdb2IDYY8NkZpen5hb05oBDCwAJ1YAJ5wFYZxoVydy1nyqjF6n1evUfhrz7tcAEzAAKDgBL8cAf/8WnGkAtLQPi7Y91+FMNkpSenihdlC9mRmjrugIMmkAf38AQHcDQHMAf78Ega4UmMI7wIFJLSoBBi4AC00AFHAAGI33+P0AJ68AAADN2fvl6foANtABJJTZ4/wAARkAG6mvx/sDElgCR+sBNbMAC2cBR9AJVvP6twcHZ/AAKcr5qAUTFSsHd/WUtvv+xQsBV9EBZMm40v0BOer6mQP6xy771jCQ6JCKqvgsJiqs9Jqku/kHhvgOJGwnKUvvuC1x14cJlvk4MygPpvqMl8kzKRszNk9zd4sCRLtINxqYos7SlhFJOCkJpnBaRRhURSak7ZbFxs+1us4qN3RxWClzmvp6o/uwhBT/5S0Vt/x0iMfYpyz+1RICdMomp/yNZhaTl6ynqLK2+aP910sPeWZ5Zit0hrUACY4jGygwRnFMVXBrerCUeCjJhxAARUwEY1szSIs2tnkotvlJSFXU09XK/qzwiQT3yEsWFRwKh2kImWoilv0vxPzEy+4DVlYA//8uV49MWIpOx4Nmd8uJWxWHaCWbw/7XtCoAK+cDa2E9QVdVZpVVdKRry4aV8pGsiCT76JIaJEcBJI0CO0UQNpQ1lW9VZbV3mM9txvaseBS3lCkAAQsAAH8AAKoAAP8AFnMQx/4jLGw8MRsse/41iPxJTWxQZ9JSl/JUpPpSxnpQyv9nZ3p0i+t14oqkqMqxtLnWpw/s5tIADUgAVf8CZKwpiGpPW61R2vdkSRtzpZGGluWM5P7nt0/v15EAAFUAFE4BHcAAKq8ALrkCNDoCN2sAP78DUpEAVaoAqv8zR6w3WKgpavcieVwqqHU7wH5ETJFdYHNLeuVRgrpNu3toSid1VRhkaZFx5u6UcxWfgCqIiJGPoaKPii+cAAABAHRSTlP/7uzq//+h/1r/////////////aP///04dl6T///////8e/9QC/wOj/////////wJrjwR+uP////7+/v/+Af///v7///7///7+/v7///7+///+///+/v/+///////////+//////7//v/////8///////////////////////////7////////////////////////////////////////////Af///////////////////////3H//////////yoCAwHL////////////////////////dAPO////////////A2v8sMT/dwSqAwP/////////////////////////Ad9HugAAEBpJREFUeNqlmgV8W1eWh2XHYWrKUx7m5d0Hkp5kkf0ElmQ5liVZtmzJnJgpMSZOzDHGDTjchpkaTqaQJg3jbGkK05nSTrmd8nTOvQ8Fzm5nz8+Snp7k/3cP3HPvk6RQS3Yv3E5Nevf5uNkLsM2ObWlpcEMPyMJfev7dt0+ByL/JRBXi0R/hNilugdNps1ksSbyZkWlllsyZCluiYCoVOmk2p9mcC57/FxD6n2jAf6vVb8cFnBZeV6uNkFVJJsjSYBQ2mhZBac68cXeo1X+JBDymvuf5gE0Y9y3UpWEL8uzhHBGBPDE7C8ZNAsEID/51gS3JjeVl0qoIixIH+brvEqbkIC8EwBxzWl7BfWr178IA7waStOGDT44pTUtxQeps3R/a27NWlLByAqTN2fRztfqfRcBj6jinOzwsY4hTcuPlq7Pap+Dn+E2cC2m2pnHqx57iAX9R3+eMLS8bNS2I5uSQ+Igkl/whC8wHtxUbWQGhQgBM+A+cBwUqqQly/bCBy7UplqTqdh87fnxyDmlC8r59WdW+TRWb2qvbx5MkScUfpjkXEGC285mfo1pSgP4kmzslUj6m+p7Jxy+ta2paNw7k7/Lt8/lCI2vWVFTszcpq7+sbP2VFQo7gAgBsgaY71D8DwE/Uc5JStJiQIpMPyyYMbymoT15YUFDwaFPTM3Ev3H31amhTxeo1FaFQRcXHvvb2FStWZK1YSkku2Gx5kAa14h3125YUZPKkRqn/df6FC2sDeWsXLlyIAOPW/OfnH63uXP1RCDIwpWJNxcchn68aVZOU5tk2Z9O/q38GOQAHouXFwJA5j//1woWzTqfz7Nq1GPBoU0FT5/DOnatHQvsgx76s6r0/rQDblLXiOzYHE3hAXsEPIUSTLGHy8orB6ufPn7HZbM4zgQD2oCAP+knenYc6R0JXL86cudeXBUOv9kG8RrhyFQk2p7PgDgDEJ8WUx+qTz5/9wGKxIIDTGVi7FsShE8KJcZ0jd2/qHO7cMLw6lFVdDZXa/nGFLyvhNEXlyAHj1IpTc7Qx9JH61MlnbJYkTh8BUJtNQs/B8u5cM7JzQ+eUmUd27twLPgBjU0Uoa0UfybvAxSiQd6/iDbMYILEsWVA/ewY1Vk4OEaQWDieTnHf+dPXQ8N7Q3hDkwgcJrs4KrdmU1V5CSi4gQMEdigluQ4Q8xb4/+QwvZ+EQSUlut1tcH8CS8jo3DHXue2HD8HDn8Of7EMJXMVKdNZ40IRdU2AUUo/sU8VqDygAm6ZPvn0XKSZZzixSKGaCtjTBzmsWWFzc0tGGvLxQ6Mjx8xIftozW+rCkmU1iM8uIUiSmGcH3K9Bka9Izxt3V4vJ4H8RxJkcnDilIQcAbGDR0a2vDhkZm+zg0v+EIIMLI6tK86l8SFJKQ5bwEPkOmTOR/A+LsbvUFPsCU4KjQ+nCmtGSUuL6/AZgsMvXVoQ+fQh1dvH3ohBHbVd3H1576sPilGsIDaAjyAlgAm0oSC3h1saRkdbfEEnzOIRabF2UYVFbCl2eLeOjQ8MnLxw6FDRy5efAAxbl/j2/crUowRdiEMwOsTyZCAqdM9LS3B6dPtv+ZeUyWbUfUISTartHPe+tGPDt1+5PZf3XX3tGm/eOnrr6fddWfogZkIQEUC5AkgCRMA3O4HB/dPLDsxOPhLOE+rILNcL0TxVCXPmXp087HxDy1nNEpsulcXBtYuvDTtF3c/YOJcEDrebADQ8rZMkt2bKdDf8clgw8St9bkmtJ7zPiYefu/F/ubSWkFWbrrz4KCt4JlpB2VJMGOAKhxwjckhkt3QnpaVw6pCkixLJcZ/crS7sHZ9DF2ZnTenmc2BZ+IQgOZdMMsAvP4nyniWIHfE9/SwVE7dxv5F12qYMYQ1So2O/9Oh51O1sJ0KNP0TV6icC5a0SECh8kXWlDtjc+G1mlsPGAGkQ0RIVSVDqgriRAAALTDRDPLVhbwG776FskbHGH/7ypXodwBBd5iGKnCO42OECdGAUg02Hb6PFJkRn4zKKF4bI8lAWMrC3tGSZyJFgNY8hwdQEoBhdJx8JKFU1YOLVPWnc7Hde5ylE2lzAAGAoMIuRABMZKlSDpARmBd7cL0CwbA5hjrygISSNjt5QKIcIOhzgCgC3BfSPWggHOAVdOZmQph+OgZQlNZpEpKACHMUdEyAnAB/65eyFFdsGPBbXEGvdyC2YDqNcgkB88ZgycHdAsUIyipZDjAJALkLCNHN4s2tQDCsR3NAqfEolLK3aXSPH1zy+J5j23R7hBiJAEoG0DDhBKWyto7krzIEFxhOuMPFK+seevXVr6e9tG7dukuXjh+/9CglAFRhAJAXASJBqfmK5DsGT6ANyRoO4MUA5tWX1sFeBvYbaOFG6/A6tD2m6WgAGQbgCc+RdUs2ftVfuFQivIf1dQkuD0T+oZcW2mTbARHAJSEFAShKDtAx4YT1Oq6Slopp6DmqRGHRuKwKnWbbOqc7KUlGAMCjOWISVCqFNMkwoFAACAQ+j0wOK+Shp1mJXvNYrct1xgKk7/7gs6lu0YU8HkCPATBKAFmxrmfFRPcUKhndTdC/TcdcAH13Uu0BxYFSnjA2wITbPwCMTDRCeY0ULljpnlql5oDL6goymvVOC2yYris6OjoU3RxBBqDDACYewBjDCRihU/YLgB42kXlk1Gp1WWs0mmykb1aMdnSMehRavDmDJHAAKiaAwAA54aYGUZQbSQpVKssmFmpet4LZQV+T6nZrd7znAQt6pmthh+aGGAUWCgA6HEBKAInw+nLOjTo0/1k2vlBzwIP0W2qRZ5loR6bKCE63260T8e4MYhQo4JvFrQA8QTfK6zP41aWlIG9H+rcZceSMyWjb98sMu93+8GluAwhJkAAGOYDkAOlGGcEDhYIBtVBhu43KA1Y70rePN3I9gnmf1qak0LlbJk6kDDzA4swzxQBw+giQzRPSGWbUzqBpoWM03acX6R5RgDwCPFjI8E2IeYVCe0qaZXsMKryHdYMHccStAMbUbB6RrrC/JuSauQmx4eQbLqfq+CVVwxiPkgb++oK/kkxMNEHX5gF0NKDZmCoQEuz2IFeqN18ftXNmHawiFim56gWMjsl+kSRpbl/Gom0hQbBELIBJDgAEAgQhd68lJCSMBu2CDVaCQg0uXM6Y9dmb69D/QpXXmfTwKqUiJYAUIl5fACBCQoZoII1ug3NBgDAxOl0YIfPK5qPnzp2bcSUHAWit6RYAgmhOzeQI217LyJAjMk5geZLM1enEWY4PjdmZmZmvXMnMPI2WTFUS0qIiAHyECAzIxIhtt8n1V27pJbCRxBKNrJHgAwhnNpixDgCsysID6DAAGQbAiPErM1auXInkV04sJwQjiY1iQ5dsPZM9j0kHAEXJAYYIABLoTp0/XyA8DICVD/+6ZPNnhAxQokuPJkCcmPTTBNq2mIlbAnanzpuPEUCY19y/ufnK/NT0WkmfJMbrjOnpUYxsI2PEe8akw7IcxwDkps6bN48nbNuG55uR6dZLLhClDAKEE3RMJqMrhAjRkOOwIuIAkj5B9CPCPN4Hfkr3O3Ilq0XdSk5A0w1al64OIkS7DxNhRaRSUBEAonv+PN4JccoJhkbONcNszjcjkobjTNDvJ0iWdicTYYCUGACirxnJ49nARynCwDFwLhth0jEAedEMk9igVWF9WZXGAuiJg3VLlmzcvae/+1hhaSbvRLrc+Gc4+ng+QNNjQY/CdYBTMGYOMEIygnA4HAdzi4uXLOnbuHv37j17+vu7m5uPAbq0FEURZlhm4UYTmgIkX2gSAFVR2DSLYfqxTf4eQnhORgNMplvoj2kxSZx+JID8hwBjGBcMSt6LqIgA6f//+iaTRAgDHCxZXLu4JHcsxNzKSgd+QI3bUVnp58872r7xOwYGHCKAFC9YwgFf8dd8JWMAvnG5QHqV1WWHJ234CTa/q/Xl/EZvvqhf3FUvFqoAgPeVgHbN4hq4vwvlkLtx+eQ9cLnuJ4hKl9VaRBC/cd0QwH6rtyrf6xEAJnLrLDt/wSIHFMMV3TIoiWXgR66j71PHrpKSg+j/nyspKeZCYW1tIIgG2Pd+yR07qrq6YKnwewRAfldXFUmWN7hu3F/MUhEhWqRU9qGh6i9DkICGXNEU63PRo3IRJpz0Bgki6PF4T+rner2VRdu9jY2t+yXAgLdxVmuL6Uar1TXrW+yC3IMa5XI+ZxrlYgAoa0F6sb5GqSkBdglid3k9/nxvcAA4cOj4trGlq8HVWungAP76VtfAVmvrQP0Nl7VhWRSAUfLriuMRDPibHsRrdimVxXr935Q16JX8jo6qLsVJv7fDf7LxpJ54tki/6kZr2yqA5Htc+WWtbQRR5bIS9a1lJFdHcsBy3gN9LojDDfKxSFlbgq+1wR9UhI7XOgamK7r02zsGWrxb9UX7rS5ISBvUVeWzLmsV3tXbXS5/vauM+zwhDABxuIxzsBjEwYPnBMD169cXL/4OAYj93mDQk6//1guJyNdbW+0nvrGLgEq7tayhoeFEgwMAJCmGiJaqSFnidxSD/nJ9seDBMnzgL+YqtR6UW/T6KvSZKlQtlKu+jAMUQe3CISpagtxizTCxAuBpWj4PcDQ0ufpdPKCGQJkG5qeY4IcrmQG93gF+TNSD5okvy6zWLavsVgDYe1+2WgcnZrjayC+s9rJ6DFDFKyaIAKJvOZ7Ii/0EAuAQLdc7atG561xb0EOE58JcKXO5KvX6NkhBWZlLAPiJLejiYdBPOgbt1q0YkPIDxRs0KzW7XZcv9+FW5NhVDEHP3VUMva/4075ioT0VzX0W9eeiuUX44eW5cLiKKCpyOJ5FQ+gtryrH07m83IQB2icUp6ReIW8L3CO+l3f8sZac6I6Ky9SgvVeh5pPwv68HDoffn59fXl5VlZ+f73c4xujspAiACL2pVqh/H7UiRJq/vH5gf1lL0OP1Qm9onKVQNDZ6vZ7tv9m/9f58R0x5fp5pn0BfNVK0cDZ60OVfniiDVCKzBrdvb9m+ffssxOEMaF5PcH9XuSNCntdXadVqxe+QC2wMQm9522BZRllDW31VuR8iwlmvv2guWFGRH8Wrqr5r4GQLXPWX1fsldfHTJXDgHYX6KXCBZckwLxz+L7a0bXm5vDc6DwjS2+uQR8bhr9raUNZQ7w8fP52iUv8EQvRH9T20nEASvf9VXu53jJlqziJTS/i/2FrvN/HLJV4LtJPUT6IcPKmeYKDEKJGOXsc/ttTDWpabaxI/VjK4f4B+iYC+sI4gfI8dDBlllKT/Z6TPfeX+lPppAxWGIL+/NB97iv9s0v2m9JU7sgkGGn//EWFjasXUFgZvMKTA+LmfJYg/e5jAfclIfn+jBHFh8IY/7YD4R/zs4Sn1PU+DE2wsN26hLZn0uTDI/zjGDzeeVMOMw5+h/h+9MLGx1CE4bphfOL8xfjzz+6cjvmyPJRz22wpa0lalpOzY4da++QQ33CgAF7RTb0yIp6OM15JLCsLSRznaFO2P//zED0HkHZno3wHefqLIm7zrQQAAAABJRU5ErkJggg=='}), provider: provider})\n" +
        "      }));\n" +
        "    } catch(_){}\n" +
        "  }\n" +
        "  provider._oneAnnounce = _announce;\n" +
        "  window.addEventListener('eip6963:requestProvider', _announce);\n" +
        "  if (!window.web3) window.web3={currentProvider:provider,eth:{accounts:_accounts}};\n" +
        "  console.log('[OneWallet] window.ethereum injected (EIP-1193 + EIP-6963)');\n" +
        "  // Announce after a microtask so dApp listeners are attached first\n" +
        "  Promise.resolve().then(_announce);\n" +
        "})();\n";

    // ══════════════════════════════════════════════════════════════
    // onCreate
    // ══════════════════════════════════════════════════════════════
    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_inapp_browser);

        String intentUrl = getIntent().getStringExtra(EXTRA_URL); // may be null on restore

        // Bind views
        webViewContainer  = findViewById(R.id.webViewContainer);
        progressBar       = findViewById(R.id.inAppProgress);
        tvUrl             = findViewById(R.id.inAppUrl);
        btnBack           = findViewById(R.id.btnBack);
        btnForward        = findViewById(R.id.btnForward);
        btnClose          = findViewById(R.id.btnClose);
        btnNewTab         = findViewById(R.id.btnNewTab);
        btnWallet         = findViewById(R.id.btnWallet);
        btnMenu           = findViewById(R.id.btnMenu);
        btnCloseToProfile = findViewById(R.id.btnCloseToProfile);
        ivLock            = findViewById(R.id.ivLock);
        tvTabCount        = findViewById(R.id.tvTabCount);
        btnTabSwitcher    = findViewById(R.id.btnTabSwitcher);
        tabSwitcherOverlay = findViewById(R.id.tabSwitcherOverlay);
        rvTabs            = findViewById(R.id.rvTabs);
        searchOverlay     = findViewById(R.id.searchOverlay);
        etSearch          = findViewById(R.id.etSearch);
        btnSearchGo       = findViewById(R.id.btnSearchGo);
        btnSearchPaste    = findViewById(R.id.btnSearchPaste);
        btnSearchCancel   = findViewById(R.id.btnSearchCancel);
        searchDismissArea = findViewById(R.id.searchDismissArea);

        // History overlay
        historyOverlay = findViewById(R.id.historyOverlay);
        rvHistory      = findViewById(R.id.rvHistory);
        historyAdapter = new HistoryAdapter();
        rvHistory.setLayoutManager(new LinearLayoutManager(this));
        rvHistory.setAdapter(historyAdapter);
        ImageButton btnCloseHistory = findViewById(R.id.btnCloseHistory);
        btnChainSelector  = findViewById(R.id.btnChainSelector);
        ivChainLogo       = findViewById(R.id.ivChainLogo);

        // Native chain picker
        nativeChainPickerOverlay = findViewById(R.id.nativeChainPickerOverlay);
        nativeChainPickerSheet   = findViewById(R.id.nativeChainPickerSheet);
        rvNativeChains           = findViewById(R.id.rvNativeChains);
        etNativeChainSearch      = findViewById(R.id.etNativeChainSearch);
        nativeChainAdapter       = new NativeChainAdapter();
        rvNativeChains.setLayoutManager(new LinearLayoutManager(this));
        rvNativeChains.setAdapter(nativeChainAdapter);
        findViewById(R.id.btnNativeChainPickerClose).setOnClickListener(v -> hideNativeChainPicker());
        nativeChainPickerOverlay.setOnClickListener(v -> hideNativeChainPicker());
        nativeChainPickerSheet.setOnClickListener(v -> {}); // consume clicks so overlay dismiss doesn't fire
        // Swipe-down to dismiss chain picker sheet
        nativeChainPickerSheet.setOnTouchListener(new android.view.View.OnTouchListener() {
            private float startY;
            private float startTY;
            @Override
            public boolean onTouch(android.view.View v, android.view.MotionEvent e) {
                switch (e.getActionMasked()) {
                    case android.view.MotionEvent.ACTION_DOWN:
                        startY  = e.getRawY();
                        startTY = nativeChainPickerSheet.getTranslationY();
                        return true;
                    case android.view.MotionEvent.ACTION_MOVE:
                        float dy = e.getRawY() - startY;
                        if (dy > 0) nativeChainPickerSheet.setTranslationY(startTY + dy);
                        return true;
                    case android.view.MotionEvent.ACTION_UP:
                    case android.view.MotionEvent.ACTION_CANCEL:
                        float moved = nativeChainPickerSheet.getTranslationY();
                        float threshold = nativeChainPickerSheet.getHeight() * 0.35f;
                        if (moved > threshold) {
                            hideNativeChainPicker();
                        } else {
                            nativeChainPickerSheet.animate().translationY(0)
                                .setDuration(200)
                                .setInterpolator(new android.view.animation.DecelerateInterpolator()).start();
                        }
                        return true;
                }
                return false;
            }
        });
        etNativeChainSearch.addTextChangedListener(new android.text.TextWatcher() {
            public void beforeTextChanged(CharSequence s, int st, int c, int a) {}
            public void onTextChanged(CharSequence s, int st, int b, int c) {
                filterNativeChains(s.toString().trim().toLowerCase());
            }
            public void afterTextChanged(android.text.Editable s) {}
        });

        // Native wallet drawer
        nativeWalletDrawerOverlay  = findViewById(R.id.nativeWalletDrawerOverlay);
        nativeWalletDrawer         = findViewById(R.id.nativeWalletDrawer);
        rvNativeWalletGroups       = findViewById(R.id.rvNativeWalletGroups);
        tvNativeWalletActive       = findViewById(R.id.tvNativeWalletActive);
        tvNativeWalletGroupCount   = findViewById(R.id.tvNativeWalletGroupCount);
        nativeWalletGroupAdapter   = new NativeWalletGroupAdapter();
        rvNativeWalletGroups.setLayoutManager(new LinearLayoutManager(this));
        rvNativeWalletGroups.setNestedScrollingEnabled(false);
        rvNativeWalletGroups.setAdapter(nativeWalletGroupAdapter);
        findViewById(R.id.btnNativeWalletDrawerClose).setOnClickListener(v -> hideNativeWalletDrawer());
        nativeWalletDrawer.setOnClickListener(v -> {}); // consume
        // Set drawer width to 50% of screen
        nativeWalletDrawer.post(() -> {
            int halfWidth = getResources().getDisplayMetrics().widthPixels / 2;
            android.view.ViewGroup.LayoutParams lp = nativeWalletDrawer.getLayoutParams();
            lp.width = halfWidth;
            nativeWalletDrawer.setLayoutParams(lp);
            nativeWalletDrawer.setTranslationX(halfWidth);
        });
        // Full-screen swipe-right to dismiss: overlay intercepts touch everywhere
        nativeWalletDrawerOverlay.setOnTouchListener(new android.view.View.OnTouchListener() {
            private float startX;
            private float startTX;
            private boolean dragging = false;
            @Override
            public boolean onTouch(android.view.View v, android.view.MotionEvent e) {
                switch (e.getActionMasked()) {
                    case android.view.MotionEvent.ACTION_DOWN:
                        startX   = e.getRawX();
                        startTX  = nativeWalletDrawer.getTranslationX();
                        dragging = false;
                        // let drawer child views receive this touch too
                        nativeWalletDrawer.dispatchTouchEvent(e);
                        return true;
                    case android.view.MotionEvent.ACTION_MOVE:
                        float dx = e.getRawX() - startX;
                        if (!dragging && dx > 12) dragging = true;  // 12px slop
                        if (dragging) {
                            float newTX = startTX + dx;
                            if (newTX > 0) nativeWalletDrawer.setTranslationX(newTX);
                        } else {
                            nativeWalletDrawer.dispatchTouchEvent(e);
                        }
                        return true;
                    case android.view.MotionEvent.ACTION_UP:
                    case android.view.MotionEvent.ACTION_CANCEL:
                        if (dragging) {
                            float moved = nativeWalletDrawer.getTranslationX();
                            float threshold = nativeWalletDrawer.getWidth() * 0.35f;
                            if (moved > threshold) {
                                hideNativeWalletDrawer();
                            } else {
                                nativeWalletDrawer.animate().translationX(0)
                                    .setDuration(200)
                                    .setInterpolator(new android.view.animation.DecelerateInterpolator()).start();
                            }
                        } else {
                            // Not a drag — forward to child (handles taps inside drawer)
                            // or dismiss if tap was outside drawer (on dim area)
                            int[] loc = new int[2];
                            nativeWalletDrawer.getLocationOnScreen(loc);
                            float tx = e.getRawX();
                            if (tx < loc[0] || tx > loc[0] + nativeWalletDrawer.getWidth()) {
                                hideNativeWalletDrawer();
                            } else {
                                nativeWalletDrawer.dispatchTouchEvent(e);
                            }
                        }
                        return true;
                }
                return false;
            }
        });

        btnCloseHistory.setOnClickListener(v -> hideHistoryPanel());
        TextView btnClearHistory = findViewById(R.id.btnClearHistory);
        btnClearHistory.setOnClickListener(v -> {
            clearHistory();
            historyAdapter.refresh();
            Toast.makeText(this, "History cleared", Toast.LENGTH_SHORT).show();
        });

        // Setup tab RecyclerView
        tabAdapter = new TabAdapter();
        rvTabs.setLayoutManager(new LinearLayoutManager(this));
        rvTabs.setAdapter(tabAdapter);

        // Tab switcher close btn
        ImageButton btnCloseTabSwitcher = findViewById(R.id.btnCloseTabSwitcher);
        btnCloseTabSwitcher.setOnClickListener(v -> hideTabSwitcher());

        TextView btnAddTabFromSwitcher = findViewById(R.id.btnAddTabFromSwitcher);
        btnAddTabFromSwitcher.setOnClickListener(v -> {
            hideTabSwitcher();
            openNewTab("about:blank");
            openSearchOverlayFresh();
        });

        // Restore saved tabs, or open intentUrl as first tab
        loadSelectedWallet();
        loadSelectedChain();
        updateChainButton();
        btnChainSelector.setOnClickListener(v -> showChainPicker());
        boolean restored = restoreTabs();
        if (!restored) {
            if (intentUrl == null || intentUrl.isEmpty()) { finish(); return; }
            openNewTab(intentUrl);
        } else if (intentUrl != null && !intentUrl.isEmpty() && !intentUrl.equals("about:blank")) {
            openNewTab(intentUrl);
        }

        // EXTRA_SHOW_TABS: show tab switcher on launch (from profile Tab button)
        boolean showTabs = getIntent().getBooleanExtra(EXTRA_SHOW_TABS, false);
        // EXTRA_OPEN_SEARCH: show search overlay on launch (from in-browser New Tab button)
        boolean openSearch = getIntent().getBooleanExtra(EXTRA_OPEN_SEARCH, false);
        if (showTabs) {
            pendingShowTabs = true; // onWindowFocusChanged will handle it
        } else if (openSearch) {
            webViewContainer.post(this::openSearchOverlayFresh);
        }

        // Toolbar buttons
        btnBack.setOnClickListener(v -> {
            WebView wv = activeWebView();
            if (wv != null && wv.canGoBack()) wv.goBack();
        });
        btnForward.setOnClickListener(v -> {
            WebView wv = activeWebView();
            if (wv != null && wv.canGoForward()) wv.goForward();
        });
        btnClose.setOnClickListener(v -> returnToMain()); // X = return to wallet without destroying
        // Close icon left of URL pill — close browser, keep tab state, return to profile
        btnCloseToProfile.setOnClickListener(v -> returnToMain());

        // Tab count badge → open tab switcher
        btnTabSwitcher.setOnClickListener(v -> toggleTabSwitcher());
        btnNewTab.setOnClickListener(v -> {
            openNewTab("about:blank");
            openSearchOverlayFresh();
        });

        btnWallet.setOnClickListener(v -> openWalletDrawerInBrowser());
        btnMenu.setOnClickListener(this::showPopupMenu);

        LinearLayout urlPill = findViewById(R.id.urlPill);
        urlPill.setOnClickListener(v -> openSearchOverlay());

        // Search overlay
        btnSearchCancel.setOnClickListener(v -> closeSearchOverlay());
        searchDismissArea.setOnClickListener(v -> closeSearchOverlay());
        btnSearchGo.setOnClickListener(v -> commitSearch());
        btnSearchPaste.setOnClickListener(v -> {
            android.content.ClipboardManager cm =
                (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            if (cm != null && cm.hasPrimaryClip() && cm.getPrimaryClip() != null) {
                android.content.ClipData.Item item = cm.getPrimaryClip().getItemAt(0);
                if (item != null) {
                    CharSequence text = item.getText();
                    if (text != null && text.length() > 0) {
                        etSearch.setText(text.toString().trim());
                        etSearch.setSelection(etSearch.getText().length());
                        commitSearch(); // auto-load immediately after paste
                        return;
                    }
                }
            }
            Toast.makeText(this, "Clipboard is empty", Toast.LENGTH_SHORT).show();
        });
        etSearch.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_GO ||
                (event != null && event.getKeyCode() == KeyEvent.KEYCODE_ENTER
                    && event.getAction() == KeyEvent.ACTION_DOWN)) {
                commitSearch(); return true;
            }
            return false;
        });
    }

    // ══════════════════════════════════════════════════════════════
    // Tab management
    // ══════════════════════════════════════════════════════════════

    /** Public entry point — called from MainActivity when browser is already alive */
    public void openNewTabPublic(String url) {
        openNewTab(url);
    }

    /** Switch to existing tab with matching URL, or open new tab if not found. */
    public void switchToTabByUrlPublic(String url) {
        if (url == null || url.isEmpty()) return;
        String normTarget = normalizeUrl(url);
        for (int i = 0; i < tabs.size(); i++) {
            Tab tab = tabs.get(i);
            String tabUrl = tab.webView != null ? tab.webView.getUrl() : null;
            if (tabUrl == null || tabUrl.isEmpty()) tabUrl = tab.url;
            if (normalizeUrl(tabUrl).equals(normTarget)) {
                switchToTab(i);
                return;
            }
        }
        // Not found — open new tab
        openNewTab(url);
    }

    /** Normalize URL for comparison: lowercase scheme+host, strip trailing slash */
    private String normalizeUrl(String url) {
        if (url == null) return "";
        try {
            android.net.Uri u = android.net.Uri.parse(url);
            String host = u.getHost();
            String path = u.getPath();
            if (host == null) return url.toLowerCase().replaceAll("/+$", "");
            if (path == null || path.equals("/")) path = "";
            String norm = u.getScheme() + "://" + host.toLowerCase() + path.replaceAll("/+$", "");
            return norm;
        } catch (Exception e) { return url.toLowerCase().replaceAll("/+$", ""); }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private Tab openNewTab(String url) {
        Tab tab = new Tab();
        tab.url = url;
        tab.loaded = true;
        tab.webView = createWebView();
        webViewContainer.addView(tab.webView);
        tabs.add(tab);
        switchToTab(tabs.size() - 1);
        if (!url.equals("about:blank")) tab.webView.loadUrl(url);
        updateTabCount();
        saveTabs();
        return tab;
    }

    private void switchToTab(int index) {
        if (index < 0 || index >= tabs.size()) return;
        // Hide all
        for (int i = 0; i < tabs.size(); i++) {
            tabs.get(i).webView.setVisibility(View.GONE);
        }
        activeTab = index;
        Tab tab = tabs.get(activeTab);
        tab.webView.setVisibility(View.VISIBLE);
        // Lazy load: if this tab was restored but never loaded, load it now
        if (!tab.loaded && tab.url != null && !tab.url.isEmpty() && !tab.url.equals("about:blank")) {
            tab.loaded = true;
            tab.webView.loadUrl(tab.url);
        }
        applyDesktopMode(tab.webView, tab.desktopMode);
        updateToolbarForTab(tab);
        tabAdapter.notifyDataSetChanged();
        saveTabs();
    }

    private void closeTab(int index) {
        if (tabs.size() == 1) { returnToMain(); return; } // last tab → return to wallet without destroying
        Tab tab = tabs.get(index);
        webViewContainer.removeView(tab.webView);
        tab.webView.stopLoading();
        dropRequestsForTab(tab.webView);
        mPageSeq.remove(tab.webView); // cancel any pending delayed restores for this WebView
        tab.webView.destroy();
        tab.webView = null; // prevent dangling reference
        tabs.remove(index);
        // Adjust activeTab index if a tab before or at active was removed
        if (index < activeTab) activeTab--;
        int newActive = Math.min(Math.max(activeTab, 0), tabs.size() - 1);
        activeTab = newActive; // set before switchToTab to avoid stale state
        switchToTab(newActive);
        updateTabCount();
        tabAdapter.notifyDataSetChanged();
        saveTabs();
    }

    private WebView activeWebView() {
        if (activeTab < 0 || activeTab >= tabs.size()) return null;
        Tab t = tabs.get(activeTab);
        return t != null ? t.webView : null;
    }

    private Tab activeTabObj() {
        if (activeTab < 0 || activeTab >= tabs.size()) return null;
        return tabs.get(activeTab);
    }

    private void updateTabCount() {
        int count = tabs.size();
        tvTabCount.setText(count > 9 ? "9+" : String.valueOf(count));
    }

    private void updateToolbarForTab(Tab tab) {
        String display = (tab.url == null || tab.url.isEmpty() || tab.url.equals("about:blank"))
            ? "New Tab" : extractDomain(tab.url);
        tvUrl.setText(display);
        updateLock(tab.url);
        updateNavButtons();
    }

    private void toggleTabSwitcher() {
        if (tabSwitcherOverlay.getVisibility() == View.VISIBLE) {
            hideTabSwitcher();
        } else {
            showTabSwitcher();
        }
    }

    private void showTabSwitcher() {
        tabAdapter.notifyDataSetChanged();
        tabSwitcherOverlay.setVisibility(View.VISIBLE);
    }

    private void hideTabSwitcher() {
        tabSwitcherOverlay.setVisibility(View.GONE);
    }

    // ══════════════════════════════════════════════════════════════
    // Tab RecyclerView Adapter
    // ══════════════════════════════════════════════════════════════
    private class TabAdapter extends RecyclerView.Adapter<TabAdapter.VH> {

        class VH extends RecyclerView.ViewHolder {
            TextView  tvTitle, tvUrl;
            ImageButton btnClose;
            View      activeIndicator, itemRoot;
            VH(View v) {
                super(v);
                tvTitle       = v.findViewById(R.id.tabItemTitle);
                tvUrl         = v.findViewById(R.id.tabItemUrl);
                btnClose      = v.findViewById(R.id.tabItemClose);
                activeIndicator = v.findViewById(R.id.tabActiveIndicator);
                itemRoot      = v.findViewById(R.id.tabItemRoot);
            }
        }

        @Override
        public VH onCreateViewHolder(ViewGroup parent, int viewType) {
            View v = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_tab, parent, false);
            return new VH(v);
        }

        @Override
        public void onBindViewHolder(VH holder, int position) {
            Tab tab = tabs.get(position);
            String domain = extractDomain(tab.url);
            holder.tvTitle.setText(tab.title != null && !tab.title.isEmpty() ? tab.title : "New Tab");
            holder.tvUrl.setText(domain != null && !domain.isEmpty() ? domain : "about:blank");

            boolean isActive = (position == activeTab);
            holder.activeIndicator.setVisibility(isActive ? View.VISIBLE : View.INVISIBLE);
            holder.itemRoot.setAlpha(isActive ? 1.0f : 0.75f);

            holder.itemRoot.setOnClickListener(v -> {
                switchToTab(holder.getAdapterPosition());
                hideTabSwitcher();
            });
            holder.btnClose.setOnClickListener(v -> {
                int pos = holder.getAdapterPosition();
                if (pos != RecyclerView.NO_POSITION) closeTab(pos);
            });
        }

        @Override public int getItemCount() { return tabs.size(); }
    }

    // ══════════════════════════════════════════════════════════════
    // History RecyclerView Adapter
    // ══════════════════════════════════════════════════════════════
    private class HistoryAdapter extends RecyclerView.Adapter<HistoryAdapter.VH> {

        private JSONArray data = new JSONArray();

        void refresh() {
            data = getHistory();
            notifyDataSetChanged();
        }

        class VH extends RecyclerView.ViewHolder {
            TextView tvTitle, tvUrl, tvTime;
            VH(View v) {
                super(v);
                tvTitle = v.findViewById(android.R.id.text1);
                tvUrl   = v.findViewById(android.R.id.text2);
                tvTime  = new TextView(v.getContext());
            }
        }

        @Override
        public VH onCreateViewHolder(ViewGroup parent, int viewType) {
            // Build a simple two-line list item programmatically
            LinearLayout row = new LinearLayout(parent.getContext());
            row.setOrientation(LinearLayout.VERTICAL);
            row.setPadding(32, 24, 32, 24);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                row.setBackground(new android.graphics.drawable.RippleDrawable(
                    android.content.res.ColorStateList.valueOf(0x336366F1), null, null));
            }
            // title
            TextView title = new TextView(parent.getContext());
            title.setId(android.R.id.text1);
            title.setTextColor(0xFFE5E7EB);
            title.setTextSize(14f);
            title.setMaxLines(1);
            title.setEllipsize(android.text.TextUtils.TruncateAt.END);
            // url + time row
            LinearLayout sub = new LinearLayout(parent.getContext());
            sub.setOrientation(LinearLayout.HORIZONTAL);
            sub.setPadding(0, 4, 0, 0);
            TextView url = new TextView(parent.getContext());
            url.setId(android.R.id.text2);
            url.setTextColor(0xFF6B7280);
            url.setTextSize(12f);
            url.setMaxLines(1);
            url.setEllipsize(android.text.TextUtils.TruncateAt.END);
            LinearLayout.LayoutParams urlLp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
            sub.addView(url, urlLp);
            TextView time = new TextView(parent.getContext());
            time.setTextColor(0xFF6B7280);
            time.setTextSize(11f);
            time.setPadding(16, 0, 0, 0);
            sub.addView(time);
            row.addView(title);
            row.addView(sub);
            row.setLayoutParams(new RecyclerView.LayoutParams(
                RecyclerView.LayoutParams.MATCH_PARENT,
                RecyclerView.LayoutParams.WRAP_CONTENT));
            VH vh = new VH(row);
            vh.tvTime = time;
            return vh;
        }

        @Override
        public void onBindViewHolder(VH holder, int position) {
            try {
                JSONObject h = data.getJSONObject(position);
                String title = h.optString("title", "");
                String url   = h.optString("url", "");
                holder.tvTitle.setText(title.isEmpty() ? url : title);
                holder.tvUrl.setText(url);
                holder.tvTime.setText(timeAgo(h.optLong("ts", 0)));
                holder.itemView.setOnClickListener(v -> {
                    WebView wv = activeWebView();
                    if (wv != null && !url.isEmpty()) wv.loadUrl(url);
                    hideHistoryPanel();
                });
            } catch (Exception ignored) {}
        }

        @Override public int getItemCount() { return data.length(); }
    }

    // ══════════════════════════════════════════════════════════════
    // WebView factory
    // ══════════════════════════════════════════════════════════════
    @SuppressLint("SetJavaScriptEnabled")
    private WebView createWebView() {
        WebView wv = new WebView(this);
        wv.setLayoutParams(new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT));
        wv.setVisibility(View.GONE);

        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setDatabaseEnabled(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setOffscreenPreRaster(true);
        wv.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        s.setUserAgentString(getMobileUA());

        // ── Disable Android text-selection toolbar (copy/translate/web-search popup on long-press) ──
        wv.setOnLongClickListener(v -> true); // consume long-press so context menu never shows
        wv.setLongClickable(false);
        wv.setHapticFeedbackEnabled(false);

        wv.addJavascriptInterface(new OneWeb3Bridge(wv), "OneWeb3Bridge");
        // NOTE: no page-visible chain/wallet setters. The chain and wallet are changed only by the
        // native pickers (see the chain picker and wallet drawer), never by dApp page JS.

        wv.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                Tab tab = tabForWebView(view);
                if (tab != null) { tab.url = url; tab.loading = true; }
                if (view == activeWebView()) {
                    progressBar.setVisibility(View.VISIBLE);
                    tvUrl.setText(extractDomain(url));
                    updateLock(url);
                    updateNavButtons();
                }
                // Re-apply desktop/mobile UA so link clicks don't reset mode
                if (tab != null) applyDesktopMode(view, tab.desktopMode);
                // Reset injection flags so onPageFinished does a clean full-inject.
                // Do NOT inject WEB3_PROVIDER_JS here — page JS hasn't loaded yet,
                // so eip6963:announceProvider would fire before dApp listeners attach.
                view.evaluateJavascript("window._oneWeb3Injected = false; window._oneAccountsIntercepted = false;", null);
                // Increment seq so any pending restoreSelectedWalletIntoPage delayed
                // callbacks from the PREVIOUS page load are automatically no-op'd.
                nextPageSeq(view);
                // This tab's document is going away: drop its pending requests (and its open
                // confirmation). Other tabs' requests are left alone.
                dropRequestsForTab(view);
                final String host2 = extractDomain(url);
                // Snapshot seq AFTER nextPageSeq() was already called above for this navigation
                final int host2Seq = mPageSeq.getOrDefault(view, 0);
                if (host2 != null && !host2.isEmpty()) {
                    view.postDelayed(() -> {
                        // Guard: if page has navigated away since this was scheduled, skip
                        if (!isSeqCurrent(view, host2Seq)) return;
                        String safeHost2 = jsStr(host2);
                        WebView mv = MainActivity.getMainWebView();
                        if (mv != null) mv.post(() -> mv.evaluateJavascript(
                            "window._oneActiveBrowserHost = " + safeHost2 + ";", null));
                    }, 500);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                Tab tab = tabForWebView(view);
                if (tab != null) { tab.url = url; tab.loading = false; }
                if (view == activeWebView()) {
                    progressBar.setVisibility(View.GONE);
                    tvUrl.setText(extractDomain(url));
                    updateLock(url);
                    updateNavButtons();
                }
                saveTabs(); // persist updated URL
                // Inject desktop viewport override if desktop mode active
                if (tab != null && tab.desktopMode) {
                    injectDesktopViewport(view);
                }
                final String pageOrigin = originOf(view.getUrl());
                if (pageOrigin != null) {
                    view.evaluateJavascript(WEB3_PROVIDER_JS
                        .replace("__ONE_CHAIN_ID__", selectedChainId != null ? selectedChainId : "0x1")
                        .replace("__ONE_BRIDGE_TOKEN__", bridgeToken(pageOrigin))
                        .replace("__ONE_ORIGIN__", jsStr(pageOrigin)), null);
                }
                // ── Inject CSS to disable text selection globally (prevents copy/translate toolbar) ──
                view.evaluateJavascript(
                    "(function(){" +
                    "  var s=document.getElementById('_oneNoSelect');" +
                    "  if(!s){" +
                    "    s=document.createElement('style');" +
                    "    s.id='_oneNoSelect';" +
                    "    s.textContent='*{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important;}';" +
                    "    document.head.appendChild(s);" +
                    "  }" +
                    "})()",
                    null);
                // ── Re-inject selected wallet immediately after provider inject ──
                final WebView finalView = view;
                // Snapshot the current page load sequence. Delayed lambdas check this
                // before firing so stale callbacks from previous navigations are no-ops.
                final int pageSeq = mPageSeq.getOrDefault(view, 0);
                // Restore immediately (provider just injected), then at multiple delays
                // to catch slow-init dApps (wagmi/web3modal can take 1-3s to init)
                restoreSelectedWalletIntoPage(finalView);
                view.postDelayed(() -> { if (isSeqCurrent(finalView, pageSeq)) restoreSelectedWalletIntoPage(finalView); }, 300);
                view.postDelayed(() -> { if (isSeqCurrent(finalView, pageSeq)) restoreSelectedWalletIntoPage(finalView); }, 800);
                view.postDelayed(() -> { if (isSeqCurrent(finalView, pageSeq)) restoreSelectedWalletIntoPage(finalView); }, 1800);
                view.postDelayed(() -> { if (isSeqCurrent(finalView, pageSeq)) restoreSelectedWalletIntoPage(finalView); }, 3500);

                view.evaluateJavascript("document.title", titleResult -> {
                    if (isDestroyed() || isFinishing()) return;
                    String pageTitle = titleResult;
                    if (pageTitle != null) pageTitle = pageTitle.replaceAll("^\"|\"$", "");
                    final String finalTitle = (pageTitle == null || pageTitle.equals("null"))
                        ? extractDomain(url) : pageTitle;
                    if (tab != null) tab.title = finalTitle;
                    runOnUiThread(() -> { if (!isDestroyed()) tabAdapter.notifyDataSetChanged(); });
                    saveToHistory(url, finalTitle);
                    WebView mv = MainActivity.getMainWebView();
                    if (mv != null) {
                        // Escape for single-quoted JS string: backslash first, then single-quote
                        String safeUrl2 = url.replace("\\", "\\\\").replace("'", "\\'");
                        mv.post(() -> mv.evaluateJavascript(
                            "(function(){ try { profHistoryAdd('" + safeUrl2 + "'); } catch(e){} })()", null));
                    }
                });
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("http://") || url.startsWith("https://")) return false;
                // Non-web links: only well-known schemes, only after a real user tap (never from a
                // redirect or script), and only as a plain browsable VIEW intent. Everything else
                // (intent:, file:, content:, javascript:, market:, custom app schemes) is dropped.
                if (request.hasGesture() && !request.isRedirect() && isAllowedExternalScheme(request.getUrl())) {
                    try {
                        Intent i = new Intent(Intent.ACTION_VIEW, request.getUrl());
                        i.addCategory(Intent.CATEGORY_BROWSABLE);
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(i);
                    } catch (Exception ignored) {}
                }
                return true;
            }
        });

        wv.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (view == activeWebView()) {
                    progressBar.setProgress(newProgress);
                    progressBar.setVisibility(newProgress == 100 ? View.GONE : View.VISIBLE);
                }
            }
            @Override
            public void onReceivedTitle(WebView view, String title) {
                Tab tab = tabForWebView(view);
                if (tab != null && title != null && !title.isEmpty()) {
                    tab.title = title;
                    runOnUiThread(() -> { if (!isDestroyed()) tabAdapter.notifyDataSetChanged(); });
                }
            }
        });

        return wv;
    }

    private Tab tabForWebView(WebView wv) {
        for (Tab t : tabs) if (t.webView == wv) return t;
        return null;
    }

    // ══════════════════════════════════════════════════════════════
    // History helpers (unchanged)
    // ══════════════════════════════════════════════════════════════
    private void saveToHistory(String url, String title) {
        if (url == null || url.isEmpty()) return;
        if (url.startsWith("about:") || url.startsWith("data:")) return;
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            JSONArray arr = new JSONArray(prefs.getString(HISTORY_KEY, "[]"));
            JSONArray filtered = new JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                if (!url.equals(o.optString("url"))) filtered.put(o);
            }
            JSONObject entry = new JSONObject();
            entry.put("url", url); entry.put("title", (title != null && !title.isEmpty()) ? title : extractDomain(url));
            entry.put("ts", System.currentTimeMillis());
            JSONArray newArr = new JSONArray();
            newArr.put(entry);
            for (int i = 0; i < filtered.length() && i < HISTORY_MAX - 1; i++) newArr.put(filtered.getJSONObject(i));
            prefs.edit().putString(HISTORY_KEY, newArr.toString()).apply();
        } catch (Exception ignored) {}
    }

    private JSONArray getHistory() {
        try { return new JSONArray(getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getString(HISTORY_KEY, "[]")); }
        catch (Exception e) { return new JSONArray(); }
    }

    private void clearHistory() { getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().remove(HISTORY_KEY).apply(); }

    private String timeAgo(long ts) {
        long diff = (System.currentTimeMillis() - ts) / 1000;
        if (diff < 60) return "just now";
        if (diff < 3600) return (diff / 60) + "m ago";
        if (diff < 86400) return (diff / 3600) + "h ago";
        return (diff / 86400) + "d ago";
    }

    // ══════════════════════════════════════════════════════════════
    // Search overlay
    // ══════════════════════════════════════════════════════════════
    private void openSearchOverlay() {
        WebView wv = activeWebView();
        String current = wv != null ? wv.getUrl() : "";
        etSearch.setText(current != null ? current : "");
        etSearch.selectAll();
        searchOverlay.setVisibility(View.VISIBLE);
        etSearch.requestFocus();
        showKeyboard(etSearch);
    }

    private void openSearchOverlayFresh() {
        etSearch.setText("");
        searchOverlay.setVisibility(View.VISIBLE);
        etSearch.requestFocus();
        showKeyboard(etSearch);
    }

    private void closeSearchOverlay() {
        hideKeyboard(); // dismiss first while window token is still valid
        searchOverlay.setVisibility(View.GONE);
    }

    private void commitSearch() {
        String input = etSearch.getText().toString().trim();
        if (input.isEmpty()) { closeSearchOverlay(); return; }
        closeSearchOverlay();
        WebView wv = activeWebView();
        if (wv != null) wv.loadUrl(resolveInput(input));
    }

    private String resolveInput(String input) {
        if (input.startsWith("http://") || input.startsWith("https://")) return input;
        if (!input.contains(" ") && input.contains(".")) return "https://" + input;
        return "https://www.google.com/search?q=" + Uri.encode(input);
    }

    // ══════════════════════════════════════════════════════════════
    // Popup menu (3-dot)
    // ══════════════════════════════════════════════════════════════
    private void showPopupMenu(View anchor) {
        Tab activeTabObj = activeTabObj();
        boolean isDesktop = activeTabObj != null && activeTabObj.desktopMode;

        PopupMenu popup = new PopupMenu(this, anchor);
        popup.getMenu().add(0, 1, 0, "Open in browser");
        popup.getMenu().add(0, 2, 1, "Copy link");
        popup.getMenu().add(0, 3, 2, "Refresh");
        popup.getMenu().add(0, 4, 3, "Recent History");
        popup.getMenu().add(0, 5, 4, isDesktop ? "✓ Desktop Site" : "Desktop Site");

        popup.setOnMenuItemClickListener(item -> {
            WebView wv = activeWebView();
            String currentUrl = wv != null ? wv.getUrl() : null;
            int id = item.getItemId();
            if (id == 1) {
                if (currentUrl != null) try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(currentUrl)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) {}
                return true;
            }
            if (id == 2) {
                if (currentUrl != null) {
                    android.content.ClipboardManager cm = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                    if (cm != null) cm.setPrimaryClip(android.content.ClipData.newPlainText("URL", currentUrl));
                    Toast.makeText(this, "Link copied", Toast.LENGTH_SHORT).show();
                }
                return true;
            }
            if (id == 3) { if (wv != null) wv.reload(); return true; }
            if (id == 4) { showHistoryPanel(); return true; }
            if (id == 5) { toggleDesktopMode(); return true; }
            return false;
        });
        popup.show();
    }

    // ══════════════════════════════════════════════════════════════
    // Desktop mode
    // ══════════════════════════════════════════════════════════════
    private static final String UA_DESKTOP =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    private String getMobileUA() {
        return "Mozilla/5.0 (Linux; Android " + Build.VERSION.RELEASE +
            "; " + Build.MODEL + ") AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
    }

    private void toggleDesktopMode() {
        Tab tab = activeTabObj();
        WebView wv = activeWebView();
        if (tab == null || wv == null) return;

        boolean nowDesktop = !tab.desktopMode;
        tab.desktopMode = nowDesktop;
        applyDesktopMode(wv, nowDesktop);

        String msg = nowDesktop ? "🖥️ Desktop mode ON" : "📱 Mobile mode ON";
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();

        String url = wv.getUrl();
        if (url != null && !url.isEmpty()) wv.reload();
    }

    private void applyDesktopMode(WebView wv, boolean desktop) {
        WebSettings s = wv.getSettings();
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        if (desktop) {
            s.setUserAgentString(UA_DESKTOP);
            s.setUseWideViewPort(true);
            s.setLoadWithOverviewMode(true);
            // Calculate scale so 1280px desktop width fits screen — same as Chrome
            int screenPx = getResources().getDisplayMetrics().widthPixels;
            int scalePct = Math.round((screenPx / 1280.0f) * 100f);
            wv.setInitialScale(scalePct);
        } else {
            s.setUserAgentString(getMobileUA());
            s.setUseWideViewPort(true);
            s.setLoadWithOverviewMode(true);
            wv.setInitialScale(0);
        }
    }

    private void injectDesktopViewport(WebView wv) {
        // Viewport width=1280, user-scalable — Chrome desktop site standard
        wv.evaluateJavascript(
            "(function() {" +
            "  var vp = document.querySelector('meta[name=\"viewport\"]');" +
            "  var c = 'width=1280, user-scalable=yes';" +
            "  if (vp) { vp.setAttribute('content', c); }" +
            "  else { var m = document.createElement('meta'); m.name='viewport'; m.content=c; document.head.appendChild(m); }" +
            "})()", null);
    }

    // ══════════════════════════════════════════════════════════════
    // History panel
    // ══════════════════════════════════════════════════════════════
    private void showHistoryPanel() {
        historyAdapter.refresh();
        historyOverlay.setVisibility(View.VISIBLE);
    }

    private void hideHistoryPanel() {
        historyOverlay.setVisibility(View.GONE);
    }

    // ══════════════════════════════════════════════════════════════
    // Web3 Bridge (unchanged logic, targets active tab WebView)
    // ══════════════════════════════════════════════════════════════
    public class OneWeb3Bridge {
        private final WebView owner; // the tab this bridge instance is attached to

        OneWeb3Bridge(WebView owner) { this.owner = owner; }

        @JavascriptInterface
        public void handleRequest(final String token, final int pageReqId, final String method,
                                  final String paramsJson) {
            // WebView state is only readable on the UI thread
            runOnUiThread(() -> dispatchWeb3Request(owner, token, pageReqId, method, paramsJson));
        }

        // NOTE: there is deliberately no modalApprove()/modalReject() here. The confirmation UI is
        // native (see showNativeTxConfirm) so page JS can neither see nor press Approve.

        /**
         * Opens the given URL in a new in-app browser tab.
         * Called from the TX success toast's "View on Explorer →" tap handler.
         */
        @JavascriptInterface
        public void openInAppBrowser(final String token, final String url) {
            if (!isHttpUrl(url)) return;
            runOnUiThread(() -> {
                if (!isDestroyed() && tabForWebView(owner) != null && isTokenFor(owner, token)) {
                    openNewTabPublic(url);
                }
            });
        }
    }

    /** Registers a request from a tab's top document and hands it to the wallet. UI thread only. */
    private void dispatchWeb3Request(WebView tabWv, String token, int pageReqId, String method,
                                     String paramsJson) {
        if (isDestroyed() || tabForWebView(tabWv) == null) return;
        if (!isTokenFor(tabWv, token)) {
            // An iframe or a stale document. Nothing is sent back: the id it passed could belong
            // to a real request of the top document.
            android.util.Log.w("OneWeb3", "Dropped a request that is not from the tab's top document");
            return;
        }
        final String origin = originOf(tabWv.getUrl());
        final String host = displayHost(origin);
        // The wallet only ever sees this id. Page ids start at 1 in every tab and are chosen by
        // the page, so they cannot identify a request.
        final int reqId = sNextReqId.getAndIncrement();
        sPending.put(reqId, new Web3Pending(tabWv, pageReqId, origin, host));
        if (!isValidMethod(method)) { rejectFromMain(reqId, "Unsupported method"); return; }
        android.util.Log.d("OneWeb3", "Request #" + reqId + " method=" + method);
        final WebView mv = MainActivity.getMainWebView();
        if (mv == null) { rejectFromMain(reqId, "One Wallet not available"); return; }
        String escaped = paramsJson == null ? "[]" : paramsJson.replace("\\", "\\\\").replace("`", "\\`").replace("$", "\\$");
        String args = reqId + ", " + jsStr(method) + ", `" + escaped + "`, " + jsStr(host);
        mv.post(() -> mv.evaluateJavascript(
            "(function(){\n  try {\n    if (typeof oneHandleWeb3Request === 'function') {\n" +
            "      oneHandleWeb3Request(" + args + ");\n" +
            "    } else { window._oneWeb3Fallback && window._oneWeb3Fallback(" + args + "); }\n" +
            "  } catch(e) { console.error('[OneWeb3] dispatch error:', e); }\n})()", null));
    }

    /** Forgets every pending request of {@code view} and tells the wallet to discard them. */
    private void dropRequestsForTab(WebView view) {
        StringBuilder ids = new StringBuilder();
        java.util.Iterator<java.util.Map.Entry<Integer, Web3Pending>> it = sPending.entrySet().iterator();
        while (it.hasNext()) {
            java.util.Map.Entry<Integer, Web3Pending> e = it.next();
            WebView tabWv = e.getValue().tab.get();
            if (tabWv != null && tabWv != view) continue;
            if (e.getKey() == txConfirmReqId) dismissNativeTxConfirm();
            if (ids.length() > 0) ids.append(',');
            ids.append(e.getKey());
            it.remove();
        }
        if (ids.length() > 0) tellWalletToDrop(ids.toString());
    }

    private static void tellWalletToDrop(String commaSeparatedIds) {
        final WebView mv = MainActivity.getMainWebView();
        if (mv == null) return;
        mv.post(() -> mv.evaluateJavascript(
            "window._oneDropBrowserRequests && window._oneDropBrowserRequests([" + commaSeparatedIds + "]);",
            null));
    }

    // ── Per-WebView page-load sequence counter ──────────────────
    // Incremented on every onPageStarted; delayed restoreSelectedWalletIntoPage
    // callbacks capture the counter at schedule-time and no-op if it has changed,
    // preventing stale restores firing on the wrong page after navigation.
    private final java.util.concurrent.ConcurrentHashMap<WebView, Integer> mPageSeq =
        new java.util.concurrent.ConcurrentHashMap<>();

    private int nextPageSeq(WebView wv) {
        int seq = mPageSeq.getOrDefault(wv, 0) + 1;
        mPageSeq.put(wv, seq);
        return seq;
    }

    private boolean isSeqCurrent(WebView wv, int seq) {
        Integer cur = mPageSeq.get(wv);
        return cur != null && cur == seq;
    }
    private static WeakReference<InAppBrowserActivity> sInstance;

    // ── Pending Web3 requests, keyed by the wallet-side id ──
    private static final class Web3Pending {
        final WeakReference<WebView> tab;
        final int pageReqId;  // the id the page's provider is waiting on
        final String origin;  // top-document origin when the request was made
        final String host;    // what the confirmation sheet shows

        Web3Pending(WebView tabWv, int pageReqId, String origin, String host) {
            this.tab = new WeakReference<>(tabWv);
            this.pageReqId = pageReqId;
            this.origin = origin;
            this.host = host;
        }

        /** The requesting tab, or null if it is gone or now shows another site. UI thread only. */
        WebView liveTab() {
            WebView wv = tab.get();
            return wv != null && origin.equals(originOf(wv.getUrl())) ? wv : null;
        }
    }

    private static final AtomicInteger sNextReqId = new AtomicInteger(1);
    private static final java.util.concurrent.ConcurrentHashMap<Integer, Web3Pending>
        sPending = new java.util.concurrent.ConcurrentHashMap<>();

    public static void resolveFromMain(final int reqId, final String resultJson) {
        String escaped = resultJson == null ? "null" : resultJson.replace("\\", "\\\\").replace("`", "\\`").replace("$", "\\$");
        deliverToRequester(reqId, "window._oneW3Resolve", "`" + escaped + "`");
    }

    public static void rejectFromMain(final int reqId, final String message) {
        // jsStr() JSON-quotes the message (backslash, quote, newlines, U+2028/9), so any reject text
        // reaches the dApp as a valid JS string and its promise always settles.
        deliverToRequester(reqId, "window._oneW3Reject",
            jsStr(message == null ? "User rejected" : message));
    }

    /** Answers only the tab that asked, and only while it still shows the site that asked. */
    private static void deliverToRequester(final int reqId, final String fn, final String jsArg) {
        InAppBrowserActivity a = sInstance != null ? sInstance.get() : null;
        if (a == null) return;
        a.runOnUiThread(() -> {
            Web3Pending pending = sPending.remove(reqId);
            if (pending == null) return; // answered already, or the tab navigated / closed
            WebView target = pending.liveTab();
            if (target == null) return;
            target.evaluateJavascript(fn + " && " + fn + "(" + pending.pageReqId + ", " + jsArg + ");", null);
        });
    }

    public static void updateAccountState(final String accountsJson, final String chainId) {
        InAppBrowserActivity a = sInstance != null ? sInstance.get() : null;
        if (a == null) return;
        WebView wv = a.activeWebView();
        if (wv == null) return;
        String safeAccounts = accountsJson == null ? "[]"
            : accountsJson.replace("\\", "\\\\").replace("`", "\\`").replace("$", "\\$");
        String safeChain = jsStr(isValidChainId(chainId) ? chainId : "0x1");
        wv.post(() -> wv.evaluateJavascript(
            "window.ethereum && window.ethereum._updateState(`" + safeAccounts + "`, " + safeChain + ");", null));
    }

    public static void injectTxModal(final int reqId, final String actionLabel, final String siteHost,
                                     final String bodyHtml, final String approveLabel) {
        final InAppBrowserActivity a = sInstance != null ? sInstance.get() : null;
        if (a == null) return;
        a.runOnUiThread(() -> {
            // The host shown is the one recorded when the tab made this request. The siteHost the
            // wallet JS passes in is not used. A request whose tab is gone is not shown at all.
            Web3Pending pending = sPending.get(reqId);
            if (pending == null || pending.liveTab() == null) {
                sPending.remove(reqId);
                tellWalletToDrop(String.valueOf(reqId));
                return;
            }
            a.showNativeTxConfirm(reqId, actionLabel, pending.host, bodyHtml, approveLabel);
        });
    }

    // ── Native transaction / signature confirmation ──────────────────────────────────────────
    // Rendered natively, NOT inside the dApp page, so page JS can neither see nor press the
    // Approve button. The request id that Approve/Reject act on is the one captured when the
    // sheet was opened, never a value supplied by page JS. The request summary is shown in a
    // JS-disabled WebView whose CSP forbids scripts, frames and navigation.
    private FrameLayout txConfirmOverlay;
    private WebView txConfirmBody;
    private int txConfirmReqId = -1;
    private final android.os.Handler txConfirmHandler =
        new android.os.Handler(android.os.Looper.getMainLooper());
    private Runnable txConfirmTimeout;

    private int txDp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private android.widget.Button txButton(String label, int fill, int textColor, int stroke) {
        android.widget.Button btn = new android.widget.Button(this);
        btn.setAllCaps(false);
        btn.setText(label);
        btn.setTextColor(textColor);
        btn.setTextSize(14f);
        btn.setTypeface(btn.getTypeface(), android.graphics.Typeface.BOLD);
        btn.setStateListAnimator(null);
        btn.setFilterTouchesWhenObscured(true); // ignore taps while another app draws over us
        android.graphics.drawable.GradientDrawable bg = new android.graphics.drawable.GradientDrawable();
        bg.setColor(fill);
        bg.setCornerRadius(txDp(12));
        if (stroke != 0) bg.setStroke(txDp(1), stroke);
        btn.setBackground(bg);
        return btn;
    }

    private void showNativeTxConfirm(final int reqId, String actionLabel, String siteHost,
                                     String bodyHtml, String approveLabel) {
        dismissNativeTxConfirm();
        ViewGroup content = findViewById(android.R.id.content);
        if (content == null) return;
        txConfirmReqId = reqId;

        final FrameLayout overlay = new FrameLayout(this);
        overlay.setBackgroundColor(0xE004040A);
        overlay.setClickable(true);
        overlay.setFocusable(true);
        overlay.setElevation(txDp(64));
        overlay.setOnClickListener(v -> rejectNativeTxConfirm());

        LinearLayout sheet = new LinearLayout(this);
        sheet.setOrientation(LinearLayout.VERTICAL);
        android.graphics.drawable.GradientDrawable sheetBg = new android.graphics.drawable.GradientDrawable();
        sheetBg.setColor(0xFF0C0C18);
        float r = txDp(20);
        sheetBg.setCornerRadii(new float[]{r, r, r, r, 0, 0, 0, 0});
        sheetBg.setStroke(txDp(1), 0x406366F1);
        sheet.setBackground(sheetBg);
        sheet.setPadding(txDp(18), txDp(16), txDp(18), txDp(12));
        sheet.setClickable(true); // swallow taps so they don't fall through to the dim area
        overlay.addView(sheet, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT,
            android.view.Gravity.BOTTOM));

        TextView host = new TextView(this);
        host.setText(siteHost == null || siteHost.isEmpty() ? "dApp" : siteHost);
        host.setTextColor(0xFFE5E7EB);
        host.setTextSize(13f);
        host.setTypeface(host.getTypeface(), android.graphics.Typeface.BOLD);
        // Never truncated: the end of a long host name is the part that identifies the site
        host.setSingleLine(false);
        sheet.addView(host);

        TextView action = new TextView(this);
        action.setText(actionLabel == null || actionLabel.isEmpty() ? "REQUEST" : actionLabel);
        action.setTextColor(0xFF6B7280);
        action.setTextSize(10f);
        action.setTypeface(android.graphics.Typeface.MONOSPACE);
        action.setSingleLine(true);
        action.setEllipsize(android.text.TextUtils.TruncateAt.END);
        sheet.addView(action);

        WebView body = new WebView(this);
        WebSettings bs = body.getSettings();
        bs.setJavaScriptEnabled(false);
        bs.setAllowFileAccess(false);
        bs.setAllowContentAccess(false);
        bs.setDomStorageEnabled(false);
        bs.setSupportMultipleWindows(false);
        bs.setJavaScriptCanOpenWindowsAutomatically(false);
        body.setBackgroundColor(0);
        body.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest rq) { return true; }
        });
        String html = "<!doctype html><html><head><meta charset=\"utf-8\">"
            + "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src https: data:; "
            + "style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'\">"
            + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            + "<style>html,body{margin:0;padding:0;background:transparent;color:#e5e7eb;"
            + "font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;word-break:break-word}</style>"
            + "</head><body>" + (bodyHtml == null ? "" : bodyHtml) + "</body></html>";
        body.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
        LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            Math.round(getResources().getDisplayMetrics().heightPixels * 0.42f));
        blp.topMargin = txDp(10);
        sheet.addView(body, blp);
        txConfirmBody = body;

        final TextView err = new TextView(this);
        err.setText("Wallet did not respond. Please try again.");
        err.setTextColor(0xFFF87171);
        err.setTextSize(11f);
        err.setGravity(android.view.Gravity.CENTER);
        err.setVisibility(View.GONE);
        sheet.addView(err);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        final android.widget.Button rej = txButton("Reject", 0x1AEF4444, 0xFFF87171, 0x40EF4444);
        final android.widget.Button apr = txButton(
            approveLabel == null || approveLabel.isEmpty() ? "Confirm" : approveLabel,
            0xFF6366F1, 0xFFFFFFFF, 0);
        LinearLayout.LayoutParams rlp = new LinearLayout.LayoutParams(0, txDp(48), 1f);
        LinearLayout.LayoutParams alp = new LinearLayout.LayoutParams(0, txDp(48), 1.4f);
        alp.leftMargin = txDp(10);
        row.addView(rej, rlp);
        row.addView(apr, alp);
        LinearLayout.LayoutParams rowLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        rowLp.topMargin = txDp(10);
        sheet.addView(row, rowLp);

        rej.setOnClickListener(v -> rejectNativeTxConfirm());
        apr.setOnClickListener(v -> {
            WebView mv = MainActivity.getMainWebView();
            if (mv == null) { rejectNativeTxConfirm(); return; }
            apr.setEnabled(false);
            apr.setText("Processing…");
            rej.setEnabled(false);
            rej.setAlpha(0.4f);
            err.setVisibility(View.GONE);
            final int id = txConfirmReqId;
            mv.post(() -> mv.evaluateJavascript(
                "(function(){ try { window._oneModalApproveFromBrowser(" + id + "); } catch(e){} })()", null));
            if (txConfirmTimeout != null) txConfirmHandler.removeCallbacks(txConfirmTimeout);
            txConfirmTimeout = () -> {
                apr.setEnabled(true);
                apr.setText("Try Again");
                rej.setEnabled(true);
                rej.setAlpha(1f);
                err.setVisibility(View.VISIBLE);
            };
            txConfirmHandler.postDelayed(txConfirmTimeout, 60000);
        });

        txConfirmOverlay = overlay;
        content.addView(overlay, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void dismissNativeTxConfirm() {
        if (txConfirmTimeout != null) { txConfirmHandler.removeCallbacks(txConfirmTimeout); txConfirmTimeout = null; }
        if (txConfirmOverlay != null) {
            ViewGroup parent = (ViewGroup) txConfirmOverlay.getParent();
            if (parent != null) parent.removeView(txConfirmOverlay);
            txConfirmOverlay = null;
        }
        if (txConfirmBody != null) { txConfirmBody.destroy(); txConfirmBody = null; }
        txConfirmReqId = -1;
    }

    private void rejectNativeTxConfirm() {
        final int id = txConfirmReqId;
        dismissNativeTxConfirm();
        if (id < 0) return;
        WebView mv = MainActivity.getMainWebView();
        if (mv == null) return;
        mv.post(() -> mv.evaluateJavascript(
            "(function(){ try { window._oneModalRejectFromBrowser(" + id + "); } catch(e){} })()", null));
    }

    public static void dismissTxModal() { dismissTxModal(-1); }
    public static void dismissTxModal(final int reqId) {
        final InAppBrowserActivity a = sInstance != null ? sInstance.get() : null;
        if (a == null) return;
        // If reqId given, only dismiss the modal that belongs to that request.
        // Prevents race where permit sign dismiss removes the follow-up TX modal.
        a.runOnUiThread(() -> {
            if (reqId < 0 || reqId == a.txConfirmReqId) a.dismissNativeTxConfirm();
        });
    }

    /**
     * Injects a TX success toast into the active dApp WebView.
     * Called after eth_sendTransaction resolves with a txHash.
     * Shows for 8 seconds then auto-dismisses, with an explorer link tap.
     */
    public static void injectTxSuccess(final String txHash, final String explorerUrl) {
        InAppBrowserActivity a = sInstance != null ? sInstance.get() : null;
        if (a == null) return;
        a.runOnUiThread(() -> a.showTxSuccessToast(txHash, explorerUrl));
    }

    private void showTxSuccessToast(String txHash, String explorerUrl) {
        WebView wv = activeWebView();
        if (wv == null) return;
        String origin = originOf(wv.getUrl());
        if (origin == null) return;
        String safeHash = txHash == null ? "" : txHash;
        String shortHash = safeHash.length() > 14
            ? safeHash.substring(0, 8) + "..." + safeHash.substring(safeHash.length() - 6)
            : safeHash;
        String url = explorerUrl != null && isHttpUrl(explorerUrl) ? explorerUrl : "";

        StringBuilder sb = new StringBuilder();
        sb.append("(function(){");
        sb.append("if(String(window.location.origin)!==").append(jsStr(origin)).append(")return;");
        sb.append("var _SID='_one_tx_success_toast';");
        sb.append("var old=document.getElementById(_SID); if(old){clearTimeout(old._timer);old.remove();}");
        // Toast container
        sb.append("var t=document.createElement('div'); t.id=_SID;");
        sb.append("t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:2147483647;");
        sb.append("background:linear-gradient(135deg,#0d1117,#0f1923);border:1px solid rgba(16,185,129,0.4);");
        sb.append("border-radius:16px;padding:14px 18px;box-shadow:0 8px 32px rgba(0,0,0,0.6),0 0 0 1px rgba(16,185,129,0.15);");
        sb.append("display:flex;align-items:center;gap:12px;min-width:240px;max-width:340px;");
        sb.append("animation:_ntSuccIn .35s cubic-bezier(0.34,1.15,0.64,1);font-family:-apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer;';");
        // Styles
        sb.append("var sty=document.createElement('style');");
        sb.append("sty.textContent='@keyframes _ntSuccIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}");
        sb.append("@keyframes _ntSuccOut{from{opacity:1;transform:translateX(-50%) translateY(0)}to{opacity:0;transform:translateX(-50%) translateY(20px)}}';");
        sb.append("document.head.appendChild(sty);");
        // Icon
        sb.append("var icon=document.createElement('div');");
        sb.append("icon.style.cssText='width:36px;height:36px;border-radius:50%;background:rgba(16,185,129,0.15);border:1.5px solid rgba(16,185,129,0.4);");
        sb.append("display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;';");
        sb.append("icon.textContent='✅'; t.appendChild(icon);");
        // Text block
        sb.append("var txt=document.createElement('div'); txt.style.flex='1';");
        sb.append("var title=document.createElement('div');");
        sb.append("title.style.cssText='font-size:13px;font-weight:700;color:#10b981;margin-bottom:2px;';");
        sb.append("title.textContent='Transaction Submitted';");
        sb.append("var sub=document.createElement('div');");
        sb.append("sub.style.cssText='font-size:11px;color:#6b7280;font-family:monospace;';");
        sb.append("sub.textContent=").append(jsStr(shortHash)).append(";");
        sb.append("var link=document.createElement('div');");
        sb.append("link.style.cssText='font-size:11px;color:#6366f1;margin-top:3px;font-weight:600;';");
        sb.append("link.textContent='View on Explorer →';");
        sb.append("txt.appendChild(title); txt.appendChild(sub);");
        if (!url.isEmpty()) {
            sb.append("txt.appendChild(link);");
        }
        sb.append("t.appendChild(txt);");
        sb.append("document.body.appendChild(t);");
        // Tap to open explorer — use OneAndroid.openExternalUrl so it opens in the
        // system browser, not inside the dApp WebView (fixes jumper.xyz/%22https:... bug)
        if (!url.isEmpty()) {
            sb.append("t.onclick=function(){" +
                "try{" +
                    "if(typeof OneWeb3Bridge!=='undefined'&&OneWeb3Bridge.openInAppBrowser){" +
                        "OneWeb3Bridge.openInAppBrowser('" + bridgeToken(origin) + "'," + jsStr(url) + ");" +
                    "}else{" +
                        "window.open(" + jsStr(url) + ",'_blank','noopener,noreferrer');" +
                    "}" +
                "}catch(e){}" +
            "};");
        }
        // Auto-dismiss after 8s
        sb.append("t._timer=setTimeout(function(){");
        sb.append("t.style.animation='_ntSuccOut .3s ease forwards';");
        sb.append("setTimeout(function(){if(t.parentNode)t.remove();},300);");
        sb.append("},8000);");
        sb.append("})();");

        wv.post(() -> wv.evaluateJavascript(sb.toString(), null));
    }

    /**
     * Injects a "chain not configured" error toast into the active dApp WebView.
     * Called by the eth_sendTransaction chain-validation guard in oneHandleWeb3Request.
     * Shows for 6 seconds — prompts user to add the network in One Wallet.
     */
    public static void injectChainError(final String chainHex, final String chainIdDec) {
        InAppBrowserActivity a = sInstance != null ? sInstance.get() : null;
        if (a == null) return;
        WebView wv = a.activeWebView();
        if (wv == null) return;

        // Also show a native Android Toast (visible even if WebView is full-screen)
        a.runOnUiThread(() ->
            android.widget.Toast.makeText(
                a,
                "Chain " + chainHex + " not added in One Wallet — add it first",
                android.widget.Toast.LENGTH_LONG
            ).show()
        );

        StringBuilder sb = new StringBuilder();
        sb.append("(function(){");
        sb.append("var _EID='_one_chain_error_toast';");
        sb.append("var old=document.getElementById(_EID); if(old){clearTimeout(old._timer);old.remove();}");
        // Container
        sb.append("var t=document.createElement('div'); t.id=_EID;");
        sb.append("t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:2147483647;");
        sb.append("background:linear-gradient(135deg,#1a0a0a,#1f0f0f);border:1px solid rgba(239,68,68,0.45);");
        sb.append("border-radius:16px;padding:14px 18px;box-shadow:0 8px 32px rgba(0,0,0,0.65),0 0 0 1px rgba(239,68,68,0.18);");
        sb.append("display:flex;align-items:center;gap:12px;min-width:260px;max-width:340px;");
        sb.append("animation:_ntErrIn .35s cubic-bezier(0.34,1.15,0.64,1);font-family:-apple-system,BlinkMacSystemFont,sans-serif;';\n");
        // Keyframes
        sb.append("var sty=document.createElement('style');");
        sb.append("sty.textContent='@keyframes _ntErrIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}");
        sb.append("@keyframes _ntErrOut{from{opacity:1;transform:translateX(-50%) translateY(0)}to{opacity:0;transform:translateX(-50%) translateY(20px)}}';");
        sb.append("document.head.appendChild(sty);");
        // Icon
        sb.append("var icon=document.createElement('div');");
        sb.append("icon.style.cssText='width:38px;height:38px;border-radius:50%;background:rgba(239,68,68,0.12);border:1.5px solid rgba(239,68,68,0.4);");
        sb.append("display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;';");
        sb.append("icon.textContent='⛓️'; t.appendChild(icon);");
        // Text block
        sb.append("var txt=document.createElement('div'); txt.style.flex='1';");
        sb.append("var title=document.createElement('div');");
        sb.append("title.style.cssText='font-size:13px;font-weight:700;color:#ef4444;margin-bottom:3px;';");
        sb.append("title.textContent='Network Not Added';");
        sb.append("var sub=document.createElement('div');");
        sb.append("sub.style.cssText='font-size:11px;color:#9ca3af;line-height:1.4;';");
        sb.append("sub.textContent='Chain ").append(chainHex).append(" (id:").append(chainIdDec).append(") is not configured in One Wallet. Add this network first.';");
        sb.append("txt.appendChild(title); txt.appendChild(sub); t.appendChild(txt);");
        sb.append("document.body.appendChild(t);");
        // Auto-dismiss 6s
        sb.append("t._timer=setTimeout(function(){");
        sb.append("t.style.animation='_ntErrOut .3s ease forwards';");
        sb.append("setTimeout(function(){if(t.parentNode)t.remove();},300);");
        sb.append("},6000);");
        sb.append("})();");

        wv.post(() -> wv.evaluateJavascript(sb.toString(), null));
    }

    // ── Wallet Drawer ────────────────────────────────────────────
    public static InAppBrowserActivity getInstance() { return sInstance != null ? sInstance.get() : null; }
    public String getSelectedChainId() { return selectedChainId != null ? selectedChainId : "0x1"; }

    /** Returns the persisted wallet address from SharedPreferences (called by OneAndroidBridge). */
    public String getPersistedWalletAddress() {
        String addr = selectedWalletAddress;
        if (addr == null || addr.isEmpty()) {
            addr = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                    .getString(KEY_SELECTED_WALLET, "");
        }
        return (addr != null && addr.matches("0x[0-9a-fA-F]{40}")) ? addr : "";
    }


    /** Called from MainActivity bridge when profile page tab button tapped */
    public void showTabSwitcherFromOutside() {
        boolean hasRealTabs = false;
        for (Tab t : tabs) {
            if (t.url != null && !t.url.isEmpty() && !t.url.equals("about:blank")) {
                hasRealTabs = true;
                break;
            }
        }
        if (hasRealTabs) {
            showTabSwitcher();
        } else {
            openNewTab("about:blank");
            openSearchOverlayFresh();
        }
    }
    public void openWalletDrawerInBrowser() {
        WebView mv = MainActivity.getMainWebView();
        if (mv == null) { showNativeWalletDrawer("[]"); return; }
        mv.post(() -> mv.evaluateJavascript(
            "(function(){ try { return getBrowserWalletDataJson(); } catch(e){ return '[]'; } })()",
            dataJson -> {
                String json = dataJson;
                if (json != null && json.startsWith("\"") && json.endsWith("\""))
                    json = json.substring(1, json.length()-1).replace("\\\"","\"").replace("\\\\","\\");
                final String finalJson = (json == null || json.equals("null") || json.isEmpty()) ? "[]" : json;
                runOnUiThread(() -> showNativeWalletDrawer(finalJson));
            }));
    }

    private void showNativeWalletDrawer(String groupsJson) {
        nativeWalletGroupsData = new org.json.JSONArray();
        try { nativeWalletGroupsData = new org.json.JSONArray(groupsJson); } catch (Exception ignored) {}
        // Update header
        tvNativeWalletGroupCount.setText(nativeWalletGroupsData.length() + " GROUPS");
        if (selectedWalletAddress != null && !selectedWalletAddress.isEmpty()) {
            String s = selectedWalletAddress;
            tvNativeWalletActive.setText("● " + s.substring(0,6) + "..." + s.substring(s.length()-4) + " active");
            tvNativeWalletActive.setVisibility(View.VISIBLE);
        } else {
            tvNativeWalletActive.setVisibility(View.GONE);
        }
        nativeWalletGroupAdapter.notifyDataSetChanged();
        nativeWalletDrawerOverlay.setVisibility(View.VISIBLE);
        // Animate drawer in from right
        float drawerW = nativeWalletDrawer.getWidth() > 0 ? nativeWalletDrawer.getWidth() : getResources().getDisplayMetrics().widthPixels / 2f;
        nativeWalletDrawer.setTranslationX(drawerW);
        nativeWalletDrawer.animate().translationX(0).setDuration(300)
            .setInterpolator(new android.view.animation.DecelerateInterpolator(2f)).start();
    }

    private void hideNativeWalletDrawer() {
        float drawerW = nativeWalletDrawer.getWidth() > 0 ? nativeWalletDrawer.getWidth() : getResources().getDisplayMetrics().widthPixels / 2f;
        nativeWalletDrawer.animate().translationX(drawerW).setDuration(250)
            .setInterpolator(new android.view.animation.AccelerateInterpolator())
            .withEndAction(() -> nativeWalletDrawerOverlay.setVisibility(View.GONE)).start();
    }


    // ══════════════════════════════════════════════════════════════
    // Wallet selection persistence across page navigations
    // ══════════════════════════════════════════════════════════════

    /**
     * Re-injects the currently selected wallet address into a WebView after page load.
     * This ensures wallet stays connected even when the user navigates to a new URL.
     */
    private void restoreSelectedWalletIntoPage(WebView wv) {
        if (wv == null || selectedWalletAddress == null || selectedWalletAddress.isEmpty()) return;
        // ── Sync selected wallet into main WebView (index.html) so _oneBrowserSelectedAddress
        // is always up-to-date for oneHandleWeb3Request signing. Without this, app backgrounding
        // or page reload clears the variable and causes "Wallet not found" on dApps like Jumper.
        WebView mv = MainActivity.getMainWebView();
        if (mv != null) {
            String safeA = selectedWalletAddress.replace("\\", "\\\\").replace("\"", "\\\"");
            String safeC = (selectedChainId != null ? selectedChainId : "0x1").replace("\\", "\\\\").replace("\"", "\\\"");
            mv.post(() -> mv.evaluateJavascript(
                "window.oneSetBrowserSelectedWallet && window.oneSetBrowserSelectedWallet(\"" + safeA + "\", \"" + safeC + "\");",
                null));
        }
        // Escape backslash first, then single-quote and double-quote
        String safeAddr  = selectedWalletAddress.replace("\\", "\\\\").replace("'", "\\'").replace("\"", "\\\"");
        String safeChain = (selectedChainId != null ? selectedChainId : "0x1").replace("\\", "\\\\").replace("'", "\\'").replace("\"", "\\\"");
        wv.evaluateJavascript(
            "(function(){" +
            "  var addr='" + safeAddr + "';" +
            "  var chain='" + safeChain + "';" +
            "  window._oneBwdSelected=addr;" +
            "  window._oneBrowserChainId=chain;" +
            // 1. Update ethereum provider state
            "  try{" +
            "    if(window.ethereum && typeof window.ethereum._updateState==='function'){" +
            "      window.ethereum._updateState([addr],chain);" +
            "    }" +
            "  }catch(_){}" +
            // 2. Re-announce EIP-6963 so wagmi/web3modal reconnects
            "  try{" +
            "    if(window.ethereum && typeof window.ethereum._oneAnnounce==='function'){" +
            "      window.ethereum._oneAnnounce();" +
            "      window.dispatchEvent(new Event('eip6963:requestProvider'));" +
            "    }" +
            "  }catch(_){}" +
            // 3. Force wagmi/RainbowKit reconnect: they watch 'accountsChanged' event
            "  try{" +
            "    if(window.ethereum && window.ethereum.emit){" +
            "      window.ethereum.emit('accountsChanged',[addr]);" +
            "      window.ethereum.emit('chainChanged',chain);" +
            "      window.ethereum.emit('connect',{chainId:chain});" +
            "    }" +
            "  }catch(_){}" +
            // 4. wagmi v2 stores connector in localStorage — patch selectedAddress so it reconnects
            "  try{" +
            "    var keys=Object.keys(localStorage);" +
            "    for(var i=0;i<keys.length;i++){" +
            "      var k=keys[i];" +
            // wagmi.store, wagmiStore, wc@2:client:...
            "      if(k.indexOf('wagmi')!==-1||k.indexOf('wc@')!==-1||k.indexOf('walletconnect')!==-1){" +
            "        try{" +
            "          var v=localStorage.getItem(k);" +
            "          if(v&&v.indexOf('disconnected')!==-1){" +
            "            var parsed=JSON.parse(v);" +
            // Remove disconnected state so wagmi auto-reconnects on next check
            "            if(parsed&&parsed.state){" +
            "              if(parsed.state.status==='disconnected') parsed.state.status='connected';" +
            "              if(parsed.state.connections&&Object.keys(parsed.state.connections).length===0) delete parsed.state.connections;" +
            "              localStorage.setItem(k,JSON.stringify(parsed));" +
            "            }" +
            "          }" +
            "        }catch(_){}" +
            "      }" +
            "    }" +
            "  }catch(_){}" +
            "})()", null);
    }

    /** Return to MainActivity without destroying this activity — preserves tab WebViews */
    private void returnToMain() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        startActivity(intent);
    }


    // ── Lifecycle ────────────────────────────────────────────────
    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        sInstance = new WeakReference<>(this);
        // Handle URL open request (from MainActivity.openInAppBrowser)
        String newUrl = intent.getStringExtra(EXTRA_URL);
        if (newUrl != null && !newUrl.isEmpty() && !newUrl.equals("about:blank")) {
            intent.removeExtra(EXTRA_URL);
            openNewTab(newUrl);
        }
        // Handle tab switcher request
        if (intent.getBooleanExtra(EXTRA_SHOW_TABS, false)) {
            intent.removeExtra(EXTRA_SHOW_TABS);
            pendingShowTabs = true;
        }
    }

    @Override protected void onResume() {
        super.onResume();
        sInstance = new WeakReference<>(this);
        // Clean up pending requests whose WebView refs have been GC'd
        sPending.values().removeIf(p -> p.tab.get() == null);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && pendingShowTabs) {
            pendingShowTabs = false;
            tabAdapter.notifyDataSetChanged();
            tabSwitcherOverlay.setVisibility(View.VISIBLE);
        }
    }

    @Override protected void onPause() { super.onPause(); }

    @Override
    protected void onDestroy() {
        dismissNativeTxConfirm();
        saveTabs();
        mPageSeq.clear();
        WebView _mvDestroy = MainActivity.getMainWebView();
        if (_mvDestroy != null) {
            _mvDestroy.post(() -> _mvDestroy.evaluateJavascript(
                "(function(){ if(window._w3mCurrentReq){try{window._oneFallbackOpenModal(window._w3mCurrentReq.reqId);}catch(_){}} })()", null));
        }
        for (Tab tab : tabs) {
            if (tab.webView != null) {
                tab.webView.stopLoading();
                if (tab.webView.getParent() != null)
                    webViewContainer.removeView(tab.webView);
                tab.webView.destroy();
                tab.webView = null;
            }
        }
        tabs.clear();
        sInstance = null; // null AFTER WebViews destroyed so pending callbacks don't NPE
        super.onDestroy();
    }

    // ── Tab persistence ──────────────────────────────────────────
    private void saveTabs() {
        try {
            JSONArray arr = new JSONArray();
            for (Tab tab : tabs) {
                String url = tab.webView != null ? tab.webView.getUrl() : tab.url;
                if (url == null || url.isEmpty()) url = tab.url;
                if (url == null || url.isEmpty() || url.equals("about:blank")) continue;
                arr.put(url);
            }
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
                .putString(TABS_KEY, arr.toString())
                .putInt(ACTIVE_TAB_KEY, activeTab)
                .apply();
        } catch (Exception ignored) {}
    }

    /** Returns true if at least one tab was restored */
    private boolean restoreTabs() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String json = prefs.getString(TABS_KEY, null);
            if (json == null) return false;
            JSONArray arr = new JSONArray(json);
            if (arr.length() == 0) return false;
            int savedActive = prefs.getInt(ACTIVE_TAB_KEY, 0);
            int target = Math.min(savedActive, arr.length() - 1);
            // Restore tabs without loading URLs — only load the active tab
            for (int i = 0; i < arr.length(); i++) {
                String url = arr.getString(i);
                if (url == null || url.isEmpty()) continue;
                Tab tab = new Tab();
                tab.url = url;
                tab.title = extractDomain(url);
                tab.webView = createWebView();
                webViewContainer.addView(tab.webView);
                tab.webView.setVisibility(View.GONE);
                tabs.add(tab);
            }
            updateTabCount();
            // Use switchToTab so lazy-load triggers correctly for the active tab
            if (target >= 0 && target < tabs.size()) {
                tabs.get(target).loaded = false; // ensure lazy-load fires in switchToTab
                switchToTab(target);
            }
            return !tabs.isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public void onBackPressed() {
        if (txConfirmOverlay != null) { rejectNativeTxConfirm(); return; }
        if (nativeChainPickerOverlay != null && nativeChainPickerOverlay.getVisibility() == View.VISIBLE) { hideNativeChainPicker(); return; }
        if (nativeWalletDrawerOverlay != null && nativeWalletDrawerOverlay.getVisibility() == View.VISIBLE) { hideNativeWalletDrawer(); return; }
        if (historyOverlay.getVisibility() == View.VISIBLE) { hideHistoryPanel(); return; }
        if (tabSwitcherOverlay.getVisibility() == View.VISIBLE) { hideTabSwitcher(); return; }
        if (searchOverlay.getVisibility() == View.VISIBLE) { closeSearchOverlay(); return; }
        WebView wv = activeWebView();
        if (wv != null && wv.canGoBack()) wv.goBack();
        else returnToMain(); // no more history → return to MainActivity without destroying
    }

    // ── Helpers ──────────────────────────────────────────────────
    private void updateNavButtons() {
        WebView wv = activeWebView();
        btnBack.setAlpha(wv != null && wv.canGoBack() ? 1.0f : 0.3f);
        if (btnForward != null) btnForward.setAlpha(wv != null && wv.canGoForward() ? 1.0f : 0.3f);
    }

    private void updateLock(String url) {
        ivLock.setVisibility((url != null && url.startsWith("https://")) ? View.VISIBLE : View.GONE);
    }

    private String extractDomain(String url) {
        if (url == null || url.equals("about:blank")) return "New Tab";
        try { Uri uri = Uri.parse(url); String host = uri.getHost(); return host != null ? host : url; }
        catch (Exception e) { return url; }
    }

    private void showKeyboard(View view) {
        InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (imm != null) imm.showSoftInput(view, InputMethodManager.SHOW_IMPLICIT);
    }

    private void hideKeyboard() {
        InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (imm == null) return;
        // Use etSearch window token as fallback — covers cases where focus
        // is already cleared (e.g. overlay set to GONE before dismiss call)
        android.view.View focused = getCurrentFocus();
        android.os.IBinder token = focused != null
            ? focused.getWindowToken()
            : (etSearch != null ? etSearch.getWindowToken() : null);
        if (token != null) imm.hideSoftInputFromWindow(token, 0);
        // Also force-clear focus from etSearch so keyboard doesn't linger
        if (etSearch != null) etSearch.clearFocus();
    }

    // ══════════════════════════════════════════════════════════════
    // Native Chain Picker Adapter
    // ══════════════════════════════════════════════════════════════
    private class NativeChainAdapter extends RecyclerView.Adapter<NativeChainAdapter.VH> {
        private java.util.List<java.util.Map<String,String>> data = new java.util.ArrayList<>();

        void setData(java.util.List<java.util.Map<String,String>> list) {
            data = list;
            notifyDataSetChanged();
        }

        class VH extends RecyclerView.ViewHolder {
            android.widget.ImageView ivLogo;
            TextView tvName, tvSub, tvCheck;
            android.view.View itemRoot;
            VH(android.view.View v) {
                super(v);
                ivLogo   = v.findViewById(android.R.id.icon);
                tvName   = v.findViewById(android.R.id.text1);
                tvSub    = v.findViewById(android.R.id.text2);
                tvCheck  = v.findViewById(android.R.id.button1);
                itemRoot = v;
            }
        }

        @Override
        public VH onCreateViewHolder(ViewGroup parent, int viewType) {
            // Build row programmatically
            android.widget.LinearLayout row = new android.widget.LinearLayout(parent.getContext());
            row.setOrientation(android.widget.LinearLayout.HORIZONTAL);
            row.setPadding(28, 22, 28, 22);
            row.setGravity(android.view.Gravity.CENTER_VERTICAL);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                row.setBackground(new android.graphics.drawable.RippleDrawable(
                    android.content.res.ColorStateList.valueOf(0x336366F1), null, null));
            }
            row.setLayoutParams(new RecyclerView.LayoutParams(RecyclerView.LayoutParams.MATCH_PARENT, RecyclerView.LayoutParams.WRAP_CONTENT));

            // Logo container
            android.widget.FrameLayout logoFrame = new android.widget.FrameLayout(parent.getContext());
            int sz = dp(40);
            android.widget.LinearLayout.LayoutParams lfp = new android.widget.LinearLayout.LayoutParams(sz, sz);
            lfp.setMarginEnd(dp(12));
            logoFrame.setLayoutParams(lfp);
            android.widget.ImageView logo = new android.widget.ImageView(parent.getContext());
            logo.setId(android.R.id.icon);
            logo.setScaleType(android.widget.ImageView.ScaleType.CENTER_CROP);
            android.widget.FrameLayout.LayoutParams logolp = new android.widget.FrameLayout.LayoutParams(sz, sz);
            logoFrame.addView(logo, logolp);
            row.addView(logoFrame);

            // Text block
            android.widget.LinearLayout textBlock = new android.widget.LinearLayout(parent.getContext());
            textBlock.setOrientation(android.widget.LinearLayout.VERTICAL);
            android.widget.LinearLayout.LayoutParams tbp = new android.widget.LinearLayout.LayoutParams(0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
            textBlock.setLayoutParams(tbp);
            TextView name = new TextView(parent.getContext());
            name.setId(android.R.id.text1);
            name.setTextColor(0xFFE5E7EB);
            name.setTextSize(13f);
            name.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
            name.setMaxLines(1);
            name.setEllipsize(android.text.TextUtils.TruncateAt.END);
            TextView sub = new TextView(parent.getContext());
            sub.setId(android.R.id.text2);
            sub.setTextColor(0xFF6B7280);
            sub.setTextSize(10f);
            sub.setTypeface(android.graphics.Typeface.MONOSPACE);
            textBlock.addView(name);
            textBlock.addView(sub);
            row.addView(textBlock);

            // Checkmark
            TextView check = new TextView(parent.getContext());
            check.setId(android.R.id.button1);
            check.setText("✓");
            check.setTextColor(0xFF6366F1);
            check.setTextSize(18f);
            check.setPadding(dp(8), 0, 0, 0);
            row.addView(check);

            return new VH(row);
        }

        @Override
        public void onBindViewHolder(VH holder, int pos) {
            java.util.Map<String,String> m = data.get(pos);
            String name = m.containsKey("name") ? m.get("name") : "";
            String cid  = m.containsKey("chainId") ? m.get("chainId") : "";
            String hex  = m.containsKey("hex") ? m.get("hex") : "";
            String logo = m.containsKey("logoURI") ? m.get("logoURI") : "";
            boolean sel = "1".equals(m.get("selected") != null ? m.get("selected") : "") || hex.equalsIgnoreCase(selectedChainId);

            holder.tvName.setText(name);
            holder.tvSub.setText("Chain ID " + cid);
            holder.tvCheck.setVisibility(sel ? View.VISIBLE : View.GONE);

            // Set background tint based on selection
            holder.itemRoot.setAlpha(1f);

            // Load logo with tag-check to prevent wrong logo on recycled rows
            if (!logo.isEmpty()) {
                final String logoUrl = logo;
                final android.widget.ImageView iv = holder.ivLogo;
                iv.setTag(logoUrl); // mark expected URL before async load
                iv.setImageDrawable(null);
                new Thread(() -> {
                    try {
                        java.net.HttpURLConnection conn2 = (java.net.HttpURLConnection) new java.net.URL(logoUrl).openConnection();
                        conn2.setConnectTimeout(4000);
                        conn2.setReadTimeout(4000);
                        conn2.connect();
                        android.graphics.Bitmap bmpLoaded = null;
                        try {
                            bmpLoaded = android.graphics.BitmapFactory.decodeStream(conn2.getInputStream());
                        } finally {
                            conn2.disconnect();
                        }
                        final android.graphics.Bitmap bmp = bmpLoaded;
                        if (bmp != null) runOnUiThread(() -> {
                            // Only apply if this ImageView still expects this URL
                            if (logoUrl.equals(iv.getTag())) {
                                iv.setImageBitmap(bmp);
                                iv.setClipToOutline(true);
                            }
                        });
                    } catch (Exception ignored) {}
                }).start();
            } else {
                holder.ivLogo.setImageDrawable(null);
            }

            holder.itemRoot.setOnClickListener(v -> {
                hideNativeChainPicker();
                // Notify Java bridge
                String h = hex;
                String n = name;
                String l = logo;
                saveSelectedChain(h, n, l);
                updateChainButton();
                WebView dApp = activeWebView();
                if (dApp != null) {
                    String safeId = h.replace("\"","\\\"");
                    String accts  = selectedWalletAddress != null
                        ? "[\"" + selectedWalletAddress.replace("\"","\\\"") + "\"]" : "[]";
                    dApp.post(() -> {
                        dApp.evaluateJavascript("window._oneBrowserChainId = \"" + safeId + "\";", null);
                        dApp.evaluateJavascript("window.ethereum && window.ethereum._updateState(" + accts + ", \"" + safeId + "\");", null);
                    });
                }
                // Also notify main wallet WebView so oneBrowserChainId stays in sync
                WebView mv2 = MainActivity.getMainWebView();
                if (mv2 != null) {
                    String safeId2   = h.replace("\\","\\\\").replace("\"","\\\"");
                    String safeAddr2 = selectedWalletAddress != null
                        ? selectedWalletAddress.replace("\\","\\\\").replace("\"","\\\"") : "";
                    final boolean hasWallet2 = !safeAddr2.isEmpty();
                    final String _si2 = safeId2;
                    final String _sa2 = safeAddr2;
                    mv2.post(() -> mv2.evaluateJavascript(
                        "(function(){" +
                        // Only sync wallet if one is selected
                        (hasWallet2 ? "try{if(window.oneSetBrowserSelectedWallet)window.oneSetBrowserSelectedWallet(\"" + _sa2 + "\",\"" + _si2 + "\");}catch(_){}" : "") +
                        // Always fire web3UpdateAccount so dApp gets chainChanged
                        "try{OneAndroid.web3UpdateAccount(" + (hasWallet2 ? "JSON.stringify([\"" + _sa2 + "\"])" : "JSON.stringify([])") + ",\"" + _si2 + "\");}catch(_){}" +
                        "})()", null));
                }
            });
        }

        @Override public int getItemCount() { return data.size(); }

        private int dp(int dp) {
            return Math.round(dp * getResources().getDisplayMetrics().density);
        }
    }

    // ══════════════════════════════════════════════════════════════
    // Native Wallet Group Adapter
    // ══════════════════════════════════════════════════════════════
    private class NativeWalletGroupAdapter extends RecyclerView.Adapter<NativeWalletGroupAdapter.VH> {
        private final int[] COLORS = { 0xFF6366F1, 0xFF8B5CF6, 0xFF06B6D4, 0xFF10B981,
                                        0xFFF59E0B, 0xFFEF4444, 0xFFEC4899, 0xFF14B8A6 };
        // Track expanded state per group ID (string) — NOT position, which shifts on rebind
        private final java.util.Set<String> expandedGroupIds = new java.util.HashSet<>();

        class VH extends RecyclerView.ViewHolder {
            TextView tvGroupName, tvGroupCount, tvChevron;
            LockableScrollView scrollContainer;
            android.widget.LinearLayout walletContainer;
            android.view.View groupHeader;
            VH(android.view.View v) {
                super(v);
                tvGroupName     = v.findViewById(android.R.id.text1);
                tvGroupCount    = v.findViewById(android.R.id.text2);
                tvChevron       = v.findViewById(android.R.id.icon1);
                scrollContainer = (LockableScrollView) v.findViewWithTag("wallet_scroll");
                walletContainer = v.findViewById(android.R.id.list);
                groupHeader     = v.findViewById(android.R.id.content);
            }
        }

        @Override
        public VH onCreateViewHolder(ViewGroup parent, int viewType) {
            android.widget.LinearLayout root = new android.widget.LinearLayout(parent.getContext());
            root.setOrientation(android.widget.LinearLayout.VERTICAL);
            root.setPadding(0, 0, 0, dp(4));
            root.setLayoutParams(new RecyclerView.LayoutParams(RecyclerView.LayoutParams.MATCH_PARENT, RecyclerView.LayoutParams.WRAP_CONTENT));

            // Group header row — tappable
            android.widget.LinearLayout header = new android.widget.LinearLayout(parent.getContext());
            header.setId(android.R.id.content);
            header.setOrientation(android.widget.LinearLayout.HORIZONTAL);
            header.setGravity(android.view.Gravity.CENTER_VERTICAL);
            header.setPadding(dp(12), dp(10), dp(12), dp(10));
            header.setBackgroundColor(0x14FFFFFF);
            header.setClickable(true);
            header.setFocusable(true);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                header.setBackground(new android.graphics.drawable.RippleDrawable(
                    android.content.res.ColorStateList.valueOf(0x336366F1),
                    new android.graphics.drawable.ColorDrawable(0x14FFFFFF), null));
            }
            android.widget.LinearLayout.LayoutParams hp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
            header.setLayoutParams(hp);

            android.widget.LinearLayout textCol = new android.widget.LinearLayout(parent.getContext());
            textCol.setOrientation(android.widget.LinearLayout.VERTICAL);
            android.widget.LinearLayout.LayoutParams tcp = new android.widget.LinearLayout.LayoutParams(0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
            textCol.setLayoutParams(tcp);

            TextView gName = new TextView(parent.getContext());
            gName.setId(android.R.id.text1);
            gName.setTextColor(0xFFE5E7EB);
            gName.setTextSize(12f);
            gName.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
            TextView gCount = new TextView(parent.getContext());
            gCount.setId(android.R.id.text2);
            gCount.setTextColor(0xFF6B7280);
            gCount.setTextSize(10f);
            textCol.addView(gName);
            textCol.addView(gCount);
            header.addView(textCol);

            // Chevron arrow
            TextView chevron = new TextView(parent.getContext());
            chevron.setId(android.R.id.icon1);
            chevron.setText("▶");
            chevron.setTextColor(0xFF6B7280);
            chevron.setTextSize(10f);
            chevron.setPadding(dp(4), 0, 0, 0);
            header.addView(chevron);

            root.addView(header);

            // Wallet container — LockableScrollView locks parent scroll on touch
            LockableScrollView scrollView = new LockableScrollView(parent.getContext());
            scrollView.setTag("wallet_scroll");
            scrollView.setVisibility(android.view.View.GONE);
            scrollView.setFillViewport(true);
            android.widget.LinearLayout.LayoutParams svp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
            svp.setMarginStart(dp(8));
            scrollView.setLayoutParams(svp);

            android.widget.LinearLayout walletBox = new android.widget.LinearLayout(parent.getContext());
            walletBox.setId(android.R.id.list);
            walletBox.setOrientation(android.widget.LinearLayout.VERTICAL);
            walletBox.setLayoutParams(new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT));
            scrollView.addView(walletBox);
            root.addView(scrollView);

            return new VH(root);
        }

        @Override
        public void onBindViewHolder(VH holder, int pos) {
            int color = COLORS[pos % COLORS.length];
            holder.walletContainer.removeAllViews();

            String groupId = "pos_" + pos; // fallback key
            try {
                org.json.JSONObject g = nativeWalletGroupsData.getJSONObject(pos);
                // Use stable group ID (from JS) if available, otherwise fall back to name or position
                String gId = g.optString("id", "");
                if (!gId.isEmpty()) groupId = "id_" + gId;
                else {
                    String gname2 = g.optString("name", "");
                    groupId = gname2.isEmpty() ? ("pos_" + pos) : ("name_" + gname2);
                }
            } catch (Exception ignored) {}

            final String stableGroupId = groupId;
            boolean expanded = expandedGroupIds.contains(stableGroupId);

            try {
                org.json.JSONObject g = nativeWalletGroupsData.getJSONObject(pos);
                String gname = g.optString("name", "Group " + (pos+1));
                org.json.JSONArray wallets = g.optJSONArray("wallets");
                int wcount = wallets != null ? wallets.length() : 0;
                holder.tvGroupName.setText(gname);
                holder.tvGroupCount.setText(wcount + " wallet(s)");

                // Build wallet rows
                if (wallets != null) {
                    for (int i = 0; i < wallets.length(); i++) {
                        try {
                            org.json.JSONObject w = wallets.getJSONObject(i);
                            String addr  = w.optString("address", "");
                            String label = w.optString("label", "Wallet " + (i + 1));
                            holder.walletContainer.addView(buildWalletRow(holder.walletContainer.getContext(), addr, label, color));
                        } catch (Exception ignored) {}
                    }
                }
            } catch (Exception ignored) {}

            // Apply expand/collapse state — cap height to 40% of screen, scroll inside
            int maxH = (int)(getResources().getDisplayMetrics().heightPixels * 0.40f);
            android.view.ViewGroup.LayoutParams svlp = holder.scrollContainer.getLayoutParams();
            svlp.height = expanded ? maxH : 0;
            holder.scrollContainer.setLayoutParams(svlp);
            holder.scrollContainer.setVisibility(expanded ? android.view.View.VISIBLE : android.view.View.GONE);
            holder.tvChevron.setText(expanded ? "▼" : "▶");
            holder.tvChevron.setTextColor(expanded ? 0xFF6366F1 : 0xFF6B7280);

            // Toggle on header tap — use stable group ID so position shifts don't break state
            holder.groupHeader.setOnClickListener(v -> {
                if (expandedGroupIds.contains(stableGroupId)) {
                    expandedGroupIds.remove(stableGroupId);
                } else {
                    expandedGroupIds.add(stableGroupId);
                }
                int p = holder.getAdapterPosition();
                if (p != RecyclerView.NO_POSITION) notifyItemChanged(p);
            });
        }

        @Override public int getItemCount() {
            return nativeWalletGroupsData.length();
        }

        private int dp(int d) { return Math.round(d * getResources().getDisplayMetrics().density); }
    }

    // ── Builds a single wallet row view (used by NativeWalletGroupAdapter LinearLayout) ───────────────
    private android.view.View buildWalletRow(android.content.Context ctx, String addr, String label, int accentColor) {
        int dp1 = Math.round(getResources().getDisplayMetrics().density);
        android.widget.LinearLayout row = new android.widget.LinearLayout(ctx);
        row.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        row.setGravity(android.view.Gravity.CENTER_VERTICAL);
        row.setPadding(10*dp1, 8*dp1, 10*dp1, 8*dp1);
        row.setLayoutParams(new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT));
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            row.setBackground(new android.graphics.drawable.RippleDrawable(
                android.content.res.ColorStateList.valueOf(0x3310B981), null, null));
        }
        // Selected indicator bar
        android.view.View bar = new android.view.View(ctx);
        boolean isSel = addr.equalsIgnoreCase(selectedWalletAddress != null ? selectedWalletAddress : "");
        android.widget.LinearLayout.LayoutParams barlp = new android.widget.LinearLayout.LayoutParams(3*dp1, 36*dp1);
        barlp.setMarginEnd(8*dp1);
        bar.setLayoutParams(barlp);
        bar.setBackgroundColor(isSel ? 0xFF10B981 : 0x00000000);
        row.addView(bar);

        // Text block
        android.widget.LinearLayout tb = new android.widget.LinearLayout(ctx);
        tb.setOrientation(android.widget.LinearLayout.VERTICAL);
        tb.setLayoutParams(new android.widget.LinearLayout.LayoutParams(0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        TextView tvLabel = new TextView(ctx);
        tvLabel.setText(label + (isSel ? " ✓" : ""));
        tvLabel.setTextSize(11f);
        tvLabel.setTextColor(isSel ? 0xFF10B981 : 0xFF9CA3AF);
        String shortAddr = addr.length() > 10 ? addr.substring(0,6) + "..." + addr.substring(addr.length()-4) : addr;
        TextView tvAddr = new TextView(ctx);
        tvAddr.setText(shortAddr);
        tvAddr.setTextSize(11f);
        tvAddr.setTypeface(android.graphics.Typeface.MONOSPACE);
        tvAddr.setTextColor(isSel ? 0xFF6EE7B7 : 0xFFC4B5FD);
        tb.addView(tvLabel);
        tb.addView(tvAddr);
        row.addView(tb);

        // Row click: select if not selected, deselect if already selected
        // FIX: do NOT capture isSel in lambda — read live from selectedWalletAddress
        // so that after a different wallet is selected, old rows still correctly show
        // "deselect" vs "select" behaviour without requiring a full rebind.
        row.setClickable(true);
        row.setFocusable(true);
        row.setOnClickListener(v -> {
            boolean currentlySelected = addr.equalsIgnoreCase(
                selectedWalletAddress != null ? selectedWalletAddress : "");
            if (currentlySelected) {
                performWalletDeselect();
            } else {
                // Select this wallet
                saveSelectedWallet(addr);
                hideNativeWalletDrawer();
                WebView dApp = activeWebView();
                String chain = selectedChainId != null ? selectedChainId : "0x1";
                // FIX: escape both double-quote AND single-quote for JS string safety
                String safeAddrDQ  = addr.replace("\\","\\\\").replace("\"","\\\"");
                String safeAddrSQ  = addr.replace("\\","\\\\").replace("'","\\'");
                String safeChainDQ = chain.replace("\\","\\\\").replace("\"","\\\"");
                String safeChainSQ = chain.replace("\\","\\\\").replace("'","\\'");
                if (dApp != null) {
                    dApp.post(() -> {
                        // Use double-quoted strings so single-quotes in address (none expected, but safe)
                        dApp.evaluateJavascript(
                            "window._oneBwdSelected=\"" + safeAddrDQ + "\";", null);
                        dApp.evaluateJavascript(
                            "window.ethereum&&window.ethereum._updateState([\"" + safeAddrDQ + "\"],\"" + safeChainDQ + "\");", null);
                        // Resolve any dApp-side pending promises for eth_requestAccounts
                        dApp.evaluateJavascript(
                            "(function(){var p=window._oneW3Pending||{};Object.keys(p).forEach(function(id){try{p[id].resolve([\"" + safeAddrDQ + "\"]);}catch(_){}delete p[id];});})()", null);
                    });
                }
                WebView mv = MainActivity.getMainWebView();
                if (mv != null) {
                    final String _sa = safeAddrDQ;
                    final String _sc = safeChainDQ;
                    mv.post(() -> mv.evaluateJavascript(
                        "(function(){" +
                        // Resolve pending eth_requestAccounts so dApp wallet connect completes
                        "if(window._onePendingBrowserReqId){" +
                        "  try{OneAndroid.web3Resolve(window._onePendingBrowserReqId,JSON.stringify([\"" + _sa + "\"]));}catch(_){}" +
                        "  window._onePendingBrowserReqId=null;" +
                        "}" +
                        // Pass chainId so _oneBrowserChainId is correctly set
                        "window.oneSetBrowserSelectedWallet&&window.oneSetBrowserSelectedWallet(\"" + _sa + "\",\"" + _sc + "\");" +
                        // Update account state in dApp provider
                        "try{OneAndroid.web3UpdateAccount(JSON.stringify([\"" + _sa + "\"]),\"" + _sc + "\");}catch(_){}" +
                        "})()", null));
                }
                nativeWalletGroupAdapter.notifyDataSetChanged();
            }
        });
        return row;
    }

    /** Clears the selected wallet and notifies both WebViews. Called only when no web3 modal is pending. */
    private void performWalletDeselect() {
        selectedWalletAddress = null;
        android.content.SharedPreferences.Editor ed = getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE).edit();
        ed.remove(KEY_SELECTED_WALLET).apply();
        hideNativeWalletDrawer();
        WebView dApp = activeWebView();
        if (dApp != null) {
            dApp.post(() -> {
                dApp.evaluateJavascript("window._oneBwdSelected=null;", null);
                dApp.evaluateJavascript("window.ethereum&&window.ethereum._updateState([],null);", null);
            });
        }
        WebView mv = MainActivity.getMainWebView();
        if (mv != null) {
            mv.post(() -> mv.evaluateJavascript(
                "(function(){" +
                "window.oneSetBrowserSelectedWallet&&window.oneSetBrowserSelectedWallet(null,null);" +
                "try{OneAndroid.web3UpdateAccount(JSON.stringify([]),null);}catch(_){}" +
                "})()", null));
        }
        if (nativeWalletGroupAdapter != null) nativeWalletGroupAdapter.notifyDataSetChanged();
    }

    // ── LockableScrollView: consumes all touch so parent RV never steals scroll ──────────────────────
    private static class LockableScrollView extends android.widget.ScrollView {
        private float startY;

        LockableScrollView(android.content.Context ctx) {
            super(ctx);
        }

        @Override
        public boolean onInterceptTouchEvent(android.view.MotionEvent ev) {
            if (ev.getActionMasked() == android.view.MotionEvent.ACTION_DOWN) {
                startY = ev.getY();
            }
            return super.onInterceptTouchEvent(ev);
        }

        @Override
        public boolean onTouchEvent(android.view.MotionEvent ev) {
            switch (ev.getActionMasked()) {
                case android.view.MotionEvent.ACTION_DOWN:
                    startY = ev.getY();
                    getParent().requestDisallowInterceptTouchEvent(true);
                    break;
                case android.view.MotionEvent.ACTION_MOVE:
                    float dy = Math.abs(ev.getY() - startY);
                    if (dy > 0) getParent().requestDisallowInterceptTouchEvent(true);
                    break;
                case android.view.MotionEvent.ACTION_UP:
                case android.view.MotionEvent.ACTION_CANCEL:
                    getParent().requestDisallowInterceptTouchEvent(false);
                    break;
            }
            return super.onTouchEvent(ev);
        }

        // Always consume touch so parent RV cannot steal it
        @Override
        public boolean dispatchTouchEvent(android.view.MotionEvent ev) {
            getParent().requestDisallowInterceptTouchEvent(true);
            return super.dispatchTouchEvent(ev);
        }
    }
}







