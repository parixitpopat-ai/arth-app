package com.parixitpopat.arth;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Catches each incoming text message. Only a message that looks like a bank/card money movement (an amount plus debited/credited/spent wording, and not an
 * OTP, an advance notice or a reminder) is kept: it is put in a small queue on the phone (read later by the app) and a notification is shown. Every other
 * message is ignored and never stored. Nothing leaves the phone. The same rules exist in src/domain/sms/smsInbox.js, which makes the final decision.
 */
public class SmsReceiver extends BroadcastReceiver {
    static final String PREFS = "arth_sms";
    static final String KEY_QUEUE = "queue";
    static final String CHANNEL = "arth_bank_sms";
    private static final int MAX_QUEUE = 200;

    private static final Pattern AMOUNT = Pattern.compile("(?i)(rs\\.?|inr|\\u20B9)\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)");
    private static final Pattern MOVE = Pattern.compile("(?i)\\b(debited|credited|spent|paid|purchase|withdrawn|sent|received|deposited|refund(?:ed)?|reversal|cashback)\\b");
    private static final Pattern MOVE_STRONG = Pattern.compile("(?i)\\b(debited|credited|spent)\\b");
    private static final Pattern OTP = Pattern.compile("(?i)\\b(otp|one[- ]time|verification code|cvv)\\b");
    private static final Pattern PROMO = Pattern.compile("(?i)\\b(offer|apply now|pre-?approved|eligible|win|click|t&c|loan up to)\\b");
    private static final Pattern[] NOTICE = new Pattern[] {
        Pattern.compile("(?i)\\b(?:to be|will be|shall be|is going to be|going to be)\\s+(?:debited|charged|deducted|auto-?debited)\\b"),
        Pattern.compile("(?i)\\b(?:upcoming|scheduled)\\b[^.]{0,40}\\b(?:debit|payment|mandate)\\b"),
        Pattern.compile("(?i)\\bstatement\\b[^.]{0,60}\\b(?:sent|generated|ready|available|due)\\b"),
        Pattern.compile("(?i)\\b(?:total|minimum|min\\.?)\\s+(?:amount\\s+)?due\\b"),
        Pattern.compile("(?i)\\bdue\\s+(?:date|on|by)\\b"),
        Pattern.compile("(?i)\\bpayment\\s+(?:reminder|due)\\b"),
        Pattern.compile("(?i)\\bbill\\b[^.]{0,30}\\b(?:generated|due)\\b"),
    };

    static boolean looksLikeMoney(String body) {
        if (body == null || !AMOUNT.matcher(body).find() || !MOVE.matcher(body).find() || OTP.matcher(body).find()) return false;
        for (Pattern p : NOTICE) if (p.matcher(body).find()) return false;
        if (PROMO.matcher(body).find() && !MOVE_STRONG.matcher(body).find()) return false;
        return true;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        SmsMessage[] parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (parts == null || parts.length == 0) return;
        // a long message arrives in several parts: join the parts of each sender
        Map<String, StringBuilder> bodies = new LinkedHashMap<>();
        Map<String, Long> times = new LinkedHashMap<>();
        for (SmsMessage m : parts) {
            if (m == null) continue;
            String from = m.getOriginatingAddress() == null ? "" : m.getOriginatingAddress();
            StringBuilder b = bodies.get(from);
            if (b == null) { b = new StringBuilder(); bodies.put(from, b); times.put(from, m.getTimestampMillis()); }
            if (m.getMessageBody() != null) b.append(m.getMessageBody());
        }
        for (Map.Entry<String, StringBuilder> e : bodies.entrySet()) {
            String body = e.getValue().toString();
            if (!looksLikeMoney(body)) continue;
            long when = times.get(e.getKey());
            String id = e.getKey() + "|" + when + "|" + body.hashCode();
            if (enqueue(context, id, e.getKey(), body, when)) notifyUser(context, body, id);
        }
    }

    private static boolean enqueue(Context context, String id, String address, String body, long when) {
        try {
            SharedPreferences sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONArray q = new JSONArray(sp.getString(KEY_QUEUE, "[]"));
            for (int i = 0; i < q.length(); i++) if (id.equals(q.getJSONObject(i).optString("id"))) return false;
            JSONObject o = new JSONObject();
            o.put("id", id); o.put("address", address); o.put("body", body); o.put("date", when);
            q.put(o);
            JSONArray trimmed = new JSONArray();
            for (int i = Math.max(0, q.length() - MAX_QUEUE); i < q.length(); i++) trimmed.put(q.get(i));
            sp.edit().putString(KEY_QUEUE, trimmed.toString()).apply();
            return true;
        } catch (Exception ex) {
            return false;
        }
    }

    private static void notifyUser(Context context, String body, String id) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "Bank messages", NotificationManager.IMPORTANCE_DEFAULT);
                ch.setDescription("A bank or card message that looks like a transaction");
                context.getSystemService(NotificationManager.class).createNotificationChannel(ch);
            }
            Matcher m = AMOUNT.matcher(body);
            String amount = m.find() ? "Rs. " + m.group(2) : "A transaction";
            Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (open != null) open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pi = open == null ? null : PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            // lock screen: say only that there is something to review, not the amount
            NotificationCompat.Builder pub = new NotificationCompat.Builder(context, CHANNEL).setSmallIcon(R.drawable.ic_stat_arth).setContentTitle("Arth").setContentText("New bank message to review");
            NotificationCompat.Builder b = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_arth)
                .setContentTitle("New bank message")
                .setContentText(amount + " · tap to review in Arth")
                .setAutoCancel(true)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(pub.build());
            if (pi != null) b.setContentIntent(pi);
            NotificationManagerCompat nm = NotificationManagerCompat.from(context);
            if (nm.areNotificationsEnabled()) nm.notify(id.hashCode(), b.build());
        } catch (SecurityException se) {
            // notification permission not granted: the message is still queued and appears in Arth's bell
        } catch (Exception ignored) {
        }
    }
}
