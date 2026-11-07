import copy

from backend.main import load_case_study
from backend.models import CompareRequest


def concept_request(**changes) -> dict:
    """The illustrative 6/8/10 concept inputs (plan §4 fixture) as a JSON-able dict."""
    cs = load_case_study()
    req = copy.deepcopy({k: cs[k] for k in ("candidate_home_counts", "household", "development", "funding_sources")})
    for dotted, value in changes.items():
        section, key = dotted.split("__")
        req[section][key] = value
    return req


def concept(**changes) -> CompareRequest:
    return CompareRequest.model_validate(concept_request(**changes))
