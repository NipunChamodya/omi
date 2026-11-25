import 'package:material_ui/material_ui.dart';

import '../../../design/omi_design.dart';
import '../splash_artwork.dart';

class OmiLogo extends StatelessWidget {
  const OmiLogo({super.key});

  @override
  Widget build(BuildContext context) => const RepaintBoundary(
    child: Image(
      image: SplashArtwork.logo,
      fit: BoxFit.contain,
      semanticLabel: 'OMI Tropical Adventure',
      errorBuilder: _missingLogo,
    ),
  );
}

Widget _missingLogo(BuildContext context, Object error, StackTrace? stack) =>
    const Center(
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(
          'OMI',
          style: TextStyle(
            color: OmiColors.gold,
            fontSize: 64,
            fontWeight: FontWeight.w900,
            decoration: TextDecoration.none,
          ),
        ),
      ),
    );
