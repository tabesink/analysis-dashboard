import pandas as pd

from server.services.etl import CSVParser, RSPConverter


def test_rsp_converter_outputs_tagged_csv(monkeypatch) -> None:
    converter = RSPConverter()

    def load_stub(_path):
        return (
            pd.DataFrame([[10.0, 20.0], [11.0, 21.0]]),
            [
                {"Description": "Force_X", "Units": "N"},
                {"Description": "Force_Y", "Units": "N"},
            ],
            {"DELTA_T": "0.25"},
        )

    monkeypatch.setattr(converter, "_load_via_rpc_reader", load_stub)

    result = converter.convert("event_rsp.rsp", b"raw-rsp")
    parsed = CSVParser().parse(result.content, result.filename)

    assert result.filename == "event_rsp.csv"
    assert result.row_count == 2
    assert result.channel_count == 2
    assert parsed.is_valid is True
    assert list(parsed.dataframe.columns) == ["", "", "1 Force_X", "2 Force_Y"]
    assert parsed.dataframe.iloc[0, 1] == 0.0
    assert parsed.dataframe.iloc[1, 1] == 0.25
