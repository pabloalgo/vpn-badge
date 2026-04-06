UUID := vpn-badge@pabloalgo.dev
EXT_DIR := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SCHEMA_DIR := schemas
SCHEMA_XML := $(SCHEMA_DIR)/org.gnome.shell.extensions.vpn-badge.gschema.xml

.PHONY: all schema install dev uninstall clean

all: schema

schema:
	glib-compile-schemas $(SCHEMA_DIR)

install: schema
	mkdir -p "$(EXT_DIR)"
	cp extension.js metadata.json prefs.js README.md stylesheet.css "$(EXT_DIR)/"
	mkdir -p "$(EXT_DIR)/schemas"
	cp "$(SCHEMA_XML)" "$(EXT_DIR)/schemas/"
	glib-compile-schemas "$(EXT_DIR)/schemas"
	@echo "Installed to $(EXT_DIR)"
	@echo "Run: gnome-extensions enable $(UUID)"
	@echo "Then logout/login to activate."

dev: schema
	rm -rf "$(EXT_DIR)"
	mkdir -p "$(EXT_DIR)"
	ln -sf "$(CURDIR)/extension.js" "$(EXT_DIR)/extension.js"
	ln -sf "$(CURDIR)/metadata.json" "$(EXT_DIR)/metadata.json"
	ln -sf "$(CURDIR)/prefs.js" "$(EXT_DIR)/prefs.js"
	ln -sf "$(CURDIR)/README.md" "$(EXT_DIR)/README.md"
	ln -sf "$(CURDIR)/stylesheet.css" "$(EXT_DIR)/stylesheet.css"
	mkdir -p "$(EXT_DIR)/schemas"
	ln -sf "$(CURDIR)/$(SCHEMA_XML)" "$(EXT_DIR)/schemas/$(notdir $(SCHEMA_XML))"
	ln -sf "$(CURDIR)/$(SCHEMA_DIR)/gschemas.compiled" "$(EXT_DIR)/schemas/gschemas.compiled"
	@echo "Dev symlinks created in $(EXT_DIR)"
	@echo "Run: gnome-extensions enable $(UUID)"
	@echo "Then logout/login to activate."

uninstall:
	gnome-extensions disable $(UUID) 2>/dev/null || true
	rm -rf "$(EXT_DIR)"
	@echo "Uninstalled $(UUID)"

clean:
	rm -f "$(SCHEMA_DIR)/gschemas.compiled"
