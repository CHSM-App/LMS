import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_tokens.g.dart';
import '../../data/models/student_models.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/core_providers.dart';
import '../../presentation/providers/student_providers.dart';
import '../../widgets/app_widgets.dart';
import '../../widgets/course_card.dart';

class CatalogScreen extends ConsumerStatefulWidget {
  const CatalogScreen({super.key});

  @override
  ConsumerState<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends ConsumerState<CatalogScreen> {
  final _search = TextEditingController();
  String _q = '';
  String? _subject; // null = every subject
  String? _lang; // null = every language

  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _apply(String v) => setState(() => _q = v.trim());

  /// Results follow the typing after a short pause; Enter searches straight away.
  void _onTyping(String v) {
    setState(() {}); // shows or hides the clear button
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () => _apply(v));
  }

  void _clear() {
    _debounce?.cancel();
    _search.clear();
    setState(() {
      _q = '';
      _subject = null;
      _lang = null;
    });
  }

  static OutlineInputBorder _pill(Color color, double width) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppTokens.radiusPill),
        borderSide: width == 0 ? BorderSide.none : BorderSide(color: color, width: width),
      );

  static List<String> _distinct(Iterable<String?> values) {
    final seen = <String>{};
    return [
      for (final v in values)
        if (v != null && v.isNotEmpty && seen.add(v)) v,
    ];
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final loggedIn = ref.watch(sessionProvider).isLoggedIn;
    final courses = ref.watch(catalogProvider(_q));
    final all = courses.valueOrNull ?? const <CourseCard>[];
    final subjects = _distinct(all.map((c) => c.subject));
    final languages = _distinct(all.map((c) => c.language)).where((c) => const ['en', 'mr', 'hi'].contains(c)).toList();
    // A filter that no longer matches anything in the current results is ignored, not left stuck on.
    final subject = subjects.contains(_subject) ? _subject : null;
    final lang = languages.contains(_lang) ? _lang : null;
    String langName(String code) => switch (code) { 'en' => l.pLangEn, 'mr' => l.pLangMr, _ => l.pLangHi };
    final filtered = [
      for (final c in all)
        if ((subject == null || c.subject == subject) && (lang == null || c.language == lang)) c,
    ];
    return Scaffold(
      backgroundColor: AppTokens.surface,
      appBar: AppBar(
        title: Text(l.pCourses),
        actions: [if (!loggedIn) TextButton(onPressed: () => context.go('/login'), child: Text(l.loginTitle))],
      ),
      body: Column(
        children: [
          // Search: a soft grey pill with no outline, and a filter button for language beside it.
          Padding(
            padding: const EdgeInsets.fromLTRB(AppTokens.spaceS4, AppTokens.spaceS2, AppTokens.spaceS4, AppTokens.spaceS2),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 600),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _search,
                        textInputAction: TextInputAction.search,
                        decoration: InputDecoration(
                          hintText: l.pSearch,
                          filled: true,
                          fillColor: AppTokens.hoverBg,
                          contentPadding: const EdgeInsets.symmetric(vertical: AppTokens.spaceS3),
                          prefixIcon: const Icon(Icons.search),
                          suffixIcon: _search.text.isEmpty && _q.isEmpty
                              ? null
                              : IconButton(tooltip: l.pClearSearch, icon: const Icon(Icons.close), onPressed: _clear),
                          border: _pill(AppTokens.hoverBg, 0),
                          enabledBorder: _pill(AppTokens.hoverBg, 0),
                          focusedBorder: _pill(AppTokens.focus, 2),
                        ),
                        onChanged: _onTyping,
                        onSubmitted: (v) {
                          _debounce?.cancel();
                          _apply(v);
                        },
                      ),
                    ),
                    if (languages.length > 1) ...[
                      const SizedBox(width: AppTokens.spaceS2),
                      Badge(
                        isLabelVisible: lang != null,
                        backgroundColor: AppTokens.actionPrimary,
                        smallSize: 10,
                        child: IconButton.filledTonal(
                          tooltip: l.sLanguage,
                          style: IconButton.styleFrom(backgroundColor: AppTokens.hoverBg, foregroundColor: AppTokens.text, minimumSize: const Size(48, 48)),
                          icon: const Icon(Icons.tune_rounded),
                          onPressed: () async {
                            final picked = await showModalBottomSheet<String>(
                              context: context,
                              showDragHandle: true,
                              backgroundColor: AppTokens.surface,
                              builder: (_) => _LanguageSheet(
                                title: l.sLanguage,
                                allLabel: l.pAllLanguages,
                                options: [for (final c in languages) (c, langName(c))],
                                selected: lang,
                              ),
                            );
                            // '' = "All languages"; null = the sheet was dismissed, so nothing changes.
                            if (picked != null) setState(() => _lang = picked.isEmpty ? null : picked);
                          },
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
          if (subjects.length > 1)
            _ChipRow(
              allLabel: l.pAll,
              options: [for (final s in subjects) (s, s)],
              selected: subject,
              onSelected: (v) => setState(() => _subject = v),
            ),
          // The language chosen in the filter sheet stays visible here, and one tap removes it.
          if (lang != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(AppTokens.spaceS4, 0, AppTokens.spaceS4, AppTokens.spaceS2),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Semantics(
                  button: true,
                  label: '${langName(lang)}, ${l.pClearSearch}',
                  child: InkWell(
                    onTap: () => setState(() => _lang = null),
                    borderRadius: BorderRadius.circular(AppTokens.radiusPill),
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(AppTokens.spaceS3, 6, AppTokens.spaceS2, 6),
                      decoration: BoxDecoration(color: AppTokens.selectedBg, borderRadius: BorderRadius.circular(AppTokens.radiusPill)),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(langName(lang), style: const TextStyle(color: AppTokens.text, fontSize: AppTokens.textSm, fontWeight: FontWeight.w700)),
                          const SizedBox(width: 4),
                          const Icon(Icons.close, size: 16, color: AppTokens.text),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          const SizedBox(height: AppTokens.spaceS1),
          const Divider(height: 1),
          Expanded(
            child: courses.when(
              loading: () => const _Skeletons(),
              error: (e, _) => EmptyState(title: e.toString(), actionLabel: l.tryAgain, onAction: () => ref.invalidate(catalogProvider(_q))),
              data: (_) => RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(catalogProvider(_q));
                  await ref.read(catalogProvider(_q).future);
                },
                child: filtered.isEmpty
                    ? _NoResults(onClear: (_q.isEmpty && subject == null && lang == null) ? null : _clear)
                    : _CourseList(courses: filtered),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bottom sheet that picks one language. Pops '' for "All languages".
class _LanguageSheet extends StatelessWidget {
  const _LanguageSheet({required this.title, required this.allLabel, required this.options, required this.selected});

  final String title;
  final String allLabel;
  final List<(String, String)> options; // (code, label)
  final String? selected;

  @override
  Widget build(BuildContext context) {
    Widget row(String value, String label) {
      final on = (selected ?? '') == value;
      return ListTile(
        title: Text(label, style: TextStyle(fontWeight: on ? FontWeight.w800 : FontWeight.w500)),
        trailing: on ? const Icon(Icons.check_circle_rounded, color: AppTokens.actionPrimary) : null,
        onTap: () => Navigator.of(context).pop(value),
      );
    }

    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(AppTokens.spaceS4, 0, AppTokens.spaceS4, AppTokens.spaceS2),
            child: Text(title, style: Theme.of(context).textTheme.titleMedium),
          ),
          row('', allLabel),
          for (final (code, label) in options) row(code, label),
          const SizedBox(height: AppTokens.spaceS2),
        ],
      ),
    );
  }
}

/// One horizontal row of filter chips: "All" first, then the options. Tapping the chosen one again clears it.
class _ChipRow extends StatelessWidget {
  const _ChipRow({required this.allLabel, required this.options, required this.selected, required this.onSelected});

  final String allLabel;
  final List<(String, String)> options; // (value, label)
  final String? selected;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    Widget chip(String label, bool on, VoidCallback onTap) => Padding(
          padding: const EdgeInsets.only(right: AppTokens.spaceS2),
          child: Semantics(
            button: true,
            selected: on,
            label: label,
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(AppTokens.radiusPill),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: AppTokens.sizeTapTarget),
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: AppTokens.spaceS3, vertical: 6),
                    decoration: BoxDecoration(
                      color: on ? AppTokens.brandNavy : AppTokens.surface,
                      borderRadius: BorderRadius.circular(AppTokens.radiusPill),
                      border: Border.all(color: on ? AppTokens.brandNavy : AppTokens.border),
                    ),
                    child: Text(label, style: TextStyle(color: on ? AppTokens.brandWhite : AppTokens.text, fontSize: AppTokens.textSm, fontWeight: on ? FontWeight.w800 : FontWeight.w600)),
                  ),
                ),
              ),
            ),
          ),
        );
    return SizedBox(
      height: AppTokens.sizeTapTarget,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppTokens.spaceS4),
        children: [
          chip(allLabel, selected == null, () => onSelected(null)),
          for (final (value, label) in options) chip(label, selected == value, () => onSelected(selected == value ? null : value)),
        ],
      ),
    );
  }
}

