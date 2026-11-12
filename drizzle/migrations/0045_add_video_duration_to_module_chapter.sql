ALTER TABLE zuvy_module_chapter
ADD COLUMN duration integer;

ALTER TABLE zuvy_module_chapter
RENAME COLUMN duration TO video_duration_seconds;

