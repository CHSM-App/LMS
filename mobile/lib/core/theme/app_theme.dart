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
          // One clear scale: heavy, slightly tight headings over regular body text, so the hierarchy reads at a glance.
          headlineLarge: const TextStyle(fontSize: AppTokens.textXxl, fontWeight: FontWeight.w800, height: AppTokens.lineHeightHeading, letterSpacing: -0.4, color: AppTokens.heading),
          headlineMedium: const TextStyle(fontSize: AppTokens.textLg, fontWeight: FontWeight.w800, height: AppTokens.lineHeightHeading, letterSpacing: -0.3, color: AppTokens.heading),
          headlineSmall: const TextStyle(fontSize: AppTokens.textMd, fontWeight: FontWeight.w800, height: AppTokens.lineHeightHeading, letterSpacing: -0.2, color: AppTokens.heading),
          titleLarge: const TextStyle(fontSize: AppTokens.textMd, fontWeight: FontWeight.w800, height: AppTokens.lineHeightHeading, letterSpacing: -0.2, color: AppTokens.heading),
          titleMedium: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, height: AppTokens.lineHeightHeading, color: AppTokens.heading),
          titleSmall: const TextStyle(fontSize: AppTokens.textBase, fontWeight: FontWeight.w700, height: AppTokens.lineHeightHeading, color: AppTokens.heading),
          bodyLarge: const TextStyle(fontSize: AppTokens.textBase, height: AppTokens.lineHeightBody, color: AppTokens.text),
          bodyMedium: const TextStyle(fontSize: 15, height: AppTokens.lineHeightBody, color: AppTokens.text),
          bodySmall: const TextStyle(fontSize: 13.5, height: AppTokens.lineHeightBody, color: AppTokens.textSecondary),
          labelLarge: const TextStyle(fontSize: AppTokens.textBase, fontWeight: FontWeight.w600),
        );

    final fieldBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppTokens.radiusMd + 2),
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
        // A hairline under every app bar separates it from the page without a shadow.
        shape: Border(bottom: BorderSide(color: AppTokens.divider)),
        titleTextStyle: TextStyle(fontFamily: AppTokens.fontFamily, fontSize: 18, fontWeight: FontWeight.w800, color: AppTokens.heading),
      ),
      // Flat cards with a hairline edge: what course apps use, instead of heavy shadows.
      cardTheme: CardThemeData(
        color: AppTokens.surface,
        elevation: 0,
        shadowColor: AppTokens.shadow,
        surfaceTintColor: AppTokens.surface,
        margin: EdgeInsets.only(bottom: AppTokens.spaceS3),
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusLg),
          side: const BorderSide(color: AppTokens.border),
        ),
      ),
      listTileTheme: const ListTileThemeData(
        contentPadding: EdgeInsets.symmetric(horizontal: AppTokens.spaceS4, vertical: AppTokens.spaceS1),
        iconColor: AppTokens.textSecondary,
        titleTextStyle: TextStyle(fontFamily: AppTokens.fontFamily, fontSize: AppTokens.textBase, fontWeight: FontWeight.w700, color: AppTokens.heading),
        subtitleTextStyle: TextStyle(fontFamily: AppTokens.fontFamily, fontSize: AppTokens.textSm, color: AppTokens.textSecondary, height: 1.4),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppTokens.surface,
        selectedColor: AppTokens.brandNavy,
        side: const BorderSide(color: AppTokens.border),
        shape: const StadiumBorder(),
        labelStyle: const TextStyle(fontFamily: AppTokens.fontFamily, fontSize: AppTokens.textSm, fontWeight: FontWeight.w600, color: AppTokens.text),
        secondaryLabelStyle: const TextStyle(fontFamily: AppTokens.fontFamily, fontSize: AppTokens.textSm, fontWeight: FontWeight.w700, color: AppTokens.brandWhite),
        checkmarkColor: AppTokens.brandWhite,
      ),
      tabBarTheme: const TabBarThemeData(
        labelColor: AppTokens.heading,
        unselectedLabelColor: AppTokens.textSecondary,
        labelStyle: TextStyle(fontFamily: AppTokens.fontFamily, fontSize: AppTokens.textBase, fontWeight: FontWeight.w800),
        unselectedLabelStyle: TextStyle(fontFamily: AppTokens.fontFamily, fontSize: AppTokens.textBase, fontWeight: FontWeight.w600),
        indicatorColor: AppTokens.actionPrimary,
        indicatorSize: TabBarIndicatorSize.label,
        dividerColor: AppTokens.divider,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppTokens.surface,
        surfaceTintColor: AppTokens.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTokens.radiusLg + 4)),
        titleTextStyle: const TextStyle(fontFamily: AppTokens.fontFamily, fontSize: AppTokens.textLg, fontWeight: FontWeight.w800, color: AppTokens.heading),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppTokens.surface,
        surfaceTintColor: AppTokens.surface,
        showDragHandle: true,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppTokens.radiusLg + 8))),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppTokens.text,
          textStyle: const TextStyle(fontFamily: AppTokens.fontFamily, fontWeight: FontWeight.w700),
          minimumSize: const Size(AppTokens.sizeTapTarget, AppTokens.sizeTapTarget),
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
        linearMinHeight: 8,
        borderRadius: BorderRadius.all(Radius.circular(AppTokens.radiusPill)),
      ),
      dividerTheme: const DividerThemeData(color: AppTokens.divider, thickness: 1),
      // Same as the website's navigation: navy bar, white label, soft blue highlight and an orange icon for the open tab.
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppTokens.navBg,
        surfaceTintColor: AppTokens.navBg,
        elevation: 0,
        height: 68,
        indicatorColor: AppTokens.navActiveBg,
        iconTheme: WidgetStateProperty.resolveWith(
          (s) => IconThemeData(size: 26, color: s.contains(WidgetState.selected) ? AppTokens.brandOrange : AppTokens.navTextMuted),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (s) => TextStyle(
            fontFamily: AppTokens.fontFamily,
            fontSize: AppTokens.textXs,
            fontWeight: s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
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
