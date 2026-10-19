import 'package:flutter/material.dart';

class BreadLabColors {
  static const bg = Color(0xFFFDFBF7);
  static const surface = Color(0xFFFFFFFF);
  static const text = Color(0xFF2C221E);
  static const textMuted = Color(0xFF65534A);
  static const textSoft = Color(0xFF8C7A70);
  static const primary = Color(0xFF8C5A32);
  static const primaryHover = Color(0xFF734826);
  static const border = Color(0xFFEFE8DE);
  static const borderAccent = Color(0xFFD4B28C);
  static const green = Color(0xFF587B53);
  static const greenDark = Color(0xFF3B6032);
  static const greenBg = Color(0xFFE8F0E6);
  static const gold = Color(0xFFD99B26);
  static const goldBg = Color(0xFFFBF3E0);
  static const danger = Color(0xFFA94442);
  static const dangerBg = Color(0xFFF8E8E8);
  static const warn = Color(0xFFB8860B);
  static const warnBg = Color(0xFFFBF3E0);
}

class BreadLabTheme {
  static ThemeData light() {
    final base = ColorScheme.fromSeed(
      seedColor: BreadLabColors.primary,
      brightness: Brightness.light,
      primary: BreadLabColors.primary,
      surface: BreadLabColors.surface,
      error: BreadLabColors.danger,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: base.copyWith(
        onSurface: BreadLabColors.text,
        secondary: BreadLabColors.green,
      ),
      scaffoldBackgroundColor: BreadLabColors.bg,
      appBarTheme: const AppBarTheme(
        backgroundColor: BreadLabColors.bg,
        foregroundColor: BreadLabColors.text,
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: BreadLabColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: BreadLabColors.border),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: BreadLabColors.surface,
        selectedColor: BreadLabColors.primary.withValues(alpha: 0.15),
        side: const BorderSide(color: BreadLabColors.border),
        labelStyle: const TextStyle(color: BreadLabColors.text),
      ),
      navigationBarTheme: const NavigationBarThemeData(
        backgroundColor: BreadLabColors.surface,
        indicatorColor: Color(0xFFE8D8C8),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: BreadLabColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: BreadLabColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: BreadLabColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: BreadLabColors.primary, width: 1.5),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: BreadLabColors.primary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        ),
      ),
      textTheme: const TextTheme(
        displaySmall: TextStyle(
          fontFamily: 'Georgia',
          fontSize: 32,
          fontWeight: FontWeight.w600,
          color: BreadLabColors.text,
        ),
        headlineMedium: TextStyle(
          fontFamily: 'Georgia',
          fontSize: 24,
          fontWeight: FontWeight.w600,
          color: BreadLabColors.text,
        ),
        titleLarge: TextStyle(
          fontWeight: FontWeight.w600,
          color: BreadLabColors.text,
        ),
        bodyLarge: TextStyle(color: BreadLabColors.text, height: 1.4),
        bodyMedium: TextStyle(color: BreadLabColors.textMuted, height: 1.4),
      ),
    );
  }

  static ThemeData dark() {
    final base = ColorScheme.fromSeed(
      seedColor: BreadLabColors.primary,
      brightness: Brightness.dark,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: base,
      scaffoldBackgroundColor: const Color(0xFF1C1614),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
        ),
      ),
    );
  }
}
