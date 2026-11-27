package com.one.wallet.service;

import com.one.wallet.MainActivity;
import com.one.wallet.R;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

public class OneForegroundService extends Service {

    private static final String FOREGROUND_CHANNEL_ID = "one_wallet_fg_service";
    private static final int FOREGROUND_NOTIF_ID = 9999;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannelIfNeeded();
        startForeground(FOREGROUND_NOTIF_ID, buildNotification());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // This service only holds the "running" notification; it has no work of its own to resume.
        // START_STICKY made Android re-create it (and its notification) after the app was killed.
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        // FIX: stopForeground(boolean) deprecated API 33+ → STOP_FOREGROUND_REMOVE
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
    }

    private void createChannelIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;
            if (nm.getNotificationChannel(FOREGROUND_CHANNEL_ID) != null) return;
            NotificationChannel ch = new NotificationChannel(
                FOREGROUND_CHANNEL_ID, "One Wallet Running", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Keeps transactions running in background");
            ch.enableLights(false);
            ch.enableVibration(false);
            ch.setSound(null, null);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int piFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
            : PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent pi = PendingIntent.getActivity(this, 0, openIntent, piFlags);

        return new NotificationCompat.Builder(this, FOREGROUND_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("One Wallet")
            .setContentText("Transaction engine running...")
            .setContentIntent(pi)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setSilent(true)
            .setShowWhen(false)
            .build();
    }
}
