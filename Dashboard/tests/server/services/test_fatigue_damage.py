import math

import numpy as np
from server.services.fatigue_damage import ChannelSeries, FatigueDamageCalculator


def test_calculator_reproduces_notebook_method_for_one_channel() -> None:
    signal = 1000.0 * np.sin(np.linspace(0, 8 * np.pi, 200))

    result = FatigueDamageCalculator().calculate_channel(
        ChannelSeries(
            channel_key="Ch01",
            channel_name="LF LCA Force X",
            unit="N",
            values=signal,
        )
    )

    assert result.channel_key == "Ch01"
    assert result.channel_name == "LF LCA Force X"
    assert result.unit == "N"
    assert result.status == "ok"
    assert result.error is None
    assert result.damage is not None
    assert math.isclose(result.damage, 0.007407359018192371, rel_tol=1e-9)
