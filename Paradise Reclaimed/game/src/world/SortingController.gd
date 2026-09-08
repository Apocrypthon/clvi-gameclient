extends Node

# Paradise Reclaimed: skill-based sorting. Owns accuracy, combo and token gain.
# Ported from clvi.cc/Clean Ascension/SortingLogic.gd. Two changes:
#   * Godot 3.6 dialect throughout
#   * emits token_progress_earned instead of walking get_parent() to find a
#     Nakama node -- the world layer must not reach the app layer directly.

signal token_progress_earned(token_id, amount)
signal sorting_error(penalty_type)
signal metrics_changed(accuracy, collection_rate, combo_multiplier)

enum TrashType { PAPER, PLASTIC, METAL, ORGANIC, HAZARDOUS }

export(float) var window_time := 2.0

var accuracy := 100.0
var collection_rate := 0.0
var combo_multiplier := 1
var total_sorts := 0
var successful_sorts := 0

var _session_start_ms := 0

func _ready() -> void:
	_session_start_ms = OS.get_ticks_msec()

func attempt_sort(item_data: Dictionary, bin_type: int) -> void:
	if item_data.empty():
		return
	if not item_data.has("correct_type") or not item_data.has("token_id"):
		return

	total_sorts += 1
	if item_data["correct_type"] == bin_type:
		_process_success(item_data)
	else:
		_process_failure()
	_update_metrics()

func _process_success(item: Dictionary) -> void:
	successful_sorts += 1
	combo_multiplier += 1
	emit_signal("token_progress_earned", str(item["token_id"]), 0.1 * combo_multiplier)

func _process_failure() -> void:
	combo_multiplier = 1
	emit_signal("sorting_error", "MISCLASSIFICATION")

func _update_metrics() -> void:
	if total_sorts <= 0:
		accuracy = 100.0
		collection_rate = 0.0
	else:
		accuracy = (float(successful_sorts) / total_sorts) * 100.0
		var elapsed_minutes := max((OS.get_ticks_msec() - _session_start_ms) / 60000.0, 0.0001)
		collection_rate = successful_sorts / elapsed_minutes
	emit_signal("metrics_changed", accuracy, collection_rate, combo_multiplier)
