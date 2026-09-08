extends Node

# Paradise Reclaimed: realtime multiplayer and Guardian token sync.
# Op codes mirror clvi.cc/Clean Ascension/NakamaClient.gd:
#   1 = TOKEN_MINING / TOKEN_UPDATE
#   2 = PLAYER_SPAWN

signal token_progress_updated(token_id, progress)
signal player_spawned(spawn_data)
signal socket_closed()

const SERVER_KEY := "defaultkey"
const HOST := "127.0.0.1"
const PORT := 7350
const SCHEME := "http"

const OP_TOKEN := 1
const OP_SPAWN := 2

var client
var session
var socket
var match_id := ""

func authenticate(device_id := ""):
	client = Nakama.create_client(SERVER_KEY, HOST, PORT, SCHEME)
	var id := device_id
	if id == "":
		id = OS.get_unique_id()

	session = yield(client.authenticate_device_async(id), "completed")
	if session.is_exception():
		return {"error": str(session.get_exception().message)}

	socket = Nakama.create_socket_from(client)
	var connected = yield(socket.connect_async(session), "completed")
	if connected.is_exception():
		return {"error": str(connected.get_exception().message)}

	socket.connect("received_match_state", self, "_on_match_state")
	socket.connect("closed", self, "_on_socket_closed")
	return {"user_id": session.user_id}

func join_remediation_match(code := ""):
	if socket == null:
		return {"error": "socket_unavailable"}
	var result
	if code != "":
		result = yield(socket.join_match_async(code), "completed")
	else:
		result = yield(socket.create_match_async(), "completed")
	if result.is_exception():
		return {"error": str(result.get_exception().message)}
	match_id = result.match_id
	return {"match_id": match_id}

func request_spawn() -> void:
	_send(OP_SPAWN, {"timestamp": OS.get_unix_time()})

func sync_token_progress(token_id: String, amount: float) -> void:
	_send(OP_TOKEN, {
		"token_id": token_id,
		"contribution": amount,
		"timestamp": OS.get_unix_time()
	})

func _send(op_code: int, data: Dictionary) -> void:
	if match_id == "" or socket == null:
		return
	socket.send_match_state_async(match_id, op_code, JSON.print({"data": data}))

func _on_match_state(state) -> void:
	var parsed := JSON.parse(state.data)
	if parsed.error != OK or typeof(parsed.result) != TYPE_DICTIONARY:
		return
	var content: Dictionary = parsed.result
	if not content.has("data"):
		return
	match state.op_code:
		OP_TOKEN:
			_handle_token_sync(content["data"])
		OP_SPAWN:
			emit_signal("player_spawned", content["data"])

func _handle_token_sync(payload) -> void:
	if typeof(payload) != TYPE_DICTIONARY or not payload.has("token_id"):
		return
	var progress := float(payload.get("progress", payload.get("contribution", 0.0)))
	emit_signal("token_progress_updated", str(payload["token_id"]), progress)

func _on_socket_closed() -> void:
	match_id = ""
	emit_signal("socket_closed")
