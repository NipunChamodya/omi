import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:mobile/audio/app_audio.dart';
import 'package:mobile/audio/audio_settings.dart';
import 'package:mobile/main.dart';

import 'widget_test.dart' show start;

class _Preferences implements AudioPreferencesStore {
  _Preferences({bool enabled = true})
    : value = (
        musicEnabled: enabled,
        musicVolume: .45,
        effectsEnabled: true,
        effectsVolume: .65,
      );

  AudioPreferences value;

  @override
  Future<AudioPreferences> read() async => value;

  @override
  Future<void> write(AudioPreferences preferences) async => value = preferences;
}

class _Output implements AudioOutput {
  final events = StreamController<AudioInterruption>.broadcast(sync: true);
  final failures = StreamController<Object>.broadcast(sync: true);
  final loads = <double>[];
  var initializes = 0;
  var loaded = 0;
  var plays = 0;
  var pauses = 0;
  var previews = 0;
  var effectPauses = 0;
  var hasFocus = false;
  var focusAllowed = true;
  var playing = false;
  var disposed = false;
  var invalidAsset = false;
  double? previewVolume;
  Completer<void>? pendingPreview;
  Completer<void>? pendingLoad;

  @override
  Stream<AudioInterruption> get interruptions => events.stream;

  @override
  Stream<Object> get errors => failures.stream;

  @override
  Future<void> initialize() async => initializes++;

  @override
  Future<bool> activate() async => hasFocus = focusAllowed;

  @override
  Future<void> deactivate() async => hasFocus = false;

  @override
  Future<void> loadMusic() async {
    loaded++;
    if (invalidAsset) throw StateError('Invalid or missing track');
    await pendingLoad?.future;
  }

  @override
  Future<void> setMusicVolume(double volume) async => loads.add(volume);

  @override
  void playMusic() {
    expect(playing, isFalse, reason: 'Music must never overlap itself');
    expect(hasFocus, isTrue);
    plays++;
    playing = true;
  }

  @override
  Future<void> pauseMusic() async {
    pauses++;
    playing = false;
  }

  @override
  Future<void> previewEffect(double volume) async {
    previews++;
    previewVolume = volume;
    await pendingPreview?.future;
  }

  @override
  Future<void> pauseEffect() async {
    effectPauses++;
    final preview = pendingPreview;
    if (preview != null && !preview.isCompleted) preview.complete();
  }

  @override
  Future<void> dispose() async {
    disposed = true;
    playing = false;
    await events.close();
    await failures.close();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'saved opt-in starts one loaded track and duplicate startup is safe',
    () async {
      final output = _Output();
      final audio = AppAudio(output, _Preferences());
      await Future.wait([audio.start(), audio.start()]);
      expect((output.initializes, output.loaded, output.plays), (1, 1, 1));
      audio.dispose();
      await Future<void>.delayed(Duration.zero);
      expect(output.disposed, isTrue);
      expect(output.playing, isFalse);
      expect(output.hasFocus, isFalse);
    },
  );

  test(
    'preferences persist and music volume does not change effects volume',
    () async {
      final store = _Preferences(enabled: false);
      final output = _Output();
      final audio = AppAudio(output, store);
      addTearDown(audio.dispose);
      await audio.start();
      expect(output.loads, isEmpty);
      await audio.setMusicEnabled(true);
      await audio.setMusicVolume(.25);
      await audio.setEffectsVolume(.8);
      await audio.previewEffect();
      expect(output.previewVolume, .8);
      expect(output.loads, [.45, .25]);
      await audio.setEffectsEnabled(false);
      await audio.setMusicEnabled(false);
      expect(output.playing, isFalse);
      await audio.setMusicEnabled(true);
      expect((output.loaded, output.plays), (1, 2));
      final restoredOutput = _Output();
      final restored = AppAudio(restoredOutput, store);
      addTearDown(restored.dispose);
      await restored.start();
      expect(restored.preferences, store.value);
      expect(restoredOutput.loads, [.25]);
      expect(restored.preferences.effectsEnabled, isFalse);
    },
  );

  test(
    'background and foreground pause and resume the existing source',
    () async {
      final output = _Output();
      final audio = AppAudio(output, _Preferences());
      addTearDown(audio.dispose);
      await audio.start();
      audio.didChangeAppLifecycleState(AppLifecycleState.paused);
      await Future<void>.delayed(Duration.zero);
      expect(output.playing, isFalse);
      expect(output.hasFocus, isFalse);
      audio.didChangeAppLifecycleState(AppLifecycleState.resumed);
      await Future<void>.delayed(Duration.zero);
      expect((output.loaded, output.plays, output.pauses), (1, 2, 1));
    },
  );

