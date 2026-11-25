import 'package:flutter/animation.dart';

abstract final class SplashTimeline {
  static const duration = Duration(milliseconds: 5000);
  static const backgroundEnd = 750;
  static const cardsEnd = 2000;
  static const logoEnd = 3000;
  static const finishEnd = 4250;

  static double at(int milliseconds) => milliseconds / duration.inMilliseconds;

  static double phase(
    double time,
    int start,
    int end, [
    Curve curve = Curves.linear,
  ]) => Interval(at(start), at(end), curve: curve).transform(time);

  static double background(double time) =>
      phase(time, 0, backgroundEnd, Curves.easeOutCubic);

  static double card(double time, int index) => phase(
    time,
    backgroundEnd + 150 * index,
    cardsEnd - 120 * (3 - index),
    Curves.easeOutCubic,
  );

  static double logo(double time) =>
      phase(time, cardsEnd, logoEnd, Curves.easeOutCubic);

  static double finish(double time) => phase(time, logoEnd, finishEnd);

  static double home(double time) =>
      phase(time, finishEnd, duration.inMilliseconds, Curves.easeInOutCubic);
}
