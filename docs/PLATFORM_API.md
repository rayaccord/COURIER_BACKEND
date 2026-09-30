# Courier Platform API

The Courier backend serves any number of client platforms (Hooks, a pharmacy app, a shop). Each platform has its own API key, webhook address and signing secret. A platform only ever sees its own deliveries.

## Platforms

A platform is a row in the `platforms` collection.

| Field | Meaning |
|---|---|
| `slug`, `name` | Identifies the platform |
| `apiKeyHash` | SHA-256 of the platform API key. The key itself is never stored |
| `webhookUrl` | Where delivery events are sent |
| `webhookSecret` | Used to sign every webhook |
| `dispatchMode` | `manual` (the platform picks the courier) or `auto` (nearby couriers are offered the delivery) |
| `assignmentTimeoutSeconds`, `defaultRadiusKm` | Optional overrides of the server defaults |

Create a platform, or issue a new key and secret for an existing one:

```
node scripts/createPlatform.js --slug=hooks --name="Hooks" --webhook=https://api.hooksfoodapp.com/couriers/events --dispatch=manual
node scripts/createPlatform.js --slug=hooks --name="Hooks" --rotate
```

The first platform is also created on startup from `COURIER_API_KEY`, `PLATFORM_SLUG`, `PLATFORM_NAME`, `PLATFORM_WEBHOOK_URL`, `PLATFORM_WEBHOOK_SECRET` and `PLATFORM_DISPATCH_MODE`. This keeps an existing deployment working without running the script.

## Authentication

Every `/api/v1` request sends `Authorization: Bearer <platform api key>`. A missing or wrong key returns 401.

## Delivery statuses

`pending` → `assigned` → `accepted` → `en_route_to_pickup` → `arrived_pickup` → `picked_up` → `in_transit` → `arrived_delivery` → `delivered`

It can also end as `cancelled` or `failed`.

- `assigned` means a courier has been offered the delivery and has not answered yet.
- A rejected or expired offer returns the delivery to `pending`.
- Couriers must move one step at a time.
- `arrived_pickup` and `picked_up` require the courier to be within `GEOFENCE_METERS` of the pickup. `arrived_delivery` and `delivered` require the same distance from the customer.

Old status names are still accepted from older courier app versions: `heading_to_restaurant`, `arrived_restaurant`, `on_the_way`, `arrived_customer`. Existing deliveries are renamed on startup.

## Endpoints

### Create a delivery

`POST /api/v1/deliveries`

```json
{
  "external_order_id": "7f3c9a2e-...",
  "external_reference": "HOOKS-12345",
  "dispatch": "manual",
  "pickup": { "name": "ABC Restaurant", "type": "restaurant", "external_id": "rest-1", "phone": "+234...", "address": "12 Admiralty Way, Lekki", "lat": 6.4474, "lng": 3.4723 },
  "dropoff": { "name": "Tolu Ade", "phone": "+234...", "address": "5 Bourdillon Rd, Ikoyi", "instructions": "Gate 2", "lat": 6.455, "lng": 3.436 },
  "fee": 1500,
  "currency": "NGN",
  "items": [{ "name": "Jollof Rice", "quantity": 2, "note": "extra pepper" }],
  "metadata": { "payment_method": "wallet" }
}
```

- The response is `201 { "delivery": { ... } }` for a new delivery.
- Sending the same `external_order_id` again returns `200` with the same delivery, so retries are safe.
- `pickup.type` is one of `restaurant`, `pharmacy`, `store` or `other`.
- `metadata` is stored as given and is never read by the Courier logic.

### Read, update, cancel

| Method and path | Purpose |
|---|---|
| `GET /api/v1/deliveries/:id` | Current state. `:id` can be the delivery id or your `external_order_id` |
| `PATCH /api/v1/deliveries/:id` | Change dropoff details, pickup phone, fee, items, reference or metadata. Only allowed before pickup. Pickup name, address and location can change only before a courier accepts |
| `POST /api/v1/deliveries/:id/cancel` | Body `{ "reason": "..." }`. Only allowed before pickup. After pickup the courier marks the delivery `failed` if it cannot be delivered |

### Couriers and assignment

