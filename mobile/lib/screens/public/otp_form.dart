import 'package:flutter/material.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/app_tokens.g.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/viewModels/login_viewmodel.dart';
import '../../widgets/app_widgets.dart';

/// Details → consent → OTP → submit. Used by the live demo request and student registration.
/// [extraFields] are optional text fields ('classStandard', 'city', 'email', 'preferredTime', 'message').
class OtpForm extends StatefulWidget {
  const OtpForm({super.key, required this.extraFields, this.requiredFields = const [], required this.sendOtp, required this.submit, required this.submitLabel});

  final List<String> extraFields;

  /// Extra fields that must be filled (for example 'email' on the live demo form).
  final List<String> requiredFields;
  final Future<void> Function(String mobile) sendOtp;

  /// Receives the filled fields (mobile normalised, consents, otp). Throws [ApiException] on failure.
  final Future<void> Function(Map<String, dynamic> fields) submit;
  final String submitLabel;

  @override
  State<OtpForm> createState() => _OtpFormState();
}

class _OtpFormState extends State<OtpForm> {
  final _c = <String, TextEditingController>{
    for (final k in ['name', 'mobile', 'education', 'classStandard', 'city', 'email', 'preferredTime', 'message']) k: TextEditingController(),
  };
  final _errors = <String, String>{};
  bool _terms = false;
  bool _whatsapp = true;
  String? _sentTo;
  String _otp = '';
  String? _banner;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  String _label(AppLocalizations l, String k) => switch (k) {
        'classStandard' => l.sOptional(l.sClass),
        'city' => l.sOptional(l.sCity),
        'email' => l.sOptional(l.sEmail),
        'preferredTime' => l.sOptional(l.pPreferredTime),
        _ => l.sOptional(l.pMessage),
      };

  String _requiredLabel(AppLocalizations l, String k) => switch (k) {
        'email' => l.sEmail,
        'classStandard' => l.sClass,
        'city' => l.sCity,
        'preferredTime' => l.pPreferredTime,
        _ => l.pMessage,
      };

  Future<void> _continue(AppLocalizations l) async {
    final e = <String, String>{};
    if (_c['name']!.text.trim().isEmpty) e['name'] = l.requiredField;
    if (!isValidIndianMobile(_c['mobile']!.text)) e['mobile'] = l.invalidMobile;
    if (_c['education']!.text.trim().isEmpty) e['education'] = l.requiredField;
    for (final k in widget.requiredFields) {
      if (_c[k]!.text.trim().isEmpty) e[k] = l.requiredField;
    }
    final email = _c['email']!.text.trim();
    if (email.isNotEmpty && !e.containsKey('email') && !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) e['email'] = l.requiredField;
    setState(() {
      _errors
        ..clear()
        ..addAll(e);
      _banner = _terms ? null : l.pNeedTerms;
    });
    if (e.isNotEmpty || !_terms) return;
    final mobile = normalizeIndianMobile(_c['mobile']!.text);
    setState(() => _busy = true);
    try {
      await widget.sendOtp(mobile);
      if (mounted) setState(() => _sentTo = mobile);
    } on ApiException catch (err) {
      if (mounted) setState(() => _banner = err.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _banner = null;
    });
    String? opt(String k) => _c[k]!.text.trim().isEmpty ? null : _c[k]!.text.trim();
    try {
      await widget.submit({
        'name': _c['name']!.text.trim(),
        'mobile': _sentTo,
        'education': _c['education']!.text.trim(),
        for (final k in widget.extraFields) k: opt(k),
        'otp': _otp,
        'acceptTerms': true,
        'whatsappOptIn': _whatsapp,
      });
    } on ApiException catch (err) {
      if (mounted) setState(() => _banner = err.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    if (_sentTo != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l.otpSentTo(_sentTo!)),
          TextButton(onPressed: () => setState(() => _sentTo = null), child: Text(l.changeNumber)),
          Center(child: OtpInput(onCompleted: (v) => setState(() => _otp = v), onChanged: (v) => setState(() => _otp = v))),
          const SizedBox(height: AppTokens.spaceS4),
          if (_banner != null) Padding(padding: const EdgeInsets.only(bottom: AppTokens.spaceS3), child: AppBanner(kind: 'error', message: _banner!)),
          AppButton(label: widget.submitLabel, expand: true, loading: _busy, onPressed: _otp.length == 6 ? _submit : null),
          TextButton(onPressed: _busy ? null : () => widget.sendOtp(_sentTo!), child: Text(l.resendOtp)),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(label: l.sName, controller: _c['name'], errorText: _errors['name'], requiredField: true),
        AppTextField(label: l.mobileNumber, controller: _c['mobile'], hint: l.mobileHint, keyboardType: TextInputType.phone, errorText: _errors['mobile'], requiredField: true),
        AppTextField(label: l.sEducation, controller: _c['education'], errorText: _errors['education'], requiredField: true),
        for (final k in widget.extraFields)
          AppTextField(
            label: widget.requiredFields.contains(k) ? _requiredLabel(l, k) : _label(l, k),
            requiredField: widget.requiredFields.contains(k),
            controller: _c[k],
            errorText: _errors[k],
            maxLines: k == 'message' ? 3 : 1,
            keyboardType: k == 'email' ? TextInputType.emailAddress : null,
          ),
        CheckboxListTile(contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, value: _terms, title: Text(l.pAcceptTerms), onChanged: (v) => setState(() => _terms = v ?? false)),
        CheckboxListTile(contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, value: _whatsapp, title: Text(l.pWhatsAppOk), onChanged: (v) => setState(() => _whatsapp = v ?? false)),
        if (_banner != null) Padding(padding: const EdgeInsets.symmetric(vertical: AppTokens.spaceS3), child: AppBanner(kind: 'error', message: _banner!)),
        AppButton(label: l.pContinue, expand: true, loading: _busy, onPressed: () => _continue(l)),
      ],
    );
  }
}
