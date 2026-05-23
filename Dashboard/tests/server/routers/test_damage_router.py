from __future__ import annotations

import math

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from tests.server.routers.conftest import login


def test_damage_inspect_returns_per_channel_damage(auth_client: TestClient) -> None:
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "damage_user", "password": "damagepassword123"},
    )
    assert register.status_code == 201, register.text
    owner_id = register.json()["id"]
    login(auth_client, "damage_user", "damagepassword123")

    auth_client.app.state.db.insert_event(
        event_id="event-damage-1",
        program_id="P-DMG",
        version="V1",
        uploaded_by_user_id=owner_id,
        status="Approved",
        job_number="JOB-1",
        work_order="WO-1",
    )
    for order, (plot_key, x_name, y_name, x_col, y_col) in enumerate(
        [
            ("bj_xy_force_plot", "BJ X Raw", "BJ Y Raw", 2, 3),
            ("bj_xz_force_plot", "BJ X Raw", "BJ Z Raw", 2, 4),
            ("shock_xy_force_plot", "Shock X Raw", "Shock Y Raw", 20, 21),
            ("shock_xz_force_plot", "Shock X Raw", "Shock Z Raw", 20, 22),
            ("bushing_f_xy_force_plot", "Bushing F X Raw", "Bushing F Y Raw", 8, 9),
            ("bushing_f_xz_force_plot", "Bushing F X Raw", "Bushing F Z Raw", 8, 10),
            ("bushing_r_xy_force_plot", "Bushing R X Raw", "Bushing R Y Raw", 14, 15),
            ("bushing_r_xz_force_plot", "Bushing R X Raw", "Bushing R Z Raw", 14, 16),
        ]
    ):
        auth_client.app.state.db.upsert_channel_map(
            "P-DMG",
            "V1",
            plot_key,
            x_name,
            y_name,
            plot_order=order,
            x_col=x_col,
            y_col=y_col,
            x_unit="N",
            y_unit="N",
        )
    signal = 1000.0 * np.sin(np.linspace(0, 8 * np.pi, 200))
    measurements = pd.DataFrame(
        {
            "timestamp": list(range(len(signal))),
            "channel_name": ["BJ X Raw"] * len(signal),
            "value": signal,
        }
    )
    auth_client.app.state.db.insert_measurements("event-damage-1", measurements)

    response = auth_client.post(
        "/api/v1/damage/inspect",
        json={"event_ids": ["event-damage-1"]},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["channels"][0] == {
        "channel_key": "bj_x_force",
        "channel_name": "BJ X Force",
        "unit": "N",
    }
    assert body["rows"][0]["event_id"] == "event-damage-1"
    assert body["rows"][0]["job_number"] == "JOB-1"
    assert body["rows"][0]["work_order"] == "WO-1"
    assert body["rows"][0]["program_id"] == "P-DMG"
    result = body["rows"][0]["damages"]["bj_x_force"]
    assert result["status"] == "ok"
    assert result["error"] is None
    assert math.isclose(result["damage"], 0.007407359018192371, rel_tol=1e-9)

