use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Рецепт не найден: {0}")]
    RecipeNotFound(String),
    #[error("Некорректные данные: {0}")]
    Invalid(String),
    #[error("Файл слишком большой")]
    TooLarge,
    #[error("Это не экспорт BreadLab")]
    NotBreadLab,
    #[error("Пустой файл")]
    Empty,
    #[error("Не удалось прочитать файл: {0}")]
    Io(#[from] std::io::Error),
    #[error("Повреждённый JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("{0}")]
    Message(String),
}

impl From<AppError> for String {
    fn from(value: AppError) -> Self {
        value.to_string()
    }
}
