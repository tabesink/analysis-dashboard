import pandas as pd
from server.services.etl.transformer import DataTransformer


def test_transformer_stores_only_channel_map_columns() -> None:
    df = pd.DataFrame(
        [
            [1, 0.0, 10.0, 20.0, 30.0, 40.0],
            [2, 0.1, 11.0, 21.0, 31.0, 41.0],
        ],
        columns=[
            "Index",
            "Time",
            "001_1 LF LCA OtrBJ P_UG_X Force",
            "002_2 LF LCA OtrBJ P_UG_Y Force",
            "003_3 LF LCA OtrBJ P_UG_Z Force",
            "004_4 LF ShockLwBsh P_UG_X Momt",
        ],
    )

    transformed = DataTransformer().transform_to_long(
        df,
        channel_map={
            "bj_xy_force_plot": {"x_col": 2, "y_col": 3},
            "bj_xz_force_plot": {"x_col": 2, "y_col": 4},
        },
    )

    assert transformed.columns.tolist() == ["timestamp", "channel_name", "value"]
    assert transformed["channel_name"].drop_duplicates().tolist() == [
        "001_1 LF LCA OtrBJ P_UG_X Force",
        "002_2 LF LCA OtrBJ P_UG_Y Force",
        "003_3 LF LCA OtrBJ P_UG_Z Force",
    ]


def test_transformer_deduplicates_shared_plot_columns() -> None:
    df = pd.DataFrame(
        [
            [1, 0.0, 10.0, 20.0, 30.0],
            [2, 0.1, 11.0, 21.0, 31.0],
        ],
        columns=["", "", "001_1 LF LCA OtrBJ P_UG_X Force", "Road Load", "P_UG_X Disp"],
    )

    transformed = DataTransformer().transform_to_long(
        df,
        channel_map={
            "plot_a": {"x_col": 2, "y_col": 3},
            "plot_b": {"x_col": 2, "y_col": 3},
        },
    )

    assert transformed["channel_name"].drop_duplicates().tolist() == [
        "001_1 LF LCA OtrBJ P_UG_X Force",
        "Road Load",
    ]
