# ── One Wallet ProGuard Rules ──

# Keep WebView JavaScript bridge methods (must not be obfuscated)
-keepclassmembers class com.one.wallet.bridge.OneAndroidBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep every @JavascriptInterface method in the app, including the dApp bridge
# (InAppBrowserActivity$OneWeb3Bridge). These methods are only called by name from page JS, so R8
# would otherwise treat them as unused and remove or rename them in release builds.
-keepclassmembers class com.one.wallet.** {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface

# Keep MainActivity & ForegroundService
-keep class com.one.wallet.MainActivity { *; }
-keep class com.one.wallet.service.OneForegroundService { *; }

# Keep WebViewClient overrides
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String, android.graphics.Bitmap);
    public boolean *(android.webkit.WebView, java.lang.String);
}

# Keep Biometric classes
-keep class androidx.biometric.** { *; }

# Remove all console logging in release (security: no key/address leaks via logcat)
-assumenosideeffects class android.util.Log {
    public static int d(...);
    public static int v(...);
    public static int i(...);
    public static int w(...);
    public static int e(...);
}

# Keep enums
-keepclassmembers enum * { *; }

# Keep Parcelable
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep annotations
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
