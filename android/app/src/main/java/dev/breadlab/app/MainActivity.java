package dev.breadlab.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Offline shell around bread_lab.html. The page is loaded from assets and
 * never talks to the network. Android and HarmonyOS builds share this class;
 * the flavor only changes applicationId and the platform meta-data.
 */
public class MainActivity extends Activity {
    private static final int REQ_SAVE = 41;
    private static final int REQ_OPEN = 42;
    private static final int CREAM = 0xFFFDFBF7;

    private static final String BACK_JS =
            "(function(){var ov=document.getElementById('cook-overlay');" +
            "if(ov&&!ov.classList.contains('hidden')&&window.BreadLab&&window.BreadLab.closeCookMode){" +
            "window.BreadLab.closeCookMode();return true;}return false;})()";

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingExport;
    private final AtomicBoolean backInFlight = new AtomicBoolean(false);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);
        styleSystemBars();
        configureWebView();
        webView.addJavascriptInterface(new NativeBridge(), "BreadLabNative");
        webView.loadUrl("file:///android_asset/bread_lab.html");
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        if (!backInFlight.compareAndSet(false, true)) {
            return;
        }
        webView.evaluateJavascript(BACK_JS, value -> runOnUiThread(() -> {
            backInFlight.set(false);
            if ("true".equals(value)) {
                return;
            }
            finish();
        }));
    }

    @SuppressWarnings("deprecation")
    private void styleSystemBars() {
        getWindow().setStatusBarColor(CREAM);
        getWindow().setNavigationBarColor(CREAM);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setGeolocationEnabled(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null) {
                    return true;
                }
                String scheme = uri.getScheme();
                return scheme != null && !"file".equals(scheme) && !"about".equals(scheme);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), REQ_OPEN);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                    Toast.makeText(
                            MainActivity.this,
                            "Не удалось открыть выбор файла",
                            Toast.LENGTH_LONG).show();
                }
                return true;
            }
        });
    }

    private void startSave(String content) {
        pendingExport = content;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, "breadlab-export.json");
        try {
            startActivityForResult(intent, REQ_SAVE);
        } catch (ActivityNotFoundException e) {
            pendingExport = null;
            Toast.makeText(this, "Не удалось открыть сохранение файла", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_SAVE) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingExport != null) {
                writeExport(data.getData(), pendingExport);
            }
            pendingExport = null;
            return;
        }
        if (requestCode == REQ_OPEN) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                result = new Uri[] {data.getData()};
            }
            if (fileCallback != null) {
                fileCallback.onReceiveValue(result);
                fileCallback = null;
            }
        }
    }

    private void writeExport(Uri uri, String content) {
        try (OutputStream os = getContentResolver().openOutputStream(uri)) {
            if (os == null) {
                throw new IOException("empty stream");
            }
            os.write(content.getBytes(StandardCharsets.UTF_8));
            Toast.makeText(this, "Экспорт сохранён", Toast.LENGTH_SHORT).show();
        } catch (IOException e) {
            Toast.makeText(this, "Не удалось сохранить файл", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        if (webView != null) {
            if (webView.getParent() instanceof ViewGroup) {
                ((ViewGroup) webView.getParent()).removeView(webView);
            }
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    public class NativeBridge {
        @JavascriptInterface
        public void saveTextFile(String filename, String content) {
            runOnUiThread(() -> startSave(content == null ? "" : content));
        }

        @JavascriptInterface
        public void copyText(String text) {
            runOnUiThread(() -> {
                ClipboardManager clipboard =
                        (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                if (clipboard == null) {
                    return;
                }
                clipboard.setPrimaryClip(
                        ClipData.newPlainText("BreadLab", text == null ? "" : text));
            });
        }
    }
}
