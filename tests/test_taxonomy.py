from meltwater_excel.taxonomy import contains_term, is_noise_match, load_insight_config, topic_matches


def test_default_insight_config_loads_project_taxonomies(project_root):
    config = load_insight_config(project_root / "config" / "insights")

    topic_ids = {topic.id for topic in config.topics}
    brand_ids = {brand.id for brand in config.brands}

    assert "suction_performance" in topic_ids
    assert "momcozy" in brand_ids
    assert config.thresholds.search_precision_min == 0.8
    assert is_noise_match("暖奶器", ["a teddy bear in a warm home"], config.query_noise) == "teddy bear"


def test_term_matching_uses_word_boundaries_for_ascii_terms(project_root):
    config = load_insight_config(project_root / "config" / "insights")
    suction = next(topic for topic in config.topics if topic.id == "suction_performance")

    assert contains_term("weak suction reported", "suction")
    assert not contains_term("campaign performance", "pain")
    assert topic_matches(suction, ["the pump has weak suction"]) == "suction"

