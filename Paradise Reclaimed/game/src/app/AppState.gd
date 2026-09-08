extends Node

# Paradise Reclaimed: authoritative client-side session and player totals.
# Written only by app-layer services; read by everything.

signal session_changed(player_id)
signal player_state_changed(state)

var session_token := ""
var player_id := ""
var collected_total := 0
var recycled_total := 0

func set_session(token: String, id: String) -> void:
	session_token = token
	player_id = id
	emit_signal("session_changed", player_id)

func clear_session() -> void:
	session_token = ""
	player_id = ""
	emit_signal("session_changed", player_id)

func apply_player_state(state) -> void:
	if typeof(state) != TYPE_DICTIONARY:
		return
	collected_total = int(state.get("collected_total", collected_total))
	recycled_total = int(state.get("recycled_total", recycled_total))
	emit_signal("player_state_changed", state)

func is_authenticated() -> bool:
	return player_id != ""
