extends KinematicBody

# Paradise Reclaimed: player locomotion and the pick-up input intent.
# Input actions are declared in project.godot [input].

export(float) var move_speed := 7.0
export(NodePath) var litter_path

var _velocity := Vector3.ZERO
var _litter: Node

func _ready() -> void:
	if litter_path != null and str(litter_path) != "" and has_node(litter_path):
		_litter = get_node(litter_path)

func _physics_process(_delta: float) -> void:
	var input := Vector3(
		Input.get_action_strength("move_right") - Input.get_action_strength("move_left"),
		0.0,
		Input.get_action_strength("move_back") - Input.get_action_strength("move_forward")
	)
	_velocity = input.normalized() * move_speed
	move_and_slide(_velocity, Vector3.UP)

	if Input.is_action_just_pressed("collect") and _litter != null:
		_litter.collect_near(global_transform.origin)
