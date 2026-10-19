import 'dart:async';

import 'package:flutter/material.dart';

import '../../app/app_scope.dart';
import '../../app/app_theme.dart';
import '../../data/models/recipe.dart';
import '../../domain/models/scaled_recipe.dart';
import '../../shared/widgets/section_header.dart';

class CookingScreen extends StatefulWidget {
  const CookingScreen({super.key, this.resume = false});

  final bool resume;

  @override
  State<CookingScreen> createState() => _CookingScreenState();
}

class _CookingScreenState extends State<CookingScreen>
    with WidgetsBindingObserver {
  late List<CookStep> _steps;
  late String _ckKey;
  late String _machineKey;
  int _stepIndex = 0;
  Timer? _ticker;
  int _remainingMs = 0;
  int _durationMs = 0;
  bool _running = false;
  DateTime? _deadline;
  String? _timerId;
  List<CookTimerSpec> _timerSpecs = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  void _bootstrap() {
    final app = AppScope.read(context);
    final recipe = app.selectedRecipe;
    final catalog = app.catalog;
    if (recipe == null || catalog == null) {
      Navigator.of(context).pop();
      return;
    }
    _machineKey = catalog.cookingSteps.machineKeyFromId(app.user.selectedMachineId);
    final scaled = app.currentScaled()!;
    _steps = catalog.cookingSteps.getCookingSteps(recipe, _machineKey, scaled);
    final addins = app.enabledAddinList();
    _ckKey = catalog.cookingSteps.checklistKey(
      recipe.id,
      app.user.selectedMachineId,
      addins,
    );
    app.checklistFor(_ckKey);

    final mpTimers = _machineKey == 'panasonic'
        ? recipe.panasonic.timers
        : recipe.redmond.timers;
    _timerSpecs = mpTimers.isNotEmpty
        ? mpTimers
        : [
            const CookTimerSpec(id: 'custom', label: 'Таймер 10 мин', minutes: 10)
          ];
    _timerId = _timerSpecs.first.id;
    _durationMs = (_timerSpecs.first.minutes * 60 * 1000).round();
    _remainingMs = _durationMs;

    if (widget.resume && app.user.cookSession != null) {
      final cs = app.user.cookSession!;
      _stepIndex = cs.stepIndex.clamp(0, _steps.length - 1);
      if (cs.timerId != null) {
        final idx = _timerSpecs.indexWhere((t) => t.id == cs.timerId);
        if (idx >= 0) {
          _timerId = cs.timerId;
          _durationMs = (_timerSpecs[idx].minutes * 60 * 1000).round();
        }
      }
      _remainingMs = cs.remainingMs;
      _running = false; // HTML resume never auto-starts
      _deadline = null;
    }

    _saveSession();
    _startTicker();
    setState(() {});
  }

  void _startTicker() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(milliseconds: 250), (_) {
      if (!_running || _deadline == null) return;
      final left = _deadline!.difference(DateTime.now()).inMilliseconds;
      setState(() {
        _remainingMs = left > 0 ? left : 0;
        if (_remainingMs == 0) {
          _running = false;
          _deadline = null;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Таймер завершён')),
          );
          _saveSession();
        }
      });
    });
  }

  void _saveSession() {
    final app = AppScope.read(context);
    final recipe = app.selectedRecipe;
    if (recipe == null) return;
    int rem = _remainingMs;
    if (_running && _deadline != null) {
      rem = _deadline!.difference(DateTime.now()).inMilliseconds.clamp(0, 1 << 31);
    }
    app.saveCookSession(CookSession(
      recipeId: recipe.id,
      machineId: app.user.selectedMachineId,
      stepIndex: _stepIndex,
      timerId: _timerId,
      ckKey: _ckKey,
      remainingMs: rem,
      running: false,
    ));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      _saveSession();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _ticker?.cancel();
    _ticker = null;
    super.dispose();
  }

  String _fmt(int ms) {
    final total = (ms / 1000).ceil();
    final h = total ~/ 3600;
    final m = (total % 3600) ~/ 60;
    final s = total % 60;
    if (h > 0) {
      return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
    }
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final catalog = app.catalog;
    final recipe = app.selectedRecipe;
    if (catalog == null || recipe == null || _steps.isEmpty) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final scaled = app.currentScaled()!;
    final checklist = app.checklistFor(_ckKey);
    final doneCount = _steps.where((s) => checklist[s.id] == true).length;
    final progress = _steps.isEmpty ? 0.0 : doneCount / _steps.length;
    final step = _steps[_stepIndex.clamp(0, _steps.length - 1)];
    final text = catalog.cookingSteps.fillStepText(step.text, scaled);
    final large = app.user.largeSteps;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Приготовление'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () {
            _saveSession();
            Navigator.of(context).pop();
          },
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            LinearProgressIndicator(
              value: progress,
              color: BreadLabColors.green,
              backgroundColor: BreadLabColors.border,
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'Шаг ${_stepIndex + 1} из ${_steps.length}',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  SoftCard(
                    child: Text(
                      text,
                      style: TextStyle(
                        fontSize: large ? 22 : 18,
                        height: 1.45,
                        color: step.isAddin
                            ? BreadLabColors.greenDark
                            : BreadLabColors.text,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  CheckboxListTile(
                    value: checklist[step.id] == true,
                    onChanged: (v) =>
                        app.setChecklistStep(_ckKey, step.id, v == true),
                    title: const Text('Шаг выполнен'),
                  ),
                  const SizedBox(height: 8),
                  SoftCard(
                    child: Column(
                      children: [
                        GestureDetector(
                          onTap: () {
                            if (_timerSpecs.length <= 1) return;
                            final idx = _timerSpecs
                                .indexWhere((t) => t.id == _timerId);
                            final next =
                                _timerSpecs[(idx + 1) % _timerSpecs.length];
                            setState(() {
                              _timerId = next.id;
                              _durationMs =
                                  (next.minutes * 60 * 1000).round();
                              _remainingMs = _durationMs;
                              _running = false;
                              _deadline = null;
                            });
                            _saveSession();
                          },
                          child: Text(
                            _timerSpecs
                                .firstWhere((t) => t.id == _timerId,
                                    orElse: () => _timerSpecs.first)
                                .label,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _fmt(_remainingMs),
                          style: const TextStyle(
                            fontSize: 40,
                            fontWeight: FontWeight.w700,
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            FilledButton(
                              onPressed: () {
                                setState(() {
                                  if (_running) {
                                    if (_deadline != null) {
                                      _remainingMs = _deadline!
                                          .difference(DateTime.now())
                                          .inMilliseconds
                                          .clamp(0, 1 << 31);
                                    }
                                    _running = false;
                                    _deadline = null;
                                  } else {
                                    _deadline = DateTime.now().add(
                                      Duration(milliseconds: _remainingMs),
                                    );
                                    _running = true;
                                  }
                                });
                                _saveSession();
                              },
                              child: Text(_running ? 'Пауза' : 'Старт'),
                            ),
                            const SizedBox(width: 8),
                            OutlinedButton(
                              onPressed: () {
                                setState(() {
                                  _remainingMs = _durationMs;
                                  _running = false;
                                  _deadline = null;
                                });
                                _saveSession();
                              },
                              child: const Text('Сброс таймера'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        if (_stepIndex <= 0) {
                          _saveSession();
                          Navigator.of(context).pop();
                          return;
                        }
                        setState(() => _stepIndex--);
                        _saveSession();
                      },
                      child: Text(_stepIndex <= 0 ? 'Закрыть' : 'Назад'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton(
                      onPressed: () {
                        app.setChecklistStep(_ckKey, step.id, true);
                        if (_stepIndex >= _steps.length - 1) {
                          _saveSession();
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Готово!')),
                          );
                          return;
                        }
                        setState(() => _stepIndex++);
                        _saveSession();
                      },
                      child: Text(
                        _stepIndex >= _steps.length - 1 ? 'Готово' : 'Далее',
                      ),
                    ),
                  ),
                ],
              ),
            ),
            TextButton(
              onPressed: () {
                app.resetChecklist(_ckKey);
                setState(() {
                  _stepIndex = 0;
                  _remainingMs = _durationMs;
                  _running = false;
                  _deadline = null;
                });
                _saveSession();
              },
              child: const Text('Сбросить процесс'),
            ),
          ],
        ),
      ),
    );
  }
}
