import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// Atomic JSON file storage for Android and OHOS (with channel fallback).
class AppStorage {
  AppStorage({this.fileName = 'breadlab_v1.json'});

  final String fileName;
  static const _channel = MethodChannel('com.breadlab/storage');

  Future<Directory> _resolveDir() async {
    try {
      return await getApplicationDocumentsDirectory();
    } catch (_) {
      // OHOS / unsupported path_provider: ask native side
      try {
        final path = await _channel.invokeMethod<String>('getDocumentsDir');
        if (path != null && path.isNotEmpty) {
          return Directory(path);
        }
      } catch (_) {}
      // Last resort for tests / desktop without plugins
      final tmp = Directory.systemTemp.createTempSync('breadlab_');
      return tmp;
    }
  }

  Future<File> _file() async {
    final dir = await _resolveDir();
    return File(p.join(dir.path, fileName));
  }

  Future<Map<String, dynamic>?> load() async {
    try {
      final file = await _file();
      if (!await file.exists()) return null;
      final raw = await file.readAsString();
      if (raw.trim().isEmpty) return null;
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) return decoded;
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
      return null;
    } on FormatException {
      return {'_corrupt': true};
    } catch (e, st) {
      debugPrint('AppStorage.load error: $e\n$st');
      return null;
    }
  }

  Future<bool> save(Map<String, dynamic> data) async {
    try {
      final file = await _file();
      final dir = file.parent;
      if (!await dir.exists()) await dir.create(recursive: true);
      final tmp = File('${file.path}.tmp');
      final payload = const JsonEncoder.withIndent('  ').convert(data);
      await tmp.writeAsString(payload, flush: true);
      if (await file.exists()) {
        await file.delete();
      }
      await tmp.rename(file.path);
      return true;
    } catch (e, st) {
      debugPrint('AppStorage.save error: $e\n$st');
      return false;
    }
  }

  Future<bool> clear() async {
    try {
      final file = await _file();
      if (await file.exists()) await file.delete();
      return true;
    } catch (_) {
      return false;
    }
  }
}
