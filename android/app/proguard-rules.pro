# R8 keep rules for release builds (minify + obfuscate + shrink resources).
# Mapping file: android/app/build/outputs/mapping/release/mapping.txt (also embedded in the AAB).

# Readable crash stack traces once the mapping is uploaded.
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod
-renamesourcefileattribute SourceFile

# --- React Native / Hermes / JNI --------------------------------------------
# react-android and hermes-android ship consumer rules for most of this; these
# are the explicit safety net for the pieces reached by reflection or from C++.
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep,allowobfuscation @interface com.facebook.common.internal.DoNotStrip
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keep @com.facebook.common.internal.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.common.internal.DoNotStrip *;
}
-keepclassmembers @com.facebook.proguard.annotations.KeepGettersAndSetters class * {
    void set*(***);
    *** get*();
}
# Native modules and view managers are discovered through annotations.
-keep class * extends com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
    @com.facebook.react.bridge.ReactMethod <methods>;
}
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**

# --- App ---------------------------------------------------------------------
# BuildConfig is read reflectively by react-native-config (namespace com.meetupmobile).
-keep class com.meetupmobile.BuildConfig { *; }
-keep class com.meetupmobile.R$* { *; }

# --- react-native-config ------------------------------------------------------
-keep class com.lugg.RNCConfig.** { *; }

# --- react-native-keychain (Keystore, biometric prompt, cipher storages) -----
-keep class com.oblador.keychain.** { *; }
-keep class androidx.biometric.** { *; }
-keep class androidx.security.crypto.** { *; }
-keep class com.google.crypto.tink.** { *; }
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**

# --- react-native-vision-camera v4 (CameraX + ML Kit barcode, code scanner) --
-keep class com.mrousavy.camera.** { *; }
-keep class androidx.camera.** { *; }
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_barcode.** { *; }
-dontwarn androidx.camera.**

# --- Firebase / FCM (@react-native-firebase/app + messaging) -----------------
-keep class io.invertase.firebase.** { *; }
-dontwarn io.invertase.firebase.**
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.firebase.iid.** { *; }
-keep class com.google.android.gms.common.** { *; }

# --- react-native-notify-kit (Notifee fork: WorkManager, Room, Fresco) -------
-keep class app.notifee.core.** { *; }
-keep class io.invertase.notifee.** { *; }
-keep class androidx.work.impl.** { *; }
-keep class * extends androidx.work.ListenableWorker { *; }
-keep class * extends androidx.room.RoomDatabase { *; }
-keep class com.facebook.imagepipeline.** { *; }
-dontwarn com.facebook.fresco.**

# --- react-native-image-crop-picker (uCrop, EXIF, Glide-free) ----------------
-keep class com.reactnative.ivpusic.imagepicker.** { *; }
-keep class com.yalantis.ucrop.** { *; }
-dontwarn com.yalantis.ucrop.**
-dontwarn okhttp3.**
-dontwarn okio.**

# --- @react-native-async-storage/async-storage v3 (Room-backed) --------------
-keep class org.asyncstorage.** { *; }
-keep class * extends androidx.room.RoomDatabase { *; }

# --- react-native-device-info (install referrer, GMS app set) ----------------
-keep class com.learnium.RNDeviceInfo.** { *; }
-keep class com.android.installreferrer.** { *; }

# --- react-native-screens / safe-area-context / svg --------------------------
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.horcrux.svg.** { *; }
