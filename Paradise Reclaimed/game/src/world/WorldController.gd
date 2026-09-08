extends Spatial

# Paradise Reclaimed: world composition root.
# The single place where world signals are bound to transport and HUD.

onready var sorting := $Sorting
onready var litter := $Litter
onready var hud := $HUD

func _ready():
	sorting.connect("token_progress_earned", self, "_on_token_progress_earned")
	sorting.connect("metrics_changed", hud, "update_metrics")
	sorting.connect("sorting_error", hud, "flash_penalty")
	litter.connect("litter_collected", self, "_on_litter_collected")
	Services.net.connect("token_progress_updated", hud, "update_token_progress")

	var join = Services.net.join_remediation_match()
	if join is GDScriptFunctionState:
		join = yield(join, "completed")
	if join != null and not join.has("error"):
		Services.net.request_spawn()

func _on_token_progress_earned(token_id: String, amount: float) -> void:
	Services.net.sync_token_progress(token_id, amount)

# No return type: this function yields, so it hands back GDScriptFunctionState.
func _on_litter_collected(item: Dictionary):
	var call_state = Services.http.post("/action/collect", {
		"resource": str(item["resource"]),
		"amount": int(item["amount"])
	}, _new_idempotency_key())
	if call_state is GDScriptFunctionState:
		call_state = yield(call_state, "completed")
	if call_state == null or call_state.has("error"):
		return

	var refresh = Services.http.get_json("/player/state")
	if refresh is GDScriptFunctionState:
		refresh = yield(refresh, "completed")
	AppState.apply_player_state(refresh)

func _new_idempotency_key() -> String:
	return "%d-%d" % [OS.get_unix_time(), randi()]
