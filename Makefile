.PHONY: help check release

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

check: ## Typecheck the extension
	npm install --no-save typescript @types/node @earendil-works/pi-coding-agent typebox
	npx tsc --noEmit --strict --skipLibCheck \
		--target es2022 --module nodenext --moduleResolution nodenext \
		extensions/index.ts

release: ## Bump version, commit, tag, and push (usage: make release VERSION=0.0.3)
ifndef VERSION
	$(error VERSION is required, e.g. make release VERSION=0.0.3)
endif
	@test -z "$$(git status --porcelain)" || { echo "working tree not clean" >&2; exit 1; }
	@git rev-parse "v$(VERSION)" >/dev/null 2>&1 && { echo "tag v$(VERSION) already exists" >&2; exit 1; } || true
	npm version $(VERSION) --no-git-tag-version
	git commit -am "feat: bump version $(VERSION)"
	git tag "v$(VERSION)"
	git push origin main --tags
	@echo "Release v$(VERSION) pushed — publish workflow will ship to npm."
