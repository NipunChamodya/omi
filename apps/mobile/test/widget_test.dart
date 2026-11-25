import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/splash/omi_splash_screen.dart';
import 'package:mobile/features/splash/splash_artwork.dart';
import 'package:mobile/features/splash/splash_scene.dart';
import 'package:mobile/features/splash/splash_timeline.dart';
import 'package:mobile/main.dart';

const homeKey = Key('test-home');
const artworkKey = Key('splash-artwork');

class MissingArtworkBundle extends CachingAssetBundle {
  @override
  Future<ByteData> load(String key) async {
    if (key.startsWith('assets/splash/')) {
      throw FlutterError('Missing test asset: $key');
    }
    return rootBundle.load(key);
  }
}

Future<void> start(WidgetTester tester, Widget app) async {
  await tester.pumpWidget(app);
  final context = tester.element(find.byType(OmiSplashScreen));
  await tester.runAsync(() async {
    await Future.wait([
      for (final image in SplashArtwork.images)
        precacheImage(image, context, onError: (_, _) {}),
    ]);
  });
  await tester.pump();
}

Widget app({Widget? home, Future<void>? initialization}) => MaterialApp(
  home: OmiSplashScreen(
    home: home ?? const Scaffold(key: homeKey),
    initialization: initialization,
  ),
);

