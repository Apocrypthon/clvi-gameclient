extends CanvasLayer

# Paradise Reclaimed: full-screen fade between scenes. Owned by Bootstrap.

const FADE_TIME := 0.25

onready var rect := $ColorRect
onready var tween := $Tween

func _ready() -> void:
	rect.modulate.a = 0.0

func fade_out():
	return _fade_to(1.0)

func fade_in():
	return _fade_to(0.0)

func _fade_to(target: float):
	tween.stop_all()
	tween.interpolate_property(rect, "modulate:a", rect.modulate.a, target,
		FADE_TIME, Tween.TRANS_SINE, Tween.EASE_IN_OUT)
	tween.start()
	yield(tween, "tween_all_completed")
