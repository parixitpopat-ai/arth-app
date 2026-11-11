package com.parixitpopat.arth;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ArthSmsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
