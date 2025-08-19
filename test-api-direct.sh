#!/bin/bash

# Direct API test with curl to see exact response
echo "Testing API directly with curl..."
echo ""

# The exact payload that's being sent
PAYLOAD='{
  "burnRequest": {
    "farm_id": 1,
    "field_name": "North Field",
    "acres": 150,
    "crop_type": "wheat",
    "burn_date": "2025-08-20",
    "time_window_start": "08:00",
    "time_window_end": "12:00",
    "field_boundary": {
      "type": "Polygon",
      "coordinates": [[
        [-121.75, 38.54],
        [-121.75, 38.55],
        [-121.74, 38.55],
        [-121.74, 38.54],
        [-121.75, 38.54]
      ]]
    },
    "contact_method": "sms"
  }
}'

echo "Sending payload:"
echo "$PAYLOAD" | jq .
echo ""

echo "Response:"
curl -X POST http://localhost:5001/api/agents/workflow \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -v 2>&1

echo ""
echo "Done."