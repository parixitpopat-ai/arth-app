package com.parixitpopat.arth;

import android.Manifest;
import android.database.Cursor;
import android.net.Uri;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.regex.Pattern;

/**
 * Reads money-looking text messages from the phone's SMS inbox, only when the person taps a button in Arth and has allowed SMS access.
 * Only messages that mention an amount (Rs / INR / rupee sign) are passed to the app; every other message stays on the phone, unread by Arth.
 * Nothing is stored or sent from here.
 */
@CapacitorPlugin(
    name = "ArthSms",
    permissions = { @Permission(alias = "sms", strings = { Manifest.permission.READ_SMS }) }
)
public class ArthSmsPlugin extends Plugin {

    private static final Pattern AMOUNT = Pattern.compile("(?i)(rs\\.?|inr|\\u20B9)\\s*[0-9][0-9,]*");

    private boolean granted() {
        return getPermissionState("sms") == PermissionState.GRANTED;
    }

    private void resolveStatus(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", granted());
        call.resolve(r);
    }

    @PluginMethod
    public void status(PluginCall call) {
        resolveStatus(call);
    }

    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (granted()) {
            resolveStatus(call);
            return;
        }
        requestPermissionForAlias("sms", call, "accessResult");
    }

    @PermissionCallback
    private void accessResult(PluginCall call) {
        resolveStatus(call);
    }

    @PluginMethod
    public void readInbox(PluginCall call) {
        if (!granted()) {
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
}
