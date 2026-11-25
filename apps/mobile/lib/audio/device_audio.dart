import 'dart:async';

import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_audio.dart';

class DeviceAudio implements AudioOutput {
  static const _musicAsset = 'assets/audio/coastal-breeze.wav';
  static const _effectAsset = 'assets/audio/chime.wav';

  final _interruptions = StreamController<AudioInterruption>.broadcast();
  final _errors = StreamController<Object>.broadcast();
  StreamSubscription<AudioInterruptionEvent>? _focusEvents;
  StreamSubscription<void>? _noisyEvents;
  StreamSubscription<PlayerException>? _playerErrors;
  AudioSession? _session;
  AudioPlayer? _music;
  AudioPlayer? _effect;
  bool _effectLoaded = false;
  int _effectGeneration = 0;

  @override
  Stream<AudioInterruption> get interruptions => _interruptions.stream;

  @override
  Stream<Object> get errors => _errors.stream;

  @override
  Future<void> initialize() async {
    final session = await AudioSession.instance;
    await session.configure(
      const AudioSessionConfiguration(
        avAudioSessionCategory: AVAudioSessionCategory.ambient,
        androidAudioAttributes: AndroidAudioAttributes(
          contentType: AndroidAudioContentType.music,
          usage: AndroidAudioUsage.game,
        ),
        androidAudioFocusGainType:
            AndroidAudioFocusGainType.gainTransientMayDuck,
        androidWillPauseWhenDucked: true,
      ),
    );
    _session = session;
    _focusEvents = session.interruptionEventStream.listen((event) {
      final interruption = switch ((event.begin, event.type)) {
        (false, AudioInterruptionType.unknown) =>
          AudioInterruption.requiresUserAction,
        (false, _) => AudioInterruption.ended,
        // Android exposes permanent focus loss as an unknown begin event.
        (true, AudioInterruptionType.unknown)
            when defaultTargetPlatform == TargetPlatform.android =>
          AudioInterruption.requiresUserAction,
        (true, _) => AudioInterruption.began,
      };
      _interruptions.add(interruption);
    });
    _noisyEvents = session.becomingNoisyEventStream.listen((_) {
      _interruptions.add(AudioInterruption.requiresUserAction);
    });
  }

  AudioPlayer _player() => AudioPlayer(
    handleInterruptions: false,
    handleAudioSessionActivation: false,
  );

  @override
  Future<bool> activate() => _session!.setActive(true);

  @override
  Future<void> deactivate() async {
    await _session?.setActive(false);
  }

  @override
  Future<void> loadMusic() async {
    final player = _music ??= _player();
    _playerErrors ??= player.errorStream.listen(_errors.add);
    await player.setAsset(_musicAsset);
    await player.setLoopMode(LoopMode.one);
  }

  @override
  Future<void> setMusicVolume(double volume) => _music!.setVolume(volume);

  @override
  void playMusic() {
    // just_audio completes this future when playback pauses, stops or ends.
    unawaited(
      _music!.play().catchError((Object error) {
        if (!_errors.isClosed) _errors.add(error);
      }),
    );
  }

  @override
  Future<void> pauseMusic() async => _music?.pause();

  @override
  Future<void> previewEffect(double volume) async {
    final generation = ++_effectGeneration;
    final player = _effect ??= _player();
    if (!_effectLoaded) {
      await player.setAsset(_effectAsset);
      _effectLoaded = true;
    }
    await player.setVolume(volume);
    await player.seek(Duration.zero);
    if (generation != _effectGeneration) return;
    // The music service may pause this preview when focus or the app is lost.
    try {
      await player.play().timeout(const Duration(seconds: 2));
    } finally {
      await player.pause();
    }
  }

  @override
  Future<void> pauseEffect() async {
    _effectGeneration++;
    await _effect?.pause();
  }

  @override
  Future<void> dispose() async {
    _effectGeneration++;
    await _focusEvents?.cancel();
    await _noisyEvents?.cancel();
    await _playerErrors?.cancel();
    await _music?.dispose();
    await _effect?.dispose();
    await _interruptions.close();
    await _errors.close();
  }
}

class DeviceAudioPreferences implements AudioPreferencesStore {
  DeviceAudioPreferences([SharedPreferencesAsync? preferences])
    : _preferences = preferences;

  static const _key = 'omi.audio.preferences.v1';
  SharedPreferencesAsync? _preferences;
  SharedPreferencesAsync get _store =>
      _preferences ??= SharedPreferencesAsync();

  @override
  Future<AudioPreferences> read() async {
    final values = await _store.getStringList(_key);
    if (values == null || values.length != 4) return defaultAudioPreferences;
    return (
      musicEnabled: values[0] == 'true',
      musicVolume: _volume(values[1], defaultAudioPreferences.musicVolume),
      effectsEnabled: values[2] == 'true',
      effectsVolume: _volume(values[3], defaultAudioPreferences.effectsVolume),
    );
  }

  double _volume(String value, double fallback) {
    final parsed = double.tryParse(value);
    return parsed != null && parsed.isFinite
        ? parsed.clamp(0.0, 1.0)
        : fallback;
  }

  @override
  Future<void> write(AudioPreferences preferences) =>
      _store.setStringList(_key, [
        preferences.musicEnabled.toString(),
        preferences.musicVolume.toString(),
        preferences.effectsEnabled.toString(),
        preferences.effectsVolume.toString(),
      ]);
}
