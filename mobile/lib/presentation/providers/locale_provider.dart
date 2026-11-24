import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _localeKey = 'app_locale';

/// The language the person picked (en / mr / hi). null = follow the phone's language.
class LocaleNotifier extends StateNotifier<Locale?> {
  LocaleNotifier() : super(null) {
    _load();
  }

  Future<void> _load() async {
    try {
      final code = (await SharedPreferences.getInstance()).getString(_localeKey);
      if (code != null && const ['en', 'mr', 'hi'].contains(code)) state = Locale(code);
    } catch (_) {
      // No stored choice: keep following the phone.
    }
  }

  Future<void> set(Locale locale) async {
    state = locale;
    try {
      await (await SharedPreferences.getInstance()).setString(_localeKey, locale.languageCode);
    } catch (_) {
      // The choice still applies for this session.
    }
  }
}

final localeProvider = StateNotifierProvider<LocaleNotifier, Locale?>((ref) => LocaleNotifier());
