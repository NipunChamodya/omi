import 'package:material_ui/material_ui.dart';

import '../design/omi_design.dart';
import 'app_audio.dart';

class AudioSettingsScreen extends StatelessWidget {
  const AudioSettingsScreen({super.key, required this.audio});

  final AppAudio audio;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Audio settings')),
    body: SafeArea(
      top: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          MusicControls(audio: audio),
          const Divider(),
          SoundControls(audio: audio),
        ],
      ),
    ),
  );
}

class MusicControls extends StatelessWidget {
  const MusicControls({super.key, required this.audio});

  final AppAudio audio;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: audio,
    builder: (context, _) => _AudioChannel(
      title: 'Background music',
      icon: Icons.music_note_rounded,
      enabled: audio.preferences.musicEnabled,
      volume: audio.preferences.musicVolume,
      onToggle: audio.ready ? audio.setMusicEnabled : null,
      onVolume: audio.setMusicVolume,
      status: audio.musicUnavailable
          ? 'Music is unavailable. Turn it off and on to try again.'
          : null,
    ),
  );
}

class SoundControls extends StatelessWidget {
  const SoundControls({super.key, required this.audio});

  final AppAudio audio;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: audio,
    builder: (context, _) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _AudioChannel(
          title: 'Sound effects',
          icon: Icons.spatial_audio_off_rounded,
          enabled: audio.preferences.effectsEnabled,
          volume: audio.preferences.effectsVolume,
          onToggle: audio.ready ? audio.setEffectsEnabled : null,
          onVolume: audio.setEffectsVolume,
          status: audio.previewUnavailable
              ? 'Sound preview is unavailable.'
              : null,
        ),
        OmiButton.secondary(
          label: 'Preview sound',
          icon: Icons.play_arrow_rounded,
          onPressed: audio.ready && audio.preferences.effectsEnabled
              ? audio.previewEffect
              : null,
        ),
        if (audio.preferencesUnavailable)
          Semantics(
            liveRegion: true,
            child: const Text(
              'Audio settings could not be saved on this device.',
            ),
          ),
      ],
    ),
  );
}

class _AudioChannel extends StatelessWidget {
  const _AudioChannel({
    required this.title,
    required this.icon,
    required this.enabled,
    required this.volume,
    required this.onToggle,
    required this.onVolume,
    required this.status,
  });

  final String title;
  final IconData icon;
  final bool enabled;
  final double volume;
  final ValueChanged<bool>? onToggle;
  final ValueChanged<double> onVolume;
  final String? status;

  @override
  Widget build(BuildContext context) {
    String percent(double value) => '${(value * 100).round()}%';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          secondary: Icon(icon),
          title: Text(title),
          value: enabled,
          onChanged: onToggle,
        ),
        ExcludeSemantics(child: Text('$title volume · ${percent(volume)}')),
        MergeSemantics(
          child: Semantics(
            label: '$title volume',
            child: Slider(
              value: volume,
              divisions: 20,
              onChanged: enabled && onToggle != null ? onVolume : null,
              semanticFormatterCallback: percent,
            ),
          ),
        ),
        if (status != null) Semantics(liveRegion: true, child: Text(status!)),
      ],
    );
  }
}
