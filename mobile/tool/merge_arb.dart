// Merges lib/l10n/<name>.json ({ en, mr, hi } maps) into the ARB files and adds placeholder metadata.
// Usage: dart run tool/merge_arb.dart lib/l10n/teacher_strings.json
import 'dart:convert';
import 'dart:io';

void main(List<String> args) {
  final patch = jsonDecode(File(args.first).readAsStringSync()) as Map<String, dynamic>;
  final placeholder = RegExp(r'\{(\w+)\}');
  for (final lang in ['en', 'mr', 'hi']) {
    final file = File('lib/l10n/app_$lang.arb');
    final arb = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
    final strings = (patch[lang] as Map<String, dynamic>);
    strings.forEach((key, value) {
      arb[key] = value;
      if (lang == 'en') {
        final names = placeholder.allMatches(value as String).map((m) => m.group(1)!).toSet();
        if (names.isNotEmpty) {
          arb['@$key'] = {
            'placeholders': {for (final n in names) n: {'type': (n == 'present' || n == 'total' || n == 's') ? 'int' : 'String'}},
          };
        }
      }
    });
    file.writeAsStringSync('${const JsonEncoder.withIndent('  ').convert(arb)}\n');
  }
  stdout.writeln('ARB files updated');
}
