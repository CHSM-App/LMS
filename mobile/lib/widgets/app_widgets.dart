import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/theme/app_tokens.g.dart';

enum AppButtonVariant { primary, compact, secondary, danger, ghost }

/// Primary = orange + white bold label >= 19px (AA large text). Same rules as the web Button.
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.loading = false,
    this.expand = false,
    this.icon,
    this.dense = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final bool loading;
  final bool expand;
  final IconData? icon;

  /// Shorter button for tight rows (list cards); the label size stays the same.
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !loading;
    final (Color bg, Color fg, BorderSide side, double size) = switch (variant) {
      AppButtonVariant.primary => (AppTokens.actionPrimary, AppTokens.actionPrimaryText, BorderSide.none, AppTokens.sizeButtonLabelMin),
      AppButtonVariant.compact => (AppTokens.surface, AppTokens.text, const BorderSide(color: AppTokens.actionPrimary, width: 2), AppTokens.textBase),
      AppButtonVariant.secondary => (AppTokens.surface, AppTokens.text, const BorderSide(color: AppTokens.inputBorder, width: 1.5), AppTokens.textBase),
      AppButtonVariant.danger => (AppTokens.error, AppTokens.textOnError, BorderSide.none, AppTokens.textBase),
      AppButtonVariant.ghost => (AppTokens.surface.withValues(alpha: 0), AppTokens.text, BorderSide.none, AppTokens.textBase),
    };
    final child = Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (loading) ...[
          SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: enabled ? fg : AppTokens.textDisabled)),
          const SizedBox(width: AppTokens.spaceS2),
        ] else if (icon != null) ...[
          Icon(icon, size: 20, color: enabled ? fg : AppTokens.textDisabled),
          const SizedBox(width: AppTokens.spaceS2),
        ],
        Flexible(
          child: Text(
            label,
            textAlign: TextAlign.center,
            softWrap: true,
            style: TextStyle(fontFamily: AppTokens.fontFamily, fontSize: size, fontWeight: FontWeight.w700, height: 1.2, color: enabled ? fg : AppTokens.textDisabled),
          ),
        ),
      ],
    );
    return Semantics(
      button: true,
      enabled: enabled,
      child: SizedBox(
        width: expand ? double.infinity : null,
        child: TextButton(
          onPressed: enabled ? onPressed : null,
          style: TextButton.styleFrom(
            backgroundColor: enabled ? bg : AppTokens.disabledBg,
            minimumSize: Size(dense ? 0 : AppTokens.sizeTapTarget, dense ? 38 : AppTokens.sizeTapTarget),
            tapTargetSize: dense ? MaterialTapTargetSize.shrinkWrap : null,
            padding: EdgeInsets.symmetric(horizontal: dense ? AppTokens.spaceS2 : AppTokens.spaceS5, vertical: dense ? 4 : AppTokens.spaceS2),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTokens.radiusMd), side: enabled ? side : BorderSide.none),
            overlayColor: AppTokens.actionPrimaryOverlay,
          ),
          child: child,
        ),
      ),
    );
  }
}

class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    required this.label,
    this.controller,
    this.errorText,
    this.hint,
    this.keyboardType,
    this.maxLines = 1,
    this.onChanged,
    this.enabled = true,
    this.requiredField = false,
    this.prefixText,
    this.inputFormatters,
    this.autofocus = false,
    this.onSubmitted,
  });

  final String label;
  final TextEditingController? controller;
  final String? errorText;
  final String? hint;
  final TextInputType? keyboardType;
  final int maxLines;
  final ValueChanged<String>? onChanged;
  final bool enabled;
  final bool requiredField;

  /// Fixed text before what the person types, such as "+91".
  final String? prefixText;
  final List<TextInputFormatter>? inputFormatters;
  final bool autofocus;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTokens.spaceS4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(requiredField ? '$label *' : label, style: const TextStyle(fontWeight: FontWeight.w600, color: AppTokens.text)),
          const SizedBox(height: AppTokens.spaceS1),
          TextField(
            controller: controller,
            keyboardType: keyboardType,
            maxLines: maxLines,
            enabled: enabled,
            onChanged: onChanged,
            onSubmitted: onSubmitted,
            autofocus: autofocus,
            inputFormatters: inputFormatters,
            decoration: InputDecoration(
              errorText: errorText,
              hintText: hint,
              helperMaxLines: 2,
              errorMaxLines: 3,
              prefixText: prefixText == null ? null : '$prefixText  ',
              prefixStyle: const TextStyle(color: AppTokens.text, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

/// Six boxes; pasting or typing 6 digits in the first box fills all of them.
class OtpInput extends StatefulWidget {
  const OtpInput({super.key, required this.onCompleted, this.onChanged, this.length = 6});

  final ValueChanged<String> onCompleted;
  final ValueChanged<String>? onChanged;
  final int length;

  @override
  State<OtpInput> createState() => _OtpInputState();
}

class _OtpInputState extends State<OtpInput> {
  late final List<TextEditingController> _controllers = List.generate(widget.length, (_) => TextEditingController());
  late final List<FocusNode> _nodes = List.generate(widget.length, (_) => FocusNode());

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final n in _nodes) {
      n.dispose();
    }
    super.dispose();
  }

  String get _value => _controllers.map((c) => c.text).join();

  void _onChanged(int i, String v) {
    final digits = v.replaceAll(RegExp(r'\D'), '');
    if (digits.length > 1) {
      for (var k = 0; k < widget.length; k++) {
        _controllers[k].text = k < digits.length ? digits[k] : '';
      }
      _nodes[(digits.length).clamp(0, widget.length - 1)].requestFocus();
    } else {
      _controllers[i].text = digits;
      if (digits.isNotEmpty && i < widget.length - 1) _nodes[i + 1].requestFocus();
      if (digits.isEmpty && i > 0) _nodes[i - 1].requestFocus();
    }
    widget.onChanged?.call(_value);
    if (_value.length == widget.length) widget.onCompleted(_value);
  }

  @override
  Widget build(BuildContext context) {
    // Boxes share the available width (max 48 each) so six of them never overflow a narrow phone.
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(widget.length, (i) {
        return Flexible(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 52),
            child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 3),
          child: SizedBox(
            height: 54,
            child: TextField(
              controller: _controllers[i],
              focusNode: _nodes[i],
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              autofillHints: i == 0 ? const [AutofillHints.oneTimeCode] : null,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: const TextStyle(fontSize: AppTokens.textLg, fontWeight: FontWeight.w700),
              decoration: const InputDecoration(counterText: '', contentPadding: EdgeInsets.zero),
              onChanged: (v) => _onChanged(i, v),
            ),
          ),
            ),
          ),
        );
      }),
    );
  }
}

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status, required this.label});

  final String status;
  final String label;

  static (Color, Color, String) styleFor(String status) {
    const approved = {'approved', 'published', 'completed', 'active', 'answered', 'present', 'recorded'};
    const pending = {'pending', 'scheduled', 'open', 'upcoming', 'live'};
    const rejected = {'rejected', 'blocked'};
    if (approved.contains(status)) return (AppTokens.statusApprovedBg, AppTokens.statusApprovedFg, '✓');
    if (pending.contains(status)) return (AppTokens.statusPendingBg, AppTokens.statusPendingFg, '◷');
    if (rejected.contains(status)) return (AppTokens.statusRejectedBg, AppTokens.statusRejectedFg, '✕');
    return (AppTokens.statusNeutralBg, AppTokens.statusNeutralFg, '•');
  }

  @override
  Widget build(BuildContext context) {
    final (bg, fg, icon) = styleFor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppTokens.radiusPill),
        border: bg == AppTokens.statusNeutralBg ? Border.all(color: AppTokens.border) : null,
      ),
      child: Text('$icon $label', style: TextStyle(color: fg, fontSize: AppTokens.textSm, fontWeight: FontWeight.w700)),
    );
  }
}

