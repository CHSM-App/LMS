import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/app_tokens.g.dart';
import '../presentation/providers/student_providers.dart';

/// The orange logo square, as on the website's sidebar.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 34});

  final double size;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: AppTokens.actionPrimary, borderRadius: BorderRadius.circular(AppTokens.radiusMd)),
        child: Icon(Icons.school_rounded, color: AppTokens.actionPrimaryText, size: size * 0.62),
      ),
    );
  }
}

/// Logo and app name for the Home tab's app bar.
class BrandTitle extends StatelessWidget {
  const BrandTitle({super.key, required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const BrandMark(size: 32),
        const SizedBox(width: AppTokens.spaceS2),
        Flexible(child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis)),
      ],
    );
  }
}

/// Round avatar (first letter of the name) with the person's name beside it, for the Home app bar.
class AvatarTitle extends StatelessWidget {
  const AvatarTitle({super.key, required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final trimmed = name.trim();
    final initial = trimmed.isEmpty ? '' : trimmed.characters.first.toUpperCase();
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        ExcludeSemantics(
          child: CircleAvatar(
            radius: 16,
            backgroundColor: AppTokens.actionPrimary,
            child: initial.isEmpty
                ? Icon(Icons.person_rounded, color: AppTokens.actionPrimaryText, size: 18)
                : Text(initial, style: TextStyle(color: AppTokens.actionPrimaryText, fontWeight: FontWeight.w800, fontSize: AppTokens.textSm)),
          ),
        ),
        const SizedBox(width: AppTokens.spaceS2),
        Flexible(child: Text(trimmed, maxLines: 1, overflow: TextOverflow.ellipsis)),
      ],
    );
  }
}

/// Bell with a small orange dot (and count) when there are unread notifications.
class NotificationBell extends ConsumerWidget {
  const NotificationBell({super.key, required this.tooltip, required this.onPressed});

  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(notificationsProvider).valueOrNull?.where((n) => !n.isRead).length ?? 0;
    return IconButton(
      tooltip: tooltip,
      onPressed: onPressed,
      icon: Badge(
        isLabelVisible: unread > 0,
        backgroundColor: AppTokens.actionPrimary,
        textColor: AppTokens.actionPrimaryText,
        label: Text(unread > 9 ? '9+' : '$unread'),
        child: const Icon(Icons.notifications_none_rounded),
      ),
    );
  }
}

/// Wraps a [NavigationBar] so its top corners are rounded, like a sheet sitting under the page.
class RoundedNavBar extends StatelessWidget {
  const RoundedNavBar({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(borderRadius: const BorderRadius.vertical(top: Radius.circular(AppTokens.radiusLg + 4)), child: child);
  }
}
