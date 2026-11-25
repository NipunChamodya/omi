import 'package:material_ui/material_ui.dart';

import '../../../design/omi_design.dart';
import '../splash_artwork.dart';
import '../splash_timeline.dart';

class TropicalBackground extends StatelessWidget {
  const TropicalBackground({super.key, this.animation});

  final Animation<double>? animation;

  @override
  Widget build(BuildContext context) {
    const sky = RepaintBoundary(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              OmiColors.sky,
              Color(0xFFFFDCA2),
              Color(0xFF60C4AA),
              OmiColors.forest,
            ],
            stops: [0, .35, .65, 1],
          ),
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: Alignment(.68, -.56),
              radius: .46,
              colors: [Color(0xB7FFF2D0), Color(0x00FFF2D0)],
            ),
          ),
        ),
      ),
    );
    const landscape = RepaintBoundary(child: _IslandBand());
    const palms = RepaintBoundary(
      child: Image(
        image: SplashArtwork.palms,
        fit: BoxFit.fitWidth,
        alignment: Alignment.bottomCenter,
        excludeFromSemantics: true,
        errorBuilder: hideMissingArtwork,
      ),
    );
    return ClipRect(
      child: Stack(
        fit: StackFit.expand,
        children: [
          _layer(sky),
          _layer(landscape, drift: 4, zoom: .028),
          _layer(
            const Align(
              alignment: Alignment.bottomCenter,
              child: FractionallySizedBox(widthFactor: 1, child: palms),
            ),
            drift: 7,
            zoom: .05,
          ),
        ],
      ),
    );
  }

  Widget _layer(Widget child, {double drift = 0, double zoom = 0}) {
    final timeline = animation;
    if (timeline == null) return child;
    // A clipped full-screen opacity layer is only needed during the reveal.
    return AnimatedBuilder(
      animation: timeline,
      child: child,
      builder: (context, child) {
        final time = timeline.value;
        final opacity = SplashTimeline.background(time);
        return Opacity(
          opacity: opacity,
          child: Transform.translate(
            offset: Offset(0, drift * (1 - time)),
            child: Transform.scale(
              scale: 1 + zoom * time,
              alignment: Alignment.bottomCenter,
              child: child,
            ),
          ),
        );
      },
    );
  }
}

class _IslandBand extends StatelessWidget {
  const _IslandBand();

  @override
  Widget build(BuildContext context) => const Align(
    alignment: Alignment(0, .27),
    child: FractionallySizedBox(
      widthFactor: 1,
      heightFactor: .66,
      child: ShaderMask(
        blendMode: BlendMode.dstIn,
        shaderCallback: _shoreMask,
        child: Image(
          image: SplashArtwork.landscape,
          fit: BoxFit.cover,
          alignment: Alignment(.27, 0),
          excludeFromSemantics: true,
          errorBuilder: hideMissingArtwork,
        ),
      ),
    ),
  );
}

Shader _shoreMask(Rect bounds) => const LinearGradient(
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
  colors: [Colors.transparent, Colors.white, Colors.white, Colors.transparent],
  stops: [0, .20, .73, 1],
).createShader(bounds);

Widget hideMissingArtwork(
  BuildContext context,
  Object error,
  StackTrace? stack,
) => const SizedBox.shrink();
