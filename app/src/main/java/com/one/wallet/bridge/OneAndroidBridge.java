package com.one.wallet.bridge;

import com.one.wallet.MainActivity;
import com.one.wallet.browser.InAppBrowserActivity;
import com.one.wallet.service.OneForegroundService;

import android.app.NotificationManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import java.lang.ref.WeakReference;
import java.util.concurrent.Executor;

/**
 * JavaScript <-> Java interface exposed to the main WebView as {@code OneAndroid}
 * and {@code OneBridge}. Every method is annotated with {@code @JavascriptInterface}.
 */
public class OneAndroidBridge {
    private final WeakReference<MainActivity> activityRef;

    public OneAndroidBridge(MainActivity activity) {
        this.activityRef = new WeakReference<>(activity);
    }

    private MainActivity getActivity() { return activityRef.get(); }

    @JavascriptInterface
    public boolean isNotificationPermissionGranted() {
        MainActivity a = getActivity();
        if (a == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(a,
                android.Manifest.permission.POST_NOTIFICATIONS)
                == android.content.pm.PackageManager.PERMISSION_GRANTED;
        }
        NotificationManager nm = (NotificationManager) a.getSystemService(Context.NOTIFICATION_SERVICE);
        return nm != null && nm.areNotificationsEnabled();
    }

    @JavascriptInterface
    public void requestNotificationPermission() {
        MainActivity a = getActivity();
        if (a == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.requestPermissions(a,
                new String[]{android.Manifest.permission.POST_NOTIFICATIONS},
                a.NOTIF_PERMISSION_REQUEST_CODE);
        } else {
            a.runOnUiThread(() -> {
                if (a.webView != null)
                    a.webView.evaluateJavascript(
                        "if(window._oneNotifPermCallback) window._oneNotifPermCallback(true);", null);
            });
        }
    }

    @JavascriptInterface
    public void showNotification(String title, String body) {
        MainActivity a = getActivity(); if (a == null) return;
        int count = a.notifCount.incrementAndGet();
        a._sendNotification(title, body, null, count > 5);
    }

    @JavascriptInterface
    public void showNotificationWithUrl(String title, String body, String explorerUrl) {
        MainActivity a = getActivity(); if (a == null) return;
        int count = a.notifCount.incrementAndGet();
        a._sendNotification(title, body, explorerUrl, count > 5);
    }

    @JavascriptInterface
    public void showSilentNotification(String title, String body) {
        MainActivity a = getActivity(); if (a == null) return;
        a._sendNotification(title, body, null, true);
    }

    @JavascriptInterface
    public void resetNotifCount() {
        MainActivity a = getActivity(); if (a == null) return;
        a.notifCount.set(0);
        a.notifIdCounter.set(1);
    }

    @JavascriptInterface
    public void exitApp() {
        MainActivity a = getActivity(); if (a == null) return;
        a.runOnUiThread(() -> {
            a.stopService(new Intent(a, OneForegroundService.class));
            a.finishAffinity();
        });
    }

