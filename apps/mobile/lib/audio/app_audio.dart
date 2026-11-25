import 'dart:async';

import 'package:flutter/widgets.dart';

enum AudioInterruption { began, ended, requiresUserAction }

abstract interface class AudioOutput {
  Stream<AudioInterruption> get interruptions;
  Stream<Object> get errors;
  Future<void> initialize();
  Future<bool> activate();
  Future<void> deactivate();
  Future<void> loadMusic();
  Future<void> setMusicVolume(double volume);
  void playMusic();
  Future<void> pauseMusic();
  Future<void> previewEffect(double volume);
  Future<void> pauseEffect();
  Future<void> dispose();
}

typedef AudioPreferences = ({
  bool musicEnabled,
  double musicVolume,
  bool effectsEnabled,
  double effectsVolume,
});

const defaultAudioPreferences = (
  musicEnabled: false,
  musicVolume: .45,
  effectsEnabled: true,
  effectsVolume: .65,
);

abstract interface class AudioPreferencesStore {
  Future<AudioPreferences> read();
  Future<void> write(AudioPreferences preferences);
}

class AppAudio extends ChangeNotifier with WidgetsBindingObserver {
  AppAudio(this._output, this._store);

  final AudioOutput _output;
  final AudioPreferencesStore _store;
  AudioPreferences _preferences = defaultAudioPreferences;
  AudioPreferences get preferences => _preferences;
  bool get ready => _ready;
  bool get musicUnavailable => _musicUnavailable;
  bool get preferencesUnavailable => _preferencesUnavailable;
  bool get previewUnavailable => _previewUnavailable;

  Future<void> _pending = Future.value();
  Future<void>? _start;
  StreamSubscription<AudioInterruption>? _interruptions;
  StreamSubscription<Object>? _errors;
  bool _ready = false;
  bool _foreground = false;
  bool _interrupted = false;
  bool _requiresUserAction = false;
  bool _sessionReady = false;
  bool _focused = false;
  bool _loaded = false;
  bool _playing = false;
  bool _previewing = false;
  bool _needsActivation = false;
  double? _appliedMusicVolume;
  AudioPreferences? _savedPreferences;
  bool _closed = false;
  bool _musicUnavailable = false;
  bool _preferencesUnavailable = false;
  bool _previewUnavailable = false;

  Future<void> start() => _start ??= _enqueue(() async {
    final binding = WidgetsBinding.instance;
    _foreground =
        binding.lifecycleState == null ||
        binding.lifecycleState == AppLifecycleState.resumed;
    binding.addObserver(this);
    try {
      _preferences = await _store.read();
      _savedPreferences = _preferences;
    } catch (_) {
      _preferencesUnavailable = true;
    }
    if (_closed) return;
    _ready = true;
    notifyListeners();
    await _reconcile();
  });

  Future<void> setMusicEnabled(bool enabled) {
    _requiresUserAction = false;
    if (enabled) _musicUnavailable = false;
    return _change((
      musicEnabled: enabled,
      musicVolume: _preferences.musicVolume,
      effectsEnabled: _preferences.effectsEnabled,
      effectsVolume: _preferences.effectsVolume,
    ));
  }

  Future<void> setMusicVolume(double volume) => _change((
    musicEnabled: _preferences.musicEnabled,
    musicVolume: volume.clamp(0.0, 1.0),
    effectsEnabled: _preferences.effectsEnabled,
    effectsVolume: _preferences.effectsVolume,
  ));

  Future<void> setEffectsEnabled(bool enabled) => _change((
    musicEnabled: _preferences.musicEnabled,
    musicVolume: _preferences.musicVolume,
    effectsEnabled: enabled,
    effectsVolume: _preferences.effectsVolume,
  ));

  Future<void> setEffectsVolume(double volume) => _change((
    musicEnabled: _preferences.musicEnabled,
    musicVolume: _preferences.musicVolume,
    effectsEnabled: _preferences.effectsEnabled,
    effectsVolume: volume.clamp(0.0, 1.0),
  ));

