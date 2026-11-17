import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../../core/theme/app_tokens.g.dart';

/// In-app player for uploaded videos (signed URL), demo uploads and offline videos (loopback URL).
/// Reports the position every [reportEvery] and once at the end. No download/share controls.
class VideoView extends StatefulWidget {
  const VideoView({super.key, required this.url, this.startAt = 0, this.onPosition, this.onEnded, this.reportEvery = const Duration(seconds: 15)});
  final Uri url;
  final int startAt;
  final ValueChanged<int>? onPosition;
  final VoidCallback? onEnded;
  final Duration reportEvery;

  @override
  State<VideoView> createState() => _VideoViewState();
}

class _VideoViewState extends State<VideoView> {
  late final VideoPlayerController _c = VideoPlayerController.networkUrl(widget.url);
  int _lastReported = 0;
  bool _ended = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _c.initialize().then((_) async {
      if (widget.startAt > 0) await _c.seekTo(Duration(seconds: widget.startAt));
      if (mounted) setState(() {});
    }).catchError((Object e) {
      if (mounted) setState(() => _error = '$e');
    });
    _c.addListener(_tick);
  }

  void _tick() {
    final v = _c.value;
    if (!v.isInitialized) return;
    final sec = v.position.inSeconds;
    if ((sec - _lastReported).abs() >= widget.reportEvery.inSeconds) {
      _lastReported = sec;
      widget.onPosition?.call(sec);
    }
    final done = v.duration > Duration.zero && v.position >= v.duration - const Duration(milliseconds: 300) && !v.isPlaying;
    if (done && !_ended) {
      _ended = true;
      widget.onPosition?.call(sec);
      widget.onEnded?.call();
    }
  }

  @override
  void dispose() {
    final v = _c.value;
    if (v.isInitialized) widget.onPosition?.call(v.position.inSeconds);
    _c.removeListener(_tick);
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return AspectRatio(aspectRatio: 16 / 9, child: Center(child: Text(_error!, textAlign: TextAlign.center)));
    if (!_c.value.isInitialized) return const AspectRatio(aspectRatio: 16 / 9, child: Center(child: CircularProgressIndicator()));
    return Column(
      children: [
        AspectRatio(aspectRatio: _c.value.aspectRatio, child: VideoPlayer(_c)),
        VideoProgressIndicator(_c, allowScrubbing: true, colors: const VideoProgressColors(playedColor: AppTokens.actionPrimary, bufferedColor: AppTokens.progressTrack)),
        ValueListenableBuilder<VideoPlayerValue>(
          valueListenable: _c,
          builder: (_, v, _) => Row(
            children: [
              IconButton(
                tooltip: v.isPlaying ? 'Pause' : 'Play',
                icon: Icon(v.isPlaying ? Icons.pause : Icons.play_arrow),
                onPressed: () => v.isPlaying ? _c.pause() : _c.play(),
              ),
              IconButton(tooltip: '-10s', icon: const Icon(Icons.replay_10), onPressed: () => _c.seekTo(v.position - const Duration(seconds: 10))),
              IconButton(tooltip: '+10s', icon: const Icon(Icons.forward_10), onPressed: () => _c.seekTo(v.position + const Duration(seconds: 10))),
              const Spacer(),
              Text('${_fmt(v.position)} / ${_fmt(v.duration)}', style: const TextStyle(fontSize: AppTokens.textSm)),
              const SizedBox(width: AppTokens.spaceS3),
            ],
          ),
        ),
      ],
    );
  }

  String _fmt(Duration d) => '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';
}