| Method and path | Purpose |
|---|---|
| `GET /api/v1/couriers/nearby?lat=&lng=&radius_km=&dropoff_lat=&dropoff_lng=&limit=&include_busy=` | Available couriers near a point, closest first |
| `POST /api/v1/deliveries/:id/assign` | Body `{ "courier_id": "..." }`. Offers the delivery to one courier. Also used to reassign before pickup |
| `POST /api/v1/deliveries/:id/dispatch` | Offers a pending delivery to every nearby available courier. The first to accept gets it |
| `GET /api/v1/couriers` | All couriers with their availability. Takes `status` and `search` |
| `GET /api/v1/couriers/:id` | One courier |

A nearby courier is:

- online
- not on another delivery
- not answering another offer
- has sent GPS within `LOCATION_STALE_SECONDS`
- within the radius

Each courier in the list has:

- `distance_to_pickup_m` and `distance_to_dropoff_m`
- `eta_to_pickup_seconds`
- `vehicle`, `phone` and `last_location_at`
- `availability`: one of `available`, `offered`, `busy`, `no_gps` or `offline`
- `active_delivery`

The ETA is an estimate from straight-line distance, a road factor and a typical speed for the vehicle.

An offer expires after `ASSIGNMENT_TIMEOUT_SECONDS`. When it expires, the delivery returns to `pending` and the platform gets `assignment.expired`. A courier can only accept an offer made to them, and only one courier can win.

### History and tracking

| Method and path | Purpose |
|---|---|
| `GET /api/v1/deliveries/:id/events` | Every event in time order |
| `GET /api/v1/deliveries/:id/tracking` | Courier location, pickup, dropoff, distance left, ETA, last update, assignment and acceptance times |

## Webhooks

Every event is saved to `delivery_events`, then sent through `webhook_outbox` to the platform's `webhookUrl`:

```
POST {webhookUrl}
X-Courier-Event-Id: evt_...
X-Courier-Event: delivery.picked_up
X-Courier-Timestamp: 1759140000
X-Courier-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>" with the webhook secret>
```

```json
{
  "event_id": "evt_...",
  "event": "delivery.picked_up",
  "occurred_at": "2026-09-29T09:45:12Z",
  "delivery_id": "C456",
  "order_number": "ORD-...",
  "external_order_id": "7f3c9a2e-...",
  "external_reference": "HOOKS-12345",
  "status": "picked_up",
  "fee": 1500,
  "assignment": { "id": "...", "status": "accepted", "courier_id": "...", "offered_at": "...", "expires_at": "...", "responded_at": "..." },
  "courier": { "id": "...", "name": "...", "phone": "...", "email": "...", "vehicle": "bike", "vehicle_registration": "..." },
  "location": { "lat": 6.4471, "lng": 3.472, "recorded_at": "..." },
  "note": ""
}
```

Events:

- **Delivery:** `delivery.created`, `delivery.dispatched`, `delivery.updated`, `delivery.cancelled`
- **Assignment:** `assignment.offered`, `assignment.accepted`, `assignment.rejected`, `assignment.expired`, `assignment.cancelled`
- **Steps:** `delivery.en_route_to_pickup`, `delivery.arrived_pickup`, `delivery.picked_up`, `delivery.in_transit`, `delivery.arrived_delivery`, `delivery.delivered`, `delivery.failed`
- **Location:** `courier.location`

How receivers should treat them:

- **Verify every webhook.** Check the signature and refuse a timestamp more than 5 minutes old.
- **Drop repeats** by `event_id`.
- **Order is guaranteed per delivery.** A failed send is retried with backoff (5 s, 10 s, 20 s and so on, up to 30 min) for up to `WEBHOOK_MAX_RETRY_HOURS`. Later events for the same delivery wait behind it.
- **Location is not retried.** `courier.location` events are sent at most every `LOCATION_EVENT_INTERVAL_SECONDS` per delivery, and only once. The next update replaces a lost one.

## Existing courier app endpoints

These are used by the courier app, with `Authorization: Bearer <courier JWT>` from login. They are unchanged apart from the notes below.

