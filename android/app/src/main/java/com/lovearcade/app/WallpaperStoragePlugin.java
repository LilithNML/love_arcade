package com.lovearcade.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;

@CapacitorPlugin(name = "WallpaperStorage")
public class WallpaperStoragePlugin extends Plugin {

    private static final int CONNECT_TIMEOUT_MS = 12000;
    private static final int READ_TIMEOUT_MS = 18000;

    @PluginMethod
    public void cacheWallpaperPrivate(PluginCall call) {
        String wallpaperId = call.getString("wallpaperId", "");
        String imageUrl = call.getString("imageUrl", "");

        if (imageUrl.isEmpty()) {
            call.reject("imageUrl es requerido");
            return;
        }

        try {
            byte[] bytes = downloadBytes(imageUrl);
            String ext = guessExtension(imageUrl, bytes);
            String safeId = sanitizeId(wallpaperId, imageUrl);

            File cacheDir = new File(getContext().getCacheDir(), "wallpapers/private_cache");
            if (!cacheDir.exists() && !cacheDir.mkdirs()) {
                call.reject("No se pudo crear cache privada");
                return;
            }

            File target = new File(cacheDir, safeId + ext);
            writeBytes(target, bytes);

            JSObject ret = new JSObject();
            ret.put("cached", true);
            ret.put("path", target.getAbsolutePath());
            ret.put("bytes", bytes.length);
            call.resolve(ret);
        } catch (Exception ex) {
            call.reject("Error al cachear wallpaper", ex);
        }
    }

    @PluginMethod
    public void exportPurchasedWallpaper(PluginCall call) {
        String wallpaperId = call.getString("wallpaperId", "");
        String wallpaperName = call.getString("wallpaperName", "Wallpaper");
        String imageUrl = call.getString("imageUrl", "");

        if (imageUrl.isEmpty()) {
            call.reject("imageUrl es requerido");
            return;
        }

        try {
            byte[] bytes = readFromPrivateCacheOrDownload(wallpaperId, imageUrl);
            String ext = guessExtension(imageUrl, bytes);
            String displayName = sanitizeFileName(wallpaperName);
            if (displayName.isEmpty()) displayName = "LoveArcadeWallpaper";
            String finalName = displayName + "_" + System.currentTimeMillis() + ext;
            String mime = mimeFromExtension(ext);

            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, finalName);
            values.put(MediaStore.Images.Media.MIME_TYPE, mime);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Love Arcade");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
            }

            Uri collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
            Uri uri = resolver.insert(collection, values);
            if (uri == null) {
                call.reject("No se pudo crear archivo en galería");
                return;
            }

            try (OutputStream out = resolver.openOutputStream(uri, "w")) {
                if (out == null) throw new IOException("No se pudo abrir OutputStream");
                out.write(bytes);
                out.flush();
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues publish = new ContentValues();
                publish.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(uri, publish, null, null);
            }

            JSObject ret = new JSObject();
            ret.put("exported", true);
            ret.put("uri", uri.toString());
            ret.put("bytes", bytes.length);
            call.resolve(ret);
        } catch (Exception ex) {
            call.reject("Error al exportar wallpaper", ex);
        }
    }

    private byte[] readFromPrivateCacheOrDownload(String wallpaperId, String imageUrl) throws Exception {
        String safeId = sanitizeId(wallpaperId, imageUrl);
        File cacheDir = new File(getContext().getCacheDir(), "wallpapers/private_cache");
        File[] files = cacheDir.listFiles((dir, name) -> name.startsWith(safeId + "."));
        if (files != null && files.length > 0) {
            return readBytes(files[0]);
        }

        byte[] bytes = downloadBytes(imageUrl);
        String ext = guessExtension(imageUrl, bytes);
        if (!cacheDir.exists()) cacheDir.mkdirs();
        File target = new File(cacheDir, safeId + ext);
        writeBytes(target, bytes);
        return bytes;
    }

    private byte[] downloadBytes(String imageUrl) throws Exception {
        URL url = new URL(imageUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
        conn.setReadTimeout(READ_TIMEOUT_MS);
        conn.setDoInput(true);

        int code = conn.getResponseCode();
        if (code < 200 || code >= 300) {
            throw new IOException("HTTP " + code);
        }

        try (InputStream in = conn.getInputStream();
             ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) != -1) {
                bos.write(buffer, 0, n);
            }
            return bos.toByteArray();
        } finally {
            conn.disconnect();
        }
    }

    private void writeBytes(File target, byte[] bytes) throws IOException {
        try (FileOutputStream fos = new FileOutputStream(target, false)) {
            fos.write(bytes);
            fos.flush();
        }
    }

    private byte[] readBytes(File source) throws IOException {
        try (InputStream in = getContext().getContentResolver().openInputStream(Uri.fromFile(source));
             ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            if (in == null) throw new IOException("No se pudo abrir archivo en cache");
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) != -1) {
                bos.write(buffer, 0, n);
            }
            return bos.toByteArray();
        }
    }

    private String guessExtension(String imageUrl, byte[] bytes) {
        String lower = imageUrl.toLowerCase(Locale.US);
        if (lower.contains(".png")) return ".png";
        if (lower.contains(".webp")) return ".webp";
        if (lower.contains(".jpeg") || lower.contains(".jpg")) return ".jpg";

        if (bytes.length >= 12
            && (bytes[0] & 0xFF) == 0x89
            && (bytes[1] & 0xFF) == 0x50
            && (bytes[2] & 0xFF) == 0x4E
            && (bytes[3] & 0xFF) == 0x47) {
            return ".png";
        }
        if (bytes.length >= 3
            && (bytes[0] & 0xFF) == 0xFF
            && (bytes[1] & 0xFF) == 0xD8
            && (bytes[2] & 0xFF) == 0xFF) {
            return ".jpg";
        }
        if (bytes.length >= 12
            && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
            && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') {
            return ".webp";
        }

        return ".jpg";
    }

    private String mimeFromExtension(String ext) {
        switch (ext) {
            case ".png": return "image/png";
            case ".webp": return "image/webp";
            case ".jpg":
            case ".jpeg":
            default:
                return "image/jpeg";
        }
    }

    private String sanitizeFileName(String name) {
        return name.replaceAll("[^a-zA-Z0-9-_\\s]", "").trim().replaceAll("\\s+", "_");
    }

    private String sanitizeId(String wallpaperId, String fallbackSeed) throws Exception {
        String clean = wallpaperId == null ? "" : wallpaperId.replaceAll("[^a-zA-Z0-9_-]", "");
        if (!clean.isEmpty()) return clean;
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(fallbackSeed.getBytes());
        return Base64.encodeToString(hash, Base64.NO_WRAP)
            .replace('+', '-')
            .replace('/', '_')
            .replace("=", "")
            .substring(0, 22);
    }
}
