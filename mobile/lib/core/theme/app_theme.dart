import 'package:flutter/material.dart';

import 'app_tokens.g.dart';

/// The one light theme shared by Student and Teacher screens.
/// Every colour comes from [AppTokens] (generated from design-tokens/tokens.json).
abstract final class AppTheme {
  static ThemeData light() {
    const scheme = ColorScheme(
      brightness: Brightness.light,
      primary: AppTokens.brandOrange,
      onPrimary: AppTokens.actionPrimaryText,
      secondary: AppTokens.brandBlue,
      onSecondary: AppTokens.brandNavy,
      tertiary: AppTokens.brandLime,
      onTertiary: AppTokens.brandNavy,
      error: AppTokens.functionalError,
      onError: AppTokens.textOnError,
      surface: AppTokens.surface,
      onSurface: AppTokens.text,
      surfaceContainerHighest: AppTokens.bgSection,
      outline: AppTokens.inputBorder,
      outlineVariant: AppTokens.border,
      shadow: AppTokens.shadow,
      scrim: AppTokens.backdrop,
    );

    final base = ThemeData(useMaterial3: true, colorScheme: scheme, fontFamily: AppTokens.fontFamily);
    final text = base.textTheme.apply(bodyColor: AppTokens.text, displayColor: AppTokens.heading).copyWith(
          headlineLarge: const TextStyle(fontSize: AppTokens.textXxl, fontWeight: FontWeight.w800, height: AppTokens.lineHeightHeading, color: AppTokens.heading),
          headlineMedium: const TextStyle(fontSize: AppTokens.textXl, fontWeight: FontWeight.w700, height: AppTokens.lineHeightHeading, color: AppTokens.heading),
          titleLarge: const TextStyle(fontSize: AppTokens.textLg, fontWeight: FontWeight.w700, height: AppTokens.lineHeightHeading, color: AppTokens.heading),
          titleMedium: const TextStyle(fontSize: AppTokens.textMd, fontWeight: FontWeight.w700, height: AppTokens.lineHeightHeading, color: AppTokens.heading),
          bodyLarge: const TextStyle(fontSize: AppTokens.textBase, height: AppTokens.lineHeightBody, color: AppTokens.text),
          bodyMedium: const TextStyle(fontSize: AppTokens.textBase, height: AppTokens.lineHeightBody, color: AppTokens.text),
          bodySmall: const TextStyle(fontSize: AppTokens.textSm, height: AppTokens.lineHeightBody, color: AppTokens.textSecondary),
          labelLarge: const TextStyle(fontSize: AppTokens.textBase, fontWeight: FontWeight.w600),
        );

    final fieldBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
      borderSide: const BorderSide(color: AppTokens.inputBorder, width: 1.5),
    );

    return base.copyWith(
      scaffoldBackgroundColor: AppTokens.bgPage,
      textTheme: text,
      appBarTheme: const AppBarTheme(
        backgroundColor: AppTokens.surface,
        foregroundColor: AppTokens.text,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(fontFamily: AppTokens.fontFamily, fontSize: AppTokens.textMd, fontWeight: FontWeight.w700, color: AppTokens.heading),
      ),
      cardTheme: CardThemeData(
        color: AppTokens.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusLg),
          side: const BorderSide(color: AppTokens.border),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppTokens.surface,
        border: fieldBorder,
        enabledBorder: fieldBorder,
        focusedBorder: fieldBorder.copyWith(borderSide: const BorderSide(color: AppTokens.focus, width: 2)),
        errorBorder: fieldBorder.copyWith(borderSide: const BorderSide(color: AppTokens.error, width: 2)),
        focusedErrorBorder: fieldBorder.copyWith(borderSide: const BorderSide(color: AppTokens.error, width: 2)),
        errorStyle: const TextStyle(color: AppTokens.errorText, fontWeight: FontWeight.w600),
        labelStyle: const TextStyle(color: AppTokens.textSecondary),
        contentPadding: const EdgeInsets.symmetric(horizontal: AppTokens.spaceS3, vertical: AppTokens.spaceS3),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppTokens.progressFill,
        linearTrackColor: AppTokens.progressTrack,
      ),
      dividerTheme: const DividerThemeData(color: AppTokens.divider, thickness: 1),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppTokens.navBg,
        indicatorColor: AppTokens.navActiveBg,
        iconTheme: WidgetStateProperty.resolveWith(
          (s) => IconThemeData(color: s.contains(WidgetState.selected) ? AppTokens.navActive : AppTokens.navTextMuted),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (s) => TextStyle(
            fontFamily: AppTokens.fontFamily,
            fontSize: AppTokens.textSm,
            fontWeight: FontWeight.w600,
            color: s.contains(WidgetState.selected) ? AppTokens.navText : AppTokens.navTextMuted,
          ),
        ),
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: AppTokens.navBg,
        contentTextStyle: TextStyle(fontFamily: AppTokens.fontFamily, color: AppTokens.navText, fontWeight: FontWeight.w600),
        behavior: SnackBarBehavior.floating,
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? AppTokens.interactive : null),
      ),
    );
  }
}
