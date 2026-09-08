extends Node

# Paradise Reclaimed: REST transport for the clvi.cc axum server.
# Routes are merged at the server root (server/src/routes/mod.rs) -- no /api prefix.

signal request_failed(path, code, body)

const BASE_URL := "http://127.0.0.1:3000"
const REQUEST_TIMEOUT := 10.0

func get_json(path):
	return _send(path, HTTPClient.METHOD_GET, null, "")

func post(path, payload, idempotency_key := ""):
	return _send(path, HTTPClient.METHOD_POST, payload, idempotency_key)

func _send(path, method, payload, idempotency_key):
	var request := HTTPRequest.new()
	request.timeout = REQUEST_TIMEOUT
	# Mandatory: the HTML5 preset is the non-threaded variant (variant/export_type=0).
	request.use_threads = false
	add_child(request)

	var headers := PoolStringArray()
	headers.append("Accept: application/json")
	if AppState.player_id != "":
		headers.append("x-player-id: %s" % AppState.player_id)

	var body := ""
	if payload != null:
		headers.append("Content-Type: application/json")
		body = JSON.print(payload)
	if idempotency_key != "":
		headers.append("Idempotency-Key: %s" % idempotency_key)

	var err := request.request(BASE_URL + path, headers, true, method, body)
	if err != OK:
		request.queue_free()
		emit_signal("request_failed", path, 0, "request_error_%d" % err)
		return {"error": "request_error_%d" % err}

	var result = yield(request, "request_completed")
	request.queue_free()

	var code := int(result[1])
	var raw := (result[3] as PoolByteArray).get_string_from_utf8()
	var parsed := JSON.parse(raw)
	var data = parsed.result if parsed.error == OK else null

	if code < 200 or code >= 300:
		emit_signal("request_failed", path, code, raw)
		if typeof(data) == TYPE_DICTIONARY:
			return data
		return {"error": "http_%d" % code}
	if typeof(data) != TYPE_DICTIONARY:
		return {"error": "unexpected_payload"}
	return data
