extends Node3D
## Paradise world shell: blue sky, white baseplate, fog on the camera.
##
## Built entirely in code — the .tscn beside this file is a one-node shell that
## does nothing but attach this script. Nothing is authored in the editor.
##
## Served AFTER login: _ready() refuses to build the world unless Session holds
## a live session. There is no login UI in this repo yet; see docs/GODOT.md for
## what that seam expects.

signal world_ready
signal entry_denied(reason: String)

const BASEPLATE_SIZE := 512.0
const BASEPLATE_THICKNESS := 1.0

@export_group("Sky")
@export var sky_top_color := Color("1f5fc4")
@export var sky_horizon_color := Color("b7d4f2")
@export var ground_bottom_color := Color("6b6f74")

@export_group("Baseplate")
@export var baseplate_color := Color.WHITE

@export_group("Fog")
@export var fog_color := Color("cddced")
@export_range(0.0, 0.1, 0.0001) var fog_density := 0.006
@export_range(0.0, 1.0) var fog_aerial_perspective := 0.5

var camera: Camera3D
var baseplate: MeshInstance3D
var sun: DirectionalLight3D


func _ready() -> void:
	if not Session.is_active():
		# The world is the thing behind the login wall. Refuse to compose it at
		# all rather than building it and hoping something else gates access.
		entry_denied.emit("no active session")
		push_warning("ParadiseWorld: refusing to build — no active session.")
		return
	build()


## Composes the world. Public so a login flow can call it directly once a
## session opens, instead of reloading the scene.
func build() -> void:
	if camera != null:
		return
	baseplate = _build_baseplate()
	sun = _build_sun()
	camera = _build_camera()
	world_ready.emit()


func _build_camera() -> Camera3D:
	var cam := Camera3D.new()
	cam.name = "PlayerCamera"
	cam.far = 2000.0
	# The fog (and the sky it fades into) live on the camera's own Environment.
	# Note: a Camera3D environment REPLACES any WorldEnvironment rather than
	# layering with it, which is why the sky has to be in the same resource —
	# putting the sky on a WorldEnvironment and the fog here would lose the sky.
	cam.environment = _build_environment()
	add_child(cam)
	cam.look_at_from_position(Vector3(0.0, 6.0, 18.0), Vector3(0.0, 1.5, 0.0), Vector3.UP)
	cam.current = true
	return cam


func _build_environment() -> Environment:
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = sky_top_color
	sky_material.sky_horizon_color = sky_horizon_color
	sky_material.ground_horizon_color = sky_horizon_color
	sky_material.ground_bottom_color = ground_bottom_color

	var sky := Sky.new()
	sky.sky_material = sky_material

	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 1.0

	env.fog_enabled = true
	env.fog_light_color = fog_color
	env.fog_light_energy = 1.0
	env.fog_sun_scatter = 0.1
	env.fog_density = fog_density
	env.fog_aerial_perspective = fog_aerial_perspective
	env.fog_height = 0.0
	env.fog_height_density = 0.0

	# Added in Godot 4.3. Probed rather than assumed so this script still loads
	# on 4.0-4.2 instead of erroring on an unknown property.
	if _has_property(env, "fog_mode"):
		env.set("fog_mode", 0)  # Environment.FOG_MODE_EXPONENTIAL
	if _has_property(env, "fog_sky_affect"):
		env.set("fog_sky_affect", 0.35)

	return env


func _has_property(obj: Object, property_name: String) -> bool:
	for property in obj.get_property_list():
		if property["name"] == property_name:
			return true
	return false


func _build_baseplate() -> MeshInstance3D:
	var mesh := PlaneMesh.new()
	mesh.size = Vector2(BASEPLATE_SIZE, BASEPLATE_SIZE)
	# Subdivision keeps shading stable across a plane this large.
	mesh.subdivide_width = 8
	mesh.subdivide_depth = 8

	var mat := StandardMaterial3D.new()
	mat.albedo_color = baseplate_color
	mat.roughness = 0.85
	mat.metallic = 0.0

	var mesh_instance := MeshInstance3D.new()
	mesh_instance.name = "Baseplate"
	mesh_instance.mesh = mesh
	mesh_instance.material_override = mat
	add_child(mesh_instance)

	# A baseplate you fall through is a bug, not a look.
	var body := StaticBody3D.new()
	body.name = "BaseplateBody"
	var box := BoxShape3D.new()
	box.size = Vector3(BASEPLATE_SIZE, BASEPLATE_THICKNESS, BASEPLATE_SIZE)
	var collider := CollisionShape3D.new()
	collider.shape = box
	collider.position = Vector3(0.0, -BASEPLATE_THICKNESS * 0.5, 0.0)
	body.add_child(collider)
	add_child(body)

	return mesh_instance


func _build_sun() -> DirectionalLight3D:
	var light := DirectionalLight3D.new()
	light.name = "Sun"
	light.light_energy = 1.1
	light.shadow_enabled = true
	add_child(light)
	light.rotation_degrees = Vector3(-52.0, -38.0, 0.0)
	return light
