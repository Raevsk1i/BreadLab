use std::collections::HashSet;

use breadlab::models::CalibrationInput;
use breadlab::services::calculator::{
    calculate_dough_mass, calculate_hydration, estimate_finished_weight, scale_recipe,
    CalibrationBias,
};
use breadlab::services::load_catalog;
use breadlab::services::matcher::{build_shopping_list, match_recipes, resolve_ingredient_id};
use breadlab::services::steps::cooking_steps;
use breadlab::services::validation::validate_machine_limits;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoldenFile {
    cases: Vec<GoldenCase>,
    search: GoldenSearch,
    resolve: Vec<ResolveCase>,
    programs: std::collections::HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoldenCase {
    recipe_id: String,
    flour: f64,
    addins: Vec<String>,
    calibration: Option<CalibrationInput>,
    factor: f64,
    hydration: f64,
    dough_mass: f64,
    finished: Range,
    volume: Volume,
    dispenser: f64,
    items: Vec<GoldenItem>,
    addin_rows: Vec<GoldenAddin>,
    warnings: std::collections::HashMap<String, Vec<breadlab::services::validation::Warning>>,
    panasonic_steps: Vec<breadlab::services::steps::FilledStep>,
}

#[derive(Debug, Deserialize)]
struct Range {
    min: f64,
    max: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Volume {
    initial_ml: f64,
    proofed_min_ml: f64,
    proofed_max_ml: f64,
    recommended_bowl_ml: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoldenItem {
    ingredient_id: String,
    grams: f64,
    baker_pct: f64,
    grams_text: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoldenAddin {
    addin_id: String,
    ingredient_id: String,
    grams: f64,
    baker_pct: f64,
    grams_text: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoldenSearch {
    pantry: Vec<String>,
    near: Vec<NearHit>,
    exact_only: Vec<ExactHit>,
    shopping: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NearHit {
    recipe_id: String,
    machine_key: String,
    machine_id: String,
    status: String,
    missing: Vec<String>,
    score: i32,
    program_label: String,
    time_min: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExactHit {
    recipe_id: String,
    machine_key: String,
    status: String,
    missing: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ResolveCase {
    token: String,
    id: Option<String>,
}

fn close(actual: f64, expected: f64, label: &str) {
    let delta = (actual - expected).abs();
    assert!(
        delta < 1e-6,
        "{label}: {actual} != {expected} (delta {delta})"
    );
}

#[test]
fn golden_matches_original_javascript() {
    let catalog = load_catalog().expect("catalog");
    let golden: GoldenFile =
        serde_json::from_str(include_str!("fixtures/golden.json")).expect("golden");
    assert_eq!(catalog.recipes.len(), 35);
    assert_eq!(golden.programs.len(), 35);
    for (id, program) in &golden.programs {
        let recipe = catalog.recipe(id).unwrap_or_else(|| panic!("missing {id}"));
        assert_eq!(
            &recipe.machine_profiles.panasonic.program_no, program,
            "{id}"
        );
    }

    for case in &golden.cases {
        let recipe = catalog.recipe(&case.recipe_id).expect(&case.recipe_id);
        let scaled = scale_recipe(&catalog, recipe, case.flour, &case.addins);
        let label = format!("{} @ {}", case.recipe_id, case.flour);
        close(scaled.factor, case.factor, &format!("{label} factor"));
        close(
            calculate_hydration(&catalog, &scaled),
            case.hydration,
            &format!("{label} hydration"),
        );
        let dough = calculate_dough_mass(&scaled);
        close(dough, case.dough_mass, &format!("{label} dough"));
        assert!(dough.is_finite() && dough > 0.0, "{label} dough finite");
        let bias = case.calibration.as_ref().map(|item| CalibrationBias {
            actual_finished_weight_g: item.actual_finished_weight_g,
            predicted_mid: item.predicted_mid,
        });
        let finished = estimate_finished_weight(dough, recipe.physics.bake_loss_range, bias);
        close(finished.min, case.finished.min, &format!("{label} fin min"));
        close(finished.max, case.finished.max, &format!("{label} fin max"));
        assert!(finished.min.is_finite() && finished.max.is_finite());
        let volume = breadlab::services::calculator::estimate_proof_volume(dough, recipe);
        close(
            volume.initial_ml,
            case.volume.initial_ml,
            &format!("{label} initial"),
        );
        close(
            volume.proofed_min_ml,
            case.volume.proofed_min_ml,
            &format!("{label} pmin"),
        );
        close(
            volume.proofed_max_ml,
            case.volume.proofed_max_ml,
            &format!("{label} pmax"),
        );
        close(
            volume.recommended_bowl_ml,
            case.volume.recommended_bowl_ml,
            &format!("{label} bowl"),
        );
        close(
            breadlab::services::calculator::calculate_dispenser_load(&scaled),
            case.dispenser,
            &format!("{label} dispenser"),
        );
        assert_eq!(scaled.items.len(), case.items.len(), "{label} items");
        for (actual, expected) in scaled.items.iter().zip(&case.items) {
            assert_eq!(actual.ingredient_id, expected.ingredient_id);
            close(
                actual.grams,
                expected.grams,
                &format!("{label} {}", expected.ingredient_id),
            );
            close(
                actual.baker_pct,
                expected.baker_pct,
                &format!("{label} pct {}", expected.ingredient_id),
            );
            assert_eq!(
                breadlab::services::calculator::format_grams(
                    &catalog,
                    &actual.ingredient_id,
                    actual.grams
                ),
                expected.grams_text
            );
        }
        assert_eq!(scaled.addins.len(), case.addin_rows.len());
        for (actual, expected) in scaled.addins.iter().zip(&case.addin_rows) {
            assert_eq!(actual.addin_id.as_deref(), Some(expected.addin_id.as_str()));
            assert_eq!(actual.ingredient_id, expected.ingredient_id);
            close(actual.grams, expected.grams, "addin grams");
            close(actual.baker_pct, expected.baker_pct, "addin pct");
            assert_eq!(
                breadlab::services::calculator::format_grams(
                    &catalog,
                    &actual.ingredient_id,
                    actual.grams
                ),
                expected.grams_text
            );
        }
        for machine_id in ["panasonic_sd_yr2540hts", "redmond_rmc_m92s"] {
            let actual = validate_machine_limits(&catalog, machine_id, recipe, &scaled);
            let expected = case.warnings.get(machine_id).expect(machine_id);
            assert_eq!(&actual, expected, "{label} {machine_id}");
        }
        let steps = cooking_steps(&catalog, recipe, "panasonic_sd_yr2540hts", &scaled);
        assert_eq!(steps, case.panasonic_steps, "{label} steps");
    }

    let pantry: HashSet<String> = golden.search.pantry.iter().cloned().collect();
    let near = match_recipes(&catalog, &pantry, true);
    assert_eq!(near.len(), golden.search.near.len());
    for (actual, expected) in near.iter().zip(&golden.search.near) {
        assert_eq!(actual.recipe_id, expected.recipe_id);
        assert_eq!(actual.machine_key, expected.machine_key);
        assert_eq!(actual.machine_id, expected.machine_id);
        assert_eq!(actual.status, expected.status);
        assert_eq!(actual.missing, expected.missing);
        assert_eq!(actual.score, expected.score);
        assert_eq!(actual.program_label, expected.program_label);
        close(actual.time_min, expected.time_min, "time");
    }
    let exact = match_recipes(&catalog, &pantry, false);
    assert_eq!(exact.len(), golden.search.exact_only.len());
    for (actual, expected) in exact.iter().zip(&golden.search.exact_only) {
        assert_eq!(actual.recipe_id, expected.recipe_id);
        assert_eq!(actual.machine_key, expected.machine_key);
        assert_eq!(actual.status, expected.status);
        assert_eq!(actual.missing, expected.missing);
    }
    assert_eq!(build_shopping_list(&catalog, &near), golden.search.shopping);
    for item in &golden.resolve {
        assert_eq!(resolve_ingredient_id(&catalog, &item.token), item.id);
    }
}

#[test]
fn original_self_test_numbers() {
    let catalog = load_catalog().unwrap();
    let programs = &catalog
        .machines
        .get("panasonic_sd_yr2540hts")
        .unwrap()
        .programs;
    assert_eq!(programs.get("01").map(String::as_str), Some("Основной"));
    assert_eq!(
        programs.get("03").map(String::as_str),
        Some("Основной с изюмом")
    );
    assert_eq!(programs.get("10").map(String::as_str), Some("Ржаной"));
    assert_eq!(
        programs.get("12").map(String::as_str),
        Some("Хлеб без глютена")
    );
    assert_eq!(catalog.recipe("p01").unwrap().title, "Нарезной белый");
    assert_eq!(catalog.recipe("p15").unwrap().title, "Дарницкий");
    assert_eq!(catalog.recipe("p16").unwrap().title, "Бородинский");
    assert_eq!(catalog.ingredients.get("potato").unwrap().name, "Картофель");
    assert!(catalog.ingredients.get("salt").unwrap().hide_from_pantry);
    assert!(catalog.ingredients.get("sugar").unwrap().hide_from_pantry);
    assert!(
        !catalog
            .recipe("p01")
            .unwrap()
            .machine_profiles
            .redmond
            .flip
            .as_ref()
            .unwrap()
            .required
    );

    let p01 = catalog.recipe("p01").unwrap();
    let s400 = scale_recipe(&catalog, p01, 400.0, &[]);
    let s600 = scale_recipe(&catalog, p01, 600.0, &[]);
    close(s600.factor, 600.0 / 400.0, "factor");
    let water600 = s600
        .items
        .iter()
        .find(|row| row.ingredient_id == "water")
        .unwrap();
    close(water600.grams, 390.0, "water 600");
    let hyd = calculate_hydration(&catalog, &s400);
    assert!((hyd - 65.0).abs() < 0.2, "hydration {hyd}");
    let mass = calculate_dough_mass(&s400);
    assert!(mass > 400.0 && mass.is_finite());
    let fin = estimate_finished_weight(mass, p01.physics.bake_loss_range, None);
    assert!(fin.min < fin.max && fin.max < mass);

    let p15 = catalog.recipe("p15").unwrap();
    let a = scale_recipe(&catalog, p15, 400.0, &[]);
    let b = scale_recipe(&catalog, p15, 500.0, &[]);
    let ratio = |scaled: &breadlab::services::calculator::ScaledRecipe| {
        let rye = scaled
            .items
            .iter()
            .find(|row| row.ingredient_id == "rye_flour")
            .unwrap()
            .grams;
        let wheat = scaled
            .items
            .iter()
            .find(|row| row.ingredient_id == "wheat_flour")
            .unwrap()
            .grams;
        rye / wheat
    };
    close(ratio(&a), ratio(&b), "mixed flour");

    let warn = |flour: f64| {
        validate_machine_limits(
            &catalog,
            "panasonic_sd_yr2540hts",
            p01,
            &scale_recipe(&catalog, p01, flour, &[]),
        )
    };
    assert!(warn(349.0).iter().any(|item| item.code == "flour_low"));
    assert!(!warn(350.0)
        .iter()
        .any(|item| item.code == "flour_low" || item.code == "flour_high"));
    assert!(!warn(600.0).iter().any(|item| item.code == "flour_high"));
    assert!(warn(601.0).iter().any(|item| item.code == "flour_high"));

    let mut synth = scale_recipe(&catalog, p01, 400.0, &["raisin".into()]);
    synth.addins[0].grams = 160.0;
    let disp = validate_machine_limits(&catalog, "panasonic_sd_yr2540hts", p01, &synth);
    assert!(disp.iter().any(|item| item.code == "dispenser"));

    let pantry: HashSet<String> = ["wheat_flour", "yeast", "oil"]
        .into_iter()
        .map(str::to_string)
        .collect();
    let hits = match_recipes(&catalog, &pantry, true);
    assert!(!hits.is_empty());
    assert!(hits.iter().all(|hit| hit.missing.len() <= 2));
    assert!(hits
        .iter()
        .any(|hit| hit.status == "near" || hit.status == "exact"));
    let strict = match_recipes(&catalog, &pantry, false);
    assert!(strict.iter().all(|hit| hit.missing.is_empty()));
    assert_eq!(
        resolve_ingredient_id(&catalog, "хлебопекарная мука").as_deref(),
        Some("wheat_flour")
    );
    assert_eq!(resolve_ingredient_id(&catalog, "нет такого"), None);

    let mid = (fin.min + fin.max) / 2.0;
    let biased = estimate_finished_weight(
        mass,
        p01.physics.bake_loss_range,
        Some(CalibrationBias {
            actual_finished_weight_g: mid * 1.08,
            predicted_mid: mid,
        }),
    );
    close(biased.min, fin.min * 1.08, "bias min");
    close(biased.max, fin.max * 1.08, "bias max");

    let names = build_shopping_list(&catalog, &hits);
    assert!(!names.is_empty());
}
