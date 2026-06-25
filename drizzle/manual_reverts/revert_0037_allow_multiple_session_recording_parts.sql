BEGIN;

-- Manual rollback for 0037_allow_multiple_session_recording_parts.sql.
-- Do not run this as part of the normal migration chain.
-- It restores the previous one-recording-row-per-session/meeting behavior
-- from 0036_fix_session_recordings_current_flow.sql.

DROP INDEX IF EXISTS idx_session_recordings_session_meeting;
DROP INDEX IF EXISTS idx_session_recordings_final_merge;

-- Recreate the old meeting-level uniqueness safely. If multiple rows now exist
-- for the same session_id + zoom_meeting_id, keep the best row first.
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

CREATE UNIQUE INDEX IF NOT EXISTS uniq_session_recording_meeting ON zuvy_session_recordings (session_id, zoom_meeting_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_session_recording_uuid_not_null ON zuvy_session_recordings (session_id, zoom_meeting_uuid)
WHERE
    zoom_meeting_uuid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_session_recordings_session_id ON zuvy_session_recordings (session_id);

CREATE INDEX IF NOT EXISTS idx_session_recordings_zoom_meeting_id ON zuvy_session_recordings (zoom_meeting_id);

COMMIT;
