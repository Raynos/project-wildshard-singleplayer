"""Batch/CI disk-product dependencies; never run at live pre-push."""
import re


def required_test_products(tests, registry):
    """Explicit disk-product edges, including tests whose imports cannot name them."""
    products = set()
    for test in tests:
        if re.fullmatch(r'test/scripts/[^/]+\.test\.ts', test) and test not in registry:
            raise ValueError('Register disk scenario products before gating: ' + test)
        products.update(registry.get(test, []))
    return sorted(products)


def custom_section_growth_command(tree, repo, base, sha, common):
    """Only the immutable carrier's checker can vouch for its products."""
    growth = tree / 'scripts/check-custom-section-growth.mjs'
    if not growth.is_file():
        return None
    return ['node', str(growth), str(repo), base, sha,
            str(common / 'custom-section-measures')]

