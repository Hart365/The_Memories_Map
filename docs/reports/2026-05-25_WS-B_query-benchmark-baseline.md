# Workstream B Query Benchmark Baseline

## Scope
1. Map list queries with owner joins and counts.
2. Media list queries with date/location filters.
3. Note list queries with text filtering.

## Index Changes Applied
1. `media_files_captured_at_id_index`
2. `media_files_lat_lon_id_index`
3. `media_files_map_created_id_index`
4. `memories_maps_owner_updated_id_index`
5. `map_notes_map_created_id_index`
6. `map_notes_type_map_id_index`
7. `map_notes_title_body_fulltext` (MySQL)

## Benchmark Method
1. Docker MySQL with production-like row counts from current dataset.
2. Endpoints exercised through API requests with cursor pagination and representative filters.
3. Metric events collected from `api_request_metric` logs.

## Baseline Result Summary
1. Pagination paths now avoid unbounded list scans for primary endpoints.
2. Filtered media and notes queries use targeted index paths.
3. Further p95 tuning should continue in Workstream H with synthetic load checks.
