extends Node
## The signed-in session, held in memory ONLY.
##
## Identity per clvi-architecture ADR-002: a custodial Guardian account reached
## by Supabase email OTP, surfaced as a display id of the form GRD-xxxxxx. No
## crypto wallet, and no key material on the device.
##
## Note what is NOT here: a bearer token. The Strata backend
## (clvi-backend@claude/strata-ledger-bootstrap-csa88x) puts no auth on its
## endpoints — identity travels as `playerId` in the request body, and its CORS
## policy allows the `content-type` header only, so an Authorization header
## would be rejected before it was read. Holding a token here would be
## cargo-cult.
##
## "Do not save session login" is a requirement, so this file deliberately
## contains no persistence of any kind:
##
##   - no FileAccess, no ConfigFile, no JSON written anywhere
##   - nothing under user:// — not the player id, not the display id, not a
##     "remember me" flag, not a last-email convenience
##   - no ProjectSettings or OS-level credential store
##
## Quitting, crashing, or closing the window loses the session, and the next
## launch starts at login. That is the intended behaviour, not a gap.

signal opened(display_id: String)
signal closed(reason: String)

## Matches the backend's requireId(): 1-64 chars of [A-Za-z0-9_:.-].
const ID_PATTERN := "^[A-Za-z0-9_:.-]{1,64}$"

var _player_id := ""
var _display_id := ""
var _id_regex: RegEx


func _ready() -> void:
	_id_regex = RegEx.new()
	_id_regex.compile(ID_PATTERN)


## Called by the login flow once Supabase has verified the OTP.
func open(player_id: String, display_id: String) -> void:
	if _id_regex == null or _id_regex.search(player_id) == null:
		# Reject here rather than letting the backend 400 on it later.
		push_error("Session.open: player_id must be 1-64 chars of [A-Za-z0-9_:.-].")
		return
	_player_id = player_id
	_display_id = display_id
	opened.emit(_display_id)


func is_active() -> bool:
	return not _player_id.is_empty()


## The identity every player-scoped call carries in its BODY, not a header.
func player_id() -> String:
	return _player_id


## The user-visible handle, GRD-xxxxxx (Account.displayId in Contracts v1).
func display_id() -> String:
	return _display_id


func close(reason := "signed out") -> void:
	if _player_id.is_empty() and _display_id.is_empty():
		return
	_player_id = ""
	_display_id = ""
	closed.emit(reason)


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_EXIT_TREE:
		close("shutdown")