  test(
    'focus denial, transient interruptions, and permanent loss are honored',
    () async {
      final output = _Output()..focusAllowed = false;
      final audio = AppAudio(output, _Preferences());
      addTearDown(audio.dispose);
      await audio.start();
      expect(output.plays, 0);
      output.focusAllowed = true;
      audio.didChangeAppLifecycleState(AppLifecycleState.resumed);
      await Future<void>.delayed(Duration.zero);
      expect(output.plays, 1);

      output.events.add(AudioInterruption.began);
      await Future<void>.delayed(Duration.zero);
      expect(output.playing, isFalse);
      output.events.add(AudioInterruption.ended);
      await Future<void>.delayed(Duration.zero);
      expect(output.plays, 2);

      output.events.add(AudioInterruption.requiresUserAction);
      output.events.add(AudioInterruption.ended);
      await Future<void>.delayed(Duration.zero);
      expect(output.playing, isFalse);
      await audio.setMusicEnabled(false);
      await audio.setMusicEnabled(true);
      expect((output.loaded, output.plays), (1, 3));
    },
  );

  test('pausing while loading prevents a late playback start', () async {
    final output = _Output()..pendingLoad = Completer<void>();
    final audio = AppAudio(output, _Preferences());
    addTearDown(audio.dispose);
    final starting = audio.start();
    await Future<void>.delayed(Duration.zero);
    audio.didChangeAppLifecycleState(AppLifecycleState.paused);
    output.pendingLoad!.complete();
    await starting;
    expect(output.plays, 0);
  });

  test('effect previews are single-instance and interruptible', () async {
    final output = _Output()..pendingPreview = Completer<void>();
    final audio = AppAudio(output, _Preferences(enabled: false));
    addTearDown(audio.dispose);
    await audio.start();
    await audio.previewEffect();
    await audio.previewEffect();
    expect(output.previews, 1);
    output.events.add(AudioInterruption.began);
    await Future<void>.delayed(Duration.zero);
    expect(output.effectPauses, 1);
    expect(output.hasFocus, isFalse);
  });

  test(
    'invalid assets and playback errors fail quietly and can be retried',
    () async {
      final output = _Output()..invalidAsset = true;
      final audio = AppAudio(output, _Preferences());
      addTearDown(audio.dispose);
      await audio.start();
      expect(output.plays, 0);
      expect(audio.musicUnavailable, isTrue);
      output.invalidAsset = false;
      await audio.setMusicEnabled(false);
      await audio.setMusicEnabled(true);
      expect(output.playing, isTrue);
      output.failures.add(StateError('Decoder error'));
      await Future<void>.delayed(Duration.zero);
      expect(audio.musicUnavailable, isTrue);
      expect(output.playing, isFalse);
    },
  );

  for (final width in [320.0, 480.0]) {
    testWidgets(
      'audio navigation preserves music and accessible controls at $width',
      (tester) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = Size(width, width == 320 ? 568 : 1040);
        tester.binding.platformDispatcher.textScaleFactorTestValue = 2;
        final output = _Output();
        final audio = AppAudio(output, _Preferences());
        addTearDown(tester.view.reset);
        addTearDown(
          tester.binding.platformDispatcher.clearTextScaleFactorTestValue,
        );
        addTearDown(audio.dispose);

        await start(tester, MyApp(audio: audio));
        expect(output.plays, 1);
        await tester.pump(const Duration(seconds: 5));
        await tester.ensureVisible(find.text('Audio settings'));
        await tester.pumpAndSettle();
        final settings = find.widgetWithText(OutlinedButton, 'Audio settings');
        expect(tester.getSize(settings).height, greaterThanOrEqualTo(48));
        final counter = find.widgetWithText(FilledButton, 'Add one');
        expect(tester.getSize(counter).height, greaterThanOrEqualTo(48));
        await tester.tap(settings);
        await tester.pumpAndSettle();
        expect(find.byType(AudioSettingsScreen), findsOneWidget);
        expect(
          find.bySemanticsLabel('Background music volume'),
          findsOneWidget,
        );
        final musicToggle = find.widgetWithText(
          SwitchListTile,
          'Background music',
        );
        expect(tester.getSize(musicToggle).height, greaterThanOrEqualTo(48));
        expect(tester.takeException(), isNull);
        final soundPreview = find.widgetWithText(
          OutlinedButton,
          'Preview sound',
        );
        await tester.ensureVisible(soundPreview);
        await tester.pumpAndSettle();
        expect(tester.getSize(soundPreview).height, greaterThanOrEqualTo(48));
        await tester.tap(soundPreview);
        await tester.pumpAndSettle();
        expect(output.previews, 1);
        await tester.pageBack();
        await tester.pumpAndSettle();
        expect(find.byType(AudioSettingsScreen), findsNothing);
        expect((output.loaded, output.plays, output.pauses), (1, 1, 0));
        expect(tester.takeException(), isNull);
      },
    );
  }
}
