import 'package:flutter/widgets.dart';

abstract final class SplashArtwork {
  static const landscape = AssetImage('assets/splash/tropical-island.webp');
  static const palms = AssetImage('assets/splash/palms.webp');
  static const logo = AssetImage('assets/splash/omi-mark.png');
  static const cards = [
    AssetImage('assets/splash/court-1.png'),
    AssetImage('assets/splash/court-2.png'),
    AssetImage('assets/splash/court-3.png'),
    AssetImage('assets/splash/court-4.png'),
  ];
  static const images = [landscape, palms, logo, ...cards];
}
