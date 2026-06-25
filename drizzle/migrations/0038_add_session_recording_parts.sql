BEGIN;

-- Keep zuvy_session_recordings as the single parent/job row per session +
-- Zoom meeting, and store each Zoom recording.completed UUID as a child part.
CREATE TABLE IF NOT EXISTS zuvy_session_recording_parts (
    id SERIAL PRIMARY KEY,
    session_recording_id INTEGER REFERENCES zuvy_session_recordings (id) ON DELETE CASCADE,
    session_id INTEGER NOT NULL REFERENCES zuvy_sessions (id) ON DELETE CASCADE,
    zoom_meeting_id TEXT NOT NULL,
    zoom_meeting_uuid TEXT NOT NULL,
    zoom_recording_id TEXT,
    zoom_recording_manifest JSONB NOT NULL DEFAULT '[]'::jsonb,
    local_segment_paths JSONB,
    merged_file_path TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'DISCOVERED',
    recording_start TIMESTAMPTZ,
    recording_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

WITH
    parent_choice AS (
        SELECT
            id,
            session_id,
            zoom_meeting_id,
            ROW_NUMBER() OVER (
                PARTITION BY
                    session_id,
                    zoom_meeting_id
                ORDER BY
                    CASE
                        WHEN status = 'COMPLETED' THEN 0
                        WHEN drive_file_id IS NOT NULL THEN 1
                        WHEN is_final_merged = TRUE THEN 2
                        WHEN merged_file_path IS NOT NULL THEN 3
                        ELSE 4
                    END,
                    updated_at DESC NULLS LAST,
                    created_at DESC NULLS LAST,
                    id DESC
            ) AS rn
        FROM
            zuvy_session_recordings
    ),
    parent_survivor AS (
        SELECT
            id,
            session_id,
            zoom_meeting_id
        FROM
            parent_choice
        WHERE
            rn = 1
    )
INSERT INTO
    zuvy_session_recording_parts (
        session_recording_id,
        session_id,
        zoom_meeting_id,
        zoom_meeting_uuid,
        zoom_recording_id,
        zoom_recording_manifest,
        local_segment_paths,
        merged_file_path,
        status,
        recording_start,
        recording_end,
        created_at,
        updated_at
    )
SELECT
    ps.id,
    r.session_id,
    r.zoom_meeting_id,
    r.zoom_meeting_uuid,
    r.zoom_recording_id,
    COALESCE(r.zoom_recording_manifest, '[]'::jsonb),
    r.local_segment_paths,
    r.merged_file_path,
    r.status,
    r.recording_start,
    r.recording_end,
    r.created_at,
    r.updated_at
FROM
    zuvy_session_recordings r
    JOIN parent_survivor ps ON ps.session_id = r.session_id
    AND ps.zoom_meeting_id = r.zoom_meeting_id
WHERE
    r.zoom_meeting_uuid IS NOT NULL
ON CONFLICT DO NOTHING;

WITH
    ranked AS (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY
                    session_id,
                    zoom_meeting_id
                ORDER BY
                    CASE
                        WHEN status = 'COMPLETED' THEN 0
                        WHEN drive_file_id IS NOT NULL THEN 1
                        WHEN is_final_merged = TRUE THEN 2
                        WHEN merged_file_path IS NOT NULL THEN 3
                        ELSE 4
                    END,
                    updated_at DESC NULLS LAST,
                    created_at DESC NULLS LAST,
                    id DESC
            ) AS rn
        FROM
            zuvy_session_recordings
    )
DELETE FROM zuvy_session_recordings r USING ranked d
WHERE
    r.id = d.id
    AND d.rn > 1;

DROP INDEX IF EXISTS idx_session_recordings_session_meeting;
DROP INDEX IF EXISTS idx_session_recordings_final_merge;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_session_recording_meeting ON zuvy_session_recordings (session_id, zoom_meeting_id);

WITH
    ranked AS (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY
                    session_id,
                    zoom_meeting_uuid
                ORDER BY
                    CASE
                        WHEN status = 'COMPLETED' THEN 0
                        WHEN merged_file_path IS NOT NULL THEN 1
                        ELSE 2
                    END,
                    updated_at DESC NULLS LAST,
                    created_at DESC NULLS LAST,
                    id DESC
            ) AS rn
        FROM
            zuvy_session_recording_parts
    )
DELETE FROM zuvy_session_recording_parts p USING ranked d
WHERE
    p.id = d.id
    AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_session_recording_part_uuid ON zuvy_session_recording_parts (session_id, zoom_meeting_uuid);

CREATE INDEX IF NOT EXISTS idx_session_recording_parts_parent ON zuvy_session_recording_parts (session_recording_id);

