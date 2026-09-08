extends CanvasLayer

# Paradise Reclaimed: in-world HUD. Renders from AppState signals and from the
# world layer's metrics; never calls a transport itself.

onready var collected_label := $Root/Totals/Collected
onready var recycled_label := $Root/Totals/Recycled
onready var accuracy_label := $Root/Accuracy
onready var combo_label := $Root/Combo
onready var token_bar := $Root/TokenProgress

func _ready() -> void:
	AppState.connect("player_state_changed", self, "_on_player_state_changed")
	_render_totals()

func _on_player_state_changed(_state) -> void:
	_render_totals()

func _render_totals() -> void:
	collected_label.text = "Collected %d" % AppState.collected_total
	recycled_label.text = "Recycled %d" % AppState.recycled_total

func update_metrics(accuracy: float, collection_rate: float, combo_multiplier: int) -> void:
	accuracy_label.text = "Accuracy %.1f%%  ·  %.1f/min" % [accuracy, collection_rate]
	combo_label.text = "Combo x%d" % combo_multiplier

func flash_penalty(penalty_type: String) -> void:
	combo_label.text = "%s — combo reset" % penalty_type

func update_token_progress(_token_id: String, progress: float) -> void:
	token_bar.value = clamp(progress, 0.0, 1.0)
