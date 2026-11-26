import 'package:flutter/material.dart';

import '../core/network/file_url.dart';
import '../core/theme/app_tokens.g.dart';
import '../data/models/student_models.dart';
import '../l10n/gen/app_localizations.dart';

/// Catalogue row, the way course apps list them: a 16:9 thumbnail on the left (never cropped oddly),
/// then title, teacher, language and length, and the demo badge with the fee. Rows are separated by a hairline.
class CourseTile extends StatelessWidget {
  const CourseTile({super.key, required this.course, required this.onTap, this.status});

  final CourseCard course;
  final VoidCallback onTap;

  /// enrolled | pending when I already joined or asked to join this course (shown instead of the demo mark).
  final String? status;

  static const double _thumbWidth = 128;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final thumb = absoluteFileUrl(course.thumbnailUrl);
    final language = switch (course.language) {
      'en' => l.pLangEn,
      'mr' => l.pLangMr,
      'hi' => l.pLangHi,
      _ => null,
    };
    final meta = [
      ?language,
      if (course.durationText != null && course.durationText!.isNotEmpty) course.durationText!,
    ].join(' · ');
    return Semantics(
      button: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppTokens.spaceS4, vertical: AppTokens.spaceS3),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                    child: SizedBox(
                      width: _thumbWidth,
                      child: AspectRatio(
                        aspectRatio: 16 / 9,
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            thumb == null
                                ? _GeneratedCover(subject: course.subject)
                                : Image.network(
                                    thumb,
                                    fit: BoxFit.cover,
                                    excludeFromSemantics: true,
                                    errorBuilder: (_, _, _) => _GeneratedCover(subject: course.subject),
                                  ),
                            // My state with this course (Enrolled / Requested), else the free-demo mark every course has.
                            Positioned(
                              left: 4,
                              bottom: 4,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(color: status == 'enrolled' ? AppTokens.statusApprovedBg : status == 'pending' ? AppTokens.statusPendingBg : AppTokens.surface, borderRadius: BorderRadius.circular(AppTokens.radiusPill)),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(status == 'enrolled' ? Icons.check_circle_rounded : status == 'pending' ? Icons.hourglass_top_rounded : Icons.videocam_rounded, size: 12, color: AppTokens.text),
                                    const SizedBox(width: 3),
                                    Text(status == 'enrolled' ? l.pEnrolledBadge : status == 'pending' ? l.pRequestedBadge : l.pDemoBadge, style: const TextStyle(color: AppTokens.text, fontSize: 11, fontWeight: FontWeight.w700, height: 1.2)),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppTokens.spaceS3),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          course.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: AppTokens.heading, fontSize: AppTokens.textBase, fontWeight: FontWeight.w800, height: 1.25),
                        ),
                        const SizedBox(height: 2),
                        Text(course.teacherName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textSm)),
                        if (meta.isNotEmpty)
                          Text(meta, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textXs)),
                        const SizedBox(height: AppTokens.spaceS2),
                        if (course.feeDisplay != null && course.feeDisplay!.isNotEmpty) FeeText(text: course.feeDisplay!),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const Divider(height: 1, indent: AppTokens.spaceS4, endIndent: AppTokens.spaceS4),
        ],
      ),
    );
  }
}

/// Portrait card for a horizontal swipe row (Home "Explore courses"): cover on top, then title, teacher and fee.
class CourseCarouselCard extends StatelessWidget {
  const CourseCarouselCard({super.key, required this.course, required this.onTap});

  final CourseCard course;
  final VoidCallback onTap;

  static const double width = 232;
  static const double height = 244;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      child: Container(
        width: width,
        height: height,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(color: AppTokens.surface, borderRadius: BorderRadius.circular(AppTokens.radiusLg), border: Border.all(color: AppTokens.border)),
        child: Material(
          color: AppTokens.surface,
          child: InkWell(
            onTap: onTap,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AspectRatio(aspectRatio: 16 / 9, child: CourseCover(thumbnailUrl: course.thumbnailUrl, subject: course.subject)),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppTokens.spaceS3, vertical: 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(course.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTokens.heading, fontSize: AppTokens.textBase, fontWeight: FontWeight.w800, height: 1.25)),
                        const SizedBox(height: 2),
                        Text(course.teacherName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textSm)),
                        const Spacer(),
                        if (course.feeDisplay != null && course.feeDisplay!.isNotEmpty) FeeText(text: course.feeDisplay!),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// "₹4,000 for the full course" → "₹4,000" bold with the rest small and grey.
/// The fee is free text the teacher typed, so when it doesn't start with an amount it is shown whole.
class FeeText extends StatelessWidget {
  const FeeText({super.key, required this.text, this.large = false});

  final String text;

  /// The bigger size used in the course details bottom bar.
  final bool large;

  static final _amount = RegExp(r'^\s*((?:₹|Rs\.?|INR)?\s*\d[\d,.]*)\s*(.*)$', caseSensitive: false);

  @override
  Widget build(BuildContext context) {
    final big = TextStyle(color: AppTokens.heading, fontSize: large ? AppTokens.textLg : AppTokens.textMd, fontWeight: FontWeight.w800);
    final m = _amount.firstMatch(text);
    final price = m?.group(1)?.trim();
    final rest = m?.group(2)?.trim() ?? '';
    if (price == null || price.isEmpty) {
      return Text(text, maxLines: 2, overflow: TextOverflow.ellipsis, style: big.copyWith(fontSize: AppTokens.textBase));
    }
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: price, style: big),
          if (rest.isNotEmpty) TextSpan(text: large ? '\n$rest' : '  $rest', style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textXs, fontWeight: FontWeight.w500, height: 1.3)),
        ],
      ),
      maxLines: 3,
      overflow: TextOverflow.ellipsis,
    );
  }
}

/// A course's thumbnail, or the generated cover when it has none (or fails to load). Fills its parent.
class CourseCover extends StatelessWidget {
  const CourseCover({super.key, required this.thumbnailUrl, this.subject});

  final String? thumbnailUrl;
  final String? subject;

  @override
  Widget build(BuildContext context) {
    final url = absoluteFileUrl(thumbnailUrl);
    if (url == null) return _GeneratedCover(subject: subject);
    return Image.network(url, fit: BoxFit.cover, width: double.infinity, height: double.infinity, excludeFromSemantics: true, errorBuilder: (_, _, _) => _GeneratedCover(subject: subject));
  }
}

/// Used when a course has no thumbnail (or it fails to load): navy to blue with the orange ring, as on the web.
/// It carries the subject only; the title is right beside it.
class _GeneratedCover extends StatelessWidget {
  const _GeneratedCover({required this.subject});

  final String? subject;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.hardEdge,
      decoration: const BoxDecoration(
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [AppTokens.brandNavy, AppTokens.brandNavy, AppTokens.brandBlue], stops: [0, 0.55, 1]),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -14,
            right: -14,
            child: Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: AppTokens.brandOrange, width: 7)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppTokens.spaceS2),
            child: Align(
              alignment: Alignment.bottomLeft,
              child: subject != null && subject!.isNotEmpty
                  ? Text(
                      subject!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppTokens.brandWhite, fontSize: AppTokens.textSm, fontWeight: FontWeight.w800, height: 1.15),
                    )
                  : const Icon(Icons.menu_book_rounded, color: AppTokens.brandWhite, size: 24),
            ),
          ),
        ],
      ),
    );
  }
}
