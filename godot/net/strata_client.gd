extends Node
## Every call to the Strata backend goes through here, and every call is TLS.
##
## Enforced, in order, before a socket is opened:
##   1. the resolved URL must be https:// — an http:// URL is refused, never
##      silently upgraded or downgraded
##   2. TLS options are the verifying defaults (bundled CA chain, hostname
##      checked). Nothing in this file can turn verification off.
##
## NOT IMPLEMENTED: application-layer sealing of the payload itself.
##
## The request that prompted this file asked for calls encrypted "via the
## strata backend bootstrap brands". No such thing exists anywhere in this
## repo — see docs/GODOT.md. Rather than invent an envelope format and a key
## exchange, which would look like security without being any, this file ships
## the transport guarantee it can actually make and leaves `require_sealed`
## as the switch that makes the gap loud: turn it on and every call fails
## until a real sealing scheme is wired into _seal()/_open().

signal request_failed(path: String, reason: String)

## Set from the login flow, e.g. "https://api.strata.example".
var base_url := ""

## When true, refuse to send anything until _seal() is a real implementation.
## Left false so the client is usable over TLS in the meantime; flip it once
## the sealing contract exists and unsealed calls should become errors.
var require_sealed := false

const _SEALING_IMPLEMENTED := false


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
	if require_sealed and not _SEALING_IMPLEMENTED:
		return _fail(path, "sealed payloads required but no sealing scheme is implemented")

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

	var body := "" if payload == null else JSON.stringify(_seal(payload))
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

	return {"ok": true, "status": status, "data": _open(parsed), "error": ""}


func _resolve(path: String) -> String:
	if base_url.is_empty():
		return ""
	return "%s/%s" % [base_url.rstrip("/"), path.lstrip("/")]


## Application-layer sealing seam. Identity until a real scheme is defined.
func _seal(payload: Dictionary) -> Dictionary:
	return payload


## Inverse of _seal(). Identity until a real scheme is defined.
func _open(parsed: Variant) -> Variant:
	return parsed


func _fail(path: String, reason: String) -> Dictionary:
	push_error("StrataClient %s: %s" % [path, reason])
	request_failed.emit(path, reason)
	return {"ok": false, "status": 0, "data": null, "error": reason}
