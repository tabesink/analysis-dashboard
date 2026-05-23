import asyncio
from pathlib import Path

from server.models.dashboard import EventsRequest
from server.routers.dashboard import get_events as dashboard_get_events
from server.services.etl import RSPConversionResult
from server.services.ingestion import FIXED_CHANNEL_MAP_PLOTS, IngestionService
from server.services.query import QueryService


def _make_ingestion_service(test_database, test_cache, test_settings) -> IngestionService:
    return IngestionService(test_database, test_cache, test_settings)


def _artifact_abs_path(test_settings, artifact: dict) -> Path:
    return test_settings.data_root / artifact["artifact_path"]


def _csv_with_detected_damage_channels() -> bytes:
    return b"""#HEADER
#TITLES
,,001_1 LF LCA OtrBJ P_UG_X Force,002_2 LF LCA OtrBJ P_UG_Y Force,003_3 LF ShockLwBsh P_UG_X Momt
#UNITS
,,N,N,Nmm
#DATATYPES
Huge,Double,Float,Float,Float
#DATA
1,0.000,100.0,200.0,300.0
2,0.001,101.0,201.0,301.0
3,0.002,102.0,202.0,302.0
"""


def test_ingest_forces_pending_for_non_admin(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("non_admin_uploader")

    result = service.ingest(
        files=[("event_non_admin.csv", sample_csv_content)],
        program_id="P-STATUS",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Approved",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-1", "work_order": "WO-1"},
    )

    assert result.success is True
    assert len(result.event_ids) == 1
    stored_event = test_database.get_event(result.event_ids[0])
    assert stored_event is not None
    assert stored_event.get("status") == "Pending"


