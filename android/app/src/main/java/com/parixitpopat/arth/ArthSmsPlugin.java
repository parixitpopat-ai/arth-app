package com.parixitpopat.arth;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Bank-message access for Arth, only after the person allows it:
 *  - readInbox: on request, money-looking messages already on the phone (for "Read SMS from phone").
 *  - takePending / ackPending: the messages SmsReceiver caught as they arrived (for the bell list).
 * Only messages that mention an amount (Rs / INR / rupee sign) are passed to the app; every other message stays on the phone, unread by Arth.
 * Nothing is stored elsewhere or sent anywhere from here.
 */
@CapacitorPlugin(
    name = "ArthSms",
    permissions = {
        @Permission(alias = "sms", strings = { Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS }),
        @Permission(alias = "notify", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class ArthSmsPlugin extends Plugin {

    private static final Pattern AMOUNT = Pattern.compile("(?i)(rs\\.?|inr|\\u20B9)\\s*[0-9][0-9,]*");

    private boolean has(String permission) {
        return ContextCompat.checkSelfPermission(getContext(), permission) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean canRead() { return has(Manifest.permission.READ_SMS); }
    private boolean canReceive() { return has(Manifest.permission.RECEIVE_SMS); }
    private boolean canNotify() {
        return NotificationManagerCompat.from(getContext()).areNotificationsEnabled()
            && (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || has(Manifest.permission.POST_NOTIFICATIONS));
    }

    private void resolveStatus(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", canRead());          // may read the inbox
        r.put("receive", canReceive());       // gets each message as it arrives
        r.put("notify", canNotify());         // may show a notification
        call.resolve(r);
    }

    @PluginMethod
    public void status(PluginCall call) {
        resolveStatus(call);
    }

    @PluginMethod
    public void requestAccess(PluginCall call) {
        List<String> need = new ArrayList<>();
        if (!canRead() || !canReceive()) need.add("sms");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !has(Manifest.permission.POST_NOTIFICATIONS)) need.add("notify");
        if (need.isEmpty()) {
            resolveStatus(call);
            return;
        }
        requestPermissionForAliases(need.toArray(new String[0]), call, "accessResult");
    }

    @PermissionCallback
    private void accessResult(PluginCall call) {
        resolveStatus(call);
    }

    @PluginMethod
    public void readInbox(PluginCall call) {
        if (!canRead()) {
            call.reject("SMS access is not allowed. Allow it in the phone's settings for Arth.");
            return;
        }
        long since = call.getLong("sinceMs", 0L);
        int limit = call.getInt("limit", 3000);
        JSArray out = new JSArray();
        String[] cols = { "_id", "address", "body", "date" };
        try (Cursor c = getContext().getContentResolver().query(Uri.parse("content://sms/inbox"), cols, "date > ?", new String[] { String.valueOf(since) }, "date DESC")) {
            if (c != null) {
                int iId = c.getColumnIndex("_id"), iAd = c.getColumnIndex("address"), iBody = c.getColumnIndex("body"), iDate = c.getColumnIndex("date");
                int kept = 0, looked = 0;
                while (c.moveToNext() && kept < limit && looked < 30000) {
                    looked++;
                    String body = c.getString(iBody);
                    if (body == null || !AMOUNT.matcher(body).find()) continue;
                    JSObject m = new JSObject();
                    m.put("id", c.getString(iId));
                    m.put("address", c.getString(iAd));
                    m.put("body", body);
                    m.put("date", c.getLong(iDate));
                    out.put(m);
                    kept++;
                }
            }
        } catch (Exception e) {
            call.reject("Could not read messages: " + e.getMessage());
            return;
        }
        JSObject r = new JSObject();
        r.put("messages", out);
        call.resolve(r);
    }

    /** The messages caught as they arrived and not yet acknowledged by the app. */
    @PluginMethod
    public void takePending(PluginCall call) {
        try {
            SharedPreferences sp = getContext().getSharedPreferences(SmsReceiver.PREFS, Context.MODE_PRIVATE);
            JSObject r = new JSObject();
            r.put("messages", new JSArray(sp.getString(SmsReceiver.KEY_QUEUE, "[]")));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Could not read the waiting messages: " + e.getMessage());
        }
    }

    /** The app has stored these (by id); drop them from the phone-side queue. */
    @PluginMethod
    public void ackPending(PluginCall call) {
        try {
            JSONArray ids = call.getArray("ids");
            Set<String> drop = new HashSet<>();
            if (ids != null) for (int i = 0; i < ids.length(); i++) drop.add(ids.getString(i));
            SharedPreferences sp = getContext().getSharedPreferences(SmsReceiver.PREFS, Context.MODE_PRIVATE);
            JSONArray q = new JSONArray(sp.getString(SmsReceiver.KEY_QUEUE, "[]"));
            JSONArray keep = new JSONArray();
            for (int i = 0; i < q.length(); i++) {
                JSONObject o = q.getJSONObject(i);
                if (!drop.contains(o.optString("id"))) keep.put(o);
            }
            sp.edit().putString(SmsReceiver.KEY_QUEUE, keep.toString()).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not update the waiting messages: " + e.getMessage());
        }
    }
}
