# FBC Laboratory Pro — Android build package

This package wraps the existing HTML/CSS/JavaScript application in an Android WebView.
The original `index.html`, `script.js`, and `style.css` are copied unchanged into
`android/app/src/main/assets/www/`.

## Build an APK using GitHub Actions
1. Extract this ZIP.
2. Upload/commit the contents into the root of your public `fbc-laboratory-pro.` repository.
   Keep the `.github` folder and the `android` folder at repository root.
3. On GitHub, open **Actions** and select **Build FBC Laboratory Pro APK**.
4. Select **Run workflow**. Wait for the build to finish successfully.
5. Open the completed workflow run, find **Artifacts**, and download
   `FBC-Laboratory-Pro-APK`. Extract it to obtain `app-debug.apk`.
6. Transfer `app-debug.apk` to your Android phone and install it. Android may ask
   you to allow installation from that file source.

## Data and offline behaviour
The app loads its web files from inside the APK, so its interface and core code do
not require an internet connection. Patient records continue to use browser
`localStorage` inside the app's WebView and remain on that device. They are not
automatically backed up or synchronised with other devices. Do not uninstall or
clear app storage if you need to retain those records.

This is a debug APK for personal testing, not a Play Store-signed release.
