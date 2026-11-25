import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../audio/app_audio.dart';
import '../../audio/audio_settings.dart';
import '../../design/omi_design.dart';
import '../../design/omi_navigation.dart';
import '../splash/widgets/omi_logo.dart';
import '../splash/widgets/tropical_background.dart';

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key, required this.audio});

  final AppAudio audio;

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  int _counter = 0;
  bool _settingsOpen = false;

  Future<void> _openSettings() async {
    if (_settingsOpen) return;
    _settingsOpen = true;
    try {
      await openOmiScreen<void>(
        context,
        AudioSettingsScreen(audio: widget.audio),
      );
    } finally {
      _settingsOpen = false;
    }
  }

  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
    value: SystemUiOverlayStyle.light,
    child: Scaffold(
      backgroundColor: OmiColors.forest,
      body: Stack(
        fit: StackFit.expand,
        children: [
          const TropicalBackground(),
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 34, 20, 24),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const AspectRatio(aspectRatio: 2.9, child: OmiLogo()),
                      const SizedBox(height: 34),
                      DecoratedBox(
                        decoration: BoxDecoration(
                          color: OmiColors.cream,
                          borderRadius: BorderRadius.circular(26),
                          border: Border.all(color: OmiColors.gold, width: 2),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x440A2C25),
                              blurRadius: 20,
                              offset: Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(22),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                'Table counter',
                                textAlign: TextAlign.center,
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                              Semantics(
                                liveRegion: true,
                                label: 'Table count',
                                child: Text(
                                  '$_counter',
                                  textAlign: TextAlign.center,
                                  style: Theme.of(context)
                                      .textTheme
                                      .displaySmall,
                                ),
                              ),
                              const SizedBox(height: 12),
                              OmiButton.primary(
                                label: 'Add one',
                                icon: Icons.add_rounded,
                                onPressed: () => setState(() => _counter++),
                              ),
                              const SizedBox(height: 12),
                              OmiButton.secondary(
                                label: 'Audio settings',
                                icon: Icons.tune_rounded,
                                onPressed: _openSettings,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
