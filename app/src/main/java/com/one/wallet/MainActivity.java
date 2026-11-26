package com.one.wallet;

import com.one.wallet.bridge.OneAndroidBridge;
import com.one.wallet.browser.InAppBrowserActivity;
import com.one.wallet.service.OneForegroundService;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

import java.lang.ref.WeakReference;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicInteger;

public class MainActivity extends AppCompatActivity {

    public WebView webView;
    private View appLockOverlay;

    // ── App Lock State ──────────────────────────────────────
    private boolean mLockRequired = false;
    private boolean mAuthInProgress = false;

    // Static weak ref
    private static java.lang.ref.WeakReference<WebView> sMainWebViewRef;

    public static void callJsOnMainWebView(final String js) {
        WebView wv = sMainWebViewRef != null ? sMainWebViewRef.get() : null;
        if (wv == null) return;
        wv.post(() -> wv.evaluateJavascript(js, null));
    }

    public static WebView getMainWebView() {
        return sMainWebViewRef != null ? sMainWebViewRef.get() : null;
    }
    private ValueCallback<Uri[]> filePathCallback;
    private PermissionRequest pendingPermissionRequest = null;
    public static final int NOTIF_PERMISSION_REQUEST_CODE = 200;
    private static final int CAMERA_PERMISSION_REQUEST_CODE = 300;
    private static final String CHANNEL_ID = "one_wallet_channel";
    private static final String SILENT_CHANNEL_ID = "one_wallet_silent_v2";
    private static final String FOREGROUND_CHANNEL_ID = "one_wallet_fg_service";
    private static final String CHANNEL_NAME = "One Wallet";
    public final AtomicInteger notifIdCounter = new AtomicInteger(1);
    public final AtomicInteger notifCount = new AtomicInteger(0);

    // Launchers
    private ActivityResultLauncher<Intent> fileChooserLauncher;
    private ActivityResultLauncher<Intent> inAppBrowserLauncher;