class _CourseList extends StatelessWidget {
  const _CourseList({required this.courses});

  final List<CourseCard> courses;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(top: AppTokens.spaceS3, bottom: AppTokens.spaceS6),
      itemCount: courses.length + 1,
      itemBuilder: (_, i) => Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 600),
          child: i == 0
              ? Padding(
                  padding: const EdgeInsets.fromLTRB(AppTokens.spaceS4, 0, AppTokens.spaceS4, AppTokens.spaceS1),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(l.pResultCount(courses.length), style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textSm, fontWeight: FontWeight.w600)),
                  ),
                )
              : Consumer(
                  builder: (context, ref, _) {
                    final c = courses[i - 1];
                    return CourseTile(course: c, status: ref.watch(myEnrollmentsProvider)[c.slug]?.status, onTap: () => context.push('/courses/${c.slug}'));
                  },
                ),
        ),
      ),
    );
  }
}

class _NoResults extends StatelessWidget {
  const _NoResults({required this.onClear});

  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    // Scrollable so pull-to-refresh still works on an empty list.
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppTokens.spaceS6),
      children: [
        const SizedBox(height: AppTokens.spaceS6),
        const Icon(Icons.search_off_rounded, size: 56, color: AppTokens.textDisabled),
        const SizedBox(height: AppTokens.spaceS3),
        Text(l.pNoResults, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppTokens.spaceS2),
        Text(l.pNoResultsHint, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
        if (onClear != null) ...[
          const SizedBox(height: AppTokens.spaceS4),
          Center(child: AppButton(label: l.pClearSearch, onPressed: onClear, variant: AppButtonVariant.compact)),
        ],
      ],
    );
  }
}

