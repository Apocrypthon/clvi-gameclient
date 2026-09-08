extends CanvasLayer

# Paradise Reclaimed: on-screen GLES2 budget readout.
# Ported from clvi.cc/Clean Ascension/game/src/ui/DebugHUD.gd (Godot 4 dialect).
# Budgets: draw calls <= 150, verts <= 120000, nodes <= 1500.

onready var label := $MarginContainer/Panel/Label

func _ready() -> void:
	var timer := Timer.new()
	timer.wait_time = 0.5
	timer.one_shot = false
	timer.autostart = true
	add_child(timer)
	timer.connect("timeout", self, "_update_metrics")
	_update_metrics()

func _update_metrics() -> void:
	var fps := int(Performance.get_monitor(Performance.TIME_FPS))
	var draw_calls := int(Performance.get_monitor(Performance.RENDER_DRAW_CALLS_IN_FRAME))
	var verts := int(Performance.get_monitor(Performance.RENDER_VERTICES_IN_FRAME))
	var nodes := get_tree().get_node_count()
	label.text = "FPS: %s\nDraw Calls: %s\nVerts: %s\nNodes: %s" % [fps, draw_calls, verts, nodes]