    public static final String[] EXTERNAL_BROWSER_DOMAINS = {
        "etherscan.io", "basescan.org", "bscscan.com", "arbiscan.io",
        "polygonscan.com", "snowtrace.io", "ftmscan.com", "scrollscan.com",
        "blastscan.io", "socketscan.io", "optimistic.etherscan.io",
        "gnosisscan.io", "moonscan.io", "celoscan.io", "cronoscan.com",
        "fraxscan.com", "taikoscan.io", "sonicscan.org", "storyscan.io",
        "seitrace.com", "berascan.com", "kromascan.com", "opbnbscan.com",
        "klaytnscope.com", "worldscan.org", "bobascan.com", "chiliscan.com",
        "apescan.io", "abscan.org", "scan.coredao.org", "zkevm.polygonscan.com",
        "soneium-minato.blockscout.com", "blockscout.lisk.com",
        "testnet.monadexplorer.com", "andromeda-explorer.metis.io",
        "apex-explorer.proofofplay.com", "app.roninchain.com",
        "explorer.zksync.io", "explorer.zora.energy", "explorer.mantle.xyz",
        "explorer.mode.network", "explorer.aurora.dev", "explorer.kava.io",
        "explorer.fuse.io", "explorer.degen.tips", "explorer.gobob.xyz",
        "explorer.gravity.xyz", "explorer.hyperliquid.xyz", "explorer.immutable.com",
        "explorer.inkonchain.com", "explorer.lumia.org", "explorer.mintchain.io",
        "explorer.reya.network", "explorer.rsk.co", "explorer.sanko.xyz",
        "explorer.snaxchain.io", "explorer.sophon.xyz", "explorer.xai-chain.net",
        "explorer.rango.exchange"
    };

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        android.webkit.WebView.setWebContentsDebuggingEnabled(true);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.activity_main);

        appLockOverlay = findViewById(R.id.appLockOverlay);

        createNotificationChannels();

        fileChooserLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (filePathCallback == null) return;
                Uri[] results = null;
                if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                    results = WebChromeClient.FileChooserParams.parseResult(
                        result.getResultCode(), result.getData());
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
        );

        inAppBrowserLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> { /* no-op */ }
        );

        webView = findViewById(R.id.webView);
        sMainWebViewRef = new java.lang.ref.WeakReference<>(webView);
        setupWebView();
        loadOneWallet();
        startForegroundServiceCompat();
    }

    // ══════════════════════════════════════════
    //  App Lock
    // ══════════════════════════════════════════

    private void showLockOverlay() {
        if (appLockOverlay == null) return;
        appLockOverlay.setVisibility(View.VISIBLE);
        appLockOverlay.setOnClickListener(v -> triggerBiometric());
    }

    private void hideLockOverlay() {
        if (appLockOverlay == null) return;
        appLockOverlay.setVisibility(View.GONE);
        appLockOverlay.setOnClickListener(null);
    }

    private void triggerBiometric() {
        if (mAuthInProgress) return;

        BiometricManager bm = BiometricManager.from(this);
        boolean canAuth = bm.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG |
            BiometricManager.Authenticators.BIOMETRIC_WEAK
        ) == BiometricManager.BIOMETRIC_SUCCESS;

        if (!canAuth) {
            mLockRequired = false;
            mAuthInProgress = false;
            hideLockOverlay();
            return;
        }

        mAuthInProgress = true;
        Executor executor = ContextCompat.getMainExecutor(this);
        BiometricPrompt prompt = new BiometricPrompt(this, executor,
            new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                    mLockRequired = false;
                    mAuthInProgress = false;
                    hideLockOverlay();
                }
                @Override
                public void onAuthenticationFailed() {
                    mAuthInProgress = false;
                }
                @Override
                public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                    mAuthInProgress = false;
                }
            });

        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
            .setTitle("One Wallet")
            .setSubtitle("Verify your identity to continue")
            .setNegativeButtonText("Cancel")
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG |
                BiometricManager.Authenticators.BIOMETRIC_WEAK)
            .build();

        prompt.authenticate(info);
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;

            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("One Wallet alerts and updates");
            channel.enableLights(true);
            channel.enableVibration(true);
            nm.createNotificationChannel(channel);

            NotificationChannel silentChannel = new NotificationChannel(
                SILENT_CHANNEL_ID, CHANNEL_NAME + " (Silent)", NotificationManager.IMPORTANCE_LOW);
            silentChannel.setDescription("One Wallet silent notifications");
            silentChannel.enableLights(false);
            silentChannel.enableVibration(false);
            silentChannel.setVibrationPattern(new long[]{0L});
            silentChannel.setSound(null, null);
            nm.createNotificationChannel(silentChannel);

            NotificationChannel fgChannel = new NotificationChannel(
                FOREGROUND_CHANNEL_ID, "One Wallet Running", NotificationManager.IMPORTANCE_LOW);
            fgChannel.setDescription("Keeps transactions running in background");
            fgChannel.enableLights(false);
            fgChannel.enableVibration(false);
            fgChannel.setSound(null, null);
            fgChannel.setShowBadge(false);
            nm.createNotificationChannel(fgChannel);
        }
    }

    private void startForegroundServiceCompat() {
        Intent serviceIntent = new Intent(this, OneForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();

        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(
            "Mozilla/5.0 (Linux; Android " + Build.VERSION.RELEASE +
            "; " + Build.MODEL + ") AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
        );

        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, false);

        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, false);
        }

        webView.addJavascriptInterface(new OneAndroidBridge(this), "OneAndroid");
        // Same bridge instance also exposed as window.OneBridge for the
        // native httpGet() method used by fetchJsonWithFallback in
        // index.html (CORS-free exchange ticker fetches).
        webView.addJavascriptInterface(new OneAndroidBridge(this), "OneBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("file://")) return false;
                if (url.startsWith("one://")) return true;
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    String urlLower = url.toLowerCase();
                    for (String domain : EXTERNAL_BROWSER_DOMAINS) {
                        if (urlLower.contains(domain)) {
                            try {
                                Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                                browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(browserIntent);
                            } catch (Exception ignored) {}
                            return true;
                        }
                    }
                    openInAppBrowser(url, null);
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.evaluateJavascript(
                    "window.isOneAndroid = true; " +
                    "window.OneAndroidVersion = '2.1'; " +
                    "console.log('[OneAndroid] WebView bridge ready v2.1');",
                    null
                );
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                boolean needsCamera = false;
                for (String resource : request.getResources()) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                        needsCamera = true;
                        break;
                    }
                }
                if (needsCamera) {
                    if (ContextCompat.checkSelfPermission(MainActivity.this,
                            android.Manifest.permission.CAMERA)
                            != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                        pendingPermissionRequest = request;
                        ActivityCompat.requestPermissions(
                            MainActivity.this,
                            new String[]{android.Manifest.permission.CAMERA},
                            CAMERA_PERMISSION_REQUEST_CODE
                        );
                        return;
                    }
                }
                request.grant(request.getResources());
            }

            @Override
            public boolean onShowFileChooser(WebView webView,
                                              ValueCallback<Uri[]> filePathCallback,
                                              FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                    MainActivity.this.filePathCallback = null;
                }
                MainActivity.this.filePathCallback = filePathCallback;
                try {
                    fileChooserLauncher.launch(fileChooserParams.createIntent());
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    filePathCallback.onReceiveValue(null);
                    return false;
                }
                return true;
            }
        });
    }

    private void loadOneWallet() {
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIF_PERMISSION_REQUEST_CODE) {
            boolean granted = grantResults.length > 0 &&
                grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED;
            String js = "if(window._oneNotifPermCallback) window._oneNotifPermCallback(" + granted + ");";
            if (webView != null) webView.evaluateJavascript(js, null);
        } else if (requestCode == CAMERA_PERMISSION_REQUEST_CODE) {
            boolean granted = grantResults.length > 0 &&
                grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED;
            if (granted && pendingPermissionRequest != null) {
                pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
            } else if (!granted && pendingPermissionRequest != null) {
                pendingPermissionRequest.deny();
                if (webView != null) webView.evaluateJavascript(
                    "if(typeof _showQrPermissionUI === 'function') _showQrPermissionUI();", null);
            }
            pendingPermissionRequest = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView == null) return;
        webView.evaluateJavascript(
            "(function(){" +
            "  var evt = new PopStateEvent('popstate', {bubbles:false,cancelable:false,state:null});" +
            "  window.dispatchEvent(evt);" +
            "})();",
            null
        );
    }

    @Override
    protected void onPause() {
        super.onPause();
        mAuthInProgress = false;
    }

    @Override
    protected void onDestroy() {
        sMainWebViewRef = null;
        if (isFinishing()) {
            stopService(new Intent(this, OneForegroundService.class));
        }
        if (webView != null) {
            if (webView.getParent() != null) {
                ((android.view.ViewGroup) webView.getParent()).removeView(webView);
            }
            webView.stopLoading();
            webView.clearHistory();
            webView.removeAllViews();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    // ── System UI visibility for chart fullscreen ──
    public boolean mChartFullscreen = false;
    public boolean mChartLandscape = false;
    public boolean mChartSensor    = false;

    @SuppressWarnings("deprecation")
    public void hideSystemUI() {
        Window w = getWindow();
        View decor = w.getDecorView();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            androidx.core.view.WindowCompat.setDecorFitsSystemWindows(w, false);
            androidx.core.view.WindowInsetsControllerCompat ic =
                androidx.core.view.WindowCompat.getInsetsController(w, decor);
            ic.hide(androidx.core.view.WindowInsetsCompat.Type.systemBars());
            ic.setSystemBarsBehavior(
                androidx.core.view.WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        } else {
            decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            );
        }

    }

    @SuppressWarnings("deprecation")
    public void showSystemUI() {
        Window w = getWindow();
        View decor = w.getDecorView();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            androidx.core.view.WindowCompat.setDecorFitsSystemWindows(w, true);
            androidx.core.view.WindowInsetsControllerCompat ic =
                androidx.core.view.WindowCompat.getInsetsController(w, decor);
            ic.show(androidx.core.view.WindowInsetsCompat.Type.systemBars());
        } else {
            decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            );
        }
    }

    @Override
    public void onConfigurationChanged(android.content.res.Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (mChartFullscreen) {
            hideSystemUI();
        } else {
            showSystemUI();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && mChartFullscreen) {
            hideSystemUI();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();

        if (mChartFullscreen) {
            if (mChartSensor) {
                setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR);
                hideSystemUI();
            } else if (mChartLandscape) {
                setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                hideSystemUI();
            } else {
                // Portrait fullscreen: lock to portrait
                setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    int activeCount = nm.getActiveNotifications().length;
                    if (activeCount <= 1) {
                        notifCount.set(0);
                        notifIdCounter.set(1);
                    }
                }
            } catch (Exception e) {}
        }
    }

    public void openInAppBrowserNewTab() {
        runOnUiThread(() -> {
            InAppBrowserActivity existing = InAppBrowserActivity.getInstance();
            if (existing != null) {
                Intent bringFront = new Intent(this, InAppBrowserActivity.class);
                bringFront.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                bringFront.putExtra(InAppBrowserActivity.EXTRA_SHOW_TABS, true);
                startActivity(bringFront);
            } else {
                Intent intent = new Intent(this, InAppBrowserActivity.class);
                intent.putExtra(InAppBrowserActivity.EXTRA_URL, "about:blank");
                intent.putExtra(InAppBrowserActivity.EXTRA_SHOW_TABS, true);
                inAppBrowserLauncher.launch(intent);
            }
        });
    }

    public void openInAppBrowser(String url, String title) {
        final MainActivity self = this;
        runOnUiThread(() -> {
            InAppBrowserActivity existing = InAppBrowserActivity.getInstance();
            if (existing != null) {
                boolean isBlank = url == null || url.isEmpty() || url.equals("about:blank");
                Intent bringFront = new Intent(self, InAppBrowserActivity.class);
                bringFront.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                if (!isBlank) {
                    bringFront.putExtra(InAppBrowserActivity.EXTRA_URL, url);
                } else {
                    bringFront.putExtra(InAppBrowserActivity.EXTRA_SHOW_TABS, true);
                }
                self.startActivity(bringFront);
            } else {
                Intent intent = new Intent(self, InAppBrowserActivity.class);
                intent.putExtra(InAppBrowserActivity.EXTRA_URL, url != null ? url : "about:blank");
                if (title != null) intent.putExtra(InAppBrowserActivity.EXTRA_TITLE, title);
                inAppBrowserLauncher.launch(intent);
            }
        });
    }

    public void _sendNotification(String title, String body, String explorerUrl, boolean silent) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (notifIdCounter.get() > 50) return;
        if (title != null && title.length() > 100) title = title.substring(0, 100);
        if (body != null && body.length() > 300) body = body.substring(0, 300);

        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
            : PendingIntent.FLAG_UPDATE_CURRENT;

        PendingIntent pendingIntent = null;
        if (explorerUrl != null && explorerUrl.toLowerCase().trim().startsWith("https://")) {
            Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(explorerUrl));
            browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            pendingIntent = PendingIntent.getActivity(this, notifIdCounter.get(), browserIntent, flags);
        }

        String channelId = silent ? SILENT_CHANNEL_ID : CHANNEL_ID;
        int priority = silent ? NotificationCompat.PRIORITY_LOW : NotificationCompat.PRIORITY_HIGH;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title != null ? title : "One Wallet")
            .setContentText(body != null ? body : "")
            .setPriority(priority)
            .setAutoCancel(true);

        if (pendingIntent != null) builder.setContentIntent(pendingIntent);
        if (silent) {
            builder.setSound(null);
            builder.setVibrate(new long[]{0L});
            builder.setDefaults(0);
        }
        nm.notify(notifIdCounter.getAndIncrement(), builder.build());
    }
}
