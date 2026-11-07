import pytest


@pytest.fixture(autouse=True)
def isolated_user_projects(tmp_path, monkeypatch):
    """Never let tests read or write the real user_projects directory."""
    monkeypatch.setenv("HOMEFORGE_USER_PROJECTS_DIR", str(tmp_path / "user_projects"))
