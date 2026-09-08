extends MultiMeshInstance

# Paradise Reclaimed: litter field. One MultiMesh, one draw call.
# Per-item MeshInstance nodes breach the 150-draw-call budget at ~120 items.

signal litter_collected(item)

export(int) var field_size := 400
export(float) var spread := 60.0
export(float) var pickup_radius := 1.6

const RESOURCES := ["plastic", "aluminum", "glass", "paper"]

var _items := []

func _ready() -> void:
	randomize()
	if multimesh == null:
		push_error("LitterSpawner requires a MultiMesh resource with a mesh assigned")
		return
	multimesh.instance_count = field_size
	multimesh.visible_instance_count = field_size
	for i in range(field_size):
		var origin := Vector3(rand_range(-spread, spread), 0.0, rand_range(-spread, spread))
		multimesh.set_instance_transform(i, Transform(Basis(), origin))
		_items.append({
			"index": i,
			"origin": origin,
			"resource": RESOURCES[randi() % RESOURCES.size()],
			"amount": 1,
			"collected": false
		})

func collect_near(position: Vector3) -> void:
	for item in _items:
		if item["collected"]:
			continue
		if position.distance_to(item["origin"]) > pickup_radius:
			continue
		item["collected"] = true
		var hidden := Transform(Basis().scaled(Vector3.ZERO), item["origin"])
		multimesh.set_instance_transform(item["index"], hidden)
		emit_signal("litter_collected", item)
		return
