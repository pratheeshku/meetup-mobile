package com.meetupmobile

import android.content.ActivityNotFoundException
import android.content.Intent
import android.provider.CalendarContract
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Opens the calendar app's "new entry" screen filled with a game (DES-MEETUP-ADDENDUM-priority1-nov23 P1-07).
 *
 * Uses Intent.ACTION_INSERT on CalendarContract.Events, so the app needs no calendar permission: the person saves
 * or cancels in their own calendar app. Nothing is stored or logged here.
 */
class AddToCalendarModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AddToCalendar"

  @ReactMethod
  fun insert(title: String, beginMs: Double, endMs: Double, location: String, description: String, promise: Promise) {
    val intent = Intent(Intent.ACTION_INSERT).apply {
      data = CalendarContract.Events.CONTENT_URI
      putExtra(CalendarContract.Events.TITLE, title)
      putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, beginMs.toLong())
      putExtra(CalendarContract.EXTRA_EVENT_END_TIME, endMs.toLong())
      if (location.isNotEmpty()) putExtra(CalendarContract.Events.EVENT_LOCATION, location)
      if (description.isNotEmpty()) putExtra(CalendarContract.Events.DESCRIPTION, description)
    }
    try {
      val activity = reactApplicationContext.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactApplicationContext.startActivity(intent)
      }
      promise.resolve(true)
    } catch (e: ActivityNotFoundException) {
      promise.reject("NO_CALENDAR", "No calendar app can add this entry", e)
    } catch (e: Exception) {
      promise.reject("CALENDAR_FAILED", "Could not open the calendar", e)
    }
  }
}
