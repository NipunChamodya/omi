import 'package:material_ui/material_ui.dart';

abstract final class OmiColors {
  static const sky = Color(0xFF48C8F5);
  static const play = Color(0xFF83D52F);
  static const gold = Color(0xFFFFD044);
  static const orange = Color(0xFFFF8B27);
  static const cream = Color(0xFFFFF2D0);
  static const red = Color(0xFFF64C65);
  static const green = Color(0xFF176C59);
  static const forest = Color(0xFF103D35);
  static const ink = Color(0xFF132C25);
}

const omiTouchTarget = 48.0;

ThemeData omiTheme() => ThemeData(
  colorScheme: ColorScheme.fromSeed(seedColor: OmiColors.green).copyWith(
    primary: OmiColors.green,
    onPrimary: Colors.white,
    surface: OmiColors.cream,
    onSurface: OmiColors.ink,
  ),
  scaffoldBackgroundColor: OmiColors.cream,
  materialTapTargetSize: MaterialTapTargetSize.padded,
);

class OmiButton extends StatelessWidget {
  const OmiButton.primary({
    super.key,
    required this.label,
    required this.icon,
    required this.onPressed,
  }) : _primary = true;

  const OmiButton.secondary({
    super.key,
    required this.label,
    required this.icon,
    required this.onPressed,
  }) : _primary = false;

  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool _primary;

  @override
  Widget build(BuildContext context) {
    const target = Size(omiTouchTarget, omiTouchTarget);
    return _primary
        ? FilledButton.icon(
            onPressed: onPressed,
            icon: Icon(icon),
            label: Text(label),
            style: FilledButton.styleFrom(
              minimumSize: target,
              backgroundColor: OmiColors.play,
              foregroundColor: OmiColors.ink,
            ),
          )
        : OutlinedButton.icon(
            onPressed: onPressed,
            icon: Icon(icon),
            label: Text(label),
            style: OutlinedButton.styleFrom(minimumSize: target),
          );
  }
}
