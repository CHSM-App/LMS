import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:lms_app/core/network/api_client.dart';
import 'package:lms_app/core/offline/license_guard.dart';
import 'package:lms_app/core/offline/offline_ports.dart';
import 'package:lms_app/core/offline/progress_queue.dart';
import 'package:lms_app/data/models/student_models.dart';
import 'package:lms_app/presentation/viewModels/download_viewmodel.dart';

import '../student/fake_student_repo.dart';
import 'offline_fakes.dart';

void main() {
  late Directory dir;
  late FakeStudentRepo repo;
  late MemoryDownloadDao dao;
  late MemoryKeyVault vault;
  late FakeNetwork net;
  late FakeStorage storage;
  late FakeDownloader downloader;
  final now = DateTime.utc(2026, 6, 15, 9);
  final video = sampleBytes(400000);

  DownloadTicket ticket({String url = 'https://api.example/files/v1?sig=a'}) => DownloadTicket(
        contentId: 5,
        title: 'Fractions',
        downloadUrl: url,
        keyId: 'k-5',
        key: base64.encode(List.generate(32, (i) => i)),
        licenseExpiresAt: now.add(const Duration(days: 7)),
        sizeBytes: video.length,
      );

  DownloadViewModel make() => DownloadViewModel(
        repo: repo,
        dao: dao,
        vault: vault,
        network: net,
        storage: storage,
        downloader: downloader,
        deviceId: () async => 'dev-123456',
        offlineDir: () async => Directory('${dir.path}/offline'),
        tempDir: () async => Directory('${dir.path}/tmp'),
        now: () => now,
      );

  setUp(() {
    dir = Directory.systemTemp.createTempSync('dl');
    repo = FakeStudentRepo()..ticket = ticket();
    dao = MemoryDownloadDao();
    vault = MemoryKeyVault();
    net = FakeNetwork();
    storage = FakeStorage(10 * 1024 * 1024 * 1024);
    downloader = FakeDownloader(video);
  });
  tearDown(() => dir.deleteSync(recursive: true));

  test('queued → downloading (progress %) → paused → resumed → completed; temp file removed, file stored encrypted', () async {
    final vm = make();
    downloader.gate = Completer<void>();
    final seen = <DownloadStatus>{};
    final percents = <int>[];
    vm.addListener((s) {
      final item = s.items[5];
      if (item != null) {
        seen.add(item.status);
        percents.add(item.percent);
      }
    }, fireImmediately: false);

    final run = vm.download(contentId: 5, courseId: 3, courseTitle: 'Maths', title: 'Fractions');
    await pumpEventQueue();
    expect(vm.state.items[5]!.status, DownloadStatus.downloading);
    expect(vm.state.items[5]!.percent, 25);
    vm.pause(5);
    downloader.gate!.complete();
    await run;
    expect(vm.state.items[5]!.status, DownloadStatus.paused);

    await vm.resume(5);
    expect(vm.state.items[5]!.status, DownloadStatus.completed);
    expect(seen, containsAll([DownloadStatus.queued, DownloadStatus.downloading, DownloadStatus.paused, DownloadStatus.completed]));
    expect(percents.last, 100);
    expect(downloader.requests.last.from, greaterThan(0), reason: 'resume continues from the partial file');
    expect(repo.registered, ['dev-123456']);

    final rec = (await dao.get(5))!;
    expect(File(rec.filePath).parent.path, Directory('${dir.path}/offline').path, reason: 'stored in the app-private offline folder');
    expect(File(rec.filePath).readAsBytesSync().sublist(64, 1088), isNot(equals(video.sublist(0, 1024))));
    expect(Directory('${dir.path}/tmp').existsSync() ? Directory('${dir.path}/tmp').listSync() : [], isEmpty);
    expect(await vault.get('k-5'), isNotNull);
    expect(rec.licenseExpiresAt, now.add(const Duration(days: 7)));
  });

  test('Wi-Fi only on mobile data waits with "Waiting for Wi-Fi", then starts on Wi-Fi', () async {
    net.wifi = false;
    final vm = make();
    await vm.setWifiOnly(true);
    await vm.download(contentId: 5, courseId: 3, courseTitle: 'Maths', title: 'Fractions');
    expect(vm.state.items[5]!.status, DownloadStatus.waitingWifi);
    expect(downloader.requests, isEmpty);
    net.set(wifi: true);
    await pumpEventQueue(times: 50);
    await vm.idle();
    expect(vm.state.items[5]!.status, DownloadStatus.completed);
  });

  test('low storage (< size + 200 MB) stops with "Not enough space. Free up {n} MB"', () async {
    storage.free = video.length + 150 * 1024 * 1024;
    final vm = make();
    await vm.download(contentId: 5, courseId: 3, courseTitle: 'Maths', title: 'Fractions');
    expect(vm.state.items[5]!.status, DownloadStatus.failed);
    expect(vm.state.message, const DownloadMessage(DownloadMessageCode.notEnoughSpace, mb: 50));
    expect(downloader.requests, isEmpty);
  });

  test('a third device shows the device-limit message', () async {
    repo.issueError = const ApiException(409, 'Downloads are allowed on 2 devices. Remove one in Profile → Downloads.', 'DEVICE_LIMIT');
    final vm = make();
    await vm.download(contentId: 5, courseId: 3, courseTitle: 'Maths', title: 'Fractions');
    expect(vm.state.message!.code, DownloadMessageCode.deviceLimit);
    expect(vm.state.items[5]!.status, DownloadStatus.failed);
  });

  test('logout deletes every offline file and key', () async {
    final vm = make();
    await vm.download(contentId: 5, courseId: 3, courseTitle: 'Maths', title: 'Fractions');
    final path = (await dao.get(5))!.filePath;
    expect(File(path).existsSync(), isTrue);
    await vm.wipeAll();
    expect(File(path).existsSync(), isFalse);
    expect(vault.keys, isEmpty);
    expect(await dao.all(), isEmpty);
    expect(vm.state.items, isEmpty);
  });

  group('licence guard', () {
    Future<DownloadRecord> stored(DownloadViewModel vm) async {
      await vm.download(contentId: 5, courseId: 3, courseTitle: 'Maths', title: 'Fractions');
      return (await dao.get(5))!;
    }

    test('an expired licence locks the video', () async {
      final rec = await stored(make());
      final guard = LicenseGuard(dao: dao, vault: vault);
      expect(await guard.open(5, now: now), isA<LicenseOk>());
      await dao.upsert(rec.copyWith(licenseExpiresAt: now.subtract(const Duration(minutes: 1))));
      expect(await guard.open(5, now: now), isA<LicenseExpired>());
    });

    test('renew: revoked → file and key deleted, reason shown; renewed → new expiry', () async {
      final vm = make();
      final rec = await stored(vm);
      repo.renewResults = [const RenewResult(contentId: 5, revokedReason: 'subscription_ended')];
      final removed = await vm.renewAll();
      expect(removed, [(title: 'Fractions', reason: 'subscription_ended')]);
      expect(File(rec.filePath).existsSync(), isFalse);
      expect(vault.keys, isEmpty);
      expect(await dao.get(5), isNull);

      await stored(vm);
      final later = now.add(const Duration(days: 9));
      repo.renewResults = [RenewResult(contentId: 5, licenseExpiresAt: later)];
      expect(await vm.renewAll(), isEmpty);
      expect((await dao.get(5))!.licenseExpiresAt, later);
    });
  });

  group('offline progress queue', () {
    test('collapses per lesson, keeps completion, syncs once online without duplicates', () async {
      final q = OfflineProgressQueue(dao: dao, repo: repo, network: net, now: () => now);
      net.online = false;
      await q.record(5, positionSec: 30);
      await q.record(5, positionSec: 90, completed: true);
      await q.record(5, positionSec: 120);
      await q.record(6, positionSec: 10);
      expect(await q.sync(), 0);
      expect(repo.synced, isEmpty);

      net.online = true;
      final results = await Future.wait([q.sync(), q.sync()]);
      expect(results.reduce((a, b) => a + b), 2);
      expect(repo.synced, hasLength(1));
      final items = {for (final i in repo.synced.single) i['contentId']: i};
      expect(items[5]!['positionSec'], 120);
      expect(items[5]!['completedAt'], now.toIso8601String());
      expect(items[6]!['completedAt'], isNull);
      expect(await q.sync(), 0);
      expect(repo.synced, hasLength(1));
    });

    test('a failed sync keeps the items for next time', () async {
      final q = OfflineProgressQueue(dao: dao, repo: repo, network: net, now: () => now);
      await q.record(5, positionSec: 30);
      repo.syncFails = true;
      expect(await q.sync(), 0);
      repo.syncFails = false;
      expect(await q.sync(), 1);
    });
  });
}
