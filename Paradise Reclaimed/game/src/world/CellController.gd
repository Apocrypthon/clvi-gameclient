extends Spatial

# Paradise Reclaimed: restoration state of one map cell.
# Field names on the wire come from server/src/routes/remediation.rs:
#   RemediationRequest  { player_id?, item_id, success, timing_ms }
#   RemediationResponse { player_id, item_id, token_increment }

signal cell_restored(cell_id, token_increment)

export(String) var cell_id := ""
export(int) var item_id := 0
export(int) var required_collections := 8

var collected := 0
var restored := false

var _started_ms := 0

func _ready() -> void:
	_started_ms = OS.get_ticks_msec()

# No return type: this function yields, so it hands back GDScriptFunctionState.
func register_collection():
	if restored:
		return
	collected += 1
	if collected >= required_collections:
		var state = _submit_remediation(true)
		if state is GDScriptFunctionState:
			yield(state, "completed")

func _submit_remediation(success: bool):
	var response = Services.http.post("/remediation/process", {
		"item_id": item_id,
		"success": success,
		"timing_ms": OS.get_ticks_msec() - _started_ms
	})
	if response is GDScriptFunctionState:
		response = yield(response, "completed")
	if response == null or response.has("error"):
		return
	restored = true
	emit_signal("cell_restored", cell_id, float(response.get("token_increment", 0.0)))
