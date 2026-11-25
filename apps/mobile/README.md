# OMI — Tropical Adventure (Flutter)

Open `apps/mobile` in Android Studio with the Flutter plugin enabled. Use `lib/main.dart` as the Flutter run configuration's entry point, select the Android device, and click Run. From the same folder, use `flutter run -d R5CX233EWJX` for the Galaxy S24 Ultra.

## V4 splash and audio

| Finding | Change |
| --- | --- |
| The splash rebuilt its layout and artwork widget tree on each tick. | One timeline now drives the layer, card, logo, progress, and handoff widgets. Images are precached and passed as stable animation children. |
| The landscape shrank into a narrow band on portrait phones. | The island is cropped around the waterfall and layered under a warm sky and independently moving foreground palms. Existing OMI art supplies the landscape, palms, courts, and logo. |
| Native Home used the generated Material counter styling. | Home uses the OMI wordmark, colors, scrollable layout, and accessible buttons while preserving the counter through navigation. |
| There was no native music or settings layer. | A single app-root service owns one local looping music player. A separate, lazy sound-effects player handles the settings preview. Audio settings persist independently of routes. |

The animation starts after artwork precaching. It reveals the environment at 0–750 ms, enters four cards at 750–2,000 ms, reveals the logo at 2,000–3,000 ms, adds the finishing highlight at 3,000–4,250 ms, and crossfades to Home at 4,250–5,000 ms. It pauses while the app is inactive. Reduced motion uses a static splash and an immediate handoff at the five-second mark.

Music defaults to off on first launch, matching the existing OMI opt-in policy. Enable it from **Audio settings**. On subsequent cold launches the saved preference applies during the splash. Android requests transient focus that lets existing media duck and pauses OMI during focus interruptions. iOS uses an ambient session that mixes with other audio and honors silent mode. Music pauses in the background, and losing focus permanently or disconnecting an audio route requires explicit re-enabling. See [asset provenance](assets/audio/README.md).

The Flutter app currently contains Home and Audio settings. The audio service belongs to the app root so future native lobby and gameplay routes can share it. The current landscape has paddy fields. A portrait illustration with tea terraces and new illustrated court cards can replace the existing artwork without changing the timeline. The local CC0 music and preview assets are included. The loop boundary and device audio policies should be checked by listening on hardware.

## Verification commands

```sh
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
flutter devices
```
