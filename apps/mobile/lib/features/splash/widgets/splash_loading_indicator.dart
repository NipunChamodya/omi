import 'package:material_ui/material_ui.dart';

import '../../../design/omi_design.dart';

class SplashLoadingIndicator extends StatelessWidget {
  const SplashLoadingIndicator({
    super.key,
    required this.animation,
    required this.reducedMotion,
    required this.failed,
  });

  final Animation<double> animation;
  final bool reducedMotion;
  final bool failed;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: animation,
    builder: (context, child) => _frame(animation.value),
  );

  Widget _frame(double time) {
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
                style: const TextStyle(color: OmiColors.cream),
              )
            : SizedBox(
                width: 64,
                child: LinearProgressIndicator(
                  value: reducedMotion ? .65 : time,
                  minHeight: 4,
                  borderRadius: const BorderRadius.all(Radius.circular(4)),
                  color: OmiColors.gold,
                  backgroundColor: const Color(0x55FFF2D0),
                ),
              ),
      ),
    );
  }
}