/// Grey card shapes while the list loads, so the screen doesn't jump when the courses arrive.
class _Skeletons extends StatefulWidget {
  const _Skeletons();

  @override
  State<_Skeletons> createState() => _SkeletonsState();
}

class _SkeletonsState extends State<_Skeletons> with SingleTickerProviderStateMixin {
  // A slow fade in and out; it stops by itself when the real list replaces this widget.
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat(reverse: true);

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween<double>(begin: 0.45, end: 1).animate(CurvedAnimation(parent: _pulse, curve: Curves.easeInOut)),
      child: _rows(),
    );
  }

  Widget _rows() {
    Widget bar(double w, double h) => Container(
          width: w,
          height: h,
          decoration: BoxDecoration(color: AppTokens.progressTrack, borderRadius: BorderRadius.circular(AppTokens.radiusSm)),
        );
    return ListView.builder(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppTokens.spaceS4),
      itemCount: 6,
      itemBuilder: (_, _) => Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 600),
          child: Container(
            margin: const EdgeInsets.only(bottom: AppTokens.spaceS4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                  child: Container(width: 128, height: 72, color: AppTokens.progressTrack),
                ),
                Padding(
                  padding: const EdgeInsets.only(left: AppTokens.spaceS3),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [bar(150, 16), const SizedBox(height: AppTokens.spaceS2), bar(100, 12), const SizedBox(height: AppTokens.spaceS2), bar(70, 12)],
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
