extends Node

# Paradise Reclaimed: service locator.
# Presenters reach transports as Services.http / Services.net, never by node path.

var http: Node
var net: Node

func _ready() -> void:
	http = preload("res://game/src/app/HttpService.gd").new()
	http.name = "http"
	add_child(http)

	net = preload("res://game/src/app/NetService.gd").new()
	net.name = "net"
	add_child(net)
