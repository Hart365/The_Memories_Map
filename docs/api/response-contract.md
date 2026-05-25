# API Response Contract (Workstream B)

## Cursor Pagination Envelope

When `per_page` or `cursor` is provided, endpoints return:

```json
{
  "data": [],
  "meta": {
    "per_page": 20,
    "next_cursor": "...",
    "prev_cursor": null,
    "has_more": true
  }
}
```

## Legacy Compatibility

1. `GET /api/maps` and `GET /api/maps/{map}/notes` keep legacy non-paginated array output when no cursor parameters are sent.
2. `GET /api/maps/{map}/media` always returns `data` and now includes `meta` for cursor navigation.

## Error Surface

1. Validation errors return Laravel standard 422 payloads.
2. Endpoint timing and status are logged as `api_request_metric` events.
