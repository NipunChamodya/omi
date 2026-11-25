import 'package:material_ui/material_ui.dart';

Future<T?> openOmiScreen<T>(BuildContext context, Widget screen) {
  final reducedMotion = MediaQuery.disableAnimationsOf(context);
  final duration = reducedMotion
      ? Duration.zero
      : const Duration(milliseconds: 220);
  return Navigator.of(context).push<T>(
    PageRouteBuilder<T>(
      transitionDuration: duration,
      reverseTransitionDuration: duration,
      pageBuilder: (context, animation, secondaryAnimation) => screen,
      transitionsBuilder: (context, animation, secondaryAnimation, child) =>
          FadeTransition(
            opacity: animation.drive(CurveTween(curve: Curves.easeOutCubic)),
            child: child,
          ),
    ),
  );
}
