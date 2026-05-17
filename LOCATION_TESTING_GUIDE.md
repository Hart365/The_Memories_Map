# Location Features Testing Guide

## ✅ What's Been Implemented

1. **Automatic Location Extraction** - Photos/videos with GPS data automatically get location information when uploaded
2. **Reverse Geocoding** - GPS coordinates are converted to readable location names using OpenStreetMap
3. **Location Rescan API** - Existing media can be rescanned to extract location data
4. **Location Editing** - Location fields can be manually updated via API

## 🧪 How to Test

### Test 1: Upload a Photo with GPS Data

**What you need:**
- A photo taken with a smartphone or camera that has GPS enabled
- Most modern phone photos have this data automatically

**Steps:**
1. Log in to the app at http://localhost:5173
2. Open a map
3. Click the "Upload Media" button
4. Select a photo with GPS data (typically from your phone)
5. Upload the file

**Expected Result:**
- The photo should upload successfully
- When you view the photo details, it should have:
  - `latitude` and `longitude` values
  - `location_name` - A readable place name
  - `location_address` - Street address (if available)
  - `location_city` - City name
  - `location_country` - Country name

**How to check:**
```powershell
# View the most recent media record in the database
docker compose exec db mysql -u memories_map -pmemories123 memories_map -e "SELECT id, original_name, latitude, longitude, location_name, location_city, location_country FROM media_files ORDER BY id DESC LIMIT 1;"
```

### Test 2: Rescan a Single Media File

**API Endpoint:** `POST /api/maps/{mapId}/media/{mediaId}/rescan-location`

**Using curl (from PowerShell):**
```powershell
# Replace {mapId} and {mediaId} with actual IDs
# Replace {token} with your auth token
curl -X POST http://localhost:8080/api/maps/{mapId}/media/{mediaId}/rescan-location `
  -H "Authorization: Bearer {token}" `
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "updated": true,
  "media": {
    "id": 123,
    "latitude": 51.5074,
    "longitude": -0.1278,
    "location_name": "London",
    "location_address": "Westminster, SW1A 1AA",
    "location_city": "London",
    "location_country": "United Kingdom",
    ...
  }
}
```

### Test 3: Bulk Rescan All Media in a Map

**API Endpoint:** `POST /api/maps/{mapId}/media/rescan-locations`

**Using curl:**
```powershell
curl -X POST http://localhost:8080/api/maps/{mapId}/media/rescan-locations `
  -H "Authorization: Bearer {token}" `
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "total": 15,
  "updated": 10,
  "skipped": 5
}
```

### Test 4: Edit Location Information

**API Endpoint:** `PUT /api/maps/{mapId}/media/{mediaId}`

**Using curl:**
```powershell
$body = @{
  location_name = "My Custom Location"
  location_address = "123 Main St"
  location_city = "Custom City"
  location_country = "Custom Country"
} | ConvertTo-Json

curl -X PUT http://localhost:8080/api/maps/{mapId}/media/{mediaId} `
  -H "Authorization: Bearer {token}" `
  -H "Content-Type: application/json" `
  -d $body
```

## 📝 Database Schema Changes

New fields added to `media_files` table:
- `location_name` - varchar(255), nullable
- `location_address` - varchar(255), nullable  
- `location_city` - varchar(255), nullable
- `location_country` - varchar(255), nullable

## 🔍 Troubleshooting

### Location fields are NULL after upload

**Check if the photo has GPS data:**
```powershell
docker compose exec app php -r "var_dump(exif_read_data('/path/to/photo.jpg')['GPS'] ?? null);"
```

**Check the logs:**
```powershell
docker compose logs app --tail 50 | Select-String "Geocoding"
```

### Geocoding is slow

- First request to a coordinate takes ~1 second (Nominatim rate limit)
- Subsequent requests to the same coordinate are instant (cached for 30 days)
- Rate limiting ensures compliance with OpenStreetMap usage policy

### No location name but has coordinates

- Some coordinates may not have detailed location data
- Remote locations (ocean, uninhabited areas) may only have country-level data
- The API returns `null` for unavailable fields

## 🌍 Geocoding Service Details

**Provider:** OpenStreetMap Nominatim API
**Rate Limit:** 1 request per second (enforced)
**Cache Duration:** 30 days
**Coverage:** Worldwide
**Cost:** Free (open data)

## 📦 What's Next

Remaining features to implement:
- [ ] Frontend UI to display location information
- [ ] Frontend UI to edit location fields
- [ ] Map overlays (satellite, terrain, etc.)
- [ ] Map theming fixes
- [ ] Timeline component with media filtering

## 🐛 Known Limitations

1. Only photos/videos with GPS metadata will have location data
2. Indoor photos may have less accurate location names
3. Very remote locations may not have detailed address data
4. Rate limiting means bulk rescans on large maps will be slow (by design)
