import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/session/session.dart';
import '../../data/repositories/auth_repository.dart';

enum LoginStep { mobile, otp, done }

@immutable
class LoginState {
  const LoginState({this.step = LoginStep.mobile, this.mobile = '', this.loading = false, this.error, this.errorCode, this.resendIn = 0, this.user});

  final LoginStep step;
  final String mobile;
  final bool loading;

  /// Either a server message or the l10n key 'invalidMobile'.
  final String? error;
  final String? errorCode;
  final int resendIn;
  final SessionUser? user;

  LoginState copyWith({LoginStep? step, String? mobile, bool? loading, String? error, String? errorCode, bool clearError = false, int? resendIn, SessionUser? user}) {
    return LoginState(
      step: step ?? this.step,
      mobile: mobile ?? this.mobile,
      loading: loading ?? this.loading,
      error: clearError ? null : (error ?? this.error),
      errorCode: clearError ? null : (errorCode ?? this.errorCode),
      resendIn: resendIn ?? this.resendIn,
      user: user ?? this.user,
    );
  }
}

bool isValidIndianMobile(String input) {
  var d = input.replaceAll(RegExp(r'\D'), '');
  if (d.length == 12 && d.startsWith('91')) d = d.substring(2);
  if (d.length == 11 && d.startsWith('0')) d = d.substring(1);
  return RegExp(r'^[6-9]\d{9}$').hasMatch(d);
}

class LoginViewModel extends StateNotifier<LoginState> {
  LoginViewModel(this._repo, {this.purpose = 'login'}) : super(const LoginState());

  final AuthRepository _repo;
  final String purpose;
  Timer? _timer;

  Future<void> sendOtp(String mobile) async {
    if (!isValidIndianMobile(mobile)) {
      state = state.copyWith(error: 'invalidMobile', errorCode: 'VALIDATION');
      return;
    }
    state = state.copyWith(loading: true, clearError: true, mobile: mobile);
    try {
      final wait = await _repo.sendOtp(mobile, purpose);
      state = state.copyWith(loading: false, step: LoginStep.otp, resendIn: wait);
      _startCountdown();
    } on ApiException catch (e) {
      state = state.copyWith(loading: false, error: e.message, errorCode: e.code);
    }
  }

  Future<void> resend() => sendOtp(state.mobile);

  void changeNumber() {
    _timer?.cancel();
    state = const LoginState();
  }

  Future<void> verify(String otp) async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final user = await _repo.login(state.mobile, otp);
      _timer?.cancel();
      state = state.copyWith(loading: false, step: LoginStep.done, user: user);
    } on ApiException catch (e) {
      state = state.copyWith(loading: false, error: e.message, errorCode: e.code);
    }
  }

  void _startCountdown() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      if (state.resendIn <= 1) {
        t.cancel();
        state = state.copyWith(resendIn: 0);
      } else {
        state = state.copyWith(resendIn: state.resendIn - 1);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
