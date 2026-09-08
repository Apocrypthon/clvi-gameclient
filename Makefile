# Paradise Reclaimed -- Godot 3.6.2 (GLES2) client.
# Target set mirrors clvi.cc/Makefile. Requires Godot 3.6.2 on PATH.
#
# NOTE: this tree is a Godot client living beside the TypeScript + Vite STRATA
# client. It does not participate in `npm run build`; see docs/GODOT-CLIENT.md.

GODOT ?= godot
PROJECT ?= Paradise Reclaimed
WEB_OUT ?= build/web

.PHONY: run check test export-web serve clean

run:
	"$(GODOT)" --path "$(PROJECT)"

check:
	"$(GODOT)" --path "$(PROJECT)" --no-window --quit

test:
	"$(GODOT)" --path "$(PROJECT)" --no-window --script res://tests/run_tests.gd

export-web:
	mkdir -p $(WEB_OUT)
	"$(GODOT)" --path "$(PROJECT)" --no-window --export "HTML5" \
	  "$(CURDIR)/$(WEB_OUT)/index.html"

serve:
	node web/index.js

clean:
	rm -rf $(WEB_OUT)
