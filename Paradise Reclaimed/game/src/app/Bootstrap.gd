extends Node

# Paradise Reclaimed: entry point. Hands control to SceneRouter and exits.
# Replaces the convention source's Spatial.tscn, which was an empty node with an
# orchestrator script attached to nothing.

onready var fade_layer := $FadeLayer

func _ready() -> void:
	SceneRouter.fade_layer_path = fade_layer.get_path()
	SceneRouter.go_to_login()
