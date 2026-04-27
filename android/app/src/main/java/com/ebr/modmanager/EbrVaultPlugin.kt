package com.ebr.modmanager

import android.app.Activity
import android.content.Intent
import android.util.Base64
import androidx.activity.result.ActivityResult
import androidx.core.content.edit
import androidx.core.net.toUri
import androidx.documentfile.provider.DocumentFile
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject

@CapacitorPlugin(name = "EbrVaultPlugin")
class EbrVaultPlugin : Plugin() {

    companion object {
        private const val PREFS_NAME = "ebr_vault_prefs"
        private const val KEY_DIRECTORY_URI = "directory_uri"
    }

    // Cache resolved directory DocumentFiles to avoid repeated findFile() queries.
    // Cleared on each clearVaultContents call since the directory tree changes.
    private val dirCache = mutableMapOf<String, DocumentFile>()

    @Suppress("unused")
    @PluginMethod
    fun pickDirectory(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
        startActivityForResult(call, intent, "pickDirectoryResult")
    }

    @Suppress("unused")
    @ActivityCallback
    private fun pickDirectoryResult(call: PluginCall, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK || result.data == null) {
            call.reject("User cancelled directory picker")
            return
        }

        val uri = result.data!!.data
        if (uri == null) {
            call.reject("No directory selected")
            return
        }

        // Take persistable read/write permissions so the URI survives app restarts
        val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        context.contentResolver.takePersistableUriPermission(uri, flags)

        storeDirectoryUri(uri.toString())

