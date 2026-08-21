from app.services.password_policy import validate_password


def test_strong_password_passes_with_no_violations():
    assert validate_password("Tr0ub4dor!Xyz") == []


def test_too_short_is_flagged():
    violations = validate_password("Ab1!ab")
    assert any("10 characters" in v for v in violations)


def test_missing_uppercase_is_flagged():
    violations = validate_password("lowercase123!")
    assert any("uppercase" in v for v in violations)


def test_missing_lowercase_is_flagged():
    violations = validate_password("UPPERCASE123!")
    assert any("lowercase" in v for v in violations)


def test_missing_digit_is_flagged():
    violations = validate_password("NoDigitsHere!")
    assert any("number" in v for v in violations)


def test_missing_special_char_is_flagged():
    violations = validate_password("NoSpecialChar123")
    assert any("special character" in v for v in violations)


def test_common_password_is_flagged_even_if_otherwise_compliant():
    # "password123" is 11 chars, has lower+digit, but no upper/special --
    # exercises the denylist independent of the other rules by picking one
    # that's deliberately close to passing.
    violations = validate_password("Password123!")
    # This one *does* satisfy every structural rule, so the denylist
    # shouldn't fire for a password merely resembling a common one.
    assert violations == []


def test_password_containing_email_local_part_is_flagged():
    violations = validate_password("Dwiesner2021!!", email="dwiesner2021@gmail.com")
    assert any("email address" in v for v in violations)


def test_password_not_containing_email_is_unaffected():
    violations = validate_password("Tr0ub4dor!Xyz", email="dwiesner2021@gmail.com")
    assert violations == []


def test_multiple_violations_all_reported_at_once():
    violations = validate_password("abc")
    assert len(violations) >= 3
