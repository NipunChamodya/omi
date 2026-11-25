import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../splash_artwork.dart';
import '../splash_timeline.dart';
import 'tropical_background.dart';

class AnimatedPlayingCards extends StatelessWidget {
  const AnimatedPlayingCards({super.key, required this.animation});

  final Animation<double> animation;

  @override
  Widget build(BuildContext context) {
    const angles = [-.29, -.095, .095, .29];
    return LayoutBuilder(
      builder: (context, bounds) {
        final width = bounds.maxWidth;
        final cardWidth = width * .25;
        return Stack(
          alignment: Alignment.topCenter,
          children: [
            for (var index = 0; index < SplashArtwork.cards.length; index++)
              AnimatedBuilder(
                animation: animation,
                child: RepaintBoundary(
                  child: Image(
                    image: SplashArtwork.cards[index],
                    width: cardWidth,
                    height: cardWidth * 76 / 54,
                    fit: BoxFit.contain,
                    excludeFromSemantics: true,
                    errorBuilder: hideMissingArtwork,
                  ),
                ),
                builder: (context, child) {
                  final progress = SplashTimeline.card(animation.value, index);
                  final offset = (index - 1.5) * width * .15;
                  final angle = angles[index];
                  final stretch = math.sin(progress * math.pi) * .038;
                  return Transform.translate(
                    offset: Offset(
                      offset * (.55 + .45 * progress),
                      width * (.11 * (1 - progress) + angle.abs() * .12),
                    ),
                    child: Transform.rotate(
                      angle: angle * (.4 + .6 * progress),
                      child: Transform.scale(
                        scaleX: 1 - stretch,
                        scaleY: 1 + stretch,
                        child: Opacity(opacity: progress, child: child),
                      ),
                    ),
                  );
                },
              ),
          ],
        );
      },
    );
  }
}
