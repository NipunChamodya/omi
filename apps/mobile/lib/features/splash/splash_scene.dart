import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../../design/omi_design.dart';
import 'splash_timeline.dart';
import 'widgets/animated_omi_logo.dart';
import 'widgets/animated_playing_cards.dart';
import 'widgets/splash_loading_indicator.dart';
import 'widgets/tropical_background.dart';

class SplashScene extends StatelessWidget {
  const SplashScene({
    super.key,
    required this.animation,
    required this.artworkReady,
    required this.reducedMotion,
    required this.failed,
  });

  final Animation<double> animation;
  final bool artworkReady;
  final bool reducedMotion;
  final bool failed;

  @override
  Widget build(BuildContext context) {
    final visualTimeline = reducedMotion
        ? AlwaysStoppedAnimation(SplashTimeline.at(SplashTimeline.finishEnd))
        : animation;
    return Material(
      color: OmiColors.forest,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (artworkReady) TropicalBackground(animation: visualTimeline),
          SafeArea(
            minimum: const EdgeInsets.all(16),
            child: LayoutBuilder(
              builder: (context, bounds) {
                final width = math.min(
                  420.0,
                  math.min(bounds.maxWidth, bounds.maxHeight * .92),
                );
                return Stack(
                  fit: StackFit.expand,
                  children: [
                    if (artworkReady)
                      Align(
                        alignment: const Alignment(0, -.32),
                        child: SizedBox(
                          key: const Key('splash-artwork'),
                          width: width,
                          height: width * .83,
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              Positioned(
                                top: width * .36,
                                left: 0,
                                right: 0,
                                height: width * .47,
                                child: AnimatedPlayingCards(
                                  animation: visualTimeline,
                                ),
                              ),
                              Positioned(
                                top: 0,
                                left: 0,
                                right: 0,
                                height: width * .345,
                                child: AnimatedOmiLogo(
                                  animation: visualTimeline,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    Align(
                      alignment: const Alignment(0, .84),
                      child: SplashLoadingIndicator(
                        animation: animation,
                        reducedMotion: reducedMotion,
                        failed: failed,
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
