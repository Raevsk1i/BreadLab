mod commands;
mod error;
mod models;
mod services;

use commands::*;
use services::{Catalog, SharedCatalog};
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let catalog = Catalog::load_embedded().expect("failed to load embedded BreadLab catalog");
    let catalog: SharedCatalog = Arc::new(catalog);

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(catalog)
        .invoke_handler(tauri::generate_handler![
            get_catalog,
            get_recipe,
            get_ingredients,
            get_machines,
            get_addins,
            get_meta,
            search_recipes,
            resolve_ingredient,
            calculate_recipe_cmd,
            validate_machine_limits_cmd,
            load_state_cmd,
            save_state_cmd,
            import_state,
            export_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running BreadLab");
}

/// Test-only re-exports
#[cfg(test)]
#[allow(clippy::field_reassign_with_default)]
mod tests {
    use crate::models::*;
    use crate::services::*;
    use serde_json::json;
    use std::collections::{HashMap, HashSet};

    fn catalog() -> Catalog {
        Catalog::load_embedded().expect("catalog")
    }

    #[test]
    fn loads_all_35_recipes() {
        let c = catalog();
        assert_eq!(c.recipes.len(), 35);
        for i in 1..=35 {
            assert!(c.recipes.contains_key(&format!("p{i:02}")));
        }
    }

    #[test]
    fn program_numbers_match_source() {
        let c = catalog();
        assert_eq!(c.recipes["p01"].machine_profiles.panasonic.program_no, "01");
        assert_eq!(c.recipes["p02"].machine_profiles.panasonic.program_no, "02");
        assert_eq!(c.recipes["p07"].machine_profiles.panasonic.program_no, "09");
        assert_eq!(c.recipes["p16"].machine_profiles.panasonic.program_no, "10");
        assert_eq!(c.recipes["p32"].machine_profiles.panasonic.program_no, "11");
    }

    #[test]
    fn scale_preserves_flour_share_and_water() {
        let c = catalog();
        let p01 = &c.recipes["p01"];
        let s600 = scale_recipe(&c, p01, 600.0, &[]);
        assert!((s600.factor - 1.5).abs() < 1e-9);
        let water = s600
            .items
            .iter()
            .find(|r| r.ingredient_id == "water")
            .unwrap()
            .grams;
        assert!((water - 390.0).abs() < 1e-6);
    }

    #[test]
    fn p01_hydration_about_65() {
        let c = catalog();
        let p01 = &c.recipes["p01"];
        let scaled = scale_recipe(&c, p01, 400.0, &[]);
        let hyd = calculate_hydration(&c, &scaled);
        assert!((hyd - 65.0).abs() < 0.2);
    }

    #[test]
    fn panasonic_flour_thresholds() {
        let c = catalog();
        let p01 = &c.recipes["p01"];
        let codes = |flour: f64| {
            let scaled = scale_recipe(&c, p01, flour, &[]);
            validate_machine_limits(&c, "panasonic_sd_yr2540hts", p01, &scaled)
                .into_iter()
                .map(|w| (w.level, w.code))
                .collect::<Vec<_>>()
        };
        assert!(codes(349.0).iter().any(|c| c.1 == "flour_low"));
        assert!(codes(350.0).is_empty());
        assert!(codes(600.0).is_empty());
        assert!(codes(601.0).iter().any(|c| c.1 == "flour_high" && c.0 == "danger"));
    }

    #[test]
    fn dispenser_over_150_danger() {
        let c = catalog();
        let p01 = &c.recipes["p01"];
        let mut scaled = scale_recipe(&c, p01, 400.0, &["raisin".into()]);
        scaled.all.push(ScaledItem {
            ingredient_id: "raisin".into(),
            grams: 160.0,
            baker_pct: 0.0,
            is_flour: false,
            stage: "addins".into(),
            role: String::new(),
            detailed_role: String::new(),
            placement: Placement {
                panasonic: "raisinNutDispenser".into(),
                redmond: "manual".into(),
            },
            scalable: true,
            hydration_contributor: false,
            increase_effect: String::new(),
            decrease_effect: String::new(),
            substitutions: vec![],
            unit: "g".into(),
            optional: true,
            scaled: true,
            name: None,
            is_addin: true,
            addin_id: None,
            pct_range: None,
            grams_range: None,
            effect: None,
            warnings: None,
            dry: None,
        });
        let load = calculate_dispenser_load(&scaled);
        assert!(load > 150.0);
        let warns = validate_machine_limits(&c, "panasonic_sd_yr2540hts", p01, &scaled);
        assert!(warns.iter().any(|w| w.code == "dispenser" && w.level == "danger"));
    }

    #[test]
    fn mixed_flour_ratio_invariant() {
        let c = catalog();
        let p15 = &c.recipes["p15"];
        let ratio = |flour: f64| {
            let s = scale_recipe(&c, p15, flour, &[]);
            let rye = s.items.iter().find(|r| r.ingredient_id == "rye_flour").unwrap().grams;
            let wheat = s
                .items
                .iter()
                .find(|r| r.ingredient_id == "wheat_flour")
                .unwrap()
                .grams;
            rye / wheat
        };
        assert!((ratio(400.0) - ratio(500.0)).abs() < 1e-9);
    }

    #[test]
    fn alias_resolves_wheat() {
        let c = catalog();
        assert_eq!(
            resolve_ingredient_id(&c, "хлебопекарная мука").as_deref(),
            Some("wheat_flour")
        );
    }

    #[test]
    fn match_near_missing_up_to_two() {
        let c = catalog();
        let mut pantry = HashSet::new();
        pantry.insert("wheat_flour".into());
        pantry.insert("yeast".into());
        pantry.insert("oil".into());
        let matches = match_recipes(&c, &pantry, true);
        assert!(!matches.is_empty());
        assert!(matches.iter().any(|m| m.status == "exact" || m.status == "near"));
        assert!(matches.iter().all(|m| m.missing.len() <= 2));
    }

    #[test]
    fn finished_weight_finite() {
        let c = catalog();
        let p01 = &c.recipes["p01"];
        let calc = calculate_recipe(&c, p01, "panasonic_sd_yr2540hts", 400.0, &[], None);
        assert!(calc.dough_mass.is_finite());
        assert!(calc.finished.min.is_finite() && calc.finished.max.is_finite());
        assert!(calc.finished.min < calc.finished.max);
        assert!(calc.finished.max < calc.dough_mass);
    }

    #[test]
    fn import_rejects_invalid() {
        assert!(!is_breadlab_import_payload(&json!(null)));
        assert!(!is_breadlab_import_payload(&json!([])));
        assert!(!is_breadlab_import_payload(&json!({"foo": 1})));
        assert!(is_breadlab_import_payload(&json!({"app": "BreadLab"})));
        assert!(is_breadlab_import_payload(&json!({"favorites": []})));
    }

    #[test]
    fn export_import_roundtrip_preserves_favorites() {
        let c = catalog();
        let mut state = PersistedState::default();
        state.favorites = vec!["p01".into(), "p16".into()];
        state.pantry.insert("wheat_flour".into(), true);
        let export = build_export(&c, &state);
        let value = serde_json::to_value(&export).unwrap();
        let mut restored = PersistedState::default();
        merge_import(&mut restored, &value).unwrap();
        assert_eq!(restored.favorites, state.favorites);
        assert_eq!(restored.pantry.get("wheat_flour"), Some(&true));
    }

    #[test]
    fn persistence_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let data = app_data_dir(dir.path());
        let mut state = PersistedState::default();
        state.favorites = vec!["p01".into()];
        state.target_flour_g = 500.0;
        save_state(&data, &state).unwrap();
        let (loaded, recovered) = load_state(&data).unwrap();
        assert!(!recovered);
        assert_eq!(loaded.favorites, vec!["p01".to_string()]);
        assert!((loaded.target_flour_g - 500.0).abs() < 1e-9);
    }

    #[test]
    fn addins_independent_per_recipe_in_state() {
        let mut state = PersistedState::default();
        let mut a = HashMap::new();
        a.insert("raisin".into(), true);
        let mut b = HashMap::new();
        b.insert("walnut".into(), true);
        state.addins_by_recipe.insert("p01".into(), a);
        state.addins_by_recipe.insert("p02".into(), b);
        assert!(state.addins_by_recipe["p01"]["raisin"]);
        assert!(!state.addins_by_recipe["p02"].contains_key("raisin"));
    }

    #[test]
    fn calibration_bias_applied() {
        let c = catalog();
        let p01 = &c.recipes["p01"];
        let base = calculate_recipe(&c, p01, "panasonic_sd_yr2540hts", 400.0, &[], None);
        let mid = (base.finished.min + base.finished.max) / 2.0;
        let cal = CalibrationEntry {
            recipe_id: "p01".into(),
            machine_id: "panasonic_sd_yr2540hts".into(),
            target_flour_g: 400.0,
            actual_finished_weight_g: mid * 1.1,
            peak_fill_percent: Some(60.0),
            predicted_mid: mid,
            timestamp: "t".into(),
        };
        let biased = calculate_recipe(&c, p01, "panasonic_sd_yr2540hts", 400.0, &[], Some(&cal));
        assert!((biased.finished.min - base.finished.min * 1.1).abs() < 1e-6);
    }

    #[test]
    fn golden_calc_file_matches() {
        let golden: serde_json::Value =
            serde_json::from_str(include_str!("../tests/goldens/calc.json")).unwrap();
        let c = catalog();
        let p01 = &c.recipes["p01"];
        let scaled600 = scale_recipe(&c, p01, 600.0, &[]);
        assert_eq!(
            scaled600.factor,
            golden["p01_scale_factor_600"].as_f64().unwrap()
        );
        let water = scaled600
            .items
            .iter()
            .find(|r| r.ingredient_id == "water")
            .unwrap()
            .grams;
        assert_eq!(water, golden["p01_water_600"].as_f64().unwrap());
        let scaled400 = scale_recipe(&c, p01, 400.0, &[]);
        let hyd = calculate_hydration(&c, &scaled400);
        assert!((hyd - golden["p01_hydration_400"].as_f64().unwrap()).abs() < 1e-9);
        assert_eq!(
            resolve_ingredient_id(&c, "хлебопекарная мука").as_deref(),
            golden["alias_wheat"].as_str()
        );
    }

    #[test]
    fn cook_session_persists_paused() {
        let dir = tempfile::tempdir().unwrap();
        let data = app_data_dir(dir.path());
        let mut state = PersistedState::default();
        state.cook_session = Some(CookSession {
            recipe_id: "p01".into(),
            machine_id: "panasonic_sd_yr2540hts".into(),
            step_index: 2,
            timer_id: Some("bake".into()),
            ck_key: "p01::panasonic_sd_yr2540hts::addins:".into(),
            remaining_ms: 120_000.0,
            running: true, // should be forced false on save
        });
        save_state(&data, &state).unwrap();
        let (loaded, _) = load_state(&data).unwrap();
        assert!(!loaded.cook_session.unwrap().running);
    }
}
