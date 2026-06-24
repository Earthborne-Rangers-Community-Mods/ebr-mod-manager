package com.ebr.modmanager

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.provider.DocumentsContract
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

    // Directory chosen in the current session via pickDirectory(). Not persisted:
    // the SAF grant from ACTION_OPEN_DOCUMENT_TREE lasts only for this process and
    // we deliberately do not take a persistable permission. A fresh pickDirectory()
    // is required before any write, including after an app restart.
    private var activeDirectoryUri: String? = null

    @Suppress("unused")
    @PluginMethod
    fun pickDirectory(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
        // Pre-navigate the picker to the last-used directory when one is stored.
        // This is only a starting-location hint, not a grant of access.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getStoredSeedUri()?.let { seed ->
                intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, seed.toUri())
            }
        }
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

        // No persistable permission is taken: the grant from ACTION_OPEN_DOCUMENT_TREE
        // lasts only for this process. Hold the directory in memory for this session's
        // writes; a fresh pickDirectory() is required again after an app restart.
        activeDirectoryUri = uri.toString()
        dirCache.clear()

        // Persist the URI only as a picker seed hint for the next launch.
        storeSeedUri(uri.toString())

        val dir = DocumentFile.fromTreeUri(context, uri)
        val ret = JSObject()
        ret.put("uri", uri.toString())
        ret.put("name", dir?.name ?: JSONObject.NULL)
        call.resolve(ret)
    }

    @Suppress("unused")
    @PluginMethod
    fun getWritableDirectory(call: PluginCall) {
        // By design, Android persists no writable directory across sessions. SAF
        // can persist write access via takePersistableUriPermission(), but we
        // deliberately do not take it because the user may want to pick a new
        // location. Always answer null; callers must invoke pickDirectory()
        // before any write.
        val ret = JSObject()
        ret.put("uri", JSONObject.NULL)
        ret.put("name", JSONObject.NULL)
        call.resolve(ret)
    }

    @Suppress("unused")
    @PluginMethod
    fun listVaultContents(call: PluginCall) {
        val dir = resolveActiveDir(call) ?: return

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

        val rootDir = resolveActiveDir(call) ?: return

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

        val dir = resolveActiveDir(call) ?: return

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
     * Resolve the active session directory for a SAF operation, enforcing the
     * seed-only security invariant in one place: no operation proceeds without a
     * live in-session pick, and a vanished directory forces a re-pick. Returns
     * the resolved DocumentFile on success, or null after already rejecting the
     * call - so callers early-return on null. Rejects with "No directory
     * selected" when no pick is active, or "Directory not found" (and clears the
     * active URI) when the picked directory is gone.
     */
    private fun resolveActiveDir(call: PluginCall): DocumentFile? {
        val uriString = activeDirectoryUri
        if (uriString == null) {
            call.reject("No directory selected")
            return null
        }

        val dir = DocumentFile.fromTreeUri(context, uriString.toUri())
        if (dir == null || !dir.exists()) {
            activeDirectoryUri = null
            call.reject("Directory not found")
            return null
        }

        return dir
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

    // Persist the last-used directory URI as a picker seed hint only.
    private fun storeSeedUri(uri: String) {
        context.getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE).edit {
            putString(KEY_DIRECTORY_URI, uri)
        }
    }

    private fun getStoredSeedUri(): String? {
        return context.getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE)
            .getString(KEY_DIRECTORY_URI, null)
    }
}
