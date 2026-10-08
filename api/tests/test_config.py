from app.core.config import Settings


def test_cors_origins_defaults_to_any_origin():
    assert Settings(_env_file=None).cors_origins == ["*"]


def test_cors_origins_splits_and_trims_comma_separated_list():
    settings = Settings(
        _env_file=None,
        cors_allow_origins=" https://biolens-web.onrender.com/ , https://biolens.app ",
    )
    assert settings.cors_origins == ["https://biolens-web.onrender.com", "https://biolens.app"]
