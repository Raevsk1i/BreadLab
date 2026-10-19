#![allow(clippy::field_reassign_with_default)]

use breadlab::models::UserState;
use breadlab::services::persistence::{
    export_value, is_breadlab_import, load_dir, merge_import, prepare_for_save, read_import_file,
    save_dir, write_export,
};
use serde_json::json;

#[test]
fn import_rejects_invalid_shapes() {
    assert!(!is_breadlab_import(&json!({})));
    assert!(!is_breadlab_import(&json!([])));
    assert!(!is_breadlab_import(&json!("BreadLab")));
    assert!(is_breadlab_import(
        &json!({"app": "BreadLab", "pantry": {}})
    ));
    assert!(is_breadlab_import(
        &json!({"pantry": {"wheat_flour": true}})
    ));
    assert!(is_breadlab_import(&json!({"checklist": {}})));
}

#[test]
fn export_roundtrip_keeps_user_fields() {
    let dir = std::env::temp_dir().join(format!("breadlab-rt-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let mut state = UserState::default();
    state.pantry.insert("wheat_flour".into(), true);
    state.favorites = vec!["p16".into()];
    state.recent = vec!["p01".into(), "p16".into()];
    state.addins_by_recipe.insert(
        "p01".into(),
        indexmap::IndexMap::from([("walnut".into(), true)]),
    );
    state.addins_by_recipe.insert(
        "p27".into(),
        indexmap::IndexMap::from([("cheese_add".into(), true)]),
    );
    state.enabled_taste_addins.insert("walnut".into(), true);
    state.cook_session = Some(breadlab::models::CookSession {
        recipe_id: "p01".into(),
        machine_id: Some("panasonic_sd_yr2540hts".into()),
        step_index: 3,
        timer_id: Some("cycle".into()),
        ck_key: Some("p01::panasonic_sd_yr2540hts::addins:".into()),
        remaining_ms: Some(90_000.0),
        running: true,
    });
    state.selected_recipe_id = Some("p01".into());
    state.target_flour_g = 400.0;
    state.catalog_favorites_only = true;
    prepare_for_save(&mut state);
    assert!(!state.cook_session.as_ref().unwrap().running);

    let path = dir.join("breadlab-export.json");
    write_export(&path, &state, "1.0.0").unwrap();
    let raw = read_import_file(&path).unwrap();
    assert_eq!(raw.get("app").and_then(|v| v.as_str()), Some("BreadLab"));
    let mut restored = UserState::default();
    merge_import(&mut restored, &raw).unwrap();
    assert_eq!(restored.favorites, vec!["p16".to_string()]);
    assert_eq!(restored.pantry.get("wheat_flour"), Some(&true));
    assert_eq!(
        restored.addins_by_recipe.get("p01").unwrap().get("walnut"),
        Some(&true)
    );
    assert_eq!(
        restored
            .addins_by_recipe
            .get("p27")
            .unwrap()
            .get("cheese_add"),
        Some(&true)
    );
    assert_eq!(restored.cook_session.as_ref().unwrap().step_index, 3);
    assert_eq!(
        restored.cook_session.as_ref().unwrap().remaining_ms,
        Some(90_000.0)
    );
    assert!(!restored.cook_session.as_ref().unwrap().running);
    assert!(restored.catalog_favorites_only);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn state_survives_restart_and_corrupt_primary() {
    let dir = std::env::temp_dir().join(format!("breadlab-state-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    let mut state = UserState::default();
    state.favorites = vec!["p15".into()];
    state.target_flour_g = 500.0;
    save_dir(&dir, &state).unwrap();
    state.target_flour_g = 510.0;
    save_dir(&dir, &state).unwrap();
    let loaded = load_dir(&dir);
    assert!(loaded.notice.is_none());
    assert_eq!(loaded.state.favorites, vec!["p15".to_string()]);
    assert_eq!(loaded.state.target_flour_g, 510.0);

    let backup = std::fs::read(dir.join("state.backup.json")).unwrap();
    std::fs::write(dir.join("state.json"), b"{not json").unwrap();
    let recovered = load_dir(&dir);
    assert!(recovered.notice.unwrap().contains("резервн"));
    assert_eq!(recovered.state.favorites, vec!["p15".to_string()]);
    assert_eq!(recovered.state.target_flour_g, 500.0);
    assert_eq!(
        std::fs::read(dir.join("state.backup.json")).unwrap(),
        backup
    );

    let mut next = recovered.state;
    next.favorites = vec!["p02".into()];
    save_dir(&dir, &next).unwrap();
    let again = load_dir(&dir);
    assert_eq!(again.state.favorites, vec!["p02".to_string()]);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn import_file_rejects_garbage_and_huge_payload() {
    let dir = std::env::temp_dir().join(format!("breadlab-bad-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let empty = dir.join("empty.json");
    std::fs::write(&empty, b"   ").unwrap();
    assert!(read_import_file(&empty).is_err());
    let array = dir.join("array.json");
    std::fs::write(&array, b"[]").unwrap();
    assert!(read_import_file(&array).is_err());
    let huge = dir.join("huge.json");
    std::fs::write(&huge, vec![b' '; 2_100_000]).unwrap();
    assert!(read_import_file(&huge).is_err());
    let legacy = dir.join("legacy.json");
    std::fs::write(
        &legacy,
        br#"{"app":"BreadLab","pantry":{"yeast":true},"favorites":["p16"]}"#,
    )
    .unwrap();
    let mut state = UserState::default();
    merge_import(&mut state, &read_import_file(&legacy).unwrap()).unwrap();
    assert_eq!(state.favorites, vec!["p16".to_string()]);
    assert_eq!(state.pantry.get("yeast"), Some(&true));
    let _ = export_value(&state, "1.0.0").unwrap();
    let _ = std::fs::remove_dir_all(&dir);
}