| Method and path | Purpose |
|---|---|
| `POST /api/auth/register` | Sign up with ID and vehicle photos (multipart). Emails a 4 digit code |
| `POST /api/auth/verify` | `{email, code}`. Creates the courier and returns `{token, courier}` |
| `POST /api/auth/resend-verification` | `{email}` |
| `POST /api/auth/login` | `{email, password}`. Returns `{token, courier}`. The courier starts offline |
| `POST /api/auth/forgot-password` | `{email}`. Emails a reset code |
| `POST /api/auth/verify-reset-code` | `{email, code}` |
| `POST /api/auth/reset-password` | `{email, code, password}`. Now requires the code |
| `GET /api/profile`, `PUT /api/profile` | The courier's own profile |
| `PUT /api/profile/online` | `{online}` |
| `PUT /api/profile/location`, `PUT /api/courier/location` | `{lat, lng}`. Stores the position and time, and feeds live tracking of the active delivery |
| `POST /api/profile/push-token`, `POST /api/courier/push-token` | Expo push token |
| `GET /api/orders/pending` | Offers waiting for this courier, each with `offer.expiresAt` |
| `PUT /api/orders/:id/accept` | Accept an offer |
| `PUT /api/orders/:id/reject` | Decline an offer, or drop an accepted delivery before pickup |
| `PUT /api/orders/:id/status` | `{status}` next step, or `{status: "failed", reason}` after accepting |
| `PUT /api/orders/:id/cancel` | Drop an accepted delivery before pickup. It returns to the platform, and the customer order is not cancelled |
| `GET /api/orders/active`, `/history`, `/stats`, `/analytics`, `/weekly-earnings` | Current delivery, history and earnings |
| `GET /api/wallet`, `PUT /api/wallet/bank-account`, `POST /api/wallet/withdraw` | Wallet |
| `GET /api/surge` | Surge zones for the map (currently generated, not stored) |
| `POST /api/deliveries` | Old Hooks create format, kept only until the Hooks backend moves to `/api/v1/deliveries`. Needs a platform key |

## Courier app realtime

The socket connects with `auth: { token: <courier JWT> }`. A connection without a valid token is refused.

| Event | Payload | When |
|---|---|---|
| `new-order` | The delivery plus `offer { assignmentId, expiresAt, distanceToPickupM, tripDistanceM, etaToPickupSeconds, tripEtaSeconds }` | A delivery is offered to this courier |
| `offer-withdrawn` | `{ orderId, reason }` | The offer was given to someone else or cancelled |
| `offer-expired` | `{ orderId }` | The courier did not answer in time |
| `order-accepted` | order id | Another courier took an auto-dispatched delivery |
| `order-cancelled` | `{ orderId, reason }` | The courier's delivery was cancelled or reassigned (`reason: "reassigned"`) |
| `delivery-updated` | the delivery | The platform changed details |

Couriers that are not connected get an Expo push notification for new offers.

## Database changes (MongoDB)

- **New collections:** `platforms`, `assignments`, `deliveryevents`, `webhookoutboxes`.
- **New fields on `orders`:** `platform`, `externalOrderId`, `externalReference`, `metadata`, `dispatchMode`, `pickupPhone`, `pickupExternalId`, `dropoffInstructions`, `items`, `itemsCount`, `currency`, `currentAssignment`, `statusChangedAt`, `cancelReason`, `cancelledBy`, `courierLocation`, `lastLocationEventAt`.
- **New `orders` indexes:** a unique index on `{ platform, externalOrderId }` and an index on `{ courier, status }`.
- **Removed from the schema:** the seven `hooks*` fields. On startup their values are copied into `externalOrderId`, `pickupExternalId`, `sourceType` and `metadata`. Their old indexes are dropped, and old status names are renamed. Startup never deletes data.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `ASSIGNMENT_TIMEOUT_SECONDS` | 60 | Time a courier has to answer |
| `LOCATION_STALE_SECONDS` | 120 | Couriers without GPS for longer are not offered deliveries |
| `DEFAULT_RADIUS_KM` / `MAX_RADIUS_KM` | 10 / 50 | Courier search radius |
| `GEOFENCE_METERS` | 100 | Distance allowed for arrive, pickup and deliver |
| `LOCATION_EVENT_INTERVAL_SECONDS` | 15 | How often location is sent to platforms |
| `WEBHOOK_TIMEOUT_SECONDS` | 10 | Per webhook request |
| `WEBHOOK_MAX_RETRY_HOURS` | 24 | Retry window for failed webhooks |
| `WORKER_INTERVAL_SECONDS` | 5 | Offer expiry and webhook worker tick |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |

## Security changes

- `GET /api/test-courier` is removed. It exposed every courier record with no login.
- `POST /api/orders` is removed. It had no login and could never succeed.
- `POST /api/surge` now needs a platform key.
- `POST /api/auth/reset-password` now requires the emailed reset code.
- Verification and reset codes are no longer written to the server log.
- The socket requires the courier JWT, and a courier only receives their own events.
- Accepting a delivery is atomic and only allowed for the courier it was offered to.
- A courier can no longer cancel a platform's delivery. Dropping it before pickup returns it to the platform.
