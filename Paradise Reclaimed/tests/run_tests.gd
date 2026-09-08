extends SceneTree

# Paradise Reclaimed: offline unit gate. No network, no scene instancing.
# Run: godot --path "Paradise Reclaimed" --no-window --script res://tests/run_tests.gd

var _failures := 0

func _init():
	_test_sorting_accuracy()
	_test_combo_resets_on_failure()
	_test_sort_ignores_malformed_items()
	if _failures == 0:
		print("ok - all tests passed")
	else:
		printerr("not ok - %d failing" % _failures)
	quit(_failures)

func _assert_eq(actual, expected, label: String) -> void:
	if actual == expected:
		print("ok - %s" % label)
	else:
		_failures += 1
		printerr("not ok - %s (got %s, want %s)" % [label, actual, expected])

func _new_sorting():
	var sorting = preload("res://game/src/world/SortingController.gd").new()
	sorting._session_start_ms = OS.get_ticks_msec()
	return sorting

func _test_sorting_accuracy() -> void:
	var sorting = _new_sorting()
	sorting.attempt_sort({"correct_type": 1, "token_id": "t1"}, 1)
	sorting.attempt_sort({"correct_type": 1, "token_id": "t1"}, 2)
	_assert_eq(sorting.total_sorts, 2, "counts every attempt")
	_assert_eq(sorting.successful_sorts, 1, "counts only correct sorts")
	_assert_eq(int(sorting.accuracy), 50, "accuracy is successes over attempts")
	sorting.free()

func _test_combo_resets_on_failure() -> void:
	var sorting = _new_sorting()
	sorting.attempt_sort({"correct_type": 0, "token_id": "t1"}, 0)
	_assert_eq(sorting.combo_multiplier, 2, "a correct sort raises the combo")
	sorting.attempt_sort({"correct_type": 0, "token_id": "t1"}, 3)
	_assert_eq(sorting.combo_multiplier, 1, "a miss resets the combo")
	sorting.free()

func _test_sort_ignores_malformed_items() -> void:
	var sorting = _new_sorting()
	sorting.attempt_sort({}, 0)
	sorting.attempt_sort({"correct_type": 0}, 0)
	sorting.attempt_sort({"token_id": "t1"}, 0)
	_assert_eq(sorting.total_sorts, 0, "malformed items never count as a sort")
	sorting.free()