void main() {
  test('timeline has exact duration and phase endpoints', () {
    expect(SplashTimeline.duration, const Duration(seconds: 5));
    final at = SplashTimeline.at;
    expect(SplashTimeline.background(at(0)), 0);
    expect(SplashTimeline.background(at(750)), 1);
    for (var index = 0; index < 4; index++) {
      expect(SplashTimeline.card(at(750 + 150 * index), index), 0);
      expect(SplashTimeline.card(at(751 + 150 * index), index), greaterThan(0));
      expect(SplashTimeline.card(at(2000), index), 1);
    }
    expect(SplashTimeline.logo(at(2000)), 0);
    expect(SplashTimeline.logo(at(3000)), 1);
    expect(SplashTimeline.finish(at(3000)), 0);
    expect(SplashTimeline.finish(at(4250)), 1);
    expect(SplashTimeline.home(at(4250)), 0);
    expect(SplashTimeline.home(at(5000)), 1);
  });

  testWidgets('cold start renders and Home is built once and unlocked at 5s', (
    tester,
  ) async {
    var homeMounts = 0;
    await start(tester, app(home: MountProbe(onMount: () => homeMounts++)));
    expect(find.byType(SplashScene), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 4249));
    expect(find.byKey(homeKey), findsNothing);
    await tester.pump(const Duration(milliseconds: 376));
    expect(find.byKey(homeKey), findsOneWidget);
    expect(find.byType(SplashScene), findsOneWidget);
    final sceneOpacity = tester.widget<Opacity>(
      find.ancestor(
        of: find.byType(SplashScene),
        matching: find.byType(Opacity),
      ),
    );
    expect(sceneOpacity.opacity, closeTo(.5, .03));
    await tester.pump(const Duration(milliseconds: 374));
    expect(find.byType(SplashScene), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 1));
    expect(find.byType(SplashScene), findsNothing);
    expect(find.byKey(homeKey), findsOneWidget);
    await tester.pump(const Duration(seconds: 10));
    expect(homeMounts, 1);
  });

  testWidgets('real app preserves counter Home and does not replay on resume', (
    tester,
  ) async {
    await start(tester, const MyApp());
    await tester.pump(const Duration(seconds: 5));
    expect(find.byType(MyHomePage), findsOneWidget);
    await tester.tap(find.byTooltip('Increment'));
    await tester.pump();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    expect(find.text('1'), findsOneWidget);
    expect(find.byType(SplashScene), findsNothing);
  });

  testWidgets('disposal during animation cancels pending work', (tester) async {
    await start(tester, app());
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 6));
    expect(tester.takeException(), isNull);
  });

  testWidgets('reduced motion shows static artwork then cuts to Home', (
    tester,
  ) async {
    tester.binding.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(
      tester.binding.platformDispatcher.clearAccessibilityFeaturesTestValue,
    );
    await start(tester, app());
    expect(
      tester.widget<SplashScene>(find.byType(SplashScene)).reducedMotion,
      true,
    );
    final progress = find.byType(LinearProgressIndicator);
    final initialValue = tester.widget<LinearProgressIndicator>(progress).value;
    await tester.pump(const Duration(milliseconds: 4999));
    expect(
      tester.widget<LinearProgressIndicator>(progress).value,
      initialValue,
    );
    expect(find.byKey(homeKey), findsNothing);
    await tester.pump(const Duration(milliseconds: 1));
    expect(find.byKey(homeKey), findsOneWidget);
  });

  testWidgets('pause freezes active timeline and resume continues it', (
    tester,
  ) async {
    await start(tester, app());
    await tester.pump(const Duration(seconds: 2));
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump(const Duration(seconds: 8));
    expect(find.byKey(homeKey), findsNothing);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 2999));
    expect(find.byType(SplashScene), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 1));
    expect(find.byType(SplashScene), findsNothing);
  });

  testWidgets('missing assets fall back and still reach Home', (tester) async {
    await start(
      tester,
      DefaultAssetBundle(bundle: MissingArtworkBundle(), child: app()),
    );
    await tester.pump(const Duration(seconds: 3));
    await tester.pump();
    expect(find.text('OMI'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pump(const Duration(seconds: 2));
    expect(find.byKey(homeKey), findsOneWidget);
  });

  testWidgets('Home waits for essential initialization', (tester) async {
    final pending = Completer<void>();
    await start(tester, app(initialization: pending.future));
    await tester.pump(const Duration(seconds: 5));
    expect(find.byKey(homeKey), findsNothing);
    expect(find.byType(SplashScene), findsOneWidget);
    pending.complete();
    await tester.pump();
    expect(find.byKey(homeKey), findsOneWidget);
    expect(find.byType(SplashScene), findsNothing);
  });

  testWidgets('initialization failure keeps a safe error screen', (
    tester,
  ) async {
    final pending = Completer<void>();
    await start(tester, app(initialization: pending.future));
    pending.completeError(StateError('test startup failure'));
    await tester.pump(const Duration(seconds: 5));
    expect(find.textContaining('Could not start OMI'), findsOneWidget);
    expect(find.byKey(homeKey), findsNothing);
  });

  for (final size in [const Size(320, 568), const Size(480, 1040)]) {
    testWidgets('artwork fits ${size.width} x ${size.height} with cutout', (
      tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = size;
      tester.view.padding = const FakeViewPadding(top: 42, bottom: 24);
      tester.binding.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.view.reset);
      addTearDown(
        tester.binding.platformDispatcher.clearTextScaleFactorTestValue,
      );
      await start(tester, app());
      await tester.pump(const Duration(seconds: 3));
      final artwork = tester.getRect(find.byKey(artworkKey));
      final progress = tester.getRect(find.byType(LinearProgressIndicator));
      expect(artwork.left, greaterThanOrEqualTo(16));
      expect(artwork.right, lessThanOrEqualTo(size.width - 16));
      expect(artwork.top, greaterThanOrEqualTo(42));
      expect(artwork.bottom, lessThan(progress.top));
      expect(progress.bottom, lessThanOrEqualTo(size.height - 24));
      expect(tester.takeException(), isNull);
    });
  }
}

class MountProbe extends StatefulWidget {
  const MountProbe({super.key, required this.onMount});

  final VoidCallback onMount;

  @override
  State<MountProbe> createState() => _MountProbeState();
}

class _MountProbeState extends State<MountProbe> {
  @override
  void initState() {
    super.initState();
    widget.onMount();
  }

  @override
  Widget build(BuildContext context) => const Scaffold(key: homeKey);
}
