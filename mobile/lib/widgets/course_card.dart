import 'package:flutter/material.dart';

import '../core/network/file_url.dart';
import '../core/theme/app_tokens.g.dart';
import '../data/models/student_models.dart';
import '../l10n/gen/app_localizations.dart';

/// Catalogue row, the way course apps list them: a 16:9 thumbnail on the left (never cropped oddly),
/// then title, teacher, language and length, and the demo badge with the fee. Rows are separated by a hairline.
class CourseTile extends StatelessWidget {
  const CourseTile({super.key, required this.course, required this.onTap});

  final CourseCard course;
  final VoidCallback onTap;

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
                            // Every course offers a free live demo, so it is a small mark on the cover, not a row of its own.
                            Positioned(
                              left: 4,
                              bottom: 4,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(color: AppTokens.surface, borderRadius: BorderRadius.circular(AppTokens.radiusPill)),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.videocam_rounded, size: 12, color: AppTokens.text),
                                    const SizedBox(width: 3),
                                    Text(l.pDemoBadge, style: const TextStyle(color: AppTokens.text, fontSize: 11, fontWeight: FontWeight.w700, height: 1.2)),
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
                        if (course.feeDisplay != null && course.feeDisplay!.isNotEmpty) _Fee(text: course.feeDisplay!),
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

/// "₹4,000 for the full course" → "₹4,000" bold with the rest small and grey.
/// The fee is free text the teacher typed, so when it doesn't start with an amount it is shown whole.
class _Fee extends StatelessWidget {
  const _Fee({required this.text});

  final String text;

  static final _amount = RegExp(r'^\s*((?:₹|Rs\.?|INR)?\s*\d[\d,.]*)\s*(.*)$', caseSensitive: false);

  @override
  Widget build(BuildContext context) {
    const big = TextStyle(color: AppTokens.heading, fontSize: AppTokens.textMd, fontWeight: FontWeight.w800);
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
          if (rest.isNotEmpty) TextSpan(text: '  $rest', style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textXs, fontWeight: FontWeight.w500)),
        ],
      ),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
    );
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