    @JavascriptInterface
    public boolean isBiometricAvailable() {
        MainActivity a = getActivity(); if (a == null) return false;
        BiometricManager bm = BiometricManager.from(a);
        return bm.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG |
            BiometricManager.Authenticators.BIOMETRIC_WEAK
        ) == BiometricManager.BIOMETRIC_SUCCESS;
    }

    @JavascriptInterface
    public void showBiometricPrompt(final String reason, final String callbackFn) {
        MainActivity a = getActivity(); if (a == null) return;
        if (callbackFn == null || !callbackFn.matches("[a-zA-Z_$][a-zA-Z0-9_$.]*")) return;
        a.runOnUiThread(() -> {
            Executor executor = ContextCompat.getMainExecutor(a);
            BiometricPrompt prompt = new BiometricPrompt(a, executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        MainActivity act = getActivity();
                        if (act == null || act.webView == null) return;
                        act.webView.evaluateJavascript(callbackFn + "('success');", null);
                    }
                    @Override public void onAuthenticationFailed() {}
                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        MainActivity act = getActivity();
                        if (act == null || act.webView == null) return;
                        String msg = (errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                                      errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON)
                            ? "cancelled" : "error";
                        act.webView.evaluateJavascript(callbackFn + "('" + msg + "');", null);
                    }
                });
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("One Wallet")
                .setSubtitle(reason)
                .setNegativeButtonText("Use PIN")
                .setAllowedAuthenticators(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG |
                    BiometricManager.Authenticators.BIOMETRIC_WEAK)
                .build();
            prompt.authenticate(info);
        });
    }

    @JavascriptInterface
    public void copyToClipboard(String text) {
        if (text == null) return;
        MainActivity a = getActivity(); if (a == null) return;
        final String finalText = text;
        a.runOnUiThread(() -> {
            ClipboardManager clipboard = (ClipboardManager)
                a.getSystemService(Context.CLIPBOARD_SERVICE);
            if (clipboard == null) return;
            clipboard.setPrimaryClip(ClipData.newPlainText("One Wallet", finalText));
            Toast.makeText(a, "Copied!", Toast.LENGTH_SHORT).show();
        });
    }

    @JavascriptInterface
    public String getClipboardText() {
        MainActivity a = getActivity(); if (a == null) return "";
        ClipboardManager clipboard = (ClipboardManager)
            a.getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard == null || !clipboard.hasPrimaryClip()) return "";
        ClipData clip = clipboard.getPrimaryClip();
        if (clip == null || clip.getItemCount() == 0) return "";
        CharSequence text = clip.getItemAt(0).getText();
        return text != null ? text.toString().trim() : "";
    }

    @JavascriptInterface
    public String getAndroidVersion() { return Build.VERSION.RELEASE; }

    @JavascriptInterface
    public String getDeviceModel() { return Build.MANUFACTURER + " " + Build.MODEL; }

    @JavascriptInterface
    public void openExternalUrl(String url) {
        if (url == null) return;
        String lower = url.toLowerCase().trim();
        if (!lower.startsWith("https://") && !lower.startsWith("http://")) return;
        MainActivity a = getActivity(); if (a == null) return;
        for (String domain : MainActivity.EXTERNAL_BROWSER_DOMAINS) {
            if (lower.contains(domain)) {
                a.runOnUiThread(() -> {
                    try {
                        Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        a.startActivity(browserIntent);
                    } catch (Exception ignored) {}
                });
                return;
            }
        }
        a.openInAppBrowser(url, null);
    }

    @JavascriptInterface
    public void openInAppBrowser(String url, String title) {
        if (url == null || url.trim().isEmpty()) return;
        String val = url.trim();
        String resolved;
        if (val.toLowerCase().startsWith("https://") || val.toLowerCase().startsWith("http://")) {
            resolved = val;
        } else if (!val.contains(" ") && val.matches("([a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,}([/?#].*)?")) {
            resolved = "https://" + val;
        } else {
            resolved = "https://www.google.com/search?q=" + android.net.Uri.encode(val);
        }
        MainActivity a = getActivity(); if (a == null) return;
        a.openInAppBrowser(resolved, title);
    }

    @JavascriptInterface
    public void shareText(String text) {
        if (text == null) return;
        MainActivity a = getActivity(); if (a == null) return;
        final String finalText = text;
        a.runOnUiThread(() -> {
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("text/plain");
            intent.putExtra(Intent.EXTRA_TEXT, finalText);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            a.startActivity(Intent.createChooser(intent, "Share via")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        });
    }

    @JavascriptInterface
    public boolean isAndroidApp() { return true; }

    // ── Web3 Bridge callbacks ──────────────────────────────
    @JavascriptInterface
    public void web3Resolve(final int reqId, final String resultJson) {
        InAppBrowserActivity.resolveFromMain(reqId, resultJson);
    }

    @JavascriptInterface
    public void web3Reject(final int reqId, final String message) {
        InAppBrowserActivity.rejectFromMain(reqId, message);
    }

    @JavascriptInterface
    public void web3UpdateAccount(final String accountsJson, final String chainId) {
        InAppBrowserActivity.updateAccountState(accountsJson, chainId);
    }

    @JavascriptInterface
    public void web3OpenWalletDrawer() {
        InAppBrowserActivity browser = InAppBrowserActivity.getInstance();
        if (browser != null) {
            browser.runOnUiThread(() -> browser.openWalletDrawerInBrowser());
            return;
        }
        MainActivity a = getActivity(); if (a == null) return;
        WebView mv = MainActivity.getMainWebView();
        if (mv == null) return;
        mv.post(() -> mv.evaluateJavascript(
            "typeof openBrowserWalletDrawer==='function' && openBrowserWalletDrawer();",
            null
        ));
    }

    @JavascriptInterface
    public void showTxModal(final String reqIdStr, final String actionLabel,
                            final String siteHost, final String bodyHtml,
                            final String approveLabel) {
        int reqId;
        try { reqId = Integer.parseInt(reqIdStr); } catch (Exception e) { return; }
        final int fReqId = reqId;
        InAppBrowserActivity browser = InAppBrowserActivity.getInstance();
        if (browser != null) {
            InAppBrowserActivity.injectTxModal(fReqId, actionLabel, siteHost, bodyHtml, approveLabel);
        } else {
            WebView mv = MainActivity.getMainWebView();
            if (mv != null) {
                mv.post(() -> mv.evaluateJavascript(
                    "(function(){ try { window._oneFallbackOpenModal(" + fReqId + "); } catch(e){} })()",
                    null
                ));
            }
        }
    }

    @JavascriptInterface
    public void dismissTxModal() {
        InAppBrowserActivity.dismissTxModal(-1);
    }

    @JavascriptInterface
    public void dismissTxModal(final int reqId) {
        InAppBrowserActivity.dismissTxModal(reqId);
    }

    @JavascriptInterface
    public void showDappTxSuccess(final String txHash, final String explorerUrl) {
        InAppBrowserActivity.injectTxSuccess(txHash, explorerUrl);
    }

    @JavascriptInterface
    public void openBrowserTabSwitcher() {
        MainActivity a = getActivity(); if (a == null) return;
        InAppBrowserActivity browser = InAppBrowserActivity.getInstance();
        if (browser != null) {
            a.runOnUiThread(() -> {
                Intent bringFront = new Intent(a, InAppBrowserActivity.class);
                bringFront.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                bringFront.putExtra(InAppBrowserActivity.EXTRA_SHOW_TABS, true);
                a.startActivity(bringFront);
            });
        } else {
            a.runOnUiThread(() -> a.openInAppBrowserNewTab());
        }
    }

    @JavascriptInterface
    public void web3SetSelectedWallet(final String address) {
        MainActivity a = getActivity(); if (a == null) return;
        WebView mv = MainActivity.getMainWebView();
        if (mv == null) return;
        String safeAddr = address == null ? "" : address.replace("\"", "\\\"");
        InAppBrowserActivity browser = InAppBrowserActivity.getInstance();
        String chainId = (browser != null) ? browser.getSelectedChainId() : "0x1";
        if (chainId == null || chainId.isEmpty()) chainId = "0x1";
        final String safeChain = chainId.replace("\"", "\\\"");
        mv.post(() -> mv.evaluateJavascript(
            "window.oneSetBrowserSelectedWallet && " +
            "window.oneSetBrowserSelectedWallet(\"" + safeAddr + "\", \"" + safeChain + "\");",
            null
        ));
    }

    @JavascriptInterface
    public String getSelectedBrowserChainId() {
        InAppBrowserActivity browser = InAppBrowserActivity.getInstance();
        if (browser == null) return "0x1";
        String chain = browser.getSelectedChainId();
        return (chain != null && !chain.isEmpty()) ? chain : "0x1";
    }

    @JavascriptInterface
    public String getPersistedBrowserWallet() {
        InAppBrowserActivity browser = InAppBrowserActivity.getInstance();
        if (browser == null) return "";
        return browser.getPersistedWalletAddress();
    }

    @JavascriptInterface
    public boolean isBrowserOpen() {
        return InAppBrowserActivity.getInstance() != null;
    }

    @JavascriptInterface
    public void showToast(final String message) {
        MainActivity a = getActivity();
        if (a == null || message == null) return;
        a.runOnUiThread(() ->
            android.widget.Toast.makeText(a, message, android.widget.Toast.LENGTH_LONG).show()
        );
    }

    @JavascriptInterface
    public void injectChainError(final String chainHex, final String chainIdDec) {
        InAppBrowserActivity.injectChainError(
            chainHex != null ? chainHex : "?",
            chainIdDec != null ? chainIdDec : "?"
        );
    }

    @JavascriptInterface
    public void web3SwitchChain(final String hexId, final String name) {
        if (hexId == null || hexId.isEmpty()) return;
        InAppBrowserActivity browser = InAppBrowserActivity.getInstance();
        if (browser == null) return;
        browser.runOnUiThread(() -> {
            String logoURI = InAppBrowserActivity.chainLogoFromId(hexId);
            browser.saveSelectedChain(hexId, name != null ? name : hexId, logoURI);
            browser.updateChainButton();
            String safeAddr = browser.getPersistedWalletAddress();
            String accts = !safeAddr.isEmpty()
                ? "[\"" + safeAddr + "\"]" : "[]";
            InAppBrowserActivity.updateAccountState(accts, hexId);
        });
    }

    @JavascriptInterface
    public void setOrientation(final String mode) {
        MainActivity a = getActivity();
        if (a == null) return;
        a.runOnUiThread(() -> {
            if ("sensor".equals(mode)) {
                a.mChartFullscreen = true;
                a.mChartLandscape = false;
                a.mChartSensor    = true;
                a.setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR);
                a.hideSystemUI();
            } else if ("landscape".equals(mode)) {
                a.mChartFullscreen = true;
                a.mChartLandscape = true;
                a.mChartSensor    = false;
                a.setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_USER_LANDSCAPE);
                a.hideSystemUI();
            } else if ("portrait".equals(mode)) {
                a.mChartFullscreen = true;
                a.mChartLandscape = false;
                a.mChartSensor    = false; // portrait lock — do NOT allow sensor rotation
                a.setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                // Portrait fullscreen: keep nav bar visible (do NOT hide system UI)
            } else if ("unspecified".equals(mode)) {
                a.mChartFullscreen = true;
                a.mChartLandscape = false;
                a.mChartSensor    = true;
                a.setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR);
                a.hideSystemUI();
            } else {
                // Exit fullscreen
                a.mChartFullscreen = false;
                a.mChartLandscape = false;
                a.mChartSensor    = false;
                a.setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                a.showSystemUI();
            }
        });
    }

    // ── Native HTTP bridge for market-data fetches ──────────────
    // Exposed to JS (index.html) as window.OneBridge.httpGet. Issues
    // the GET request via java.net.HttpURLConnection on a background
    // executor — no extra Gradle dependency — then delivers the JSON
    // result back into this WebView through
    // window.__nxBridgeResolve(callbackId, jsonString). Native requests
    // are not subject to the WebView's CORS restrictions, so this
    // removes the need for public CORS proxies (allorigins/codetabs/
    // corsproxy/thingproxy) for exchange ticker calls — those proxies
    // are rate-limited/unreliable and were the cause of repeated
    // "All fetch attempts failed" errors (e.g. DigiFinex).
    private static final java.util.concurrent.ExecutorService httpExecutor =
            java.util.concurrent.Executors.newFixedThreadPool(4);

    @JavascriptInterface
    public void httpGet(final String url, final String headersJson, final String callbackId) {
        if (url == null || callbackId == null) return;
        httpExecutor.execute(() -> {
            String resultJson;
            java.net.HttpURLConnection conn = null;
            try {
                java.net.URL u = new java.net.URL(url);
                conn = (java.net.HttpURLConnection) u.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");
                conn.setRequestProperty("Accept", "application/json, text/plain, */*");
                conn.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
                if (url.contains("lbkex.com")) {
                    conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                }
                // Optional extra headers from JS, e.g. {"X-CMC_PRO_API_KEY":"..."}.
                // These override the defaults above if the same header name is sent.
                if (headersJson != null && !headersJson.isEmpty()) {
                    try {
                        org.json.JSONObject hdrs = new org.json.JSONObject(headersJson);
                        java.util.Iterator<String> keys = hdrs.keys();
                        while (keys.hasNext()) {
                            String key = keys.next();
                            String value = hdrs.optString(key, null);
                            if (key != null && value != null) conn.setRequestProperty(key, value);
                        }
                    } catch (Exception ignored) {
                        // Malformed headers JSON — proceed with default headers only.
                    }
                }
                int status = conn.getResponseCode();
                java.io.InputStream is = (status >= 200 && status < 300)
                        ? conn.getInputStream() : conn.getErrorStream();
                String body = readHttpStream(is);
                org.json.JSONObject wrapper = new org.json.JSONObject();
                wrapper.put("ok", status >= 200 && status < 300);
                wrapper.put("status", status);
                wrapper.put("body", body != null ? body : "");
                resultJson = wrapper.toString();
            } catch (Exception e) {
                org.json.JSONObject err = new org.json.JSONObject();
                try {
                    err.put("ok", false);
                    err.put("status", 0);
                    err.put("error", e.getMessage() != null ? e.getMessage() : "unknown error");
                } catch (Exception ignored) {}
                resultJson = err.toString();
            } finally {
                if (conn != null) conn.disconnect();
            }
            deliverHttpResult(callbackId, resultJson);
        });
    }


    @JavascriptInterface
    public void httpPost(final String url, final String headersJson, final String bodyStr, final String callbackId) {
        if (url == null || callbackId == null) return;
        httpExecutor.execute(() -> {
            String resultJson;
            java.net.HttpURLConnection conn = null;
            try {
                java.net.URL u = new java.net.URL(url);
                conn = (java.net.HttpURLConnection) u.openConnection();
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);
                conn.setDoOutput(true);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");
                conn.setRequestProperty("Accept", "application/json, text/plain, */*");
                conn.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
                conn.setRequestProperty("Content-Type", "application/json");
                if (headersJson != null && !headersJson.isEmpty()) {
                    try {
                        org.json.JSONObject hdrs = new org.json.JSONObject(headersJson);
                        java.util.Iterator<String> keys = hdrs.keys();
                        while (keys.hasNext()) {
                            String key = keys.next();
                            String value = hdrs.optString(key, null);
                            if (key != null && value != null) conn.setRequestProperty(key, value);
                        }
                    } catch (Exception ignored) {}
                }
                if (bodyStr != null && !bodyStr.isEmpty()) {
                    byte[] bodyBytes = bodyStr.getBytes("UTF-8");
                    conn.setRequestProperty("Content-Length", String.valueOf(bodyBytes.length));
                    try (java.io.OutputStream os = conn.getOutputStream()) {
                        os.write(bodyBytes);
                    }
                }
                int status = conn.getResponseCode();
                java.io.InputStream is = (status >= 200 && status < 300)
                        ? conn.getInputStream() : conn.getErrorStream();
                String body = readHttpStream(is);
                org.json.JSONObject wrapper = new org.json.JSONObject();
                wrapper.put("ok", status >= 200 && status < 300);
                wrapper.put("status", status);
                wrapper.put("body", body != null ? body : "");
                resultJson = wrapper.toString();
            } catch (Exception e) {
                org.json.JSONObject err = new org.json.JSONObject();
                try {
                    err.put("ok", false);
                    err.put("status", 0);
                    err.put("error", e.getMessage() != null ? e.getMessage() : "unknown error");
                } catch (Exception ignored) {}
                resultJson = err.toString();
            } finally {
                if (conn != null) conn.disconnect();
            }
            deliverHttpResult(callbackId, resultJson);
        });
    }

    private static String readHttpStream(java.io.InputStream is) throws java.io.IOException {
        if (is == null) return "";
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = is.read(buf)) != -1) out.write(buf, 0, n);
        is.close();
        return out.toString("UTF-8");
    }

    private void deliverHttpResult(String callbackId, String resultJson) {
        MainActivity a = getActivity();
        if (a == null || a.webView == null) return;
        a.runOnUiThread(() -> {
            // Embed the already-valid JSON via a JS string literal, escaping
            // only what's needed to keep it a valid single-quoted JS string —
            // the receiving side does JSON.parse on it, so we never hand-build
            // JSON ourselves here.
            String escaped = resultJson
                    .replace("\\", "\\\\")
                    .replace("'", "\\'")
                    .replace("\n", "\\n")
                    .replace("\r", "");
            String js = "window.__nxBridgeResolve && window.__nxBridgeResolve('"
                    + callbackId + "', '" + escaped + "');";
            a.webView.evaluateJavascript(js, null);
        });
    }
}
