import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import 'splash_artwork.dart';
import 'splash_scene.dart';
import 'splash_timeline.dart';

/// Owns the cold-start handoff on the app's initial route, preserving Home state.
class OmiSplashScreen extends StatefulWidget {
  const OmiSplashScreen({super.key, required this.home, this.initialization});

  final Widget home;
  final Future<void>? initialization;

  @override
  State<OmiSplashScreen> createState() => _OmiSplashScreenState();
}

class _OmiSplashScreenState extends State<OmiSplashScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController _timeline;
  bool _artReady = false;
  bool _preparingArtwork = false;
  late bool _ready;
  bool _failed = false;
  bool _foreground = true;
  bool _showHome = false;
  bool _finished = false;
  bool _reducedMotion = false;

  @override
  void initState() {
    super.initState();
    final binding = WidgetsBinding.instance;
    binding.addObserver(this);
    _foreground =
        binding.lifecycleState == null ||
        binding.lifecycleState == AppLifecycleState.resumed;
    _timeline = AnimationController(
      vsync: this,
      duration: SplashTimeline.duration,
      animationBehavior: AnimationBehavior.preserve,
    )..addListener(_advanceHandoff);
    final initialization = widget.initialization;
    _ready = initialization == null;
    if (initialization != null) _awaitInitialization(initialization);
  }

  Future<void> _awaitInitialization(Future<void> initialization) async {
    try {
      await initialization;
      if (!mounted) return;
      setState(() => _ready = true);
      _advanceHandoff();
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reducedMotion = MediaQuery.disableAnimationsOf(context);
    if (!_artReady) _precacheArtwork();
  }

  Future<void> _precacheArtwork() async {
    if (_preparingArtwork) return;
    _preparingArtwork = true;
    await Future.wait([
      for (final image in SplashArtwork.images)
        precacheImage(image, context, onError: (_, _) {}),
    ]);
    if (!mounted) return;
    _artReady = true;
    if (_foreground) _timeline.forward();
  }

  void _advanceHandoff() {
    final complete = _timeline.value >= 1;
    final revealHome =
        _showHome ||
        _ready &&
            (complete ||
                (!_reducedMotion &&
                    _timeline.value >=
                        SplashTimeline.at(SplashTimeline.finishEnd)));
    if (revealHome == _showHome && (complete && _ready) == _finished) return;
    setState(() {
      _showHome = revealHome;
      _finished = complete && _ready;
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (!_foreground) {
      _timeline.stop();
    } else if (_artReady && _timeline.value < 1) {
      _timeline.forward();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timeline.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        if (_showHome)
          ExcludeFocus(
            excluding: !_finished,
            child: ExcludeSemantics(excluding: !_finished, child: widget.home),
          ),
        if (!_finished)
          AnnotatedRegion<SystemUiOverlayStyle>(
            value: SystemUiOverlayStyle.light,
            child: AbsorbPointer(
              child: AnimatedBuilder(
                animation: _timeline,
                builder: (context, child) {
                  final time = _timeline.value;
                  final home = _showHome && !_reducedMotion
                      ? SplashTimeline.home(time)
                      : 0.0;
                  return Opacity(
                    opacity: 1 - home,
                    child: SplashScene(
                      time: time,
                      artworkReady: _artReady,
                      reducedMotion: _reducedMotion,
                      failed: _failed,
                    ),
                  );
                },
              ),
            ),
          ),
      ],
    );
  }
}
