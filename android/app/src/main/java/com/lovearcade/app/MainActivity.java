package com.lovearcade.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WallpaperStoragePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
