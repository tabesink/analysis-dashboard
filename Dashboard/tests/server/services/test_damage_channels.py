from server.services.damage_channels import (
    DamageChannelSpec,
    derive_damage_channel_specs,
    resolve_damage_channel_name,
)


def _channel_map_rows() -> list[dict]:
    return [
        {
            "plot_key": "bj_xy_force_plot",
            "x_col": 2,
            "y_col": 3,
            "x_channel": "BJ X Raw",
            "y_channel": "BJ Y Raw",
            "x_unit": "N",
            "y_unit": "N",
        },
        {
            "plot_key": "bj_xz_force_plot",
            "x_col": 2,
            "y_col": 4,
            "x_channel": "BJ X Raw",
            "y_channel": "BJ Z Raw",
            "x_unit": "N",
            "y_unit": "N",
        },
        {
            "plot_key": "shock_xy_force_plot",
            "x_col": 20,
            "y_col": 21,
            "x_channel": "Shock X Raw",
            "y_channel": "Shock Y Raw",
        },
        {
            "plot_key": "shock_xz_force_plot",
            "x_col": 20,
            "y_col": 22,
            "x_channel": "Shock X Raw",
            "y_channel": "Shock Z Raw",
        },
        {
            "plot_key": "bushing_f_xy_force_plot",
            "x_col": 8,
            "y_col": 9,
            "x_channel": "Bushing F X Raw",
            "y_channel": "Bushing F Y Raw",
        },
        {
            "plot_key": "bushing_f_xz_force_plot",
            "x_col": 8,
            "y_col": 10,
            "x_channel": "Bushing F X Raw",
            "y_channel": "Bushing F Z Raw",
        },
        {
            "plot_key": "bushing_r_xy_force_plot",
            "x_col": 14,
            "y_col": 15,
            "x_channel": "Bushing R X Raw",
            "y_channel": "Bushing R Y Raw",
        },
        {
            "plot_key": "bushing_r_xz_force_plot",
            "x_col": 14,
            "y_col": 16,
            "x_channel": "Bushing R X Raw",
            "y_channel": "Bushing R Z Raw",
        },
    ]


def test_derive_damage_channel_specs_from_plot_pairs() -> None:
    specs = derive_damage_channel_specs(_channel_map_rows())

    assert [(spec.key, spec.label, spec.channel_name) for spec in specs] == [
        ("bj_x_force", "BJ X Force", "BJ X Raw"),
        ("bj_y_force", "BJ Y Force", "BJ Y Raw"),
        ("bj_z_force", "BJ Z Force", "BJ Z Raw"),
        ("shock_x_force", "Shock X Force", "Shock X Raw"),
        ("shock_y_force", "Shock Y Force", "Shock Y Raw"),
        ("shock_z_force", "Shock Z Force", "Shock Z Raw"),
        ("bushing_f_x_momt", "Bushing F X Momt", "Bushing F X Raw"),
        ("bushing_f_y_momt", "Bushing F Y Momt", "Bushing F Y Raw"),
        ("bushing_f_z_momt", "Bushing F Z Momt", "Bushing F Z Raw"),
        ("bushing_r_x_momt", "Bushing R X Momt", "Bushing R X Raw"),
        ("bushing_r_y_momt", "Bushing R Y Momt", "Bushing R Y Raw"),
        ("bushing_r_z_momt", "Bushing R Z Momt", "Bushing R Z Raw"),
    ]


def test_derive_damage_channel_specs_marks_shared_x_mismatch_unavailable() -> None:
    rows = _channel_map_rows()
    rows[1] = {**rows[1], "x_col": 99}

    specs = derive_damage_channel_specs(rows)

    assert specs[0].error is not None
    assert specs[1].error == specs[0].error
    assert specs[2].error == specs[0].error
    assert specs[3].error is None


def test_resolve_damage_channel_name_matches_known_lca_patterns() -> None:
    raw_names = [
        "(LCA) LtFr LCA Balljoint Load (X)",
        "1 LF LBJ - Fy",
        "003_3 LF LCA OtrBJ P_UG_Z Force",
        "(LCA) LtFr Shock Lower Mount Load (X)",
        "5 LF SHK LWR MNT - Fy",
        "021_21 LF ShockLwBsh P_UG_Z Force",
        "(LCA) LtFr LCA Front Attachment Load (X)",
        "11 LF LCA FRONT BUSH - Fy",
        "012_12 LF LCABushingF P_UG_Z Momt",
        "(LCA) LtFr LCA Rear Attachment Load (X)",
        "17 LF LCA REAR BUSH - Fy",
        "018_18 LF LCABushingR P_UG_Z Momt",
    ]

    cases = {
        "bj_x_force": "(LCA) LtFr LCA Balljoint Load (X)",
        "bj_y_force": "1 LF LBJ - Fy",
        "bj_z_force": "003_3 LF LCA OtrBJ P_UG_Z Force",
        "shock_x_force": "(LCA) LtFr Shock Lower Mount Load (X)",
        "shock_y_force": "5 LF SHK LWR MNT - Fy",
        "shock_z_force": "021_21 LF ShockLwBsh P_UG_Z Force",
        "bushing_f_x_momt": "(LCA) LtFr LCA Front Attachment Load (X)",
        "bushing_f_y_momt": "11 LF LCA FRONT BUSH - Fy",
        "bushing_f_z_momt": "012_12 LF LCABushingF P_UG_Z Momt",
        "bushing_r_x_momt": "(LCA) LtFr LCA Rear Attachment Load (X)",
        "bushing_r_y_momt": "17 LF LCA REAR BUSH - Fy",
        "bushing_r_z_momt": "018_18 LF LCABushingR P_UG_Z Momt",
    }

    for key, expected in cases.items():
        resolution = resolve_damage_channel_name(
            DamageChannelSpec(
                key=key,
                label=key,
                plot_key="legacy_plot",
                axis="x",
                channel_name="col_2",
                unit=None,
            ),
            raw_names,
        )

        assert resolution.channel_name == expected
        assert resolution.error is None


def test_resolve_damage_channel_name_matches_underscore_abbreviations() -> None:
    raw_names = [
        "1 LF LCA Ball_Jnt P_UG_X Force",
        "10 LF LCA Front_Bsh P_UG_X Force",
        "16 LF LCA Rear_Bsh P_UG_X Force",
    ]

    for key, expected in {
        "bj_x_force": "1 LF LCA Ball_Jnt P_UG_X Force",
        "bushing_f_x_momt": "10 LF LCA Front_Bsh P_UG_X Force",
        "bushing_r_x_momt": "16 LF LCA Rear_Bsh P_UG_X Force",
    }.items():
        resolution = resolve_damage_channel_name(
            DamageChannelSpec(
                key=key,
                label=key,
                plot_key="legacy_plot",
                axis="x",
                channel_name="col_2",
                unit=None,
            ),
            raw_names,
        )

        assert resolution.channel_name == expected
        assert resolution.error is None


def test_resolve_damage_channel_name_rejects_ambiguous_matches() -> None:
    resolution = resolve_damage_channel_name(
        DamageChannelSpec(
            key="bj_x_force",
            label="BJ X Force",
            plot_key="bj_xy_force_plot",
            axis="x",
            channel_name="col_2",
            unit=None,
        ),
        [
            "(LCA) LtFr LCA Balljoint Load (X)",
            "(LCA) RtFr LCA Balljoint Load (X)",
        ],
    )

    assert resolution.channel_name is None
    assert resolution.error is not None
    assert "Multiple raw measurement channels matched" in resolution.error