def test_ingest_allows_admin_to_set_status(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("admin_uploader")

    result = service.ingest(
        files=[("event_admin.csv", sample_csv_content)],
        program_id="P-STATUS",
        version="V2",
        channel_map_content=sample_channel_map_content,
        status_value="Obsolete",
        is_admin=True,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-2", "work_order": "WO-2"},
    )

    assert result.success is True
    assert len(result.event_ids) == 1
    stored_event = test_database.get_event(result.event_ids[0])
    assert stored_event is not None
    assert stored_event.get("status") == "Obsolete"


def test_ingest_converts_rsp_before_csv_pipeline(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("rsp_uploader")
    phases: list[str] = []

    class StubRSPConverter:
        def convert(self, filename: str, content: bytes) -> RSPConversionResult:
            assert filename == "event_rsp.rsp"
            assert content == b"raw-rsp"
            return RSPConversionResult(
                filename="event_rsp.csv",
                content=sample_csv_content,
                row_count=10,
                channel_count=4,
            )

    service.rsp_converter = StubRSPConverter()

    result = service.ingest(
        files=[("event_rsp.rsp", b"raw-rsp")],
        program_id="P-RSP",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-RSP", "work_order": "WO-RSP"},
        on_phase_changed=phases.append,
    )

    assert result.success is True
    assert result.event_ids == ["event_rsp"]
    assert phases == ["converting", "validating"]

    stored_event = test_database.get_event("event_rsp")
    assert stored_event is not None
    assert stored_event.get("source_file") == "event_rsp.rsp"


def test_ingest_rejects_mixed_csv_and_rsp(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("mixed_uploader")

    result = service.ingest(
        files=[("event_csv.csv", sample_csv_content), ("event_rsp.rsp", b"raw-rsp")],
        program_id="P-MIXED",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-MIXED", "work_order": "WO-MIXED"},
    )

    assert result.success is False
    assert "only one data format" in (result.error or "")


def test_ingest_without_channel_map_retains_pending_artifact(
    test_database, test_cache, test_settings, sample_csv_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("pending_channel_map_uploader")

    result = service.ingest(
        files=[("event_pending.csv", sample_csv_content)],
        program_id="P-PENDING-MAP",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-PENDING", "work_order": "WO-PENDING"},
    )

    assert result.success is True
    assert result.pending_channel_map is True
    assert result.event_ids == []
    assert test_database.get_events(program_id="P-PENDING-MAP", version="V1") == []

    artifacts = test_database.list_ingestion_artifacts(
        program_id="P-PENDING-MAP",
        version="V1",
    )
    assert len(artifacts) == 1
    assert artifacts[0]["status"] == "pending"
    assert artifacts[0]["source_file"] == "event_pending.csv"


def test_saving_channel_map_processes_pending_artifact(
    test_database, test_cache, test_settings
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("channel_map_processor")
    service.ingest(
        files=[("event_pending_process.csv", _csv_with_detected_damage_channels())],
        program_id="P-PENDING-PROCESS",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-PROCESS", "work_order": "WO-PROCESS"},
    )

    entries = [
        {"plot_key": plot_key, "x_col": 2, "y_col": 3 if i % 2 == 0 else 4}
        for i, plot_key in enumerate(FIXED_CHANNEL_MAP_PLOTS)
    ]
    result = service.save_channel_map_and_process_artifacts(
        program_id="P-PENDING-PROCESS",
        version="V1",
        entries=entries,
        user_id=uploader["id"],
    )

    assert result["processed_count"] == 1
    assert result["failed_count"] == 0
    events = test_database.get_events(program_id="P-PENDING-PROCESS", version="V1")
    assert len(events) == 1
    artifacts = test_database.list_ingestion_artifacts(
        program_id="P-PENDING-PROCESS",
        version="V1",
    )
    assert artifacts[0]["status"] == "processed"
    assert artifacts[0]["event_id"] == events[0]["event_id"]

    series = QueryService(test_database, test_cache, test_settings).get_damage_channel_series(
        [events[0]["event_id"]]
    )
    assert [item["channel_key"] for item in series[:3]] == [
        "bj_x_force",
        "bj_y_force",
        "bj_z_force",
    ]
    assert series[0]["channel_name"] == "BJ X Force"
    assert series[-1]["channel_name"] == "Bushing R Z Momt"
    assert series[-1]["unit"] == "Nmm"


def test_scope_delete_removes_pending_only_artifact_file(
    test_database, test_cache, test_settings, sample_csv_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("scope_delete_pending_owner")
    service.ingest(
        files=[("event_pending_delete.csv", sample_csv_content)],
        program_id="P-SCOPE-PENDING",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-DELETE", "work_order": "WO-DELETE"},
    )
    artifact = test_database.list_ingestion_artifacts("P-SCOPE-PENDING", "V1")[0]
    artifact_path = _artifact_abs_path(test_settings, artifact)
    assert artifact_path.exists()

    result = test_database.hard_delete_program_version_scope("P-SCOPE-PENDING", "V1")

    assert result["event_count"] == 0
    assert result["artifact_count"] == 1
    assert result["deleted_files"] == 1
    assert test_database.list_ingestion_artifacts("P-SCOPE-PENDING", "V1") == []
    assert not artifact_path.exists()


def test_scope_delete_removes_processed_events_measurements_channel_map_and_artifact(
    test_database, test_cache, test_settings, sample_csv_content, sample_channel_map_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("scope_delete_processed_owner")
    result = service.ingest(
        files=[("event_processed_delete.csv", sample_csv_content)],
        program_id="P-SCOPE-PROCESSED",
        version="V1",
        channel_map_content=sample_channel_map_content,
        status_value="Approved",
        is_admin=True,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-DELETE", "work_order": "WO-DELETE"},
    )
    event_id = result.event_ids[0]
    artifact = test_database.list_ingestion_artifacts("P-SCOPE-PROCESSED", "V1")[0]
    artifact_path = _artifact_abs_path(test_settings, artifact)
    assert artifact_path.exists()
    assert test_database.get_event(event_id) is not None

    delete_result = test_database.hard_delete_program_version_scope("P-SCOPE-PROCESSED", "V1")

    assert delete_result["event_count"] == 1
    assert delete_result["raw_rows"] > 0
    assert delete_result["lttb_rows"] > 0
    assert delete_result["channel_map_rows"] > 0
    assert test_database.get_event(event_id) is None
    assert test_database.list_ingestion_artifacts("P-SCOPE-PROCESSED", "V1") == []
    assert not artifact_path.exists()
    assert (
        test_database.read_connection.execute(
            "SELECT COUNT(*) FROM dim_channel_map WHERE program_id = ? AND version = ?",
            ["P-SCOPE-PROCESSED", "V1"],
        ).fetchone()[0]
        == 0
    )


def test_program_scope_delete_removes_all_versions(
    test_database, test_cache, test_settings, sample_csv_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("scope_delete_program_owner")
    for version in ("V1", "V2"):
        service.ingest(
            files=[(f"event_{version}.csv", sample_csv_content)],
            program_id="P-SCOPE-PROGRAM",
            version=version,
            channel_map_content=None,
            status_value="Pending",
            is_admin=False,
            uploaded_by_user_id=uploader["id"],
            metadata={"job_number": "JOB-DELETE", "work_order": "WO-DELETE"},
        )

    result = test_database.hard_delete_program_version_scope("P-SCOPE-PROGRAM")

    assert result["artifact_count"] == 2
    assert test_database.list_ingestion_artifacts("P-SCOPE-PROGRAM") == []
    assert test_database.get_versions("P-SCOPE-PROGRAM") == []


def test_writer_delete_scope_requires_owning_everything(
    test_database, test_cache, test_settings, sample_csv_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    owner = test_database.create_user("scope_delete_owner")
    other_owner = test_database.create_user("scope_delete_other_owner")
    service.ingest(
        files=[("owner.csv", sample_csv_content)],
        program_id="P-SCOPE-MIXED",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=owner["id"],
        metadata={"job_number": "JOB-DELETE", "work_order": "WO-DELETE"},
    )
    service.ingest(
        files=[("other_owner.csv", sample_csv_content + b"\n")],
        program_id="P-SCOPE-MIXED",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=other_owner["id"],
        metadata={"job_number": "JOB-DELETE", "work_order": "WO-DELETE"},
    )

    assert (
        test_database.user_can_delete_program_version_scope(
            "P-SCOPE-MIXED",
            "V1",
            owner["id"],
            is_admin=False,
        )
        is False
    )
    assert (
        test_database.user_can_delete_program_version_scope(
            "P-SCOPE-MIXED",
            "V1",
            owner["id"],
            is_admin=True,
        )
        is True
    )


def test_get_all_events_marks_channel_map_missing_events_non_selectable(
    test_database, test_cache, test_settings
) -> None:
    query_service = QueryService(test_database, test_cache, test_settings)
    owner = test_database.create_user("channel_map_selectability_owner")
    test_database.insert_event(
        event_id="event-no-channel-map",
        program_id="P-SELECT",
        version="V-NO-MAP",
        uploaded_by_user_id=owner["id"],
        status="Pending",
    )
    test_database.insert_event(
        event_id="event-with-channel-map",
        program_id="P-SELECT",
        version="V-WITH-MAP",
        uploaded_by_user_id=owner["id"],
        status="Pending",
    )
    test_database.upsert_channel_map(
        "P-SELECT",
        "V-WITH-MAP",
        "plot_a",
        "time",
        "value",
        x_col=0,
        y_col=1,
    )

    payload = query_service.get_all_events(global_filters={}, limit=100, offset=0)
    by_id = {event["event_id"]: event for event in payload["events"]}

    assert by_id["event-no-channel-map"]["has_channel_map"] is False
    assert by_id["event-no-channel-map"]["selectable_for_plotting"] is False
    assert by_id["event-with-channel-map"]["has_channel_map"] is True
    assert by_id["event-with-channel-map"]["selectable_for_plotting"] is True


def test_get_all_events_scoped_query_excludes_pending_placeholder_rows(
    test_database, test_cache, test_settings, sample_csv_content
) -> None:
    service = _make_ingestion_service(test_database, test_cache, test_settings)
    uploader = test_database.create_user("scoped_events_uploader")
    service.ingest(
        files=[("event_pending_scope.csv", sample_csv_content)],
        program_id="P-SCOPED",
        version="V1",
        channel_map_content=None,
        status_value="Pending",
        is_admin=False,
        uploaded_by_user_id=uploader["id"],
        metadata={"job_number": "JOB-SCOPE", "work_order": "WO-SCOPE"},
    )
    query_service = QueryService(test_database, test_cache, test_settings)

    unscoped = query_service.get_all_events(global_filters={}, limit=100, offset=0)
    scoped = query_service.get_all_events(
        program_ids=["P-SCOPED"],
        versions=["V1"],
        global_filters={},
        limit=100,
        offset=0,
    )

    assert any(
        event["event_id"] == "__pending_channel_map__::P-SCOPED::V1"
        for event in unscoped["events"]
    )
    assert scoped["events"] == []
    assert scoped["total_count"] == 0


def test_dashboard_events_mapper_preserves_selectability_flags() -> None:
    class QueryServiceStub:
        def get_all_events(
            self,
            program_ids: list[str] | None = None,
            versions: list[str] | None = None,
            global_filters: dict[str, list[str] | str] | None = None,
            limit: int = 100,
            offset: int = 0,
        ) -> dict[str, object]:
            del program_ids, versions, global_filters, limit, offset
            return {
                "events": [
                    {
                        "event_id": "__pending_channel_map__::0000::00",
                        "program_id": "0000",
                        "version": "00",
                        "status": "Pending",
                        "has_channel_map": False,
                        "missing_channel_map": True,
                        "selectable_for_plotting": False,
                    }
                ],
                "total_count": 1,
                "has_more": False,
            }

    response = asyncio.run(
        dashboard_get_events(
            request=EventsRequest(global_filters={}),
            query_service=QueryServiceStub(),  # type: ignore[arg-type]
            limit=100,
            offset=0,
        )
    )
    assert len(response.events) == 1
    assert response.events[0].has_channel_map is False
    assert response.events[0].missing_channel_map is True
    assert response.events[0].selectable_for_plotting is False
