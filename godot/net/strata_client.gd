extends Node
## Every call to the Strata backend goes through here, and every call is TLS.
##
## Enforced, in order, before a socket is opened:
##   1. the resolved URL must be https:// — an http:// URL is refused, never
##      silently upgraded or downgraded
##   2. TLS options are the verifying defaults (bundled CA chain, hostname
##      checked). Nothing in this file can turn verification off.
##
## There is deliberately NO application-layer encryption envelope here, and
## that is a contract decision rather than an omission:
##
##   clvi-architecture ADR-002 — "No key material is generated, stored, or
##   asked for on the device in the MVP."
##
## An app-layer seal needs a client-side key, so adding one would put this
## client out of contract. The real model is TLS for confidentiality in
## transit, a Supabase OTP bearer token for identity (ADR-002), and
## server-side HMAC-SHA256 for ledger integrity (ADR-004) — none of which
## asks the client to hold key material. See docs/GODOT.md.

signal request_failed(path: String, reason: String)

## Set from the login flow, e.g. "https://api.strata.example".
var base_url := ""


func get_json(path: String) -> Dictionary:
	return await _request(HTTPClient.METHOD_GET, path, null)


func post_json(path: String, payload: Dictionary) -> Dictionary:
	return await _request(HTTPClient.METHOD_POST, path, payload)


func _request(method: int, path: String, payload: Variant) -> Dictionary:
	var url := _resolve(path)
	if url.is_empty():
		return _fail(path, "base_url is not set")
	if not url.begins_with("https://"):
		return _fail(path, "refusing plaintext transport for %s" % url)
	var http := HTTPRequest.new()
	add_child(http)
	# Verifying client defaults. Guarded because set_tls_options landed after
	# Godot 4.0; on an engine without it the HTTPS default is still verifying.
	if http.has_method("set_tls_options"):
		http.set_tls_options(TLSOptions.client())

	var headers := PackedStringArray(["Accept: application/json"])
	if payload != null:
		headers.append("Content-Type: application/json")
	var auth := Session.authorization_header()
	if not auth.is_empty():
		headers.append(auth)

	var body := "" if payload == null else JSON.stringify(payload)
	var err := http.request(url, headers, method, body)
	if err != OK:
		http.queue_free()
		return _fail(path, "request could not be started (error %d)" % err)

	var response: Array = await http.request_completed
	http.queue_free()

	var result: int = response[0]
	var status: int = response[1]
	var raw: PackedByteArray = response[3]
	if result != HTTPRequest.RESULT_SUCCESS:
		return _fail(path, "transport failed (result %d)" % result)

	var parsed: Variant = JSON.parse_string(raw.get_string_from_utf8())
	if status == 401 or status == 403:
		# The backend disowned the session; drop it rather than retrying with a
		# token it has already rejected.
		Session.close("rejected by backend")
	if status < 200 or status >= 300:
		return _fail(path, "backend returned %d" % status)

	return {"ok": true, "status": status, "data": parsed, "error": ""}


func _resolve(path: String) -> String:
	if base_url.is_empty():
		return ""
	return "%s/%s" % [base_url.rstrip("/"), path.lstrip("/")]


func _fail(path: String, reason: String) -> Dictionary:
	push_error("StrataClient %s: %s" % [path, reason])
	request_failed.emit(path, reason)
	return {"ok": false, "status": 0, "data": null, "error": reason}
