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
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import java.lang.ref.WeakReference;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.Executor;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

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

    /** True when the phone is in dark theme (used by Settings > Appearance > System). */
    @JavascriptInterface
    public boolean isSystemDark() {
        MainActivity a = getActivity();
        if (a == null) return true;
        int night = a.getResources().getConfiguration().uiMode
                & android.content.res.Configuration.UI_MODE_NIGHT_MASK;
        return night == android.content.res.Configuration.UI_MODE_NIGHT_YES;
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
        if (MainActivity.isExternalBrowserUrl(url)) {
            a.runOnUiThread(() -> {
                try {
                    Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    a.startActivity(browserIntent);
                } catch (Exception ignored) {}
            });
            return;
        }
        a.openInAppBrowser(url, null);
    }

    /** Opens this app's system settings page (used when camera access was denied). */
    @JavascriptInterface
    public void openAppSettings() {
        MainActivity a = getActivity(); if (a == null) return;
        a.runOnUiThread(() -> {
            try {
                Intent i = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.fromParts("package", a.getPackageName(), null));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                a.startActivity(i);
            } catch (Exception ignored) {}
        });
    }

    /** Always opens the phone's own default browser (never the in-app browser), for any http(s) URL. */
    @JavascriptInterface
    public void openInSystemBrowser(String url) {
        if (url == null) return;
        String lower = url.toLowerCase().trim();
        if (!lower.startsWith("https://") && !lower.startsWith("http://")) return;
        MainActivity a = getActivity(); if (a == null) return;
        a.runOnUiThread(() -> {
            try {
                Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url.trim()));
                browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                a.startActivity(browserIntent);
            } catch (Exception ignored) {}
        });
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
        // Empty clears the selection; anything else must be a well-formed address.
        if (address != null && !address.isEmpty() && !InAppBrowserActivity.isValidAddress(address)) return;
        final String safeAddr = InAppBrowserActivity.jsStr(address == null ? "" : address);
        InAppBrowserActivity browser = InAppBrowserActivity.getInstance();
        String chainId = (browser != null) ? browser.getSelectedChainId() : "0x1";
        if (!InAppBrowserActivity.isValidChainId(chainId)) chainId = "0x1";
        final String safeChain = InAppBrowserActivity.jsStr(chainId);
        mv.post(() -> mv.evaluateJavascript(
            "window.oneSetBrowserSelectedWallet && " +
            "window.oneSetBrowserSelectedWallet(" + safeAddr + ", " + safeChain + ");",
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
        if (!InAppBrowserActivity.isValidChainId(hexId)) return;
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
        if (url == null || !isSafeCallbackId(callbackId)) return;
        httpExecutor.execute(() -> {
            String resultJson;
            java.net.HttpURLConnection conn = null;
            try {
                java.net.URL u = checkedBridgeUrl(url);
                int status;
                // Redirects are followed by hand so every hop is re-validated (https, no private
                // target) and never leaves the original host; the default auto-follow skipped both.
                for (int hop = 0; ; hop++) {
                conn = (java.net.HttpURLConnection) u.openConnection();
                conn.setInstanceFollowRedirects(false);
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
                status = conn.getResponseCode();
                java.net.URL next = hop < MAX_BRIDGE_REDIRECTS ? nextRedirect(conn, u, status) : null;
                if (next == null) break;
                conn.disconnect();
                u = next;
                }
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
        if (url == null || !isSafeCallbackId(callbackId)) return;
        httpExecutor.execute(() -> {
            String resultJson;
            java.net.HttpURLConnection conn = null;
            try {
                java.net.URL u = checkedBridgeUrl(url);
                conn = (java.net.HttpURLConnection) u.openConnection();
                conn.setInstanceFollowRedirects(false); // a redirect would skip the private-address check
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

    // Limits for the native HTTP bridge (BUG-015, partial): https only, no loopback / private /
    // link-local targets, bounded response size, and a callback id that cannot break out of the
    // JS string it is placed in. Redirects are re-validated hop by hop and limited to the same host.
    // A per-host allow-list is NOT applied here: this bridge serves
    // exchange and aggregator calls to many user-chosen hosts, so it needs device testing first.
    private static final int MAX_HTTP_BODY_BYTES = 8 * 1024 * 1024;
    private static final java.util.regex.Pattern CALLBACK_ID_RE =
            java.util.regex.Pattern.compile("[A-Za-z0-9_-]{1,64}");

    private static boolean isSafeCallbackId(String id) {
        return id != null && CALLBACK_ID_RE.matcher(id).matches();
    }

    private static java.net.URL checkedBridgeUrl(String url) throws java.io.IOException {
        java.net.URL u = new java.net.URL(url);
        if (!"https".equalsIgnoreCase(u.getProtocol())) throw new java.io.IOException("only https is allowed");
        String host = u.getHost();
        if (host == null || host.isEmpty() || u.getUserInfo() != null) throw new java.io.IOException("invalid host");
        for (java.net.InetAddress a : java.net.InetAddress.getAllByName(host)) {
            if (isBlockedAddress(a)) throw new java.io.IOException("blocked address");
        }
        return u;
    }

    /** Loopback, wildcard, link-local, private (incl. IPv6 unique-local fc00::/7 and CGNAT 100.64/10), multicast. */
    private static boolean isBlockedAddress(java.net.InetAddress a) {
        if (a.isAnyLocalAddress() || a.isLoopbackAddress() || a.isLinkLocalAddress()
                || a.isSiteLocalAddress() || a.isMulticastAddress()) return true;
        byte[] b = a.getAddress();
        if (b.length == 4) {
            int b0 = b[0] & 0xff, b1 = b[1] & 0xff;
            return b0 == 0 || (b0 == 100 && b1 >= 64 && b1 <= 127);
        }
        return b.length == 16 && (b[0] & 0xfe) == 0xfc;
    }

    private static final int MAX_BRIDGE_REDIRECTS = 3;

    /**
     * For a 3xx response returns the validated redirect target, or null when the response is not a
     * redirect. Throws if the target is not https / is a private address / is on another host (custom
     * request headers such as API keys must not be replayed to a different host).
     */
    private static java.net.URL nextRedirect(java.net.HttpURLConnection conn, java.net.URL cur, int status)
            throws java.io.IOException {
        if (status != 301 && status != 302 && status != 303 && status != 307 && status != 308) return null;
        String loc = conn.getHeaderField("Location");
        if (loc == null || loc.isEmpty()) return null;
        java.net.URL next = checkedBridgeUrl(new java.net.URL(cur, loc).toString());
        if (!next.getHost().equalsIgnoreCase(cur.getHost())) {
            throw new java.io.IOException("redirect to another host blocked");
        }
        return next;
    }

    private static String readHttpStream(java.io.InputStream is) throws java.io.IOException {
        if (is == null) return "";
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = is.read(buf)) != -1) {
            out.write(buf, 0, n);
            if (out.size() > MAX_HTTP_BODY_BYTES) {
                is.close();
                throw new java.io.IOException("response too large");
            }
        }
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

    // ── Android Keystore wrapping for the wallet master secret (BUG-002) ──
    // The JS lock code keeps one random "master secret" that the wallet keys are encrypted with.
    // It used to sit in localStorage in plaintext, next to the ciphertext. It is now stored wrapped
    // (AES-256-GCM) with a non-exportable key that lives in the Android Keystore, so reading the
    // app's storage files alone does not reveal it.
    private static final String KS_ALIAS = "one_master_wrap_v1";
    private static final String KS_PREFIX = "ks1:";

    private static SecretKey getOrCreateWrapKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(KS_ALIAS)) {
            KeyStore.Entry entry = ks.getEntry(KS_ALIAS, null);
            if (entry instanceof KeyStore.SecretKeyEntry) {
                return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
            }
        }
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        kg.init(new KeyGenParameterSpec.Builder(KS_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return kg.generateKey();
    }

    /** Wraps {@code plain}; returns "ks1:&lt;iv&gt;.&lt;ciphertext&gt;" or "" when the Keystore is unusable. */
    @JavascriptInterface
    public String keystoreWrap(String plain) {
        if (plain == null || plain.isEmpty()) return "";
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateWrapKey());
            byte[] iv = cipher.getIV();
            byte[] ct = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            return KS_PREFIX + Base64.encodeToString(iv, Base64.NO_WRAP)
                    + "." + Base64.encodeToString(ct, Base64.NO_WRAP);
        } catch (Exception e) {
            return "";
        }
    }

    /** Reverses {@link #keystoreWrap}; returns "" if the value is not a valid wrapped secret. */
    @JavascriptInterface
    public String keystoreUnwrap(String wrapped) {
        if (wrapped == null || !wrapped.startsWith(KS_PREFIX)) return "";
        try {
            String[] parts = wrapped.substring(KS_PREFIX.length()).split("\\.");
            if (parts.length != 2) return "";
            byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
            byte[] ct = Base64.decode(parts[1], Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateWrapKey(), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(ct), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }
}
