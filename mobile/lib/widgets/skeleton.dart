import 'package:flutter/material.dart';

import '../core/theme/app_tokens.g.dart';

/// A grey bar that stands in for text while data loads.
class SkeletonBar extends StatelessWidget {
  const SkeletonBar({super.key, this.width, this.height = 14});

  final double? width;
  final double height;

  @override
  Widget build(BuildContext context) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(color: AppTokens.progressTrack, borderRadius: BorderRadius.circular(AppTokens.radiusSm)),
      );
}

/// Pulses its child softly; the animation stops when the real content replaces it.
class Pulse extends StatefulWidget {
  const Pulse({super.key, required this.child});

  final Widget child;

  @override
  State<Pulse> createState() => _PulseState();
}

class _PulseState extends State<Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    return super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
        opacity: Tween<double>(begin: 0.45, end: 1).animate(CurvedAnimation(parent: _c, curve: Curves.easeInOut)),
        child: widget.child,
      );
}

/// Placeholder rows for any list screen: a rounded square, two text lines and a short one.
class ListSkeleton extends StatelessWidget {
  const ListSkeleton({super.key, this.rows = 5});

  final int rows;

  @override
  Widget build(BuildContext context) {
    // A plain Column (not a ListView) so it can sit inside any parent, bounded or not.
    return Pulse(
      child: SingleChildScrollView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppTokens.spaceS4),
        child: Column(
          children: [
            for (var i = 0; i < rows; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: AppTokens.spaceS4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(color: AppTokens.progressTrack, borderRadius: BorderRadius.circular(AppTokens.radiusMd)),
                    ),
                    const SizedBox(width: AppTokens.spaceS3),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [SkeletonBar(height: 16), SizedBox(height: AppTokens.spaceS2), SkeletonBar(width: 140, height: 12), SizedBox(height: AppTokens.spaceS2), SkeletonBar(width: 90, height: 12)],
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
