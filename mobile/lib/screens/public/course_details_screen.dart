import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_tokens.g.dart';
import '../../data/models/student_models.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/core_providers.dart';
import '../../presentation/providers/student_providers.dart';
import '../../widgets/app_widgets.dart';
import '../student/widgets/common.dart';
import '../student/widgets/video_view.dart';

class CourseDetailsScreen extends ConsumerWidget {
  const CourseDetailsScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final user = ref.watch(sessionProvider).user;
    return Scaffold(
      appBar: AppBar(title: Text(l.pCourses)),
      body: AsyncView<CourseDetail>(
        value: ref.watch(courseDetailProvider(slug)),
        onRetry: () => ref.invalidate(courseDetailProvider(slug)),
        builder: (c) => ListView(
          padding: const EdgeInsets.all(AppTokens.spaceS4),
          children: [
            Text(c.title, style: Theme.of(context).textTheme.headlineSmall),
            Text(l.pBy(c.teacherName), style: const TextStyle(color: AppTokens.textSecondary, fontWeight: FontWeight.w600)),
            if ([c.durationText, c.feeDisplay].any((x) => x != null)) Text([?c.durationText, ?c.feeDisplay].join(' · ')),
            if (c.description != null) Padding(padding: const EdgeInsets.only(top: AppTokens.spaceS3), child: Text(c.description!)),
            const SizedBox(height: AppTokens.spaceS4),
            AppButton(label: l.pEnroll, expand: true, onPressed: () => _enroll(context, user?.role)),
            const SizedBox(height: AppTokens.spaceS2),
            AppButton(label: l.pRequestDemo, variant: AppButtonVariant.secondary, expand: true, onPressed: () => context.push('/courses/$slug/demo')),
            if (c.demoVideos.isNotEmpty) ...[
              SectionTitle(l.pDemoVideos),
              for (final v in c.demoVideos)
                v.isUpload
                    ? Padding(padding: const EdgeInsets.only(bottom: AppTokens.spaceS3), child: _DemoUpload(url: v.url))
                    : Card(child: ListTile(leading: const Icon(Icons.play_circle_outline), title: Text(l.pOpenVideo), onTap: () => openExternal(v.url))),
            ],
            if (c.batches.isNotEmpty) ...[
              SectionTitle(l.pBatches),
              for (final b in c.batches) ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.groups_outlined), title: Text(b)),
            ],
            if (c.curriculum.isNotEmpty) ...[
              SectionTitle(l.pCurriculum),
              for (final s in c.curriculum)
                ExpansionTile(tilePadding: EdgeInsets.zero, title: Text(s.name, style: const TextStyle(fontWeight: FontWeight.w700)), children: [
                  for (final m in s.modules) ListTile(dense: true, title: Text(m)),
                ]),
            ],
          ],
        ),
      ),
    );
  }

  void _enroll(BuildContext context, String? role) {
    if (role == null) {
      context.push('/register?slug=${Uri.encodeQueryComponent(slug)}');
    } else if (role == 'student') {
      context.push('/enroll/$slug');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppLocalizations.of(context).pLoginToEnroll)));
    }
  }
}

/// Demo upload videos play only after a tap, so the details page doesn't start streaming by itself.
class _DemoUpload extends StatefulWidget {
  const _DemoUpload({required this.url});
  final String url;
  @override
  State<_DemoUpload> createState() => _DemoUploadState();
}

class _DemoUploadState extends State<_DemoUpload> {
  bool _play = false;
  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return _play
        ? VideoView(url: Uri.parse(widget.url))
        : Card(child: ListTile(leading: const Icon(Icons.play_circle_outline), title: Text(l.pOpenVideo), onTap: () => setState(() => _play = true)));
  }
}