/// Lime bar + navy percent text (lime alone fails contrast).
class LabeledProgress extends StatelessWidget {
  const LabeledProgress({super.key, required this.value, this.semanticLabel});

  final double value;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final pct = (value.clamp(0, 1) * 100).round();
    return Semantics(
      label: semanticLabel,
      value: '$pct%',
      child: Row(
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppTokens.radiusPill),
              child: LinearProgressIndicator(value: value.clamp(0, 1).toDouble(), minHeight: 10),
            ),
          ),
          const SizedBox(width: AppTokens.spaceS3),
          Text('$pct%', style: const TextStyle(fontWeight: FontWeight.w700, color: AppTokens.text)),
        ],
      ),
    );
  }
}

/// Square brand cover (navy to blue with the orange ring) for things that have no photo, such as a
/// course on the student dashboard. Same look as the catalogue's generated cover.
class CoverBadge extends StatelessWidget {
  const CoverBadge({super.key, this.size = 56, this.icon = Icons.menu_book_rounded});

  final double size;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppTokens.radiusMd),
        child: Container(
          width: size,
          height: size,
          decoration: const BoxDecoration(
            gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [AppTokens.brandNavy, AppTokens.brandNavy, AppTokens.brandBlue], stops: [0, 0.55, 1]),
          ),
          child: Stack(
            children: [
              Positioned(
                top: -size * 0.28,
                right: -size * 0.28,
                child: Container(
                  width: size * 0.7,
                  height: size * 0.7,
                  decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: AppTokens.brandOrange, width: size * 0.12)),
                ),
              ),
              Center(child: Icon(icon, color: AppTokens.brandWhite, size: size * 0.45)),
            ],
          ),
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.title, this.body, this.actionLabel, this.onAction, this.icon = Icons.inbox_rounded});

  final String title;
  final String? body;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// Shown in a soft circle above the title, so an empty screen reads as a state, not a bug.
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppTokens.spaceS6),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: const BoxDecoration(color: AppTokens.brandIce, shape: BoxShape.circle),
            child: Icon(icon, size: 34, color: AppTokens.textSecondary),
          ),
          const SizedBox(height: AppTokens.spaceS4),
          Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
          if (body != null) ...[
            const SizedBox(height: AppTokens.spaceS2),
            Text(body!, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
          ],
          if (actionLabel != null) ...[
            const SizedBox(height: AppTokens.spaceS4),
            AppButton(label: actionLabel!, onPressed: onAction, variant: AppButtonVariant.compact),
          ],
        ],
      ),
    );
  }
}

class AppBanner extends StatelessWidget {
  const AppBanner({super.key, required this.message, this.kind = 'info'});

  final String message;
  final String kind;

  @override
  Widget build(BuildContext context) {
    final edge = switch (kind) {
      'warning' => AppTokens.actionPrimary,
      'error' => AppTokens.error,
      'success' => AppTokens.success,
      _ => AppTokens.interactive,
    };
    // Flutter can't round a border whose sides differ in colour, so the coloured edge is its own bar
    // inside a uniformly bordered, clipped box.
    return Semantics(
      liveRegion: kind == 'error' || kind == 'warning',
      child: Container(
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: AppTokens.surface,
          borderRadius: BorderRadius.circular(AppTokens.radiusMd),
          border: Border.all(color: AppTokens.border),
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 6, color: edge),
              Expanded(child: Padding(padding: const EdgeInsets.all(AppTokens.spaceS3), child: Text(message))),
            ],
          ),
        ),
      ),
    );
  }
}
