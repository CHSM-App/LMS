package com.lms.lms_app

import android.os.StatFs
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "lms/device").setMethodCallHandler { call, result ->
            when (call.method) {
                // Free bytes on the volume that holds app-private storage (offline videos).
                "freeBytes" -> result.success(StatFs(filesDir.absolutePath).availableBytes)
                // FLAG_SECURE while an offline video plays: screenshots and recordings come out black.
                "setSecure" -> {
                    if (call.arguments == true) window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                    else window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }
}