  Future<void> _change(AudioPreferences value) {
    if (!_ready || _closed) return Future.value();
    _preferences = value;
    notifyListeners();
    return _enqueue(() async {
      await _reconcile();
      if (!_preferences.effectsEnabled && _previewing) {
        await _output.pauseEffect();
      }
      final toSave = _preferences;
      if (_savedPreferences == toSave) return;
      final wasUnavailable = _preferencesUnavailable;
      try {
        await _store.write(toSave);
        _savedPreferences = toSave;
        _preferencesUnavailable = false;
      } catch (_) {
        _preferencesUnavailable = true;
      }
      if (!_closed && wasUnavailable != _preferencesUnavailable) {
        notifyListeners();
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    unawaited(_enqueue(_reconcile));
  }

  bool get _canPlay =>
      !_closed && _foreground && !_interrupted && !_requiresUserAction;

  Future<void> _prepareSession() async {
    if (_sessionReady) return;
    await _output.initialize();
    _sessionReady = true;
    _interruptions = _output.interruptions.listen((event) {
      _interrupted = event == AudioInterruption.began;
      if (_interrupted) _needsActivation = true;
      if (event == AudioInterruption.requiresUserAction) {
        _requiresUserAction = true;
      }
      unawaited(_enqueue(_reconcile));
    });
    _errors = _output.errors.listen((_) {
      _musicUnavailable = true;
      _loaded = false;
      if (!_closed) notifyListeners();
      unawaited(_enqueue(_reconcile));
    });
  }

  bool get _wantsMusic =>
      _canPlay && _preferences.musicEnabled && !_musicUnavailable;

  Future<void> _reconcile() async {
    if (!_wantsMusic) {
      if (_playing) await _output.pauseMusic();
      _playing = false;
      if (!_canPlay && _previewing) await _output.pauseEffect();
      // Hold transient focus so Android can deliver the matching gain event.
      final awaitingGain =
          _interrupted && _foreground && _preferences.musicEnabled;
      if (!awaitingGain && (!_previewing || !_canPlay)) await _releaseFocus();
      return;
    }

    try {
      await _prepareSession();
      if (!_loaded) {
        await _output.loadMusic();
        _loaded = true;
        _appliedMusicVolume = null;
      }
      if (!_wantsMusic) return;
      final volume = _preferences.musicVolume;
      if (_appliedMusicVolume != volume) {
        await _output.setMusicVolume(volume);
        _appliedMusicVolume = volume;
      }
      if (_playing || !_wantsMusic) return;
      if (!_focused || _needsActivation) {
        _focused = await _output.activate();
        _needsActivation = false;
      }
      if (_focused && _wantsMusic) {
        _playing = true;
        _output.playMusic();
      } else if (!_wantsMusic && !_interrupted) {
        await _releaseFocus();
      }
    } catch (_) {
      _musicUnavailable = true;
      _loaded = false;
      if (_playing) await _output.pauseMusic();
      _playing = false;
      await _releaseFocus();
      if (!_closed) notifyListeners();
    }
  }

  Future<void> previewEffect() => _enqueue(() async {
    if (!_canPlay || !_preferences.effectsEnabled || _previewing) return;
    try {
      await _prepareSession();
      if (!_canPlay || !_preferences.effectsEnabled) return;
      if (!_focused) _focused = await _output.activate();
      if (!_focused || !_canPlay || !_preferences.effectsEnabled) {
        if (!_playing) await _releaseFocus();
        return;
      }
      _previewing = true;
      unawaited(_playPreview());
    } catch (_) {
      _previewUnavailable = true;
      if (!_closed) notifyListeners();
    }
  });

  Future<void> _playPreview() async {
    var unavailable = false;
    try {
      await _output.previewEffect(_preferences.effectsVolume);
    } catch (_) {
      unavailable = true;
    }
    await _enqueue(() async {
      _previewing = false;
      _previewUnavailable = unavailable;
      if (!_playing) await _releaseFocus();
      if (!_closed) notifyListeners();
    });
  }

  Future<void> _releaseFocus() async {
    if (!_focused) return;
    _focused = false;
    _interrupted = false;
    _needsActivation = false;
    await _output.deactivate();
  }

  Future<void> _enqueue(Future<void> Function() operation) {
    return _pending = _pending
        .then((_) async {
          if (!_closed) await operation();
        })
        .catchError((Object error, StackTrace stack) {
          if (!_closed) {
            _musicUnavailable = true;
            notifyListeners();
          }
        });
  }

  Future<void> _shutdown() async {
    await _pending;
    await _interruptions?.cancel();
    await _errors?.cancel();
    try {
      await _output.dispose();
    } finally {
      await _releaseFocus();
    }
  }

  @override
  void dispose() {
    _closed = true;
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_shutdown().catchError((Object _) {}));
    super.dispose();
  }
}
