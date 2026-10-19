class LabelMaps {
  const LabelMaps._();

  static String placementLabel(String? code, String machineKey) {
    const mapP = {
      'pan': 'В чашу',
      'yeastDispenser': 'Диспенсер дрожжей',
      'raisinNutDispenser': 'Диспенсер добавок',
      'manualAdd': 'Вручную / по сигналу',
      'notApplicable': '—',
    };
    const mapR = {'bowl': 'В чашу', 'manual': 'Вручную при замесе'};
    if (machineKey == 'redmond') {
      return mapR[code] ?? code ?? 'Вручную';
    }
    return mapP[code] ?? code ?? '—';
  }

  static String stageLabel(String? stage) {
    const m = {
      'preferment': 'Опара',
      'scald': 'Заварка',
      'mainMix': 'Основной замес',
      'dispenser': 'Диспенсер',
      'manual': 'Вручную',
      'topping': 'Посыпка',
      'addins': 'Добавки',
    };
    return m[stage] ?? stage ?? '—';
  }

  static const catalogCategoryOrder = [
    'Базовые',
    'Европейские',
    'Цельнозерновые',
    'Смесовые',
    'Ржаные',
    'Кисломолочные',
    'Добавки',
    'Сладкие',
    'Семена',
    'Без дрожжей',
    'Без глютена',
  ];
}
