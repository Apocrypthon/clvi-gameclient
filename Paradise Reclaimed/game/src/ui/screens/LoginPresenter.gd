extends Control

# Paradise Reclaimed: login screen. Owns its fields; delegates all I/O.
# Ported from clvi.cc/Clean Ascension: the source mixed Godot 3 and Godot 4
# dialects in one body and compiled under neither.
#
# Deviation: the source posts to /auth/login expecting a token. That route is not
# in server/src/routes/mod.rs and would 404. Auth goes through Nakama device auth,
# and the returned user_id becomes the x-player-id the axum session_middleware reads.

onready var email_field := $Panel/VBoxContainer/Email
onready var password_field := $Panel/VBoxContainer/Password
onready var login_button := $Panel/VBoxContainer/BtnLogin
onready var status_label := $Panel/VBoxContainer/Status

var _request_in_flight := false

func _ready() -> void:
	login_button.connect("pressed", self, "_on_login_pressed")
	status_label.text = ""

# No return type: this function yields, so it hands back GDScriptFunctionState.
func _on_login_pressed():
	if _request_in_flight:
		return
	_request_in_flight = true
	login_button.disabled = true
	status_label.text = "Signing in..."

	var state = _login_async()
	if state is GDScriptFunctionState:
		yield(state, "completed")

func _login_async():
	var auth = Services.net.authenticate()
	if auth is GDScriptFunctionState:
		auth = yield(auth, "completed")
	if auth == null or auth.has("error"):
		var reason := "unknown"
		if auth != null:
			reason = str(auth.get("error", "unknown"))
		_status_error("Sign-in failed: %s" % reason)
		return

	AppState.set_session("", str(auth["user_id"]))

	var state_call = Services.http.get_json("/player/state")
	if state_call is GDScriptFunctionState:
		state_call = yield(state_call, "completed")
	if state_call != null and not state_call.has("error"):
		AppState.apply_player_state(state_call)

	status_label.text = "Authenticated"
	_reset_request_state()
	SceneRouter.go_to_player_creation()

func _status_error(message: String) -> void:
	status_label.text = message
	_reset_request_state()

func _reset_request_state() -> void:
	_request_in_flight = false
	login_button.disabled = false
