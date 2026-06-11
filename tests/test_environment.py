def test_runtime_dependencies_are_available():
    import ijson
    import openpyxl

    assert ijson.__version__
    assert openpyxl.__version__

