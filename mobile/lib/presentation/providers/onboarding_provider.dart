import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _seenKey = 'onboarding_seen';

/// Whether the first-launch slides have been shown. Defaults to true (so tests and a failed read skip them);
/// main() overrides it with the stored value, which is false only on a fresh install.
final onboardingSeenProvider = StateProvider<bool>((ref) => true);

Future<bool> readOnboardingSeen() async {
  try {
    return (await SharedPreferences.getInstance()).getBool(_seenKey) ?? false;
  } catch (_) {
    return true;
  }
}

Future<void> saveOnboardingSeen() async {
  try {
    await (await SharedPreferences.getInstance()).setBool(_seenKey, true);
  } catch (_) {
    // Shown again next launch at worst.
  }
}