        val dir = DocumentFile.fromTreeUri(context, uri)
        val ret = JSObject()
        ret.put("uri", uri.toString())
        ret.put("name", dir?.name ?: JSONObject.NULL)
        call.resolve(ret)
    }

    @Suppress("unused")
    @PluginMethod
    fun getStoredDirectory(call: PluginCall) {
        val uriString = getStoredDirectoryUri()
        val ret = JSObject()

        if (uriString != null) {
            // Verify the persisted permission is still valid
            val uri = uriString.toUri()
            val persistedUris = context.contentResolver.persistedUriPermissions
            val hasPermission = persistedUris.any {
                it.uri == uri && it.isReadPermission && it.isWritePermission
            }

            if (hasPermission) {
                // Verify the directory still exists on disk (SAF permissions
                // survive folder deletion, so permission alone is not enough)
                val dir = DocumentFile.fromTreeUri(context, uri)
                if (dir != null && dir.exists() && dir.canWrite()) {
                    ret.put("uri", uriString)
                    ret.put("name", dir.name ?: JSONObject.NULL)
                } else {
                    clearStoredDirectoryUri()
                    ret.put("uri", JSONObject.NULL)
                }
            } else {
                // Permission was revoked; clear the stale reference
                clearStoredDirectoryUri()
                ret.put("uri", JSONObject.NULL)
            }
        } else {
            ret.put("uri", JSONObject.NULL)
        }

        call.resolve(ret)
    }

    @Suppress("unused")
    @PluginMethod
    fun listVaultContents(call: PluginCall) {
        val uriString = getStoredDirectoryUri()
        if (uriString == null) {
            call.reject("No directory selected")
            return
        }

        val dir = DocumentFile.fromTreeUri(context, uriString.toUri()) ?: run {
            call.reject("Directory not found")
            return
        }
        if (!dir.exists()) {
            call.reject("Directory not found")
            return
        }

        val entries = JSArray()
        for (file in dir.listFiles()) {
            val entry = JSObject()
            entry.put("name", file.name ?: "")
            entry.put("isDirectory", file.isDirectory)
            entries.put(entry)
        }

        val ret = JSObject()
        ret.put("entries", entries)
        call.resolve(ret)
    }

    @Suppress("unused")
    @PluginMethod
    fun writeFile(call: PluginCall) {
        val path = call.getString("path")
        val data = call.getString("data")

        if (path == null || data == null) {
            call.reject("path and data are required")
            return
        }

        val uriString = getStoredDirectoryUri()
        if (uriString == null) {
            call.reject("No directory selected")
            return
        }

        val rootDir = DocumentFile.fromTreeUri(context, uriString.toUri()) ?: run {
            clearStoredDirectoryUri()
            call.reject("Directory not found")
            return
        }
        if (!rootDir.exists()) {
            clearStoredDirectoryUri()
            call.reject("Directory not found")
            return
        }

        try {
            val segments = path.split("/")
            val fileName = segments.last()

            // Navigate to (or create) parent directories, using the cache
            var currentDir = rootDir
            var resolvedPath = ""
            for (i in 0 until segments.size - 1) {
                val dirName = segments[i]
                resolvedPath = if (resolvedPath.isEmpty()) dirName else "$resolvedPath/$dirName"

                val cached = dirCache[resolvedPath]
                if (cached != null) {
                    currentDir = cached
                } else {
                    val existing = currentDir.findFile(dirName)
                    currentDir = if (existing != null && existing.isDirectory) {
                        existing
                    } else {
                        currentDir.createDirectory(dirName)
                            ?: throw Exception("Failed to create directory: $dirName")
                    }
                    dirCache[resolvedPath] = currentDir
                }
            }

            // Overwrite existing file or create a new one
            val existingFile = currentDir.findFile(fileName)
            val targetUri = if (existingFile != null && !existingFile.isDirectory) {
                existingFile.uri
            } else {
                val newFile = currentDir.createFile("application/octet-stream", fileName)
                    ?: throw Exception("Failed to create file: $fileName")
                newFile.uri
            }

            // Decode base64 and write bytes
            val bytes = Base64.decode(data, Base64.DEFAULT)
            context.contentResolver.openOutputStream(targetUri, "wt")?.use { output ->
                output.write(bytes)
            } ?: throw Exception("Failed to open output stream for: $fileName")

            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to write file: ${e.message}")
        }
    }

    @Suppress("unused")
    @PluginMethod
    fun clearVaultContents(call: PluginCall) {
        dirCache.clear()

        val uriString = getStoredDirectoryUri()
        if (uriString == null) {
            call.reject("No directory selected")
            return
        }

        val dir = DocumentFile.fromTreeUri(context, uriString.toUri()) ?: run {
            call.resolve()
            return
        }
        if (!dir.exists()) {
            call.resolve()
            return
        }

        val children = dir.listFiles()
        val total = children.size
        var deleted = 0

        val errors = mutableListOf<String>()
        for (file in children) {
            try {
                deleteRecursively(file)
            } catch (_: Exception) {
                errors.add(file.name ?: "unknown")
            }
            deleted++
            if (deleted % 10 == 0 || deleted == total) {
                val data = JSObject()
                data.put("deleted", deleted)
                data.put("total", total)
                notifyListeners("clearProgress", data)
            }
        }
        if (errors.isNotEmpty()) {
            call.reject("Failed to remove: ${errors.joinToString(", ")}")
        } else {
            call.resolve()
        }
    }

    /**
     * Recursively delete a DocumentFile. For directories, deletes children
     * first since some SAF providers only delete empty directories.
     */
    private fun deleteRecursively(documentFile: DocumentFile) {
        if (documentFile.isDirectory) {
            for (child in documentFile.listFiles()) {
                deleteRecursively(child)
            }
        }
        documentFile.delete()
    }

    private fun storeDirectoryUri(uri: String) {
        context.getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE).edit {
            putString(KEY_DIRECTORY_URI, uri)
        }
    }

    private fun getStoredDirectoryUri(): String? {
        return context.getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE)
            .getString(KEY_DIRECTORY_URI, null)
    }

    private fun clearStoredDirectoryUri() {
        context.getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE).edit {
            remove(KEY_DIRECTORY_URI)
        }
    }
}