CREATE INDEX IF NOT EXISTS idx_session_recording_parts_session_meeting ON zuvy_session_recording_parts (session_id, zoom_meeting_id);

WITH
    webhook_mp4_files AS (
        SELECT
            r.id AS session_recording_id,
            s.id AS session_id,
            e.meeting_id AS zoom_meeting_id,
            e.payload #>> '{payload,object,uuid}' AS zoom_meeting_uuid,
            e.payload #>> '{payload,object,start_time}' AS event_start_time,
            file.value AS file
        FROM
            zuvy_zoom_webhook_events e
            JOIN zuvy_sessions s ON s.zoom_meeting_id = e.meeting_id
            JOIN zuvy_session_recordings r ON r.session_id = s.id
            AND r.zoom_meeting_id = e.meeting_id
            CROSS JOIN LATERAL jsonb_array_elements(
                COALESCE(
                    e.payload #> '{payload,object,recording_files}',
                    '[]'::jsonb
                )
            ) AS file(value)
        WHERE
            e.event_type = 'recording.completed'
            AND e.payload #>> '{payload,object,uuid}' IS NOT NULL
            AND file.value ->> 'file_type' = 'MP4'
    ),
    webhook_parts AS (
        SELECT
            session_recording_id,
            session_id,
            zoom_meeting_id,
            zoom_meeting_uuid,
            jsonb_agg(
                jsonb_build_object(
                    'id',
                    file ->> 'id',
                    'download_url',
                    file ->> 'download_url',
                    'file_type',
                    file ->> 'file_type',
                    'file_size',
                    file -> 'file_size',
                    'recording_type',
                    file ->> 'recording_type',
                    'recording_start',
                    file ->> 'recording_start',
                    'recording_end',
                    file ->> 'recording_end',
                    'meeting_uuid',
                    zoom_meeting_uuid
                )
                ORDER BY
                    file ->> 'recording_start',
                    file ->> 'recording_end',
                    file ->> 'id'
            ) AS manifest,
            MIN(file ->> 'id') AS zoom_recording_id,
            MIN((file ->> 'recording_start')::timestamptz) AS recording_start,
            MAX((file ->> 'recording_end')::timestamptz) AS recording_end
        FROM
            webhook_mp4_files
        GROUP BY
            session_recording_id,
            session_id,
            zoom_meeting_id,
            zoom_meeting_uuid
    )
INSERT INTO
    zuvy_session_recording_parts (
        session_recording_id,
        session_id,
        zoom_meeting_id,
        zoom_meeting_uuid,
        zoom_recording_id,
        zoom_recording_manifest,
        status,
        recording_start,
        recording_end
    )
SELECT
    session_recording_id,
    session_id,
    zoom_meeting_id,
    zoom_meeting_uuid,
    zoom_recording_id,
    manifest,
    'DISCOVERED',
    recording_start,
    recording_end
FROM
    webhook_parts
ON CONFLICT (session_id, zoom_meeting_uuid)
DO UPDATE SET
    session_recording_id = EXCLUDED.session_recording_id,
    zoom_recording_id = EXCLUDED.zoom_recording_id,
    zoom_recording_manifest = EXCLUDED.zoom_recording_manifest,
    recording_start = EXCLUDED.recording_start,
    recording_end = EXCLUDED.recording_end,
    updated_at = NOW();

WITH
    part_segments AS (
        SELECT
            p.session_recording_id,
            segment.value AS segment
        FROM
            zuvy_session_recording_parts p
            CROSS JOIN LATERAL jsonb_array_elements(p.zoom_recording_manifest) AS segment(value)
    ),
    aggregate_manifest AS (
        SELECT
            session_recording_id,
            jsonb_agg(
                segment
                ORDER BY
                    segment ->> 'recording_start',
                    segment ->> 'recording_end',
                    segment ->> 'id'
            ) AS manifest,
            MIN((segment ->> 'recording_start')::timestamptz) AS recording_start,
            MAX((segment ->> 'recording_end')::timestamptz) AS recording_end,
            COUNT(*) AS segments_count
        FROM
            part_segments
        GROUP BY
            session_recording_id
    )
UPDATE zuvy_session_recordings r
SET
    zoom_recording_id = aggregate_manifest.manifest -> 0 ->> 'id',
    zoom_recording_manifest = aggregate_manifest.manifest,
    segments_count = aggregate_manifest.segments_count,
    recording_start = aggregate_manifest.recording_start,
    recording_end = aggregate_manifest.recording_end,
    metadata_verified = TRUE,
    updated_at = NOW()
FROM
    aggregate_manifest
WHERE
    r.id = aggregate_manifest.session_recording_id;

COMMIT;
