package com.meetupmobile

import android.net.Uri
import android.os.Handler
import android.os.Looper
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Reads the Google Play install referrer once and resolves the `gi` value (the invitation attribution code of
 * group-invite-existing-accounts AD-9, D-2), or null. Uses only Google's own Install Referrer library.
 *
 * Nothing is stored here or logged: the value is returned to JS, which keeps it in memory. A missing Play
 * service, a timeout or any error resolves null, silently.
 */
class InstallReferrerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "InstallReferrer"

  @ReactMethod
  fun getAttributionCode(promise: Promise) {
    val done = AtomicBoolean(false)
    val finish = { code: String? ->
      if (done.compareAndSet(false, true)) {
        promise.resolve(code)
      }
    }
    try {
      val client = InstallReferrerClient.newBuilder(reactApplicationContext).build()
      val end = {
        try {
          client.endConnection()
        } catch (_: Exception) {
          // Already closed.
        }
      }
      Handler(Looper.getMainLooper()).postDelayed({
        end()
        finish(null)
      }, TIMEOUT_MS)
      client.startConnection(
        object : InstallReferrerStateListener {
          override fun onInstallReferrerSetupFinished(responseCode: Int) {
            var code: String? = null
            try {
              if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                code = parseCode(client.installReferrer.installReferrer)
              }
            } catch (_: Exception) {
              code = null
            }
            end()
            finish(code)
          }

          override fun onInstallReferrerServiceDisconnected() {
            finish(null)
          }
        },
      )
    } catch (_: Exception) {
      finish(null)
    }
  }

  private fun parseCode(referrer: String?): String? {
    if (referrer.isNullOrEmpty()) {
      return null
    }
    return Uri.parse("?$referrer").getQueryParameter("gi")?.takeIf { it.isNotEmpty() }
  }

  private companion object {
    const val TIMEOUT_MS = 5000L
  }
}
