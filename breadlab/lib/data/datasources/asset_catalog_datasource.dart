import 'dart:convert';

import 'package:flutter/services.dart';

class AssetCatalogDatasource {
  AssetCatalogDatasource({AssetBundle? bundle})
      : _bundle = bundle ?? rootBundle;

  final AssetBundle _bundle;

  Future<Map<String, dynamic>> loadJson(String assetPath) async {
    final raw = await _bundle.loadString(assetPath);
    final decoded = jsonDecode(raw);
    if (decoded is Map<String, dynamic>) return decoded;
    if (decoded is Map) return Map<String, dynamic>.from(decoded);
    if (decoded is List) return {'_list': decoded};
    throw FormatException('Unexpected JSON root in $assetPath');
  }

  Future<List<dynamic>> loadJsonList(String assetPath) async {
    final raw = await _bundle.loadString(assetPath);
    final decoded = jsonDecode(raw);
    if (decoded is List) return decoded;
    throw FormatException('Expected list in $assetPath');
  }
}
