class MachineConstraints {
  const MachineConstraints({
    required this.breadFlour,
    required this.doughFlour,
    required this.yeastG,
    required this.dispenserAddinsMaxG,
  });

  final List<double> breadFlour;
  final List<double> doughFlour;
  final List<double> yeastG;
  final double dispenserAddinsMaxG;

  factory MachineConstraints.fromJson(Map<String, dynamic> json) {
    return MachineConstraints(
      breadFlour: _numPair(json['breadFlour']),
      doughFlour: _numPair(json['doughFlour']),
      yeastG: _numPair(json['yeastG']),
      dispenserAddinsMaxG: (json['dispenserAddinsMaxG'] as num).toDouble(),
    );
  }
}

class Machine {
  const Machine({
    required this.id,
    required this.shortName,
    required this.name,
    this.programs = const {},
    this.constraints,
    this.modes = const [],
    this.multiCookTempC = const [],
    this.breadDefaultMin,
    this.breadRangeMin = const [],
    this.bowlVolumeMl,
    this.flipDefault,
    this.notes = '',
  });

  final String id;
  final String shortName;
  final String name;
  final Map<String, String> programs;
  final MachineConstraints? constraints;
  final List<String> modes;
  final List<double> multiCookTempC;
  final int? breadDefaultMin;
  final List<int> breadRangeMin;
  final double? bowlVolumeMl;
  final Map<String, dynamic>? flipDefault;
  final String notes;

  bool get isPanasonic => id == 'panasonic_sd_yr2540hts';
  bool get isRedmond => id == 'redmond_rmc_m92s';

  factory Machine.fromJson(String id, Map<String, dynamic> json) {
    final programsRaw = json['programs'];
    final programs = <String, String>{};
    if (programsRaw is Map) {
      programsRaw.forEach((k, v) => programs[k.toString()] = v.toString());
    }
    return Machine(
      id: json['id'] as String? ?? id,
      shortName: json['shortName'] as String? ?? id,
      name: json['name'] as String? ?? id,
      programs: programs,
      constraints: json['constraints'] is Map
          ? MachineConstraints.fromJson(
              Map<String, dynamic>.from(json['constraints'] as Map),
            )
          : null,
      modes: (json['modes'] as List?)?.map((e) => e.toString()).toList() ??
          const [],
      multiCookTempC: (json['multiCookTempC'] as List?)
              ?.map((e) => (e as num).toDouble())
              .toList() ??
          const [],
      breadDefaultMin: (json['breadDefaultMin'] as num?)?.toInt(),
      breadRangeMin: (json['breadRangeMin'] as List?)
              ?.map((e) => (e as num).toInt())
              .toList() ??
          const [],
      bowlVolumeMl: (json['bowlVolumeMl'] as num?)?.toDouble(),
      flipDefault: json['flipDefault'] is Map
          ? Map<String, dynamic>.from(json['flipDefault'] as Map)
          : null,
      notes: json['notes'] as String? ?? '',
    );
  }
}

List<double> _numPair(dynamic v) {
  if (v is List && v.length >= 2) {
    return [(v[0] as num).toDouble(), (v[1] as num).toDouble()];
  }
  return const [0, 0];
}
