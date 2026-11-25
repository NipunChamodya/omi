import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:material_ui/material_ui.dart';

import '../../../design/omi_design.dart';
import '../splash_timeline.dart';
import 'omi_logo.dart';

/// Replace this widget with another logo renderer while keeping the timeline.
class AnimatedOmiLogo extends StatelessWidget {
  const AnimatedOmiLogo({super.key, required this.animation});

  final Animation<double> animation;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: animation,
    child: const OmiLogo(),
    builder: (context, logo) => _frame(animation.value, logo!),
  );

  Widget _frame(double time, Widget logo) {
    final reveal = SplashTimeline.logo(time);
    final finish = SplashTimeline.finish(time);
    final scaleProgress = SplashTimeline.phase(
      time,
      SplashTimeline.cardsEnd,
      SplashTimeline.logoEnd,
      SplashTimeline.logoSettle,
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
        Paint()..color = OmiColors.cream.withValues(alpha: intensity),
      );
    }
  }

  @override
  bool shouldRepaint(_Sparkles oldDelegate) => progress != oldDelegate.progress;
}
