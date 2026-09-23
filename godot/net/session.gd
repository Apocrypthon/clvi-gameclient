extends Node
## The signed-in session, held in memory ONLY.
##
## "Do not save session login" is a requirement, so this file deliberately
## contains no persistence of any kind:
##
##   - no FileAccess, no ConfigFile, no JSON written anywhere
##   - nothing under user:// — not the token, not the player id, not a
##     "remember me" flag, not a last-username convenience
##   - no ProjectSettings or OS-level credential store
##
## Quitting, crashing, or closing the window loses the session, and the next
## launch starts at login. That is the intended behaviour, not a gap.
##
## Honest limit: GDScript Strings are immutable and garbage-collected, so
## clearing a reference (below) drops it but cannot scrub the bytes out of
## process memory. Not saving it is enforceable here; zeroing it is not.

signal opened(player_id: String)
signal closed(reason: String)

var _token := ""
var _player_id := ""
var _expires_at_unix := 0


func open(token: String, player_id: String, expires_at_unix: int) -> void:
	if token.is_empty() or player_id.is_empty():
		push_error("Session.open: refusing an empty token or player id.")
		return
	_token = token
	_player_id = player_id
	_expires_at_unix = expires_at_unix
	opened.emit(_player_id)


func is_active() -> bool:
	if _token.is_empty():
		return false
	if _expires_at_unix > 0 and Time.get_unix_time_from_system() >= float(_expires_at_unix):
		# Expired sessions are not "nearly valid" — drop it rather than letting
		# a stale token reach the backend.
		close("expired")
		return false
	return true


func player_id() -> String:
	return _player_id if is_active() else ""


## The header StrataClient attaches to every authenticated call. Returns "" when
## there is no live session, so callers cannot accidentally send "Bearer ".
func authorization_header() -> String:
	return ("Authorization: Bearer %s" % _token) if is_active() else ""


func close(reason := "signed out") -> void:
	if _token.is_empty() and _player_id.is_empty():
		return
	_token = ""
	_player_id = ""
	_expires_at_unix = 0
	closed.emit(reason)


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_EXIT_TREE:
		close("shutdown")
