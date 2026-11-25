import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:material_ui/material_ui.dart';

import 'splash_artwork.dart';
import 'splash_timeline.dart';

const splashBase = Color(0xFF103D35);
const _gold = Color(0xFFFFD044);
const _cream = Color(0xFFFFF2D0);

class SplashScene extends StatelessWidget {
  const SplashScene({
    super.key,
    required this.time,
    required this.artworkReady,
    required this.reducedMotion,
    required this.failed,
  });

  final double time;
  final bool artworkReady;
  final bool reducedMotion;
  final bool failed;

  @override
  Widget build(BuildContext context) {
    final visualTime = reducedMotion
        ? SplashTimeline.at(SplashTimeline.finishEnd)
        : time;
    return Material(
      color: splashBase,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (artworkReady) _TropicalBackground(time: visualTime),
          SafeArea(
            minimum: const EdgeInsets.all(16),
            child: LayoutBuilder(
              builder: (context, bounds) {
                final width = math.min(
                  410.0,
                  math.min(bounds.maxWidth, bounds.maxHeight * .98),
                );
                return Stack(
                  fit: StackFit.expand,
                  children: [
                    if (artworkReady)
                      Align(
                        alignment: const Alignment(0, -.25),
                        child: SizedBox(
                          key: const Key('splash-artwork'),
                          width: width,
                          height: width * .77,
                          child: Stack(
                            children: [
                              Positioned(
                                top: width * .32,
                                left: 0,
                                right: 0,
                                height: width * .45,
                                child: _PlayingCards(time: visualTime),
                              ),
                              Positioned(
                                top: 0,
                                left: 0,
                                right: 0,
                                height: width * .345,
                                child: _AnimatedLogo(time: visualTime),
                              ),
                            ],
                          ),
                        ),
                      ),
                    Align(
                      alignment: const Alignment(0, .86),
                      child: _LoadingIndicator(
                        time: time,
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

class _TropicalBackground extends StatelessWidget {
  const _TropicalBackground({required this.time});

  final double time;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: SplashTimeline.background(time),
      child: ClipRect(
        child: Transform.scale(
          scale: 1 + .035 * time,
          child: const RepaintBoundary(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFF48C8F5),
                    Color(0xFFFFDBA7),
                    Color(0xFF66C6AA),
                    Color(0xFF176C59),
                    splashBase,
                  ],
                  stops: [0, .33, .56, .79, 1],
                ),
              ),
              child: Align(
                alignment: Alignment(0, .44),
                child: ShaderMask(
                  blendMode: BlendMode.dstIn,
                  shaderCallback: _shoreMask,
                  child: SizedBox(
                    width: double.infinity,
                    child: Image(
                      image: SplashArtwork.landscape,
                      fit: BoxFit.fitWidth,
                      errorBuilder: _hideMissingImage,
                      excludeFromSemantics: true,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

Shader _shoreMask(Rect bounds) => const LinearGradient(
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
  colors: [Colors.transparent, Colors.white, Colors.white, Colors.transparent],
  stops: [0, .16, .78, 1],
).createShader(bounds);

Widget _hideMissingImage(
  BuildContext context,
  Object error,
  StackTrace? stack,
) => const SizedBox.shrink();

class _PlayingCards extends StatelessWidget {
  const _PlayingCards({required this.time});

  final double time;

  @override
  Widget build(BuildContext context) {
    const angles = [-.32, -.11, .11, .32];
    return LayoutBuilder(
      builder: (context, bounds) {
        final width = bounds.maxWidth;
        final cardWidth = width * .235;
        return Stack(
          alignment: Alignment.topCenter,
          children: [
            for (var index = 0; index < SplashArtwork.cards.length; index++)
              _AnimatedCard(
                progress: SplashTimeline.card(time, index),
                offset: (index - 1.5) * width * .139,
                angle: angles[index],
                width: cardWidth,
                image: SplashArtwork.cards[index],
              ),
          ],
        );
      },
    );
  }
}

class _AnimatedCard extends StatelessWidget {
  const _AnimatedCard({
    required this.progress,
    required this.offset,
    required this.angle,
    required this.width,
    required this.image,
  });

  final double progress;
  final double offset;
  final double angle;
  final double width;
  final AssetImage image;

  @override
  Widget build(BuildContext context) {
    return Transform.translate(
      offset: Offset(
        offset * (.55 + .45 * progress),
        width * (.38 * (1 - progress) + angle.abs() * .39),
      ),
      child: Transform.rotate(
        angle: angle * (.36 + .64 * progress),
        child: Opacity(
          opacity: progress,
          child: RepaintBoundary(
            child: Image(
              image: image,
              width: width,
              height: width * 76 / 54,
              fit: BoxFit.contain,
              excludeFromSemantics: true,
              errorBuilder: _hideMissingImage,
            ),
          ),
        ),
      ),
    );
  }
}

/// Replace this widget with another logo renderer while keeping the timeline.
class _AnimatedLogo extends StatelessWidget {
  const _AnimatedLogo({required this.time});

  final double time;

  @override
  Widget build(BuildContext context) {
    final reveal = SplashTimeline.logo(time);
    final finish = SplashTimeline.finish(time);
    final scaleProgress = SplashTimeline.phase(
      time,
      SplashTimeline.cardsEnd,
      SplashTimeline.logoEnd,
      const Cubic(.18, .84, .35, 1.06),
    );
    const logo = RepaintBoundary(
      child: Image(
        image: SplashArtwork.logo,
        fit: BoxFit.contain,
        semanticLabel: 'OMI Tropical Adventure',
        errorBuilder: _missingLogo,
      ),
    );
    return Opacity(
      opacity: reveal,
      child: Transform.scale(
        scale: Tween<double>(begin: .91, end: 1).transform(scaleProgress),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (finish > 0 && finish < 1)
              ShaderMask(
                blendMode: BlendMode.srcATop,
                shaderCallback: (bounds) {
                  final x = bounds.width * (-.35 + finish * 1.7);
                  return ui.Gradient.linear(
                    Offset(x - bounds.width * .17, bounds.height),
                    Offset(x + bounds.width * .17, 0),
                    const [
                      Color(0x00FFF2D0),
                      Color(0x80FFF2D0),
                      Color(0x00FFF2D0),
                    ],
                    const [0, .5, 1],
                  );
                },
                child: logo,
              )
            else
              logo,
            if (finish > 0 && finish < 1)
              IgnorePointer(child: CustomPaint(painter: _Sparkles(finish))),
          ],
        ),
      ),
    );
  }
}

Widget _missingLogo(BuildContext context, Object error, StackTrace? stack) =>
    const Center(
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            'OMI',
            style: TextStyle(
              color: _gold,
              fontSize: 64,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      ),
    );

class _Sparkles extends CustomPainter {
  const _Sparkles(this.progress);

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    const points = [Offset(.14, .24), Offset(.85, .18), Offset(.88, .65)];
    for (var index = 0; index < points.length; index++) {
      final point = points[index];
      final phase = ((progress - index * .13) / .62).clamp(0.0, 1.0);
      final intensity = math.sin(phase * math.pi);
      final radius = size.width * .018 * intensity;
      final x = size.width * point.dx;
      final y = size.height * point.dy;
      final star = Path()
        ..moveTo(x, y - radius)
        ..quadraticBezierTo(x, y, x + radius * .72, y)
        ..quadraticBezierTo(x, y, x, y + radius)
        ..quadraticBezierTo(x, y, x - radius * .72, y)
        ..quadraticBezierTo(x, y, x, y - radius)
        ..close();
      canvas.drawPath(
        star,
        Paint()..color = _cream.withValues(alpha: intensity),
      );
    }
  }

  @override
  bool shouldRepaint(_Sparkles oldDelegate) => progress != oldDelegate.progress;
}

class _LoadingIndicator extends StatelessWidget {
  const _LoadingIndicator({
    required this.time,
    required this.reducedMotion,
    required this.failed,
  });

  final double time;
  final bool reducedMotion;
  final bool failed;

  @override
  Widget build(BuildContext context) {
    final label = failed
        ? 'Could not start OMI. Reopen the app to try again.'
        : 'Loading OMI';
    final showStatus = failed || time >= 1;
    return Semantics(
      label: label,
      liveRegion: failed,
      child: ExcludeSemantics(
        child: showStatus
            ? Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: _cream),
              )
            : SizedBox(
                width: 64,
                child: LinearProgressIndicator(
                  value: reducedMotion ? .65 : time,
                  minHeight: 4,
                  borderRadius: const BorderRadius.all(Radius.circular(4)),
                  color: _gold,
                  backgroundColor: const Color(0x55FFF2D0),
                ),
              ),
      ),
    );
  }
}
