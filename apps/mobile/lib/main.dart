import 'dart:async';

import 'package:material_ui/material_ui.dart';

import 'audio/app_audio.dart';
import 'audio/device_audio.dart';
import 'design/omi_design.dart';
import 'features/home/omi_home.dart';
import 'features/splash/omi_splash_screen.dart';

export 'features/home/omi_home.dart' show MyHomePage;

void main() => runApp(const MyApp());

class MyApp extends StatefulWidget {
  const MyApp({super.key, this.audio});

  final AppAudio? audio;

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  late final AppAudio _audio;
  final _theme = omiTheme();

  @override
  void initState() {
    super.initState();
    _audio = widget.audio ?? AppAudio(DeviceAudio(), DeviceAudioPreferences());
    unawaited(_audio.start());
  }

  @override
  void dispose() {
    if (widget.audio == null) _audio.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'OMI — Tropical Adventure',
    debugShowCheckedModeBanner: false,
    theme: _theme,
    home: OmiSplashScreen(home: MyHomePage(audio: _audio)),
  );
}
